"use client";

export function ResearchSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950"
        >
          <div className="flex items-start gap-3">
            <div className="h-4 w-4 rounded bg-zinc-200 dark:bg-zinc-700" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-2/3 rounded bg-zinc-200 dark:bg-zinc-700" />
              <div className="flex gap-2">
                <div className="h-3 w-16 rounded-full bg-zinc-200 dark:bg-zinc-700" />
                <div className="h-3 w-20 rounded bg-zinc-200 dark:bg-zinc-700" />
              </div>
            </div>
            <div className="flex gap-1">
              <div className="h-7 w-14 rounded-md bg-zinc-200 dark:bg-zinc-700" />
              <div className="h-7 w-7 rounded-md bg-zinc-200 dark:bg-zinc-700" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
