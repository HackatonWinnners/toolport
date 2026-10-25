import { LogoMark } from "./Logo";

/**
 * The logo motion on a loop (design/toolport/Logo-Motion.dc.html): one ring splits into two linked
 * rings, then closes again. Keyframes live in app/globals.css; reduced motion shows the still mark.
 */
export function Loader({ size = 48, label = "Loading", caption }: { size?: number; label?: string; caption?: string }) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col items-center justify-center gap-3 py-10">
      <LogoMark size={size} ringClass={{ a: "tp-loop-a", b: "tp-loop-b", link: "tp-loop-l" }} />
      {caption ? <span className="text-[13px] text-muted">{caption}</span> : <span className="sr-only">{label}</span>}
    </div>
  );
}
