// Turns a tool's raw text output into the playground's result headline.

export interface Summary {
  headline: string;
  detail?: string;
  /** Parsed JSON, when the text was JSON. */
  json?: unknown;
}

function parse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

interface BestPath {
  send?: string;
  best?: { receive?: string; route?: string; rate?: string } | null;
  note?: string;
}

interface AccountSummary {
  balances?: { asset?: string; balance?: string }[];
}

const trim = (amount: string) => {
  const n = Number(amount);
  return Number.isFinite(n) ? String(Number(n.toFixed(7))) : amount;
};

const assetCode = (asset: string) => asset.split(":")[0];

/** Headline and detail line for a tool result; anything unknown falls back to the raw text. */
export function summarize(tool: string, text: string): Summary {
  const json = parse(text);

  if (tool === "dex_best_path" && json && typeof json === "object") {
    const r = json as BestPath;
    if (r.best?.receive) {
      const to = r.best.route?.split(" → ").pop() ?? "";
      return {
        headline: `Receive ${trim(r.best.receive)} ${to}`.trim(),
        detail: `${r.send ?? ""} via ${r.best.route ?? "the DEX"}, at a rate of ${r.best.rate ?? "n/a"}.`.trim(),
        json,
      };
    }
    return { headline: "No swap path found", detail: r.note, json };
  }

  if (tool === "account_summary" && json && typeof json === "object") {
    const balances = (json as AccountSummary).balances ?? [];
    if (balances.length === 0) return { headline: "No balances", json };
    const parts = balances.map((b) => `${trim(b.balance ?? "0")} ${assetCode(b.asset ?? "")}`);
    return { headline: parts[0], detail: parts.length > 1 ? `Also ${parts.slice(1).join(", ")}.` : undefined, json };
  }

  if (tool === "ping") {
    const value = typeof json === "string" ? json : text.trim();
    return { headline: value || "pong", json };
  }

  if (typeof json === "string") return { headline: json };
  return { headline: text.length > 140 ? `${text.slice(0, 140)}…` : text, json };
}

/** Short label for a run in the sidebar and the activity table. */
export function runLabel(tool: string, args: Record<string, unknown>): string {
  if (tool === "dex_best_path" && args.from && args.to) return `Swap path, ${args.from} → ${args.to}`;
  if (tool === "account_summary") return "Account summary";
  if (tool === "ping") return "Ping";
  return tool;
}
