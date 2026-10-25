// Mark and wordmark from design/toolport/Main.dc.html. The mark is two linked rings; the two
// short arcs redraw the crossings so each ring passes over the other once.

const ARC_LOW = "M30.26 26.5A13 13 0 0 1 25.1 31.48";
const ARC_HIGH = "M25.74 13.5A13 13 0 0 1 30.9 8.52";

/** `ringClass` lets the landing attach Logo-Motion animation classes to each ring and the links. */
export function LogoMark({
  size = 28,
  ringClass = {},
}: {
  size?: number;
  ringClass?: { a?: string; b?: string; link?: string };
}) {
  return (
    <svg width={size} height={(size * 40) / 56} viewBox="0 0 56 40" role="img" aria-label="Toolport">
      <circle cx="19" cy="20" r="13" fill="none" stroke="var(--color-fg)" strokeWidth="5" className={ringClass.a} />
      <circle cx="37" cy="20" r="13" fill="none" stroke="var(--color-fg)" strokeWidth="5" className={ringClass.b} />
      <g className={ringClass.link}>
        <path d={ARC_LOW} fill="none" stroke="var(--color-ink)" strokeWidth="9" />
        <path d={ARC_LOW} fill="none" stroke="var(--color-fg)" strokeWidth="5" />
        <path d={ARC_HIGH} fill="none" stroke="var(--color-ink)" strokeWidth="9" />
        <path d={ARC_HIGH} fill="none" stroke="var(--color-fg)" strokeWidth="5" />
      </g>
    </svg>
  );
}

export function Wordmark({ size = 22 }: { size?: number }) {
  return (
    <span className="font-semibold text-fg" style={{ fontSize: size, letterSpacing: "-0.06em", lineHeight: 1 }}>
      toolport
    </span>
  );
}
