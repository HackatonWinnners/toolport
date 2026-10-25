import type { ReactNode } from "react";
import { Loader } from "./Loader";

// Loading states: a faded skeleton shaped like the content, with the looping logo over it.

export function Skel({ className = "" }: { className?: string }) {
  return <span aria-hidden="true" className={`tp-skel block rounded-md ${className}`} />;
}

/** The skeleton fades out downward; the logo loader sits on top with a caption. */
export function LoadingState({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    <div className="relative">
      <div aria-hidden="true" className="pointer-events-none select-none [mask-image:linear-gradient(to_bottom,black_35%,transparent_95%)]">
        {children}
      </div>
      <div className="absolute inset-x-0 top-6 flex justify-center">
        <div className="rounded-2xl border border-line bg-ink/85 px-8 backdrop-blur-sm">
          <Loader size={44} caption={caption} />
        </div>
      </div>
    </div>
  );
}

export function ServerCardSkeleton() {
  return (
    <div className="flex flex-col gap-4 rounded-[18px] border border-line bg-panel p-5">
      <div className="flex items-baseline justify-between gap-4">
        <Skel className="h-5 w-40" />
        <Skel className="h-3 w-24" />
      </div>
      <Skel className="h-3 w-3/4" />
      <div className="divide-y divide-line overflow-hidden rounded-[14px] border border-line">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center justify-between gap-4 px-4 py-3">
            <div className="flex-1 space-y-2">
              <Skel className="h-3.5 w-32" />
              <Skel className="h-3 w-2/3" />
            </div>
            <Skel className="h-5 w-12" />
          </div>
        ))}
      </div>
      <Skel className="h-9 w-full rounded-[10px]" />
    </div>
  );
}

export function ApiCardSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line bg-panel p-4">
      <div className="flex justify-between gap-3">
        <Skel className="h-4 w-2/3" />
        <Skel className="h-4 w-10 rounded-full" />
      </div>
      <Skel className="h-3 w-full" />
      <Skel className="h-3 w-4/5" />
      <div className="flex gap-3 pt-1">
        <Skel className="h-3 w-20" />
        <Skel className="h-3 w-12" />
      </div>
    </div>
  );
}

export function CatalogSkeleton() {
  return (
    <LoadingState caption="Loading the catalog">
      <div className="grid gap-4 lg:grid-cols-2">
        <ServerCardSkeleton />
        <ServerCardSkeleton />
      </div>
    </LoadingState>
  );
}

export function ApiGridSkeleton({ caption }: { caption: string }) {
  return (
    <LoadingState caption={caption}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <ApiCardSkeleton key={i} />
        ))}
      </div>
    </LoadingState>
  );
}

export function ToolListSkeleton() {
  return (
    <LoadingState caption="Loading the catalog">
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-panel p-4">
            <div className="flex-1 space-y-2">
              <Skel className="h-4 w-40" />
              <Skel className="h-3 w-3/4" />
            </div>
            <Skel className="h-6 w-14" />
          </div>
        ))}
      </div>
    </LoadingState>
  );
}

export function ServerPageSkeleton() {
  return (
    <LoadingState caption="Loading the server">
      <div className="space-y-8">
        <div className="space-y-3">
          <Skel className="h-8 w-64" />
          <Skel className="h-4 w-2/3" />
          <Skel className="h-10 w-full rounded-[10px]" />
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="space-y-2 rounded-2xl border border-line bg-panel p-4">
              <Skel className="h-3 w-16" />
              <Skel className="h-7 w-24" />
            </div>
          ))}
        </div>
        <ServerCardSkeleton />
      </div>
    </LoadingState>
  );
}

/** Route-level fallback: page title, intro and a grid of cards. */
export function PageSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <LoadingState caption="Loading">
        <div className="space-y-6">
          <Skel className="h-10 w-80 max-w-full" />
          <Skel className="h-4 w-2/3" />
          <div className="grid gap-4 pt-4 lg:grid-cols-2">
            <ServerCardSkeleton />
            <ServerCardSkeleton />
          </div>
        </div>
      </LoadingState>
    </div>
  );
}
