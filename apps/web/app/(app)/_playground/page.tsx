import { Suspense } from "react";
import { Playground } from "@/components/playground/Playground";

export const metadata = { title: "Playground · Toolport" };

// useSearchParams (?q=, ?tool=) needs a Suspense boundary for the static build.
export default function PlaygroundPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading the playground…</p>}>
      <Playground />
    </Suspense>
  );
}
