import { Guarantees, Hero } from "@/components/landing/Hero";
import { BuiltWith, Catalog, Closing, Faq, How, Proof, Sellers } from "@/components/landing/Sections";

// design/toolport/Landing.dc.html
export default function LandingPage() {
  return (
    <main>
      <Hero />
      <Guarantees />
      <How />
      <Proof />
      <Catalog />
      <Sellers />
      <BuiltWith />
      <Faq />
      <Closing />
    </main>
  );
}
