"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoMark, Wordmark } from "@/components/brand/Logo";
import { DOCS_URL } from "@/lib/api";

const NAV = [
  { href: "/catalog", label: "Catalog", match: ["/catalog", "/servers"] },
  { href: "/dashboard", label: "Sell", match: ["/dashboard"] },
];

const link = "border-b-[1.5px] py-1.5 no-underline transition-colors";

export function SiteHeader() {
  const path = usePathname() ?? "/";
  return (
    <header className="sticky top-0 z-10 border-b border-raised bg-[rgba(27,26,23,0.86)] backdrop-blur-md">
      <div className="mx-auto box-border flex max-w-[1200px] flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3.5 sm:flex-nowrap sm:px-6">
        <Link href="/" aria-label="Toolport home" className="flex items-center gap-[9px] text-fg no-underline">
          <LogoMark size={36} />
          <Wordmark size={22} />
        </Link>
        <nav
          aria-label="Primary"
          data-testid="site-nav"
          className="order-last flex w-full gap-[26px] text-sm sm:order-none sm:w-auto"
        >
          {NAV.map((item) => {
            const active = item.match.some((m) => path === m || path.startsWith(`${m}/`));
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`${link} ${active ? "border-fg font-medium text-fg" : "border-transparent text-fg-soft hover:text-fg"}`}
              >
                {item.label}
              </Link>
            );
          })}
          {DOCS_URL && (
            <a href={DOCS_URL} target="_blank" rel="noreferrer" className={`${link} border-transparent text-fg-soft hover:text-fg`}>
              Docs
            </a>
          )}
        </nav>
        <Link
          href="/#connect"
          data-testid="nav-open-app"
          className="inline-flex h-10 shrink-0 items-center rounded-xl bg-fg px-4 text-sm font-medium text-ink no-underline transition-colors hover:bg-white"
        >
          Connect your agent
        </Link>
      </div>
    </header>
  );
}
