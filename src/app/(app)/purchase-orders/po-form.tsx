"use client";

import Link from "next/link";
import { startTransition, useActionState, useEffect, useState } from "react";
import { Alert, Button, Card, Field, Input, Select, Textarea } from "@/components/ui";
import { initialActionState } from "@/lib/action-state";
import { formatMoney } from "@/lib/money";
import { type PoItemOption, savePurchaseOrder, searchPoItems } from "./actions";

export type PoLine = { key: string; item: PoItemOption; variantId: string; quantity: string; unitCost: string };

export function PoForm({
  suppliers,
  locations,
  po,
  initialLines,
}: {
  suppliers: { id: string; name: string }[];
  locations: { id: string; name: string }[];
  po?: { id: string; supplier_id: string; destination_location_id: string; expected_date: string | null; notes: string | null };
  initialLines: PoLine[];
}) {
  const [state, dispatch, pending] = useActionState(savePurchaseOrder, initialActionState);
  const [lines, setLines] = useState(initialLines);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PoItemOption[]>([]);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      const found = await searchPoItems(query);
      if (!cancelled) setResults(found);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  const update = (key: string, changes: Partial<PoLine>) => setLines(lines.map((l) => (l.key === key ? { ...l, ...changes } : l)));
  const total = lines.reduce((n, l) => n + (Number(l.quantity) || 0) * (Number(l.unitCost) || 0), 0);
  const payload = lines.map((l) => ({
    variant_id: l.variantId,
    quantity_ordered: Number(l.quantity),
    unit_cost: l.unitCost.trim() === "" ? null : Number(l.unitCost.replace(/[$,]/g, "")),
  }));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
        if (submitter?.value) formData.set("intent", submitter.value);
        startTransition(() => dispatch(formData));
      }}
    >
      <Card className="space-y-5 p-5">
        {po && <input type="hidden" name="id" value={po.id} />}
        <input type="hidden" name="lines" value={JSON.stringify(payload)} />
        {state.error && <Alert>{state.error}</Alert>}
        {suppliers.length === 0 && (
          <Alert>
            Add a supplier first under{" "}
            <Link href="/purchase-orders/suppliers" className="underline">
              Suppliers
            </Link>
            .
          </Alert>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Supplier" htmlFor="supplier_id">
            <Select id="supplier_id" name="supplier_id" defaultValue={po?.supplier_id ?? ""} required>
              <option value="">Choose…</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Deliver to" htmlFor="destination_location_id">
            <Select id="destination_location_id" name="destination_location_id" defaultValue={po?.destination_location_id ?? locations[0]?.id} required>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Expected" htmlFor="expected_date" hint="Optional">
            <Input id="expected_date" name="expected_date" type="date" defaultValue={po?.expected_date ?? ""} />
          </Field>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-brand-800">Items</p>
          {lines.length > 0 && (
            <ul className="divide-y divide-cream-200 rounded-lg border border-cream-300">
              {lines.map((line) => (
                <li key={line.key} className="flex flex-wrap items-end gap-2 px-3 py-2">
                  <span className="min-w-32 flex-1 pb-2 text-sm font-medium text-brand-800">{line.item.name}</span>
                  {line.item.variants.some((v) => v.label) && (
                    <label className="flex flex-col gap-1 text-xs text-brand-500">
                      Size
                      <Select value={line.variantId} onChange={(e) => update(line.key, { variantId: e.target.value })} className="w-24">
                        {line.item.variants.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.label}
                          </option>
                        ))}
                      </Select>
                    </label>
                  )}
                  <label className="flex flex-col gap-1 text-xs text-brand-500">
                    Qty
                    <Input type="number" inputMode="numeric" min={1} value={line.quantity} onChange={(e) => update(line.key, { quantity: e.target.value })} className="w-20" />
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-brand-500">
                    Unit cost
                    <Input inputMode="decimal" value={line.unitCost} onChange={(e) => update(line.key, { unitCost: e.target.value })} placeholder="0.00" className="w-24" />
                  </label>
                  <button type="button" onClick={() => setLines(lines.filter((l) => l.key !== line.key))} className="px-2 pb-2 text-sm text-red-700" aria-label={`Remove ${line.item.name}`}>
                    ✕
                  </button>
                </li>
              ))}
              <li className="flex justify-between px-3 py-2 text-sm font-semibold text-brand-800">
                <span>Total</span>
                <span className="tabular-nums">{formatMoney(total)}</span>
              </li>
            </ul>
          )}
          <Input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search items to add" aria-label="Search items to add" />
          <ul className="max-h-48 divide-y divide-cream-200 overflow-y-auto rounded-lg border border-cream-300">
            {results.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  disabled={item.variants.length === 0}
                  onClick={() =>
                    setLines([
                      ...lines,
                      { key: crypto.randomUUID(), item, variantId: item.variants[0].id, quantity: "1", unitCost: item.unitCost != null ? item.unitCost.toFixed(2) : "" },
                    ])
                  }
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-cream-100 disabled:opacity-50"
                >
                  <span className="font-medium text-brand-800">{item.name}</span>
                  <span className="text-xs text-brand-400">{item.unitCost != null ? formatMoney(item.unitCost) : ""} Add</span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <Field label="Notes" htmlFor="notes" hint="Optional, e.g. order reference">
          <Textarea id="notes" name="notes" defaultValue={po?.notes ?? ""} rows={2} />
        </Field>

        <div className="flex flex-wrap gap-2">
          <Button type="submit" value="order" disabled={pending}>
            {pending ? "Saving…" : "Save and mark ordered"}
          </Button>
          <Button type="submit" value="draft" variant="secondary" disabled={pending}>
            Save as draft
          </Button>
        </div>
      </Card>
    </form>
  );
}
