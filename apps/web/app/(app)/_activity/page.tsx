"use client";

import Link from "next/link";
import { StatusDot } from "@/components/brand/StatusDot";
import { DOT, runMeta } from "@/components/playground/RunsAside";
import { txUrl } from "@/lib/api";
import { useAgent } from "@/lib/agent";
import { usdc } from "@/lib/buyer";
import { runLabel } from "@/lib/result";

const time = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

export default function ActivityPage() {
  const { budget } = useAgent();
  const runs = budget?.runs ?? [];
  const paid = runs.filter((r) => r.status === "paid");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-semibold tracking-[-0.04em]">Activity</h1>
          <p className="mt-1 text-sm text-muted">
            Runs from this browser. Every paid call links to its USDC transaction on Stellar.
          </p>
        </div>
        {budget && (
          <p className="font-mono text-[13px] text-fg-soft">
            {paid.length} paid · {usdc(budget.spentUnits)} spent of {usdc(budget.capUnits)}
          </p>
        )}
      </div>

      {budget && runs.length === 0 ? (
        <div className="rounded-2xl border border-line bg-panel p-8 text-center">
          <p className="text-fg-soft">No runs yet.</p>
          <Link href="/#connect" className="mt-2 inline-block text-sm text-accent hover:text-fg">
            Connect your agent
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-panel">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-line text-xs text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">When</th>
                <th className="px-4 py-3 font-medium">Run</th>
                <th className="px-4 py-3 font-medium">Tool</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Transaction</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {runs.map((run) => (
                <tr key={run.id} data-testid="activity-row">
                  <td className="whitespace-nowrap px-4 py-3 text-muted">{time(run.at)}</td>
                  <td className="px-4 py-3">{runLabel(run.tool, run.args)}</td>
                  <td className="px-4 py-3">
                    <code className="font-mono text-[13px]">{run.tool}</code>
                    {run.server && <span className="block text-xs text-muted">{run.server}</span>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className="inline-flex items-center gap-2 font-mono text-xs">
                      <StatusDot status={DOT[run.status]} />
                      {runMeta(run)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {run.tx ? (
                      <a href={txUrl(run.tx)} target="_blank" rel="noreferrer" className="font-mono text-xs text-accent hover:text-fg">
                        {run.tx.slice(0, 8)}…{run.tx.slice(-6)} ↗
                      </a>
                    ) : (
                      <span className="text-xs text-faint">none</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
