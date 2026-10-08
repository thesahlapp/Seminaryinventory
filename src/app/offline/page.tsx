import type { Metadata } from "next";
import Image from "next/image";
import { RetryButton } from "./retry-button";

export const metadata: Metadata = { title: "Offline" };

/** Shown by the service worker when a page can't be loaded without a connection. */
export default function OfflinePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <Image src="/logo-mark-cream.png" alt="" width={72} height={72} className="rounded-2xl bg-brand p-3" />
      <h1 className="font-display text-xl font-semibold text-brand-700">You&apos;re offline</h1>
      <p className="max-w-sm text-sm text-brand-500">
        This page hasn&apos;t been opened on this device before, so it can&apos;t be shown without a connection. Pages
        you&apos;ve visited recently still open. Changes can&apos;t be saved until you&apos;re back online.
      </p>
      <RetryButton />
    </main>
  );
}
