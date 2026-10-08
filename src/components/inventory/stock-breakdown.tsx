"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { InventoryRow } from "@/lib/inventory";
import { QuantityStepper } from "./quantity-stepper";

type Location = { id: string; name: string };

/**
 * The quantity shown on each inventory card/row.
 *
 * - One size and one location in view: the +/− control directly.
 * - Otherwise: the total, which opens a breakdown by size and location
 *   (hover on a computer, tap on a phone). Editors can change any line there.
 */
export function StockBreakdown({
  item,
  locations,
  canEdit,
}: {
  item: Pick<InventoryRow, "id" | "name" | "hasSizes" | "totalQuantity" | "variants" | "levels">;
  locations: Location[];
  canEdit: boolean;
}) {
  const qty = (variantId: string, locationId: string) =>
    item.levels.find((l) => l.variant_id === variantId && l.location_id === locationId)?.quantity ?? 0;

  if (item.variants.length === 0) {
    return (
      <Link href={`/items/${item.id}`} className="text-xs text-amber-800 underline-offset-2 hover:underline">
        Add sizes
      </Link>
    );
  }

  if (locations.length === 0) {
    return <span className="text-xs text-brand-400">No locations yet</span>;
  }

  if (canEdit && item.variants.length === 1 && locations.length === 1) {
    const [variant] = item.variants;
    const [location] = locations;
    return (
      <QuantityStepper
        variantId={variant.id}
        locationId={location.id}
        quantity={qty(variant.id, location.id)}
        label={`${item.name} at ${location.name}`}
      />
    );
  }

  return <BreakdownPopover item={item} locations={locations} canEdit={canEdit} qty={qty} />;
}

function BreakdownPopover({
  item,
  locations,
  canEdit,
  qty,
}: {
  item: Pick<InventoryRow, "id" | "name" | "hasSizes" | "totalQuantity" | "variants">;
  locations: Location[];
  canEdit: boolean;
  qty: (variantId: string, locationId: string) => number;
}) {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const close = () => {
    setOpen(false);
    setPinned(false);
  };

  // Place the panel under the button on larger screens (phones use a bottom sheet).
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      if (window.innerWidth < 640) return setPosition(null);
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = 320;
      const left = Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8));
      const below = rect.bottom + 6;
      const panelHeight = panelRef.current?.offsetHeight ?? 300;
      const top = below + panelHeight > window.innerHeight - 8 ? Math.max(8, rect.top - panelHeight - 6) : below;
      setPosition({ top, left });
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open]);

  // Close on outside tap or Escape.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!panelRef.current?.contains(target) && !triggerRef.current?.contains(target)) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const hoverOpen = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    clearTimeout(closeTimer.current);
    setOpen(true);
  };
  const hoverClose = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse" || pinned) return;
    closeTimer.current = setTimeout(() => setOpen(false), 200);
  };

  const rows = item.variants.map((variant) => ({
    variant,
    subtotal: locations.reduce((sum, l) => sum + qty(variant.id, l.id), 0),
  }));

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onPointerEnter={hoverOpen}
        onPointerLeave={hoverClose}
        onClick={() => {
          if (open && pinned) close();
          else {
            setOpen(true);
            setPinned(true);
          }
        }}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-semibold tabular-nums text-brand-800 ring-1 ring-cream-400 hover:bg-cream-100"
      >
        {item.totalQuantity.toLocaleString()}
        <span className="text-[11px] font-normal text-brand-400">{canEdit ? "edit" : "details"}</span>
        <span aria-hidden className="text-brand-400">▾</span>
      </button>

      {open &&
        createPortal(
          <>
            {/* Dim background on phones */}
            <div className="fixed inset-0 z-40 bg-ink/30 sm:hidden" aria-hidden onClick={close} />
            <div
              ref={panelRef}
              role="dialog"
              aria-label={`${item.name} stock`}
              onPointerEnter={hoverOpen}
              onPointerLeave={hoverClose}
              style={position ? { top: position.top, left: position.left } : undefined}
              className="fixed inset-x-0 bottom-0 z-50 max-h-[75vh] overflow-y-auto rounded-t-2xl border border-cream-300 bg-cream-50 shadow-xl sm:inset-x-auto sm:bottom-auto sm:max-h-[60vh] sm:w-80 sm:rounded-xl"
            >
              <div className="sticky top-0 flex items-center justify-between gap-2 border-b border-cream-300 bg-cream-50 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-display text-sm font-semibold text-brand">{item.name}</p>
                  <p className="text-xs text-brand-500">Total {item.totalQuantity.toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-1">
                  <Link href={`/items/${item.id}`} className="rounded-md px-2 py-1 text-xs text-brand-600 hover:bg-cream-200">
                    Open item
                  </Link>
                  <button
                    type="button"
                    onClick={close}
                    aria-label="Close"
                    className="rounded-md px-2 py-1 text-brand-500 hover:bg-cream-200"
                  >
                    ✕
                  </button>
                </div>
              </div>
              <div className="divide-y divide-cream-200 pb-[env(safe-area-inset-bottom)]">
                {rows.map(({ variant, subtotal }) => (
                  <div key={variant.id} className="px-4 py-2">
                    {item.hasSizes && (
                      <p className="flex justify-between pb-1 text-xs font-semibold uppercase tracking-wide text-brand-500">
                        <span>Size {variant.label}</span>
                        <span className="tabular-nums">{subtotal}</span>
                      </p>
                    )}
                    <ul>
                      {locations.map((location) => (
                        <li key={location.id} className="flex items-center justify-between gap-3 py-1">
                          <span className="min-w-0 truncate text-sm text-brand-800">{location.name}</span>
                          {canEdit ? (
                            <QuantityStepper
                              size="sm"
                              variantId={variant.id}
                              locationId={location.id}
                              quantity={qty(variant.id, location.id)}
                              label={`${variant.label ? `${variant.label} ` : ""}${item.name} at ${location.name}`}
                            />
                          ) : (
                            <span className="font-semibold tabular-nums">{qty(variant.id, location.id)}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </>,
          document.body,
        )}
    </>
  );
}
