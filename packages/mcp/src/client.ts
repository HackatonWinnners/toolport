import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { x402Client, x402HTTPClient } from "@x402/core/client";
import type { PaymentRequired, SettleResponse } from "@x402/core/types";
import { x402MCPClient, type x402MCPToolCallResult } from "@x402/mcp";
import { createEd25519Signer } from "@x402/stellar";
import { ExactStellarScheme } from "@x402/stellar/exact/client";
import { AgentStore, verifySettlement, DEFAULT_NETWORK, formatUsd, fromUnits, networkInfo, toUnits, type PriceInput, type StellarNetwork } from "@stellarpay/core";

export interface SpendLimits { maxPerCall?: PriceInput; budget?: PriceInput; }

/** Client-side guardrail: per-call cap + session budget, in USDC base units. */
export class SpendGuard {
  readonly maxPerCall?: bigint;
  readonly budget?: bigint;
  spent = 0n;
  /** Amounts approved for in-flight calls, counted against the budget until they settle or fail */
  reserved = 0n;
  lastDenial?: string;

  constructor(limits: SpendLimits = {}) {
    this.maxPerCall = limits.maxPerCall !== undefined ? toUnits(limits.maxPerCall) : undefined;
    this.budget = limits.budget !== undefined ? toUnits(limits.budget) : undefined;
  }

  /** Returns a human-readable reason to refuse, or null to allow. */
  check(amount: bigint): string | null {
    if (this.maxPerCall !== undefined && amount > this.maxPerCall) {
      return `price ${formatUsd(amount)} exceeds per-call cap ${formatUsd(this.maxPerCall)}`;
    }
    if (this.budget !== undefined && this.spent + this.reserved + amount > this.budget) {
      const inFlight = this.reserved > 0n ? `, ${formatUsd(this.reserved)} in flight` : "";
      return `price ${formatUsd(amount)} would exceed session budget (${formatUsd(this.spent)} of ${formatUsd(this.budget)} spent${inFlight})`;
    }
    return null;
  }

  /** Check and hold `amount` for an in-flight call, so concurrent calls can't overshoot the budget together. */
  reserve(amount: bigint): string | null {
    const reason = this.check(amount);
    if (!reason) this.reserved += amount;
    return reason;
  }

  /** Release a reservation; count it as spent if the payment settled. */
  release(amount: bigint, settled: boolean) {
    this.reserved -= amount;
    if (settled) this.spent += amount;
  }

  record(amount: bigint) {
    this.spent += amount;
  }

  remaining(): bigint | undefined {
    return this.budget === undefined ? undefined : this.budget - this.spent;
  }
}

export class PaymentRefusedError extends Error {
  constructor(readonly reason: string) {
    super(`Payment refused: ${reason}`);
  }
}

export interface PaymentRecord {
  tool: string;
  amount: bigint;
  settlement: SettleResponse;
}

export interface StellarPayClientOptions extends SpendLimits {
  secretKey: string;
  network?: StellarNetwork;
  rpcUrl?: string;
  clientInfo?: { name: string; version: string };
  guard?: SpendGuard;
  /** Shared by clients using the same wallet/network/session. Caller owns its lifecycle. */
  store?: AgentStore;
  fetcher?: typeof fetch;
  /** Check successful transaction, USDC contract, payer, recipient and amount over RPC. */
  verifyReceipts?: boolean;
  onPayment?: (record: PaymentRecord) => void;
}
export interface PaymentCallOptions {
  /** Stable operation identity supplied by the durable router, not a payment signature. */
  id?: string;
  maxPerCall?: PriceInput;
  payTo?: string;
}
export class PaymentUnknownError extends Error {
  readonly paid = "unknown";
  constructor(readonly reservationId: string, cause?: unknown, readonly receipt?: SettleResponse) {
    super(`Payment outcome is unknown; reservation ${reservationId} remains held. Retrieve the original run; do not automatically buy again.`, { cause });
  }
}
export class PaidResponseError extends Error {
  readonly paid = "settled";
  constructor(readonly settlement: SettleResponse, cause: unknown) { super("Payment settled, but reading the provider response failed", { cause }); }
}
interface CallState {
  id: string; max?: bigint; payTo?: string; amount?: bigint; authorized: boolean; denial?: string; receipt?: SettleResponse;
}
export interface PaidHttpResult {
  kind: "http"; status: number; body: unknown; paymentMade: boolean; paymentResponse?: SettleResponse;
}

/** One USDC payment policy and spend lifecycle shared by MCP and HTTP transports. */
export class StellarPayClient {
  readonly mcp: x402MCPClient;
  readonly guard: SpendGuard;
  readonly address: string;
  readonly network: StellarNetwork;
  private calls = new AsyncLocalStorage<CallState>();
  private payments: x402Client;
  private http: x402HTTPClient;

