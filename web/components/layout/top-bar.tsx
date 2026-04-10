"use client";

import { UserButton } from "@clerk/nextjs";

export function TopBar() {
  return (
    <header className="flex h-14 items-center justify-between border-b border-zinc-200 bg-white px-6 dark:border-zinc-800 dark:bg-zinc-950">
      <div />
      <UserButton />
    </header>
  );
}
