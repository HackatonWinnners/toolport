import Link from "next/link";
import type { ReactNode } from "react";
import { LogoMark, Wordmark } from "@/components/brand/Logo";
import { REPO_URL } from "@/lib/api";

// Stub shell; WP-A builds the marketing header and footer from Landing.dc.html.
export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <header className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-5">
        <Link href="/" className="flex items-center gap-2.5">
          <LogoMark size={28} />
          <Wordmark size={22} />
        </Link>
        <Link
          href="/playground"
          data-testid="nav-open-app"
          className="ml-auto rounded-xl bg-fg px-4 py-2 text-sm font-medium text-ink hover:bg-white"
        >
          Open the app
        </Link>
      </header>
      {children}
      <footer className="mx-auto flex max-w-6xl gap-4 px-4 py-10 text-sm text-muted">
        <span>Toolport · testnet</span>
        {REPO_URL && (
          <a href={REPO_URL} className="hover:text-fg">
            GitHub
          </a>
        )}
      </footer>
    </>
  );
}
