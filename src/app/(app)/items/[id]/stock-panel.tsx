"use client";

import { useEffect, useRef, useState } from "react";
import { useManualAction } from "@/components/action-form";
import { Alert, Button, Card, CardHeader, EmptyState, Input, Select } from "@/components/ui";
import { REASON_LABELS, type StockReason } from "@/lib/format";
import { changeStock } from "../actions";

type Variant = { id: string; label: string | null };
type Location = { id: string; name: string };
type Mode = "add" | "remove" | "set" | "transfer";

const MODES: { value: Mode; label: string }[] = [
  { value: "add", label: "Add" },
  { value: "remove", label: "Remove" },
  { value: "set", label: "Set count" },
  { value: "transfer", label: "Transfer" },
];

const REASONS: Record<Exclude<Mode, "transfer">, StockReason[]> = {
  add: ["received", "returned", "count_correction", "other"],
  remove: ["issued", "damaged", "lost", "count_correction", "other"],
  set: ["count_correction", "initial_count", "other"],
};

const QUANTITY_LABEL: Record<Mode, string> = {
  add: "How many to add",
  remove: "How many to remove",
  set: "New count",
  transfer: "How many to move",
};

export function StockPanel({
  variants,
  locations,
  levels,
  canEdit,
}: {
  variants: Variant[];
  locations: Location[];
  /** quantity keyed by `${variantId}:${locationId}` */
  levels: Record<string, number>;
  canEdit: boolean;
}) {
  const { state, pending, onSubmit } = useManualAction(changeStock);
  const [mode, setMode] = useState<Mode>("add");
  const [variantId, setVariantId] = useState(variants[0]?.id ?? "");
  const [locationId, setLocationId] = useState(locations[0]?.id ?? "");
  const [toLocationId, setToLocationId] = useState("");
  const [reason, setReason] = useState<StockReason>("received");
  const quantityRef = useRef<HTMLInputElement>(null);
  const noteRef = useRef<HTMLInputElement>(null);

  // After a successful change, clear the amount and note but keep the selections.
  useEffect(() => {
    if (!state.success) return;
    if (quantityRef.current) quantityRef.current.value = "";
    if (noteRef.current) noteRef.current.value = "";
  }, [state]);

  const sized = variants.some((v) => v.label);
  const qty = (v: string, l: string) => levels[`${v}:${l}`] ?? 0;
  const rowTotal = (v: string) => locations.reduce((sum, l) => sum + qty(v, l.id), 0);
  const columnTotal = (l: string) => variants.reduce((sum, v) => sum + qty(v.id, l), 0);
  const grandTotal = variants.reduce((sum, v) => sum + rowTotal(v.id), 0);

  const chooseMode = (next: Mode) => {
    setMode(next);
    if (next !== "transfer") setReason(REASONS[next][0]);
  };

  const pickCell = (v: string, l: string) => {
    if (!canEdit) return;
    setVariantId(v);
    setLocationId(l);
    quantityRef.current?.focus();
  };

  if (locations.length === 0) {
    return (
      <Card>
        <CardHeader title="Stock" />
        <EmptyState>Add a location first (Settings → Locations), then you can record stock here.</EmptyState>
      </Card>
    );
  }

  if (variants.length === 0) {
    return (
      <Card>
        <CardHeader title="Stock" />
        <EmptyState>This item has no sizes yet. Add sizes below to start recording stock.</EmptyState>
      </Card>
    );
  }

  const otherLocations = locations.filter((l) => l.id !== locationId);
  const destinationId = otherLocations.some((l) => l.id === toLocationId) ? toLocationId : (otherLocations[0]?.id ?? "");

  return (
    <Card>
      <CardHeader title="Stock" actions={<span className="text-sm text-brand-500">Total: {grandTotal.toLocaleString()}</span>} />
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-cream-300 text-xs uppercase tracking-wide text-brand-500">
              <th className="px-4 py-2 text-left font-semibold">{sized ? "Size" : ""}</th>
              {locations.map((l) => (
                <th key={l.id} className="px-3 py-2 text-right font-semibold">
                  {l.name}
                </th>
              ))}
              {locations.length > 1 && <th className="px-4 py-2 text-right font-semibold">Total</th>}
            </tr>
          </thead>
          <tbody>
            {variants.map((v) => (
              <tr key={v.id} className="border-b border-cream-200 last:border-0">
                <th scope="row" className="px-4 py-2 text-left font-medium text-brand-800">
                  {v.label ?? "Quantity"}
                </th>
                {locations.map((l) => {
                  const selected = canEdit && v.id === variantId && l.id === locationId;
                  const value = qty(v.id, l.id);
                  return (
                    <td key={l.id} className="px-1 py-1 text-right">
                      <button
                        type="button"
                        onClick={() => pickCell(v.id, l.id)}
                        disabled={!canEdit}
                        title={canEdit ? `Change ${v.label ?? "stock"} at ${l.name}` : undefined}
                        className={`w-full rounded-md px-2 py-1 text-right tabular-nums transition ${
                          selected ? "bg-brand text-cream" : canEdit ? "hover:bg-cream-200" : ""
                        } ${value === 0 && !selected ? "text-brand-300" : "font-semibold"}`}
                      >
                        {value.toLocaleString()}
                      </button>
                    </td>
                  );
                })}
                {locations.length > 1 && (
                  <td className="px-4 py-2 text-right font-semibold tabular-nums">{rowTotal(v.id).toLocaleString()}</td>
                )}
              </tr>
            ))}
          </tbody>
          {variants.length > 1 && (
            <tfoot>
              <tr className="border-t border-cream-300 text-brand-600">
                <th scope="row" className="px-4 py-2 text-left text-xs uppercase tracking-wide">
                  Total
                </th>
                {locations.map((l) => (
                  <td key={l.id} className="px-3 py-2 text-right font-semibold tabular-nums">
                    {columnTotal(l.id).toLocaleString()}
                  </td>
                ))}
                {locations.length > 1 && (
                  <td className="px-4 py-2 text-right font-bold tabular-nums">{grandTotal.toLocaleString()}</td>
                )}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {canEdit && (
        <form
          className="space-y-4 border-t border-cream-300 bg-cream-100/60 px-5 py-4"
          onSubmit={onSubmit}
        >
          <input type="hidden" name="mode" value={mode} />
          <input type="hidden" name="variant_id" value={variantId} />
          <input type="hidden" name="location_id" value={locationId} />
          {mode === "transfer" && <input type="hidden" name="to_location_id" value={destinationId} />}
          {mode !== "transfer" && <input type="hidden" name="reason" value={reason} />}
          <div className="flex flex-wrap gap-1 rounded-lg bg-cream-200 p-1" role="tablist" aria-label="Type of change">
            {MODES.map((m) => (
              <button
                key={m.value}
                type="button"
                role="tab"
                aria-selected={mode === m.value}
                onClick={() => chooseMode(m.value)}
                disabled={m.value === "transfer" && locations.length < 2}
                className={`flex-1 whitespace-nowrap rounded-md px-2 py-1.5 text-sm font-medium transition disabled:opacity-40 ${
                  mode === m.value ? "bg-cream-50 text-brand shadow-sm" : "text-brand-600 hover:text-brand"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {sized ? (
              <label className="space-y-1 text-xs font-medium text-brand-500">
                Size
                <Select value={variantId} onChange={(e) => setVariantId(e.target.value)}>
                  {variants.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.label}
                    </option>
                  ))}
                </Select>
              </label>
            ) : null}
            <label className="space-y-1 text-xs font-medium text-brand-500">
              {mode === "transfer" ? "From" : "Location"}
              <Select value={locationId} onChange={(e) => setLocationId(e.target.value)}>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} ({qty(variantId, l.id)})
                  </option>
                ))}
              </Select>
            </label>
            {mode === "transfer" && (
              <label className="space-y-1 text-xs font-medium text-brand-500">
                To
                <Select value={destinationId} onChange={(e) => setToLocationId(e.target.value)}>
                  {otherLocations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} ({qty(variantId, l.id)})
                    </option>
                  ))}
                </Select>
              </label>
            )}
            <label className="space-y-1 text-xs font-medium text-brand-500">
              {QUANTITY_LABEL[mode]}
              <Input
                ref={quantityRef}
                name="quantity"
                type="number"
                inputMode="numeric"
                min={mode === "set" ? 0 : 1}
                max={mode === "remove" || mode === "transfer" ? qty(variantId, locationId) : undefined}
                step={1}
                required
                placeholder={mode === "set" ? String(qty(variantId, locationId)) : "0"}
              />
            </label>
            {mode !== "transfer" && (
              <label className="space-y-1 text-xs font-medium text-brand-500">
                Reason
                <Select value={reason} onChange={(e) => setReason(e.target.value as StockReason)}>
                  {REASONS[mode].map((r) => (
                    <option key={r} value={r}>
                      {REASON_LABELS[r]}
                    </option>
                  ))}
                </Select>
              </label>
            )}
            <label className="space-y-1 text-xs font-medium text-brand-500 sm:col-span-2">
              Note {reason === "other" && mode !== "transfer" ? "(required)" : "(optional)"}
              <Input
                ref={noteRef}
                name="note"
                required={reason === "other" && mode !== "transfer"}
                placeholder="e.g. Fall orientation packs, PO #123"
              />
            </label>
          </div>

          {state.error && <Alert>{state.error}</Alert>}
          {state.success && <Alert tone="success">{state.success}</Alert>}
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save change"}
          </Button>
        </form>
      )}
    </Card>
  );
}
