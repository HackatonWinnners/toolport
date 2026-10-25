"use client";

import { useState, type ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-line bg-panel p-5 ${className}`}>{children}</div>;
}

export function Button({
  children,
  onClick,
  variant = "primary",
  disabled,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "danger";
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  const styles = {
    primary: "bg-fg text-ink hover:bg-white",
    ghost: "border border-line-strong text-fg hover:bg-raised",
    danger: "border border-bad/40 text-bad hover:bg-bad/10",
  }[variant];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-xl px-3.5 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${styles}`}
    >
      {children}
    </button>
  );
}

export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="shrink-0 rounded-md border border-line-strong px-2 py-1 text-xs text-muted hover:border-line-hover hover:text-fg"
    >
      {copied ? "Copied" : label}
    </button>
  );
}

export function Code({ children }: { children: string }) {
  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-[10px] border border-line bg-ink p-3 font-mono text-xs leading-relaxed text-fg-soft">
        {children}
      </pre>
      <div className="absolute right-2 top-2">
        <CopyButton value={children} />
      </div>
    </div>
  );
}

export function UrlRow({ url }: { url: string }) {
  return (
    <div className="flex items-center gap-2 rounded-[10px] border border-line bg-ink px-3 py-2">
      <code className="min-w-0 flex-1 truncate font-mono text-xs text-fg-soft">{url}</code>
      <CopyButton value={url} />
    </div>
  );
}

export function PriceTag({ usd }: { usd: string }) {
  const free = Number(usd) === 0;
  return (
    <span
      className={`rounded-full px-2 py-0.5 font-mono text-xs ${free ? "bg-raised text-muted" : "bg-good/15 text-good"}`}
    >
      {free ? "free" : `$${usd}`}
    </span>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <Card className="p-4">
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </Card>
  );
}

export function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null;
  return <p data-testid="error-note" className="rounded-[10px] border border-bad/30 bg-bad/10 px-3 py-2 text-sm text-bad">{message}</p>;
}
