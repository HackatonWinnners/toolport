"use client";

import { StatusDot } from "@/components/brand/StatusDot";
import { txUrl } from "@/lib/api";
import { usdc, type Run } from "@/lib/buyer";
import { summarize } from "@/lib/result";
import { DOT } from "./RunsAside";

export interface Attempt {
  paid: boolean;
  startedAt: number;
  endedAt?: number;
  quoted: boolean;
  signed: boolean;
  settled: boolean;
  ran: boolean;
}

export function Progress({ attempt, now }: { attempt: Attempt; now: number }) {
  const steps = attempt.paid
    ? [
        { label: "Quote", done: attempt.quoted },
        { label: "Signed in Freighter", done: attempt.signed },
        { label: "Verified", done: attempt.settled },
        { label: "Ran tool", done: attempt.settled },
        { label: "Settled on Stellar", done: attempt.settled },
      ]
    : [{ label: "Ran tool", done: attempt.ran }];
  const seconds = ((attempt.endedAt ?? now) - attempt.startedAt) / 1000;
  const current = steps.findIndex((s) => !s.done);
  return (
    <ol aria-label="Payment progress" className="m-0 flex list-none flex-wrap gap-x-[18px] gap-y-1.5 px-1 text-[12.5px] text-muted">
      {steps.map((step, i) => (
        <li
          key={step.label}
          data-testid="progress-step"
          data-done={step.done ? "true" : "false"}
          aria-current={i === current && !attempt.endedAt ? "step" : undefined}
          className={`flex items-center gap-1.5 ${step.done ? "" : i === current && !attempt.endedAt ? "text-fg" : "text-faint"}`}
        >
          {step.done ? (
            <span className="text-good" aria-hidden="true">
              ✓
            </span>
          ) : i === current && !attempt.endedAt ? (
            <span aria-hidden="true" className="h-2 w-2 animate-pulse rounded-full bg-held" />
          ) : (
            <span aria-hidden="true" className="h-2 w-2 rounded-full border border-line-strong" />
          )}
          {step.label}
          <span className="sr-only">{step.done ? " (done)" : " (pending)"}</span>
        </li>
      ))}
      <li className="ml-auto font-mono" aria-label="Elapsed">
        {seconds.toFixed(1)} s
      </li>
    </ol>
  );
}

function pretty(text: string) {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

export function ResultCard({ run, server }: { run: Run; server?: string }) {
  const ok = run.status === "paid" || run.status === "free";
  const summary = ok
    ? summarize(run.tool, run.text)
    : run.status === "refused"
      ? { headline: "Refused before signing", detail: `${run.text}. Raise the budget to continue.` }
      : { headline: "The call failed", detail: run.text.length > 240 ? `${run.text.slice(0, 240)}…` : run.text };

  return (
    <article data-testid="result-card" aria-label="Result" className="overflow-hidden rounded-[20px] border border-line bg-raised">
      <div className="flex flex-col gap-2 px-[22px] pb-[18px] pt-[22px]">
        <span className="text-xs uppercase tracking-[0.08em] text-muted">Result</span>
        <p
          data-testid="result-headline"
          className={`break-words text-[26px] font-semibold leading-[1.15] tracking-[-0.045em] sm:text-[32px] ${run.status === "failed" ? "text-bad" : ""}`}
        >
          {summary.headline}
        </p>
        {summary.detail && <p className="break-words text-[15px] text-fg-soft">{summary.detail}</p>}
        {ok && (
          <details className="mt-1 text-[13px]">
            <summary className="cursor-pointer text-muted hover:text-fg">Raw response</summary>
            <pre className="mt-2 max-h-80 overflow-auto rounded-[10px] border border-line bg-ink p-3 font-mono text-xs leading-relaxed text-fg-soft">
              {pretty(run.text)}
            </pre>
          </details>
        )}
      </div>
      <div
        data-testid="receipt"
        className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-dashed border-line-strong bg-receipt px-[22px] py-3.5 text-[13px]"
      >
        <span className="inline-flex items-center gap-2">
          <StatusDot status={DOT[run.status]} />
          {run.status === "paid" && (
            <span>
              Paid <strong className="font-mono font-medium">{usdc(run.amountUnits)}</strong> USDC
            </span>
          )}
          {run.status === "free" && <span>Free call. Nothing paid.</span>}
          {run.status === "refused" && <span>Refused. Nothing signed.</span>}
          {run.status === "failed" && <span className="text-bad">Failed. Nothing settled.</span>}
        </span>
        {(server ?? run.server) && <span className="text-muted">{server ?? run.server}</span>}
        {run.tx && (
          <a
            data-testid="receipt-tx"
            href={txUrl(run.tx)}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-[12.5px] text-accent hover:text-fg sm:ml-auto"
          >
            {run.tx.slice(0, 8)}…{run.tx.slice(-6)} ↗ Stellar Expert
          </a>
        )}
      </div>
    </article>
  );
}