  constructor(private readonly options: StellarPayClientOptions) {
    this.network = options.network ?? DEFAULT_NETWORK;
    this.guard = options.guard ?? new SpendGuard(options);
    const signer = createEd25519Signer(options.secretKey, this.network);
    this.address = signer.address;
    if (options.store && (options.store.network !== this.network || options.store.payer !== this.address)) throw new Error("Spend store belongs to a different wallet/network");
    const usdc = networkInfo(this.network).usdcContract;
    if (options.verifyReceipts && !(options.rpcUrl ?? networkInfo(this.network).rpcUrl)) throw new Error("Receipt verification on mainnet requires rpcUrl");
    this.payments = new x402Client().register(this.network, new ExactStellarScheme(signer, options.rpcUrl || networkInfo(this.network).rpcUrl ? { url: (options.rpcUrl ?? networkInfo(this.network).rpcUrl)! } : undefined));
    this.payments.setSpendControls({ allowedAssets: [{ network: this.network, asset: usdc }] });
    this.payments.registerPolicy((version, requirements) => requirements.filter((r) =>
      version === 2 && r.scheme === "exact" && r.network === this.network && r.asset === usdc && (!this.calls.getStore()?.payTo || r.payTo === this.calls.getStore()!.payTo)));
    this.payments.onBeforePaymentCreation(async ({ selectedRequirements }) => {
      const call = this.calls.getStore();
      if (!call) return { abort: true, reason: "Use StellarPayClient.callTool/callHttp to apply spend controls" };
      if (call.amount !== undefined) return { abort: true, reason: "A payment was already approved for this call; automatic repurchase is disabled" };
      const amount = BigInt(selectedRequirements.amount);
      call.payTo = selectedRequirements.payTo;
      const reason = amount <= 0n ? "Invalid payment amount" : (call.max !== undefined && amount > call.max ? "Price exceeds explicit per-call cap" : this.guard.check(amount))
        ?? (this.options.store ? await this.options.store.reserve(call.id, amount, call.max) : null);
      if (reason) { call.denial = reason; return { abort: true, reason }; }
      this.guard.reserve(amount);
      call.amount = amount;
    });
    this.payments.onAfterPaymentCreation(async () => {
      const call = this.calls.getStore()!;
      // Persist the hold before control returns to a transport that can submit the proof.
      call.authorized = true;
      await this.options.store?.resolve(call.id, "unknown");
    });
    this.http = new x402HTTPClient(this.payments);
    this.mcp = new x402MCPClient(new Client(options.clientInfo ?? { name: "stellarpay-client", version: "0.1.0" }), this.payments, {
      autoPayment: true,
      maxRequestTimeoutSeconds: 120,
      onPaymentRequested: ({ paymentRequired }) => {
        const valid = paymentRequired.accepts.some((a) => a.network === this.network && a.asset === usdc && a.scheme === "exact");
        if (!valid) this.calls.getStore()!.denial = "No exact USDC payment option on " + this.network;
        return valid;
      },
    });
  }
  get client() { return this.mcp.client; }
  async connect(url: string | URL, headers?: Record<string, string>) {
    await this.mcp.connect(new StreamableHTTPClientTransport(new URL(url), {
      requestInit: headers ? { headers } : undefined,
      fetch: (url, init) => (this.options.fetcher ?? fetch)(url, { ...init, redirect: "error", signal: init?.signal ?? AbortSignal.timeout(120_000) }),
    }));
  }
  listTools() { return this.mcp.listTools(); }
  callTool(name: string, args: Record<string, unknown> = {}, options: PaymentCallOptions = {}): Promise<x402MCPToolCallResult> {
    return this.runPayment(name, options, () => this.mcp.callTool(name, args, { timeout: 120_000 }));
  }
  /** Bare MCP quote: does not create or transmit a payment. Only use for provider-declared paid tools. */
  async quoteTool(name: string, args: Record<string, unknown> = {}) {
    const result = await this.client.callTool({ name, arguments: args }, undefined, { timeout: 45_000 });
    const required = result.structuredContent as unknown as PaymentRequired | undefined;
    if (!result.isError || !Array.isArray(required?.accepts)) throw new Error("Provider did not return a payment challenge; use tools/list for free-tool metadata");
    return required;
  }
  decodeHttpQuote(response: Response): PaymentRequired {
    return this.http.getPaymentRequiredResponse((name) => response.headers.get(name));
  }
  callHttp(url: string, init: RequestInit, options: PaymentCallOptions = {}, fetcher: typeof fetch = fetch): Promise<PaidHttpResult> {
    return this.runPayment(url, options, async () => {
      const send = (paymentHeaders?: Record<string, string>) => {
        const headers = new Headers(init.headers);
        for (const [name,value] of Object.entries(paymentHeaders ?? {})) headers.set(name,value);
        return fetcher(url, { ...init, headers, redirect: "error", signal: AbortSignal.timeout(120_000) });
      };
      let response = await send();
      let paymentMade = false;
      if (response.status === 402) {
        const required = this.decodeHttpQuote(response);
        await response.body?.cancel();
        const payload = await this.http.createPaymentPayload(required);
        paymentMade = true;
        response = await send(this.http.encodePaymentSignatureHeader(payload));
      }
      let paymentResponse: SettleResponse | undefined;
      if (paymentMade) {
        try { paymentResponse = this.http.getPaymentSettleResponse((name) => response.headers.get(name)); } catch { /* missing/invalid receipt: keep the hold */ }
        this.calls.getStore()!.receipt = paymentResponse;
      }
      const body = await readResponse(response);
      return { kind: "http", status: response.status, body, paymentMade, paymentResponse };
    });
  }
  private async runPayment<T extends { paymentMade: boolean; paymentResponse?: SettleResponse }>(tool: string, options: PaymentCallOptions, execute: () => Promise<T>): Promise<T> {
    const call: CallState = { id: options.id ?? randomUUID(), max: options.maxPerCall !== undefined ? toUnits(options.maxPerCall) : undefined, payTo: options.payTo, authorized: false };
    if (call.max !== undefined && call.max <= 0n) throw new Error("Per-call cap must be positive");
    let result: T | undefined, failure: unknown;
    try { result = await this.calls.run(call, execute); } catch (error) { failure = error; }
    const receipt = result?.paymentResponse ?? call.receipt;
    // The facilitator says it settled. On-chain verification can lag behind it, so a failed
    // check means "unverified", not "unpaid": the hold stays, but a paid result is never dropped.
    const claimed = !!(receipt?.success && receipt.network === this.network && receipt.transaction && (!receipt.payer || receipt.payer === this.address));
    let verifiedOnChain = false;
    if (claimed && this.options.verifyReceipts && call.amount !== undefined && call.payTo) {
      try {
        verifiedOnChain = await verifySettlement(receipt!.transaction, (this.options.rpcUrl ?? networkInfo(this.network).rpcUrl)!, {
          network: this.network,
          payer: this.address,
          payTo: call.payTo,
          amount: call.amount,
        });
      } catch {
        verifiedOnChain = false;
      }
    }
    const settled = claimed && (verifiedOnChain || !this.options.verifyReceipts);
    if (call.amount !== undefined) {
      if (settled) {
        await this.options.store?.resolve(call.id, "settled", receipt!.transaction);
        this.guard.release(call.amount, true);
        // Observability callbacks must not turn a settled payment into a retryable failure.
        try { this.options.onPayment?.({ tool, amount: call.amount, settlement: receipt! }); } catch { /* already accounted */ }
      } else if (!call.authorized) {
        await this.options.store?.resolve(call.id, "released");
        this.guard.release(call.amount, false);
      } else {
        // Keep the hold, with the claimed transaction so `stellarpay budget --reconcile` can settle it later.
        await this.options.store?.resolve(call.id, "unknown", receipt?.transaction);
        if (failure || !claimed) throw new PaymentUnknownError(call.id, failure, receipt);
      }
    }
    if (failure) {
      if (call.denial) throw new PaymentRefusedError(call.denial);
      if (settled) throw new PaidResponseError(receipt!, failure);
      throw failure;
    }
    const paymentState = call.amount === undefined ? "none" : settled ? "settled" : "unverified";
    return Object.assign(result!, { verifiedOnChain, paymentState, reservationId: call.id, amountUnits: call.amount });
  }
  async budget() {
    return this.options.store?.budget() ?? { asset: "USDC", spent: fromUnits(this.guard.spent), pending: fromUnits(this.guard.reserved), remaining: this.guard.remaining() === undefined ? null : fromUnits(this.guard.remaining()! - this.guard.reserved) };
  }
  close() { return this.mcp.close(); }
}

/** Bound provider output before buffering/parsing; a paid read failure is still a paid outcome. */
export async function readResponse(response: Response, maxBytes = 1_000_000): Promise<unknown> {
  if (!response.body) return null;
  const reader = response.body.getReader(), chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maxBytes) { await reader.cancel(); throw new Error("Provider response exceeds 1 MB"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const text = Buffer.concat(chunks).toString("utf8");
  try { return JSON.parse(text); } catch { return text; }
}
