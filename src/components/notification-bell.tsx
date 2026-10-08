"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  listNotifications,
  markAllNotificationsRead,
  type NotificationEntry,
} from "@/app/(app)/notifications/actions";
import { formatDateTime } from "@/lib/format";
import { BellIcon } from "./icons";

export function NotificationBell({ initialCount }: { initialCount: number }) {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(initialCount);
  const [entries, setEntries] = useState<NotificationEntry[] | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Take the server's count when it changes (e.g. after navigating).
  const [lastInitial, setLastInitial] = useState(initialCount);
  if (lastInitial !== initialCount) {
    setLastInitial(initialCount);
    setCount(initialCount);
  }

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function toggle() {
    if (open) return setOpen(false);
    setOpen(true);
    setEntries(await listNotifications());
    if (count > 0) {
      await markAllNotificationsRead();
      setCount(0);
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-label={count ? `Notifications, ${count} unread` : "Notifications"}
        className="relative rounded-md p-2 hover:bg-cream/10"
      >
        <BellIcon className="size-6" />
        {count > 0 && (
          <span className="absolute right-0.5 top-0.5 flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-bold leading-5 text-white dark:bg-[#e5484d]">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>
      {open && (
        <div className="fixed inset-x-2 top-[calc(env(safe-area-inset-top)+3.75rem)] z-50 max-h-[70vh] overflow-y-auto rounded-xl border border-cream-300 bg-cream-50 text-brand-800 shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-1 sm:w-96">
          <p className="sticky top-0 border-b border-cream-300 bg-cream-50 px-4 py-2.5 text-sm font-semibold">Notifications</p>
          {entries === null ? (
            <p className="px-4 py-6 text-center text-sm text-brand-400">Loading…</p>
          ) : entries.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-brand-400">
              Nothing yet. You&apos;ll be notified here when someone @mentions you.
            </p>
          ) : (
            <ul className="divide-y divide-cream-200">
              {entries.map((n) => (
                <li key={n.id}>
                  <Link
                    href={n.itemId ? `/items/${n.itemId}#comment-${n.commentId}` : "#"}
                    onClick={() => setOpen(false)}
                    className={`block px-4 py-3 text-sm hover:bg-cream-100 ${n.read ? "" : "bg-brand-50"}`}
                  >
                    <p>
                      <strong>{n.actorName}</strong> mentioned you on <strong>{n.itemName ?? "an item"}</strong>
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-brand-500">{n.excerpt}</p>
                    <p className="mt-1 text-xs text-brand-400">{formatDateTime(n.createdAt)}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
