"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoMark, Wordmark } from "@/components/brand/Logo";
import { DOCS_URL } from "@/lib/api";

// WP-0 stub: plain nav. WP-B adds the budget pill, Testnet pill and wallet button.
const NAV = [
  { href: "/playground", label: "Playground" },
  { href: "/catalog", label: "Catalog" },
  { href: "/activity", label: "Activity" },
  { href: "/dashboard", label: "Sell" },
];

export function AppHeader() {
  const path = usePathname();
  return (
    <header className="border-b border-line bg-sunken">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-6 px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <LogoMark size={26} />
          <Wordmark size={19} />
        </Link>
        <nav data-testid="app-nav" className="flex gap-4 text-sm text-muted">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className={path.startsWith(item.href) ? "text-fg" : "hover:text-fg"}>
              {item.label}
            </Link>
          ))}
          {DOCS_URL && (
            <a href={DOCS_URL} className="hover:text-fg">
              Docs
            </a>
          )}
        </nav>
      </div>
    </header>
  );
}
