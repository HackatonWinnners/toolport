"use client";

import { useEffect, useState } from "react";
import { Popover } from "@/components/app/Popover";
import { useAgent } from "@/lib/agent";
import { toUnits, usdc } from "@/lib/buyer";

export function BudgetPill() {
  const { budget, updateBudget } = useAgent();
  if (!budget) return <span className="h-10 w-48 rounded-xl border border-line bg-panel" aria-hidden="true" />;
  const remaining = Math.max(0, budget.capUnits - budget.spentUnits);
  const spentPct = Math.min(100, (budget.spentUnits / Math.max(1, budget.capUnits)) * 100);
  return (
    <Popover
      testId="budget-pill"
      align="left"
      label={`Budget: ${usdc(remaining)} left of ${usdc(budget.capUnits)}, ${usdc(budget.perCallUnits)} per call. Edit budget`}
      className="flex h-10 items-center gap-2.5 rounded-xl border border-line bg-panel px-3.5 hover:border-line-hover"
      trigger={
        <>
          <span className="flex h-1.5 w-16 overflow-hidden rounded-full bg-line" aria-hidden="true">
            <span className="bg-good" style={{ width: `${spentPct}%` }} />
          </span>
          <span className="font-mono text-[12.5px]">{usdc(remaining)} left</span>
          <span className="text-xs text-muted">· {usdc(budget.perCallUnits)} / call</span>
        </>
      }
    >
      {() => (
        <div className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold">Budget</h2>
            <p className="mt-0.5 text-xs text-muted">
              {usdc(budget.spentUnits)} spent of {usdc(budget.capUnits)}. Calls above a cap are refused before anything is signed.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <LimitInput
              testId="budget-total-input"
              label="Total"
              units={budget.capUnits}
              onChange={(capUnits) => updateBudget({ ...budget, capUnits })}
            />
            <LimitInput
              testId="budget-percall-input"
              label="Per call"
              units={budget.perCallUnits}
              onChange={(perCallUnits) => updateBudget({ ...budget, perCallUnits })}
            />
          </div>
          <button
            type="button"
            onClick={() => updateBudget({ ...budget, spentUnits: 0, runs: [] })}
            className="h-9 w-full rounded-[10px] border border-line-strong text-[13px] hover:bg-raised"
          >
            Reset spending and runs
          </button>
        </div>
      )}
    </Popover>
  );
}

/** Commits as soon as the value is a positive number, so a test can type and click straight away. */
function LimitInput({ label, units, onChange, testId }: { label: string; units: number; onChange: (u: number) => void; testId: string }) {
  const [value, setValue] = useState((units / 10_000_000).toString());
  useEffect(() => {
    setValue((v) => (toUnits(v) === units ? v : (units / 10_000_000).toString()));
  }, [units]);
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-muted">{label} (USDC)</span>
      <input
        data-testid={testId}
        value={value}
        inputMode="decimal"
        onChange={(e) => {
          setValue(e.target.value);
          const next = toUnits(e.target.value);
          if (next > 0 && next !== units) onChange(next);
        }}
        onBlur={() => toUnits(value) > 0 || setValue((units / 10_000_000).toString())}
        className="h-10 w-full rounded-[10px] border border-line-strong bg-ink px-3 font-mono text-[13px] outline-none focus:border-fg focus:shadow-[0_0_0_3px_rgba(92,195,149,.22)]"
      />
    </label>
  );
}
