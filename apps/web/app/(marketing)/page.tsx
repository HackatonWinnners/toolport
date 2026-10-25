import Link from "next/link";

// Stub landing; WP-A replaces it with design/toolport/Landing.dc.html.
export default function LandingPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-24">
      <h1 data-testid="hero-title" className="max-w-3xl text-5xl font-semibold tracking-tight">
        Your agent can buy the tools it needs.
      </h1>
      <p className="mt-5 max-w-2xl text-lg text-muted">The price, said out loud. Then the receipt.</p>
      <Link
        href="/playground"
        className="mt-8 inline-block rounded-xl bg-fg px-5 py-3 text-sm font-medium text-ink hover:bg-white"
      >
        Try it in the browser
      </Link>
    </main>
  );
}
