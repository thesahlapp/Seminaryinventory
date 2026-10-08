"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { adjustQuantity, setQuantity } from "@/app/(app)/items/quantity-actions";

const SAVE_DELAY_MS = 600;

/**
 * − [ 12 ] +   Saves instantly: taps are grouped for a moment and sent as one
 * change, and typing a number sets the count. No form, no Save button.
 */
export function QuantityStepper({
  variantId,
  locationId,
  quantity,
  size = "md",
  label,
}: {
  variantId: string;
  locationId: string;
  quantity: number;
  size?: "sm" | "md";
  /** Accessible name, e.g. "M at Warehouse". */
  label: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(quantity);
  const [draft, setDraft] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  // confirmed = last value the server returned; flying = delta being saved;
  // pending = taps not yet sent. What's shown is the sum of the three.
  const confirmed = useRef(quantity);
  const flying = useRef(0);
  const pending = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const flushRef = useRef<() => void>(() => {});

  const shown = () => confirmed.current + flying.current + pending.current;

  // Follow fresh data from the server when nothing is in progress.
  useEffect(() => {
    if (flying.current === 0 && pending.current === 0) {
      confirmed.current = quantity;
      setValue(quantity);
    }
  }, [quantity]);

  async function flush() {
    clearTimeout(timer.current);
    if (flying.current !== 0 || pending.current === 0) return;

    flying.current = pending.current;
    pending.current = 0;
    setStatus("saving");

    const result = await adjustQuantity(variantId, locationId, flying.current);
    flying.current = 0;

    if ("error" in result) {
      pending.current = 0;
      setError(result.error);
      setStatus("error");
    } else {
      confirmed.current = result.quantity;
      setStatus("saved");
      router.refresh();
    }
    setValue(shown());
    if (pending.current !== 0) timer.current = setTimeout(() => flushRef.current(), SAVE_DELAY_MS);
  }
  // Timers call the latest flush (it closes over current props).
  useEffect(() => {
    flushRef.current = flush;
  });

  // "Saved" fades after a moment.
  useEffect(() => {
    if (status !== "saved") return;
    const t = setTimeout(() => setStatus("idle"), 1500);
    return () => clearTimeout(t);
  }, [status]);

  // Don't lose taps if the person navigates away right after tapping.
  useEffect(
    () => () => {
      clearTimeout(timer.current);
      if (pending.current !== 0) void adjustQuantity(variantId, locationId, pending.current);
    },
    [variantId, locationId],
  );

  function bump(delta: number) {
    if (shown() + delta < 0) return;
    pending.current += delta;
    setValue(shown());
    setError(null);
    setStatus("idle");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => flushRef.current(), SAVE_DELAY_MS);
  }

  async function commitDraft() {
    if (draft === null) return;
    const text = draft.trim();
    setDraft(null);
    if (text === "" || text === String(shown())) return;
    if (!/^\d+$/.test(text)) {
      setError("Enter a whole number, 0 or more.");
      setStatus("error");
      return;
    }

    const target = Number(text);
    clearTimeout(timer.current);
    pending.current = 0;
    setValue(target);
    setError(null);
    setStatus("saving");

    const result = await setQuantity(variantId, locationId, target);
    if ("error" in result) {
      setError(result.error);
      setStatus("error");
      setValue(shown());
    } else {
      confirmed.current = result.quantity;
      setValue(shown());
      setStatus("saved");
      router.refresh();
    }
  }

  const button =
    size === "sm"
      ? "size-8 text-base"
      : "size-10 text-lg";
  const field = size === "sm" ? "h-8 w-12 text-sm" : "h-10 w-14 text-base";
  const ring =
    status === "error"
      ? "ring-2 ring-red-300"
      : status === "saving"
        ? "ring-2 ring-brand-200"
        : status === "saved"
          ? "ring-2 ring-brand-400"
          : "ring-1 ring-cream-400";

  return (
    <div className="inline-flex flex-col items-end gap-0.5">
      <div className={`inline-flex items-stretch overflow-hidden rounded-lg bg-cream-50 ${ring} transition`}>
        <button
          type="button"
          onClick={() => bump(-1)}
          disabled={value <= 0}
          aria-label={`Remove one: ${label}`}
          className={`${button} flex items-center justify-center font-semibold text-brand-700 hover:bg-cream-200 active:bg-cream-300 disabled:text-brand-200`}
        >
          −
        </button>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          aria-label={`Quantity: ${label}`}
          value={draft ?? String(value)}
          onFocus={(e) => {
            setDraft(String(value));
            e.target.select();
          }}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitDraft}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") {
              setDraft(null);
              e.currentTarget.blur();
            }
          }}
          className={`${field} border-x border-cream-300 bg-transparent text-center font-semibold tabular-nums text-ink outline-none focus:bg-cream-100`}
        />
        <button
          type="button"
          onClick={() => bump(1)}
          aria-label={`Add one: ${label}`}
          className={`${button} flex items-center justify-center font-semibold text-brand-700 hover:bg-cream-200 active:bg-cream-300`}
        >
          +
        </button>
      </div>
      {/* The outline shows saving/saved; only errors need words. */}
      <span aria-live="polite" className="sr-only">
        {status === "saving" ? "Saving" : status === "saved" ? "Saved" : ""}
      </span>
      {status === "error" && error && (
        <span role="alert" className="max-w-40 text-right text-[11px] leading-4 text-red-700">
          {error}
        </span>
      )}
    </div>
  );
}
