import { sql } from "drizzle-orm";
import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const servers = sqliteTable("servers", {
  id: text("id").primaryKey(),
  owner: text("owner").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  upstreamUrl: text("upstream_url").notNull(),
  payTo: text("pay_to").notNull(),
  network: text("network").notNull(),
  listed: integer("listed", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
});

export const tools = sqliteTable(
  "tools",
  {
    serverId: text("server_id")
      .notNull()
      .references(() => servers.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    inputSchema: text("input_schema", { mode: "json" }).$type<Record<string, unknown>>(),
    /** USDC base units (7 decimals) as a decimal string; "0" = free */
    priceUnits: text("price_units").notNull().default("0"),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  },
  (t) => [primaryKey({ columns: [t.serverId, t.name] })],
);

export const paymentClaims = sqliteTable("payment_claims", {
  id: text("id").primaryKey(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
});

export const callStatuses = ["free", "paid", "verify_failed", "tool_failed", "settle_failed", "payment_unknown"] as const;
export type CallStatus = (typeof callStatuses)[number];

export const calls = sqliteTable(
  "calls",
  {
    id: text("id").primaryKey(),
    serverId: text("server_id")
      .notNull()
      .references(() => servers.id, { onDelete: "cascade" }),
    tool: text("tool").notNull(),
    payer: text("payer"),
    amountUnits: text("amount_units").notNull().default("0"),
    status: text("status").$type<CallStatus>().notNull(),
    txHash: text("tx_hash"),
    error: text("error"),
    latencyMs: integer("latency_ms").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
  },
  (t) => [index("calls_server_created").on(t.serverId, t.createdAt)],
);

export type ServerRow = typeof servers.$inferSelect;
export type ToolRow = typeof tools.$inferSelect;
export type CallRow = typeof calls.$inferSelect;
