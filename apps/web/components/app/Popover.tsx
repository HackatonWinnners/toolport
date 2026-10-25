"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/** A button with a small panel under it; closes on outside click and Escape. */
export function Popover({
  trigger,
  label,
  testId,
  className = "",
  align = "right",
  children,
}: {
  align?: "left" | "right";
  trigger: ReactNode;
  label: string;
  testId?: string;
  className?: string;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        data-testid={testId}
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((o) => !o)}
        className={className}
      >
        {trigger}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label={label}
          className={`absolute ${align === "left" ? "left-0 sm:left-auto sm:right-0" : "right-0"} top-[calc(100%+8px)] z-30 w-[min(300px,calc(100vw-32px))] rounded-2xl border border-line bg-panel p-4 shadow-[0_18px_40px_-20px_rgba(0,0,0,0.8)]`}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}
