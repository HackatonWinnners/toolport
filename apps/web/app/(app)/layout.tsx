import type { ReactNode } from "react";
import { SiteHeader } from "@/components/site/SiteHeader";
import { AgentProvider } from "@/lib/agent";
import { SessionProvider } from "@/lib/session";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <AgentProvider>
        <SiteHeader />
        <main className="mx-auto box-border max-w-[1200px] px-4 py-8 sm:px-6">{children}</main>
      </AgentProvider>
    </SessionProvider>
  );
}
