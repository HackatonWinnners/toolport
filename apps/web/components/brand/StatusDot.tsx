export type DotStatus = "settled" | "held" | "refused" | "free" | "failed";

const FILL: Record<Exclude<DotStatus, "refused">, string> = {
  settled: "bg-good",
  held: "bg-held",
  free: "bg-faint",
  failed: "bg-bad",
};

/** One dot, three states (plus free and failed). Refused is an outlined ring: nothing was signed. */
export function StatusDot({ status }: { status: DotStatus }) {
  const look = status === "refused" ? "border-[1.5px] border-fg" : FILL[status];
  return <span aria-hidden="true" className={`inline-block h-[9px] w-[9px] shrink-0 rounded-full ${look}`} />;
}
