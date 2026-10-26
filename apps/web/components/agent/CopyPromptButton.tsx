"use client";

import { useEffect, useRef, useState } from "react";
import { agentPrompt } from "@/lib/agentPrompt";
import { copyText } from "@/lib/clipboard";

export function CopyPromptButton({ className = "", label = "Copy setup prompt" }: { className?: string; label?: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  return (
    <button
      type="button"
      data-testid="copy-agent-prompt"
      onClick={async () => {
        const ok = await copyText(agentPrompt());
        setState(ok ? "copied" : "failed");
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setState("idle"), 2000);
      }}
      className={`inline-flex items-center justify-center gap-2 font-medium transition-colors ${className}`}
    >
      {state === "copied" ? (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m3.5 8.5 3 3 6-7" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true">
          <rect x="5.5" y="5.5" width="8" height="8" rx="1.8" />
          <path d="M10.5 5.5V3.8c0-1-.8-1.8-1.8-1.8H3.8c-1 0-1.8.8-1.8 1.8v4.9c0 1 .8 1.8 1.8 1.8h1.7" />
        </svg>
      )}
      <span aria-live="polite">{state === "copied" ? "Copied!" : state === "failed" ? "Copy failed" : label}</span>
    </button>
  );
}
