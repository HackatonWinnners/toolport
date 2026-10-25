"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Full-screen slides that snap on scroll. Arrow keys, PageUp/PageDown and Space move between
 * slides; the counter follows whichever slide is mostly in view.
 */
export function Deck({ slides }: { slides: { id: string; next?: string; content: ReactNode }[] }) {
  const root = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(0);

  const go = useCallback((index: number) => {
    const target = root.current?.children[Math.max(0, Math.min(index, slides.length - 1))];
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [slides.length]);

  useEffect(() => {
    const sections = Array.from(root.current?.children ?? []);
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setCurrent(sections.indexOf(entry.target));
        }
      },
      { threshold: 0.6 },
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest("input, textarea, [contenteditable]")) return;
      if (["ArrowDown", "ArrowRight", "PageDown", " "].includes(e.key)) {
        e.preventDefault();
        go(current + 1);
      } else if (["ArrowUp", "ArrowLeft", "PageUp"].includes(e.key)) {
        e.preventDefault();
        go(current - 1);
      } else if (e.key === "Home") go(0);
      else if (e.key === "End") go(slides.length - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, go, slides.length]);

  const pad = (n: number) => String(n).padStart(2, "0");
  const next = slides[current]?.next;

  return (
    <>
      <div ref={root} className="h-dvh snap-y snap-proximity overflow-y-auto lg:snap-mandatory">
        {slides.map((slide) => (
          <section
            key={slide.id}
            id={slide.id}
            className="box-border flex min-h-dvh snap-start flex-col justify-center px-4 py-24 sm:px-10"
          >
            {slide.content}
          </section>
        ))}
      </div>
      <nav
        aria-label="Slides"
        className="fixed inset-x-0 bottom-0 flex items-center justify-between gap-4 border-t border-raised bg-[rgba(27,26,23,0.9)] px-4 py-3 font-mono text-xs text-muted backdrop-blur-md sm:px-10"
      >
        <span>
          <span className="text-fg">{pad(current + 1)}</span> / {pad(slides.length)}
        </span>
        <span className="hidden sm:inline">{next ? `Next ▸ ${next}` : "Final stop"}</span>
        <span className="flex gap-2">
          <button
            type="button"
            onClick={() => go(current - 1)}
            disabled={current === 0}
            aria-label="Previous slide"
            className="h-8 w-8 rounded-lg border border-line-strong text-fg hover:bg-raised disabled:opacity-30"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={() => go(current + 1)}
            disabled={current === slides.length - 1}
            aria-label="Next slide"
            className="h-8 w-8 rounded-lg border border-line-strong text-fg hover:bg-raised disabled:opacity-30"
          >
            ↓
          </button>
        </span>
      </nav>
    </>
  );
}
