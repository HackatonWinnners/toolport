"use client";

import { useState } from "react";
import { StatusDot, type DotStatus } from "@/components/brand/StatusDot";
import { routerConfig } from "@/lib/api";
import { usdc, type Run } from "@/lib/buyer";
import { runLabel } from "@/lib/result";

export const DOT: Record<Run["status"], DotStatus> = { paid: "settled", free: "free", refused: "refused", failed: "failed" };

/** "$0.02 · settled", as the sidebar and activity table show a run. */
export function runMeta(run: Run): string {
  const word = { paid: "settled", free: "free", refused: "refused, nothing signed", failed: "failed" }[run.status];
  return `${run.status === "paid" ? usdc(run.amountUnits) : "$0"} · ${word}`;
}

const isToday = (iso: string) => new Date(iso).toDateString() === new Date().toDateString();

export function RunsAside({
  runs,
  activeId,
  onNew,
  onPick,
}: {
  runs: Run[];
  activeId: string | null;
  onNew(): void;
  onPick(run: Run): void;
}) {
  const today = runs.filter((r) => isToday(r.at));
  return (
    <aside
      aria-label="Runs"
      className="order-last flex min-w-0 flex-col gap-[18px] rounded-2xl border border-line bg-sunken px-4 py-5 lg:order-none lg:sticky lg:top-6 lg:min-h-[calc(100vh-140px)] lg:self-start"
    >
      <button
        type="button"
        onClick={onNew}
        className="flex h-11 items-center justify-center gap-2 rounded-xl border border-line-strong bg-panel font-medium hover:border-line-hover"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
          <path d="M8 3v10M3 8h10" />
        </svg>
        New run
      </button>

      <div className="flex flex-col gap-0.5">
        <h2 className="mb-1.5 px-2.5 text-xs font-medium text-muted">Today</h2>
        {today.length === 0 && <p className="px-2.5 text-[12.5px] text-faint">No runs yet. Your runs stay in this browser.</p>}
        {today.slice(0, 8).map((run) => (
          <button
            key={run.id}
            type="button"
            data-testid="run-item"
            aria-current={run.id === activeId ? "true" : undefined}
            onClick={() => onPick(run)}
            className={`flex flex-col gap-[3px] rounded-[10px] p-2.5 text-left ${run.id === activeId ? "bg-selected" : "hover:bg-raised"}`}
          >
            <span className="flex items-center gap-2">
              <StatusDot status={DOT[run.status]} />
              <span className="truncate">{runLabel(run.tool, run.args)}</span>
            </span>
            <span className={`pl-[17px] font-mono text-xs ${run.status === "failed" ? "text-bad" : "text-muted"}`}>{runMeta(run)}</span>
          </button>
        ))}
      </div>

      <AgentConfig />
    </aside>
  );
}

function AgentConfig() {
  const config = routerConfig();
  const [copied, setCopied] = useState(false);
  return (
    <section className="mt-auto flex flex-col gap-2.5 rounded-2xl border border-line bg-panel p-4">
      <h2 className="text-base font-semibold tracking-[-0.025em]">Give it to your agent</h2>
      <p className="text-[12.5px] leading-normal text-muted">Paste into Claude Desktop&apos;s config. Same catalog, same limits.</p>
      <pre className="max-h-56 overflow-auto rounded-[10px] bg-ink p-3 font-mono text-[11px] leading-relaxed text-[#E4E0D6]">{config}</pre>
      <button
        type="button"
        data-testid="copy-config"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(config);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            // clipboard blocked: the config is still selectable above
          }
        }}
        className="h-9 rounded-[10px] border border-line-strong text-[13px] hover:bg-raised"
      >
        {copied ? "Copied" : "Copy config"}
      </button>
    </section>
  );
}
