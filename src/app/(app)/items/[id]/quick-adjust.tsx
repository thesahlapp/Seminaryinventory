"use client";

import { useState } from "react";
import { QuantityStepper } from "@/components/inventory/quantity-stepper";

/** Shown right after scanning an item's label: big +/− buttons, no searching. */
export function QuickAdjust({
  itemName,
  variants,
  locations,
  levels,
  initialVariantId,
}: {
  itemName: string;
  variants: { id: string; label: string | null }[];
  locations: { id: string; name: string }[];
  levels: Record<string, number>;
  initialVariantId?: string;
}) {
  const [variantId, setVariantId] = useState(
    variants.some((v) => v.id === initialVariantId) ? initialVariantId! : variants[0].id,
  );
  const variant = variants.find((v) => v.id === variantId)!;
  // Locations that hold this size first.
  const ordered = [...locations].sort(
    (a, b) => Number((levels[`${variantId}:${b.id}`] ?? 0) > 0) - Number((levels[`${variantId}:${a.id}`] ?? 0) > 0),
  );

  return (
    <section className="rounded-xl border-2 border-brand-300 bg-brand-50 p-4 shadow-sm" aria-label="Quick adjust">
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-500">Scanned · quick adjust</p>
      {variants.length > 1 && (
        <div className="mt-2 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Size">
          {variants.map((v) => (
            <button
              key={v.id}
              type="button"
              role="radio"
              aria-checked={v.id === variantId}
              onClick={() => setVariantId(v.id)}
              className={`min-w-11 rounded-lg px-3 py-2 text-sm font-semibold ${
                v.id === variantId ? "bg-brand text-cream" : "bg-cream-50 text-brand-700 ring-1 ring-cream-400"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      )}
      <ul className="mt-3 divide-y divide-brand-100">
        {ordered.map((location) => (
          <li key={location.id} className="flex items-center justify-between gap-3 py-2">
            <span className="min-w-0 truncate font-medium text-brand-800">{location.name}</span>
            <QuantityStepper
              key={`${variantId}:${location.id}`}
              variantId={variantId}
              locationId={location.id}
              quantity={levels[`${variantId}:${location.id}`] ?? 0}
              label={`${variant.label ? `${variant.label} ` : ""}${itemName} at ${location.name}`}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
