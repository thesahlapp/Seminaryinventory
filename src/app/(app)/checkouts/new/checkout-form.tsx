"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import { Alert, Button, Card, Field, Input, Select, Textarea } from "@/components/ui";
import { initialActionState } from "@/lib/action-state";
import { type CheckoutableItem, createCheckout, searchCheckoutable } from "../actions";

type Person = { id: string; name: string };
type Location = { id: string; name: string };
type Line = { key: string; item: CheckoutableItem; variantId: string; locationId: string; quantity: string };

function inDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(d);
}

function bestLocation(item: CheckoutableItem, variantId: string) {
  const variant = item.variants.find((v) => v.id === variantId);
  return [...(variant?.levels ?? [])].sort((a, b) => b.quantity - a.quantity)[0]?.location_id ?? "";
}

function newLine(item: CheckoutableItem): Line {
  // Default to the size with the most available.
  const variant = [...item.variants].sort(
    (a, b) => b.levels.reduce((n, l) => n + l.quantity, 0) - a.levels.reduce((n, l) => n + l.quantity, 0),
  )[0];
  return { key: crypto.randomUUID(), item, variantId: variant?.id ?? "", locationId: variant ? bestLocation(item, variant.id) : "", quantity: "1" };
}

export function CheckoutForm({
  people,
  locations,
  kits,
  initialItems,
  initialKitId,
}: {
  people: Person[];
  locations: Location[];
  kits: { id: string; name: string }[];
  initialItems: CheckoutableItem[];
  initialKitId: string | null;
}) {
  const [state, dispatch, pending] = useActionState(createCheckout, initialActionState);
  const [mode, setMode] = useState<"items" | "kit">(initialKitId ? "kit" : "items");
  const [lines, setLines] = useState<Line[]>(() => initialItems.map(newLine));
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CheckoutableItem[]>([]);
  const [borrower, setBorrower] = useState("");

  useEffect(() => {
    if (mode !== "items") return;
    let cancelled = false;
    const t = setTimeout(async () => {
      const found = await searchCheckoutable(query);
      if (!cancelled) setResults(found);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, mode]);

  const borrowerMatch = people.find((p) => p.name.toLowerCase() === borrower.trim().toLowerCase());
  const locationName = (id: string) => locations.find((l) => l.id === id)?.name ?? "Unknown location";
  const update = (key: string, changes: Partial<Line>) => setLines(lines.map((l) => (l.key === key ? { ...l, ...changes } : l)));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        startTransition(() => dispatch(formData));
      }}
    >
      <Card className="space-y-6 p-5">
        {state.error && <Alert>{state.error}</Alert>}

        {kits.length > 0 && (
          <div className="flex gap-1 rounded-lg bg-cream-200 p-1" role="tablist" aria-label="What to check out">
            {(["items", "kit"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => setMode(m)}
                className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium ${mode === m ? "bg-cream-50 text-brand-700 shadow-sm" : "text-brand-600"}`}
              >
                {m === "items" ? "Items" : "A whole kit"}
              </button>
            ))}
          </div>
        )}

        {mode === "kit" ? (
          <Field label="Kit" htmlFor="kit_id" hint="Every item in the kit is checked out, from wherever it's stored.">
            <Select id="kit_id" name="kit_id" defaultValue={initialKitId ?? ""} required>
              <option value="">Choose a kit…</option>
              {kits.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.name}
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          <div className="space-y-3">
            <input type="hidden" name="lines" value={JSON.stringify(lines.map((l) => ({ variant_id: l.variantId, location_id: l.locationId, quantity: Number(l.quantity) })))} />
            <p className="text-sm font-medium text-brand-800">Items</p>
            {lines.length > 0 && (
              <ul className="space-y-2">
                {lines.map((line) => {
                  const variant = line.item.variants.find((v) => v.id === line.variantId);
                  const available = variant?.levels.find((l) => l.location_id === line.locationId)?.quantity ?? 0;
                  const sized = line.item.variants.some((v) => v.label);
                  return (
                    <li key={line.key} className="rounded-lg border border-cream-300 bg-cream-100 p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="font-medium text-brand-800">{line.item.name}</span>
                        <button type="button" onClick={() => setLines(lines.filter((l) => l.key !== line.key))} className="text-sm text-red-700" aria-label={`Remove ${line.item.name}`}>
                          Remove
                        </button>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-[1fr_2fr_6rem]">
                        {sized ? (
                          <Select
                            aria-label="Size"
                            value={line.variantId}
                            onChange={(e) => update(line.key, { variantId: e.target.value, locationId: bestLocation(line.item, e.target.value) })}
                          >
                            {line.item.variants.map((v) => (
                              <option key={v.id} value={v.id}>
                                {v.label} ({v.levels.reduce((n, l) => n + l.quantity, 0)})
                              </option>
                            ))}
                          </Select>
                        ) : (
                          <span className="hidden sm:block" />
                        )}
                        <Select aria-label="From location" value={line.locationId} onChange={(e) => update(line.key, { locationId: e.target.value })}>
                          {!line.locationId && <option value="">None available</option>}
                          {(variant?.levels ?? [])
                            .filter((l) => l.quantity > 0 || l.location_id === line.locationId)
                            .map((l) => (
                              <option key={l.location_id} value={l.location_id}>
                                {locationName(l.location_id)} ({l.quantity} available)
                              </option>
                            ))}
                        </Select>
                        <Input
                          aria-label="Quantity"
                          type="number"
                          inputMode="numeric"
                          min={1}
                          max={available || undefined}
                          value={line.quantity}
                          onChange={(e) => update(line.key, { quantity: e.target.value })}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            <div>
              <Input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search items that can be checked out" aria-label="Search items" />
              <ul className="mt-2 max-h-56 divide-y divide-cream-200 overflow-y-auto rounded-lg border border-cream-300">
                {results.length === 0 && (
                  <li className="px-3 py-2 text-sm text-brand-400">
                    No matching items. Only items marked “Can be checked out” appear here.
                  </li>
                )}
                {results.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => setLines([...lines, newLine(item)])}
                      className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm hover:bg-cream-100"
                    >
                      <span className="font-medium text-brand-800">{item.name}</span>
                      <span className="text-xs text-brand-400">
                        {item.variants.reduce((n, v) => n + v.levels.reduce((m, l) => m + l.quantity, 0), 0)} available · Add
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Who is taking them" htmlFor="borrower_name" hint={borrowerMatch ? "Team member — they'll get overdue reminders." : "A team member, or type any name."}>
            <Input
              id="borrower_name"
              name="borrower_name"
              list="borrowers"
              required
              value={borrower}
              onChange={(e) => setBorrower(e.target.value)}
              autoComplete="off"
            />
            <datalist id="borrowers">
              {people.map((p) => (
                <option key={p.id} value={p.name} />
              ))}
            </datalist>
            {borrowerMatch && <input type="hidden" name="borrower_id" value={borrowerMatch.id} />}
          </Field>
          <Field label="Due back" htmlFor="due_date">
            <Input id="due_date" name="due_date" type="date" required defaultValue={inDays(7)} />
          </Field>
          <Field label="Project or job" htmlFor="project" hint="Optional">
            <Input id="project" name="project" placeholder="e.g. Youth camp, Ramadan shoot" />
          </Field>
          <Field label="Notes" htmlFor="notes" hint="Optional">
            <Textarea id="notes" name="notes" rows={1} />
          </Field>
        </div>

        <Button type="submit" disabled={pending || (mode === "items" && lines.length === 0)} className="w-full sm:w-auto">
          {pending ? "Checking out…" : "Check out"}
        </Button>
      </Card>
    </form>
  );
}
