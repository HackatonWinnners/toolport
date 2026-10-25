import type { Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema.js";

export type Db = ReturnType<typeof drizzleDb>;

const drizzleDb = (client: Client) => drizzle(client, { schema });

/**
 * Local files and :memory: use the native SQLite client; remote URLs (Turso) use the pure-JS one,
 * so serverless bundles never need the native binary.
 */
export async function createDb(url: string, authToken?: string): Promise<Db> {
  if (url === ":memory:" || url.startsWith("file:")) {
    const { createClient } = await import("@libsql/client");
    return drizzleDb(createClient({ url, authToken }));
  }
  const { createClient } = await import("@libsql/client/web");
  return drizzleDb(createClient({ url, authToken, fetch: plainFetch }));
}

/**
 * libsql hands fetch a Request built from the classes it captured at load time. Runtimes that
 * patch fetch (Vercel does) can drop that Request's headers, auth included, so Turso answers 401.
 * Pass the parts as plain values instead.
 */
async function plainFetch(request: Request): Promise<Response> {
  const body = request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer();
  const headers: Record<string, string> = {};
  request.headers.forEach((value, name) => (headers[name] = value));
  return fetch(request.url, { method: request.method, headers, body });
}

/** Idempotent schema setup, so a fresh checkout runs without a migration step. */
export async function migrate(db: Db) {
  const statements = [
    `CREATE TABLE IF NOT EXISTS payment_claims (id TEXT PRIMARY KEY, expires_at INTEGER NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS servers (
      id TEXT PRIMARY KEY,
      owner TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      upstream_url TEXT NOT NULL,
      pay_to TEXT NOT NULL,
      network TEXT NOT NULL,
      listed INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    )`,
    `CREATE TABLE IF NOT EXISTS tools (
      server_id TEXT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      input_schema TEXT,
      price_units TEXT NOT NULL DEFAULT '0',
      enabled INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY (server_id, name)
    )`,
    `CREATE TABLE IF NOT EXISTS calls (
      id TEXT PRIMARY KEY,
      server_id TEXT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
      tool TEXT NOT NULL,
      payer TEXT,
      amount_units TEXT NOT NULL DEFAULT '0',
      status TEXT NOT NULL,
      tx_hash TEXT,
      error TEXT,
      latency_ms INTEGER NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    )`,
    `CREATE INDEX IF NOT EXISTS calls_server_created ON calls (server_id, created_at)`,
  ];
  for (const statement of statements) await db.run(statement);
}

export { schema };
