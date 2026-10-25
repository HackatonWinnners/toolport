import Link from "next/link";
import type { ReactNode } from "react";
import { LogoMark } from "@/components/brand/Logo";
import { DOCS_URL, REPO_URL } from "@/lib/api";
import "./landing.css";

// Marketing shell from design/toolport/Landing.dc.html: sticky header and footer.
const navLink = "text-fg-soft no-underline transition-colors hover:text-fg";

function Brand({ size, animated }: { size: number; animated?: boolean }) {
  return (
    <>
      <LogoMark size={size} ringClass={animated ? { a: "tpl-A", b: "tpl-B", link: "tpl-L" } : undefined} />
      <span className="font-semibold leading-none tracking-[-0.055em]">toolport</span>
    </>
  );
}

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="tpx min-h-screen bg-ink font-sans text-fg">
      <header className="sticky top-0 z-10 border-b border-raised bg-[rgba(27,26,23,0.86)] backdrop-blur-md">
        <div className="mx-auto box-border flex max-w-[1200px] items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
          <Link href="/" aria-label="Toolport home" className="flex items-center gap-[9px] text-[22px] text-fg no-underline">
            <Brand size={36} animated />
          </Link>
          <nav aria-label="Primary" className="hidden gap-[26px] text-sm lg:flex">
            <a href="#how" className={navLink}>How it works</a>
            <a href="#proof" className={navLink}>Proof</a>
            <a href="#catalog" className={navLink}>Catalog</a>
            <a href="#sell" className={navLink}>For sellers</a>
            {DOCS_URL && (
              <a href={DOCS_URL} target="_blank" rel="noreferrer" className={navLink}>Docs</a>
            )}
          </nav>
          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-1.5 text-[12.5px] text-muted sm:inline-flex">
              <span className="h-1.5 w-1.5 rounded-full bg-held" />
              Stellar testnet
            </span>
            <Link
              href="/playground"
              data-testid="nav-open-app"
              className="inline-flex h-10 items-center rounded-xl bg-fg px-4 text-sm font-medium text-ink no-underline transition-colors hover:bg-white"
            >
              Open the app
            </Link>
          </div>
        </div>
      </header>

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
          </nav>
          <span className="text-[13px] text-muted">Stellar testnet only · test USDC</span>
        </div>
      </footer>
    </div>
  );
}
