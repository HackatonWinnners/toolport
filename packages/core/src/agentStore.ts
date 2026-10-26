import { chmod } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createHash, randomUUID } from "node:crypto";
import type { Client } from "@libsql/client";
import { fromUnits, toUnits, type PriceInput } from "./units.js";
import type { StellarNetwork } from "./constants.js";

export type PaymentState = "reserved" | "unknown" | "settled" | "released";
export interface AgentRun {
  id: string; toolId: string; status: string; createdAt: string; updatedAt: string;
  result: unknown; error: unknown;
}
const encode = (value: unknown) => JSON.stringify(value, (_, v) => typeof v === "bigint" ? v.toString() : v);
export function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, canonical(v)]));
  return value;
}
export const fingerprint = (value: unknown) => createHash("sha256").update(encode(canonical(value))).digest("hex");

/** Persistent, wallet/network/session-scoped spend reservations and request results. No wallet secrets. */
export class AgentStore {
  private constructor(private readonly db: Client, readonly scope: string, readonly perCall: bigint, readonly cap: bigint, readonly network: StellarNetwork, readonly payer: string) {}

  static async open(options: { url: string; authToken?: string; network: StellarNetwork; payer: string; session?: string; maxPerCall: PriceInput; budget: PriceInput; keepStoredBudget?: boolean; keepStoredPerCall?: boolean }) {
    const local = options.url === ":memory:" || options.url.startsWith("file:");
    const { createClient } = local ? await import("@libsql/client") : await import("@libsql/client/web");
    const db = createClient({ url: options.url, authToken: options.authToken, ...(local ? {} : { fetch: async (request: Request) => {
      const headers:Record<string,string> = {}; request.headers.forEach((v,k)=>{headers[k]=v;});
      return fetch(request.url,{method:request.method,headers,body:request.method==="GET"||request.method==="HEAD"?undefined:await request.arrayBuffer()});
    } }) });
    let cap = toUnits(options.budget), perCall = toUnits(options.maxPerCall);
    if (cap <= 0n || perCall <= 0n || cap > BigInt(Number.MAX_SAFE_INTEGER) || perCall > BigInt(Number.MAX_SAFE_INTEGER)) { db.close(); throw new Error("Budget and per-call cap must be positive and at most 900719925.4740991 USDC"); }
    const scope = fingerprint({ network: options.network, payer: options.payer, session: options.session ?? "default" });
    try {
      if (local) await db.execute("PRAGMA busy_timeout=5000");
      await db.executeMultiple(`
        CREATE TABLE IF NOT EXISTS agent_budgets (scope TEXT PRIMARY KEY, cap TEXT NOT NULL, per_call TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS agent_reservations (scope TEXT NOT NULL, id TEXT NOT NULL, amount TEXT NOT NULL, state TEXT NOT NULL, transaction_hash TEXT, PRIMARY KEY(scope,id));
        CREATE TABLE IF NOT EXISTS agent_runs (scope TEXT NOT NULL, request_key TEXT NOT NULL, fingerprint TEXT NOT NULL, id TEXT NOT NULL, tool_id TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, result TEXT, error TEXT, PRIMARY KEY(scope,request_key), UNIQUE(scope,id));
      `);
      await db.execute({ sql: "INSERT INTO agent_budgets VALUES (?,?,?) ON CONFLICT DO NOTHING", args: [scope, cap.toString(), perCall.toString()] });
      const row = (await db.execute({ sql: "SELECT * FROM agent_budgets WHERE scope=?", args: [scope] })).rows[0];
      // New limits apply from now on; spent and pending amounts in this session are kept, never reset.
      if (options.keepStoredBudget) cap = BigInt(String(row.cap));
      if (options.keepStoredPerCall) perCall = BigInt(String(row.per_call));
      if (row.cap !== cap.toString() || row.per_call !== perCall.toString()) {
        await db.execute({ sql: "UPDATE agent_budgets SET cap=?, per_call=? WHERE scope=?", args: [cap.toString(), perCall.toString(), scope] });
      }
      if (options.url.startsWith("file:")) await chmod(options.url.startsWith("file://") ? fileURLToPath(options.url) : decodeURIComponent(options.url.slice(5)), 0o600);
      return new AgentStore(db, scope, perCall, cap, options.network, options.payer);
    } catch (error) { db.close(); throw error; }
  }

  async reserve(id: string, amount: bigint, callCap?: bigint): Promise<string | null> {
    if (amount <= 0n) return "Invalid payment amount";
    if (amount > this.perCall || (callCap !== undefined && amount > callCap)) return `Price ${fromUnits(amount)} USDC exceeds the per-call cap`;
    // One conditional INSERT is the reservation transaction. No read/check/write race and no
    // interactive SQLite transaction that could block the event loop while another client waits.
    const inserted = await this.db.execute({
      sql: `INSERT INTO agent_reservations(scope,id,amount,state)
        SELECT ?,?,?,'reserved' WHERE CAST(? AS INTEGER) <=
        MIN(CAST((SELECT cap FROM agent_budgets WHERE scope=?) AS INTEGER), CAST(? AS INTEGER)) -
        COALESCE((SELECT SUM(CAST(amount AS INTEGER)) FROM agent_reservations WHERE scope=? AND state!='released'),0)
        AND CAST(? AS INTEGER) <= CAST((SELECT per_call FROM agent_budgets WHERE scope=?) AS INTEGER)
        ON CONFLICT(scope,id) DO NOTHING`,
      args: [this.scope,id,amount.toString(),amount.toString(),this.scope,this.cap.toString(),this.scope,amount.toString(),this.scope],
    });
    if (inserted.rowsAffected === 1) return null;
    const existing = await this.db.execute({sql:"SELECT id FROM agent_reservations WHERE scope=? AND id=?",args:[this.scope,id]});
    if (existing.rows.length) return "Reservation already exists; retrieve the original run instead of paying again";
    if (amount > (await this.effectiveLimits()).perCall) return `Price ${fromUnits(amount)} USDC exceeds the per-call cap`;
    return "Price would exceed the persistent session budget (including pending payments)";
  }

