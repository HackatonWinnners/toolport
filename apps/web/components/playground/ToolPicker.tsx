"use client";

import { useRef, type KeyboardEvent } from "react";
import { usdc, type CatalogTool, type Quote } from "@/lib/buyer";

const COUNT = ["No tools fit", "One tool fits", "Two tools fit", "Three tools fit"];

export function ToolOptions({
  tools,
  selectedId,
  onSelect,
}: {
  tools: CatalogTool[];
  selectedId: string | null;
  onSelect(tool: CatalogTool): void;
}) {
  const group = useRef<HTMLDivElement>(null);
  const onKey = (e: KeyboardEvent, i: number) => {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (i + step + tools.length) % tools.length;
    onSelect(tools[next]);
    group.current?.querySelectorAll<HTMLButtonElement>("[role=radio]")[next]?.focus();
  };
  return (
    <section aria-label="Matching tools" className="flex flex-col gap-2.5">
      <p className="text-[17px] leading-normal tracking-[-0.01em]">
        {COUNT[tools.length] ?? `${tools.length} tools fit`}. Prices are per call; getting a quote is free.
      </p>
      <div ref={group} role="radiogroup" aria-label="Choose a tool" className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-2.5">
        {tools.map((tool, i) => {
          const checked = tool.id === selectedId;
          return (
            <button
              key={tool.id}
              type="button"
              role="radio"
              aria-checked={checked}
              tabIndex={checked || (!selectedId && i === 0) ? 0 : -1}
              data-testid="tool-option"
              data-tool={tool.name}
              onClick={() => onSelect(tool)}
              onKeyDown={(e) => onKey(e, i)}
              className={`flex flex-col gap-1.5 rounded-[14px] p-3.5 text-left ${
                checked ? "border-[1.5px] border-fg bg-panel" : "border border-line hover:border-line-hover"
              }`}
            >
              <span className="flex w-full items-baseline justify-between gap-2">
                <span className={`truncate font-mono text-[13.5px] ${checked ? "font-medium" : ""}`}>{tool.name}</span>
                <span className="text-base font-semibold tracking-[-0.02em]">{tool.priceUnits > 0 ? usdc(tool.priceUnits) : "free"}</span>
              </span>
              <span className="line-clamp-2 text-[12.5px] leading-snug text-muted">{tool.description}</span>
              <span className="text-[11.5px] text-muted">{tool.serverName} · Toolport</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

const LABELS: Record<string, string> = { from: "From asset", to: "To asset", amount: "Amount", address: "Account" };
const labelFor = (name: string) => LABELS[name] ?? name.charAt(0).toUpperCase() + name.slice(1).replace(/[_-]/g, " ");

export function ArgsCard({
  tool,
  args,
  onArg,
  quote,
  refused,
  perCallUnits,
  busy,
  runningLabel,
  canPay,
  onQuote,
  onRun,
}: {
  tool: CatalogTool;
  args: Record<string, string>;
  onArg(name: string, value: string): void;
  quote: Quote | null;
  refused: string | null;
  perCallUnits: number;
  busy: "quote" | "run" | null;
  /** Button text while a run is in flight. */
  runningLabel: string;
  canPay: boolean;
  onQuote(): void;
  onRun(): void;
}) {
  const props = Object.entries(tool.inputSchema.properties ?? {});
  const paid = tool.priceUnits > 0;
  const price = quote?.amountUnits ?? tool.priceUnits;
  const cols = props.length >= 3 ? "sm:grid-cols-3" : props.length === 2 ? "sm:grid-cols-2" : "";

  return (
    <section aria-labelledby="args-title" className="flex flex-col gap-3.5 rounded-[18px] border border-line bg-panel p-[18px]">
      <h2 id="args-title" className="text-[13px] font-medium text-muted">
        {tool.name} · arguments
      </h2>
      {props.length ? (
        <div className={`grid grid-cols-1 gap-2.5 ${cols}`}>
          {props.map(([name, prop]) => (
            <div key={name} className="flex min-w-0 flex-col gap-[5px]">
              <label htmlFor={`arg-${name}`} className="text-xs text-muted">
                {labelFor(name)}
                {tool.inputSchema.required?.includes(name) && <span aria-hidden="true"> *</span>}
              </label>
              <div className="flex h-[42px] items-center rounded-[10px] border border-line-strong bg-ink px-3 focus-within:border-fg focus-within:shadow-[0_0_0_3px_rgba(92,195,149,.22)]">
                <input
                  id={`arg-${name}`}
                  data-testid="arg-input"
                  name={name}
                  value={args[name] ?? ""}
                  required={tool.inputSchema.required?.includes(name)}
                  inputMode={name === "amount" || prop.type === "number" ? "decimal" : undefined}
                  placeholder={prop.description}
                  onChange={(e) => onArg(name, e.target.value)}
                  className="w-full min-w-0 bg-transparent font-mono outline-none placeholder:text-faint"
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[13px] text-muted">No arguments.</p>
      )}

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <QuoteLine paid={paid} price={price} quote={quote} refused={refused} perCallUnits={perCallUnits} />
        <span className="flex gap-2 sm:ml-auto">
          {paid && (
            <button
              type="button"
              data-testid="get-price"
              onClick={onQuote}
              disabled={busy !== null}
              className="h-11 rounded-xl border border-line-strong px-4 hover:bg-raised disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy === "quote" ? "Asking…" : "Get price"}
            </button>
          )}
          <button
            type="button"
            data-testid="pay-run"
            onClick={onRun}
            disabled={busy !== null || !canPay}
            className="h-11 rounded-xl bg-fg px-[18px] font-medium text-ink hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy === "run"
              ? runningLabel
              : paid
                ? `Pay ${usdc(price)} and run`
                : "Run"}
          </button>
        </span>
      </div>
    </section>
  );
}

function QuoteLine({
  paid,
  price,
  quote,
  refused,
  perCallUnits,
}: {
  paid: boolean;
  price: number;
  quote: Quote | null;
  refused: string | null;
  perCallUnits: number;
}) {
  const big = "text-[19px] font-semibold tracking-[-0.03em]";
  if (!paid) {
    return (
      <span className="text-[13.5px]">
        <span className={big}>free</span> <span className="text-muted">No payment, nothing to sign.</span>
      </span>
    );
  }
  if (!quote) {
    return (
      <span className="text-[13.5px]">
        <span className={big}>{usdc(price)}</span> <span className="text-muted">listed per call. A quote is free; nothing is signed.</span>
      </span>
    );
  }
  if (refused) {
    return (
      <span data-testid="quote-text" data-state="refused" role="status" className="text-[13.5px]">
        <span className={big}>{usdc(quote.amountUnits)}</span> <span className="text-bad">Refused: {refused}. Nothing signed.</span>
      </span>
    );
  }
  return (
    <span data-testid="quote-text" data-state="ok" role="status" className="text-[13.5px]">
      <span className={big}>{usdc(quote.amountUnits)}</span>{" "}
      <span className="text-muted">quoted, under your {usdc(perCallUnits)} cap. Nothing signed yet.</span>
    </span>
  );
}
