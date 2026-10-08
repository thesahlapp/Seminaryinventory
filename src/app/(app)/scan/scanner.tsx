"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { QrReader } from "@/components/qr/qr-reader";

/** Full-screen scanner: jumps to the scanned item, location or kit. */
export function Scanner({ unknownCode }: { unknownCode: boolean }) {
  const router = useRouter();
  return (
    <QrReader
      onResult={(path) => router.push(path)}
      initialMessage={unknownCode ? "That code isn't a Qalam label." : null}
      className="-mx-4 -mt-6 min-h-[calc(100dvh-3.5rem-env(safe-area-inset-top))] pb-24 lg:mx-0 lg:mt-0 lg:min-h-0 lg:rounded-2xl lg:pb-0 [&>div:first-child]:flex-1 lg:[&>div:first-child]:aspect-video lg:[&>div:first-child]:flex-none"
      footer={
        <Link href="/items" className="inline-block rounded-full bg-white/15 px-4 py-2 text-sm font-medium">
          Search instead
        </Link>
      }
    />
  );
}
