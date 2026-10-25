import type { ReactNode } from "react";
import { AppHeader } from "@/components/app/AppHeader";
import { AgentProvider } from "@/lib/agent";
import { SessionProvider } from "@/lib/session";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <AgentProvider>
        <AppHeader />
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      </AgentProvider>
    </SessionProvider>
  );
}
