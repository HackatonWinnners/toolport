import Link from "next/link";
import type { ReactNode } from "react";
import { LogoMark } from "@/components/brand/Logo";
import { SiteHeader } from "@/components/site/SiteHeader";
import { DOCS_URL, REPO_URL } from "@/lib/api";
import "./landing.css";

// Marketing shell from design/toolport/Landing.dc.html: the shared header and the footer.
const navLink = "text-fg-soft no-underline transition-colors hover:text-fg";

function Brand({ size }: { size: number }) {
  return (
    <>
      <LogoMark size={size} />
      <span className="font-semibold leading-none tracking-[-0.055em]">toolport</span>
    </>
  );
}

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="tpx min-h-screen bg-ink font-sans text-fg">
      <SiteHeader />

      {children}

      <footer className="border-t border-raised">
        <div className="mx-auto box-border flex max-w-[1200px] flex-wrap items-center justify-between gap-5 px-4 pb-10 pt-7 text-sm sm:px-6">
          <span className="flex items-center gap-2 text-lg">
            <Brand size={28} />
          </span>
          <nav aria-label="Footer" className="flex flex-wrap gap-6">
            {REPO_URL && (
              <a href={REPO_URL} target="_blank" rel="noreferrer" className={navLink}>GitHub</a>
            )}
            {DOCS_URL && (
              <a href={DOCS_URL} target="_blank" rel="noreferrer" className={navLink}>Docs</a>
            )}
            <a href="#catalog" className={navLink}>Catalog</a>
            <a href="#sell" className={navLink}>For sellers</a>
            <Link href="/pitch" className={navLink}>Pitch</Link>
          </nav>
          <span className="text-[13px] text-muted">Registry on Stellar testnet (test USDC) · MPP Router APIs on mainnet (real USDC)</span>
        </div>
      </footer>
    </div>
  );
}
