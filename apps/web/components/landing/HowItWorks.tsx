"use client";

import { useEffect, useState } from "react";

// Step machine ported from the DCLogic script in design/toolport/Landing.dc.html:
// each step owns its slice of the timeline, click picks a step, Pause holds it,
// and prefers-reduced-motion stops auto-advance (the user can still click through).
// Settle is 2.8 s here (4 s on the board) so the active step always changes within 3 s (S1).
const STEPS = [
  { title: "Search", ms: 1200, meta: "free", body: "The agent asks in plain words. Toolport searches its registry." },
  { title: "Quote", ms: 1200, meta: "free · nothing signed", body: "The exact price comes back and is checked against your per-call cap and what’s left." },
  { title: "Sign", ms: 1400, meta: "USDC", body: "The wallet signs a USDC authorization for that amount and nothing more." },
  { title: "Run", ms: 1600, meta: "verified first", body: "The payment is verified and the provider runs the tool." },
  { title: "Settle", ms: 2800, meta: "about 5–15 s", body: "The payment settles on Stellar." },
  { title: "Result", ms: 2200, meta: "receipt", body: "Your agent gets the answer and a Stellar Expert link to the payment." },
];

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduced;
}

export function HowItWorks() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (paused || reduced) return;
    const timer = setTimeout(() => setActive((i) => (i + 1) % STEPS.length), STEPS[active].ms);
    return () => clearTimeout(timer);
  }, [active, paused, reduced]);

  return (
    <div className={`flex flex-col gap-4 ${paused ? "tpx-paused" : ""}`}>
      <ol
        aria-label="Steps of a paid call"
        className="m-0 grid list-none gap-3 p-0 [grid-template-columns:repeat(auto-fit,minmax(170px,1fr))]"
      >
        {STEPS.map((step, i) => {
          const isActive = i === active;
          const isDone = i < active;
          const state = (isActive ? "is-active" : isDone ? "is-done" : "is-next") + (i === STEPS.length - 1 ? " is-final" : "");
          return (
            <li key={step.title} className="flex flex-col gap-3">
              <div aria-hidden="true" className="relative h-[3px] overflow-hidden rounded-full bg-line">
                {isDone && <span className="absolute inset-0 rounded-full bg-[#6E6A60]" />}
                {isActive && (
                  <>
                    <span className="absolute inset-0 rounded-full bg-[#24382D]" />
                    <span
                      key={`fill-${active}`}
                      className="tpx-fill absolute inset-y-0 left-0 rounded-full"
                      style={{ animationDuration: `${step.ms}ms` }}
                    />
                    <span className="tpx-pulse" />
                  </>
                )}
              </div>
              <button
                type="button"
                data-testid="how-step"
                aria-current={isActive ? "step" : undefined}
                onClick={() => setActive(i)}
                className={`tpx-step ${state} flex w-full flex-1 cursor-pointer flex-col gap-2.5 rounded-[18px] border p-[18px] text-left`}
              >
                <span className="tpx-step-n font-mono text-xs">0{i + 1}</span>
                <span className="text-lg font-semibold tracking-[-0.03em]">{step.title}</span>
                <span className="tpx-step-body text-sm leading-normal">{step.body}</span>
                <span className="tpx-step-meta mt-auto font-mono text-xs">{step.meta}</span>
              </button>
            </li>
          );
        })}
      </ol>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="font-mono text-[12.5px] text-muted">
          0{active + 1} / 06 · {STEPS[active].title}
        </span>
        <button
            type="button"
            data-testid="how-pause"
            aria-pressed={paused}
            onClick={() => setPaused((p) => !p)}
            className="h-9 cursor-pointer rounded-[10px] border border-line-strong bg-transparent px-3.5 text-[13px] text-fg hover:bg-raised"
          >
            {paused ? "Play" : "Pause"}
          </button>
      </div>
    </div>
  );
}