  /** Unknown authorizations remain held across crashes/restarts; there is deliberately no automatic expiry. */
  async resolve(id: string, state: Exclude<PaymentState, "reserved">, transaction?: string) {
    // unknown → unknown lets a later step attach the claimed transaction to an existing hold.
    const permitted = state === "released" ? ["reserved"] : ["reserved", "unknown"];
    await this.db.execute({
      sql: `UPDATE agent_reservations SET state=?,transaction_hash=COALESCE(?,transaction_hash) WHERE scope=? AND id=? AND state IN (${permitted.map(() => "?").join(",")})`,
      args: [state, transaction ?? null, this.scope, id, ...permitted],
    });
  }

  async budget() {
    const rows = (await this.db.execute({ sql: "SELECT amount,state FROM agent_reservations WHERE scope=?", args: [this.scope] })).rows;
    const sum = (states: string[]) => rows.filter((r) => states.includes(String(r.state))).reduce((n, r) => n + BigInt(String(r.amount)), 0n);
    const spent = sum(["settled"]), pending = sum(["reserved", "unknown"]);
    const { cap, perCall } = await this.effectiveLimits();
    return { scope: this.scope, asset: "USDC", cap: fromUnits(cap), perCall: fromUnits(perCall), spent: fromUnits(spent), pending: fromUnits(pending), remaining: fromUnits(cap - spent - pending) };
  }

  private async effectiveLimits() {
    const row = (await this.db.execute({ sql: "SELECT cap,per_call FROM agent_budgets WHERE scope=?", args: [this.scope] })).rows[0];
    const lower = (stored: unknown, own: bigint) => (row && BigInt(String(stored)) < own ? BigInt(String(stored)) : own);
    return { cap: lower(row?.cap, this.cap), perCall: lower(row?.per_call, this.perCall) };
  }

  /** Holds whose outcome is not known yet (reserved = in flight, unknown = authorized but unconfirmed). */
  async holds(): Promise<{ id: string; amount: string; state: string; transaction: string | null }[]> {
    const rows = (await this.db.execute({ sql: "SELECT id,amount,state,transaction_hash FROM agent_reservations WHERE scope=? AND state IN ('reserved','unknown')", args: [this.scope] })).rows;
    return rows.map((r) => ({ id: String(r.id), amount: fromUnits(String(r.amount)), state: String(r.state), transaction: r.transaction_hash ? String(r.transaction_hash) : null }));
  }

  /**
   * Settle unknown holds whose claimed transaction verifies on-chain. Holds without a transaction stay:
   * nothing proves the payment didn't happen, so only an explicit `release` frees them.
   */
  async reconcile(verify: (transaction: string, amount: bigint) => Promise<boolean>) {
    const settled: string[] = [];
    for (const hold of await this.holds()) {
      if (hold.state !== "unknown" || !hold.transaction) continue;
      if (await verify(hold.transaction, toUnits(hold.amount))) {
        await this.resolve(hold.id, "settled", hold.transaction);
        settled.push(hold.id);
      }
    }
    return settled;
  }

  /** Operator decision: treat an unknown hold as unpaid (e.g. after checking the wallet's history). */
  async release(id: string): Promise<boolean> {
    const updated = await this.db.execute({ sql: "UPDATE agent_reservations SET state='released' WHERE scope=? AND id=? AND state IN ('reserved','unknown')", args: [this.scope, id] });
    return updated.rowsAffected === 1;
  }

  async claimRun(key: string, request: unknown, toolId: string): Promise<{ fresh: boolean; run: AgentRun }> {
    const hash = fingerprint(request), id = randomUUID(), now = new Date().toISOString();
    const inserted = await this.db.execute({ sql: "INSERT INTO agent_runs(scope,request_key,fingerprint,id,tool_id,status,created_at,updated_at) VALUES (?,?,?,?,?,'running',?,?) ON CONFLICT(scope,request_key) DO NOTHING", args: [this.scope, key, hash, id, toolId, now, now] });
    const row = (await this.db.execute({ sql: "SELECT * FROM agent_runs WHERE scope=? AND request_key=?", args: [this.scope, key] })).rows[0];
    if (row.fingerprint !== hash) throw new Error("Idempotency conflict: this key belongs to a different request");
    return { fresh: inserted.rowsAffected === 1, run: this.decode(row) };
  }

  async finishRun(id: string, status: string, result: unknown, error: unknown = null) {
    await this.db.execute({ sql: "UPDATE agent_runs SET status=?,result=?,error=?,updated_at=? WHERE scope=? AND id=?", args: [status, encode(result), encode(error), new Date().toISOString(), this.scope, id] });
    return this.getRun(id);
  }
  async getRun(id: string): Promise<AgentRun> {
    const row = (await this.db.execute({ sql: "SELECT * FROM agent_runs WHERE scope=? AND id=?", args: [this.scope, id] })).rows[0];
    if (!row) throw new Error("Run not found in this wallet/session");
    return this.decode(row);
  }
  private decode(row: Record<string, unknown>): AgentRun {
    return { id: String(row.id), toolId: String(row.tool_id), status: String(row.status), createdAt: String(row.created_at), updatedAt: String(row.updated_at), result: row.result ? JSON.parse(String(row.result)) : null, error: row.error ? JSON.parse(String(row.error)) : null };
  }
  close() { this.db.close(); }
}
