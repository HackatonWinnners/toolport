import type { ComponentProps, ReactNode } from "react";

// Small shared pieces for the landing sections (server components).

export const cta =
  "inline-flex items-center justify-center rounded-xl bg-fg font-medium text-ink no-underline transition-colors hover:bg-white";
export const ghost =
  "inline-flex items-center justify-center rounded-xl border border-line-strong font-medium text-fg no-underline transition-colors hover:bg-raised";

export function Section({
  id,
  label,
  labelledBy,
  className = "",
  children,
}: {
  id?: string;
  label?: string;
  labelledBy?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-label={label}
      aria-labelledby={labelledBy}
      className={`mx-auto box-border w-full max-w-[1200px] scroll-mt-20 px-4 sm:px-6 ${className}`}
    >
      {children}
    </section>
  );
}

export function H2({ id, children, className = "" }: { id: string; children: ReactNode; className?: string }) {
  return (
    <h2
      id={id}
      className={`m-0 text-[clamp(32px,4vw,52px)] font-semibold leading-[1.05] tracking-[-0.045em] ${className}`}
    >
      {children}
    </h2>
  );
}

export function Pill({ children }: { children: ReactNode }) {
  return <span className="rounded-full bg-selected px-2 py-[3px]">{children}</span>;
}

/** Outbound link that opens in a new tab. */
export function Ext(props: ComponentProps<"a">) {
  return <a target="_blank" rel="noreferrer" {...props} />;
}

/** JSON with keys and strings tinted like the board's config block. */
export function JsonTinted({ json }: { json: string }) {
  const parts: ReactNode[] = [];
  const re = /"(?:[^"\\]|\\.)*"(\s*:)?/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(json))) {
    if (m.index > last) parts.push(json.slice(last, m.index));
    const isKey = Boolean(m[1]);
    const str = isKey ? m[0].slice(0, m[0].length - m[1].length) : m[0];
    parts.push(
      <span key={k++} className={isKey ? "text-fg-soft" : "text-held"}>
        {str}
      </span>,
    );
    if (isKey) parts.push(m[1]);
    last = m.index + m[0].length;
  }
  parts.push(json.slice(last));
  return <>{parts}</>;
}
