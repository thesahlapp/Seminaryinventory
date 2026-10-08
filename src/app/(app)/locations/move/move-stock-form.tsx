"use client";

import Link from "next/link";
import { startTransition, useActionState, useEffect, useState } from "react";
import { Alert, Button, Card, Input, Select } from "@/components/ui";
import { initialActionState } from "@/lib/action-state";
import { getItemStock, moveStock, searchItems, type ItemStock } from "../actions";

type Location = { id: string; name: string };
type SearchResult = { id: string; name: string; sku: string | null };

export function MoveStockForm({
  locations,
  initialItem,
  initialFrom,
}: {
  locations: Location[];
  initialItem: ItemStock | null;
  initialFrom?: string;
}) {
  const [state, dispatch, pending] = useActionState(moveStock, initialActionState);
  const [item, setItem] = useState<ItemStock | null>(initialItem);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [variantId, setVariantId] = useState(initialItem?.variants[0]?.id ?? "");
  const [from, setFrom] = useState(initialFrom ?? "");
  const [to, setTo] = useState("");
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const [lastMove, setLastMove] = useState<string | null>(null);

  const qty = (locationId: string) =>
    item?.levels.find((l) => l.variant_id === variantId && l.location_id === locationId)?.quantity ?? 0;

  // Item search (only while no item is chosen).
  useEffect(() => {
    if (item) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      const found = await searchItems(query);
      if (!cancelled) setResults(found);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, item]);

  // After a successful move, reload the item's numbers and clear the amount.
  useEffect(() => {
    if (!state.success || !item) return;
    let cancelled = false;
    getItemStock(item.id).then((fresh) => {
      if (cancelled) return;
      setItem(fresh);
      setQuantity("");
      setNote("");
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  async function choose(result: SearchResult) {
    const stock = await getItemStock(result.id);
    setItem(stock);
    setVariantId(stock?.variants[0]?.id ?? "");
    setLastMove(null);
  }

  const fromOptions = locations.filter((l) => qty(l.id) > 0 || l.id === from);
  const fromQty = from ? qty(from) : 0;
  const toOptions = locations.filter((l) => l.id !== from);
  const sizeLabel = item?.variants.find((v) => v.id === variantId)?.label;

  return (
    <Card className="p-5">
      <form
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          const fromName = locations.find((l) => l.id === from)?.name;
          const toName = locations.find((l) => l.id === to)?.name;
          setLastMove(
            `${quantity} × ${sizeLabel ? `${sizeLabel} ` : ""}${item?.name} from ${fromName} to ${toName}`,
          );
          startTransition(() => dispatch(formData));
        }}
      >
        <input type="hidden" name="variant_id" value={variantId} />
        <input type="hidden" name="from_location_id" value={from} />
        <input type="hidden" name="to_location_id" value={to} />

        {/* 1. Item */}
        <div className="space-y-1">
          <p className="text-sm font-medium text-brand-800">Item</p>
          {item ? (
            <div className="flex items-center justify-between gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2">
              <span className="min-w-0 truncate font-medium text-brand-800">
                {item.name}
                {item.sku && <span className="ml-2 font-mono text-xs text-brand-500">{item.sku}</span>}
              </span>
              <button
                type="button"
                className="text-sm text-brand-600 underline-offset-2 hover:underline"
                onClick={() => {
                  setItem(null);
                  setVariantId("");
                  setQuery("");
                }}
              >
                Change
              </button>
            </div>
          ) : (
            <div>
              <Input
                type="search"
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name or SKU"
                aria-label="Search for an item"
              />
              <ul className="mt-2 max-h-64 divide-y divide-cream-200 overflow-y-auto rounded-lg border border-cream-300">
                {results.length === 0 && <li className="px-3 py-2 text-sm text-brand-400">No matching items.</li>}
                {results.map((result) => (
                  <li key={result.id}>
                    <button
                      type="button"
                      onClick={() => choose(result)}
                      className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm hover:bg-cream-100"
                    >
                      <span className="font-medium text-brand-800">{result.name}</span>
                      {result.sku && <span className="font-mono text-xs text-brand-400">{result.sku}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {item && item.variants.length === 0 && (
          <Alert>This item has no sizes yet. Add sizes on the item page first.</Alert>
        )}

        {item && item.variants.length > 0 && (
          <>
            {/* 2. Size */}
            {item.hasSizes && (
              <div className="space-y-1">
                <p className="text-sm font-medium text-brand-800">Size</p>
                <div className="flex flex-wrap gap-2">
                  {item.variants.map((v) => {
                    const total = item.levels.filter((l) => l.variant_id === v.id).reduce((s, l) => s + l.quantity, 0);
                    return (
                      <button
                        key={v.id}
                        type="button"
                        aria-pressed={v.id === variantId}
                        onClick={() => setVariantId(v.id)}
                        className={`rounded-lg border px-3 py-2 text-sm ${
                          v.id === variantId
                            ? "border-brand bg-brand text-cream"
                            : "border-cream-400 bg-cream-50 text-brand-800 hover:bg-cream-100"
                        }`}
                      >
                        {v.label} <span className="opacity-70">({total})</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 3. From / To */}
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1 text-sm font-medium text-brand-800">
                From
                <Select value={from} onChange={(e) => setFrom(e.target.value)}>
                  <option value="">Choose…</option>
                  {fromOptions.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} ({qty(l.id)})
                    </option>
                  ))}
                </Select>
                {fromOptions.length === 0 && (
                  <span className="block text-xs font-normal text-amber-800">None of this is in stock anywhere.</span>
                )}
              </label>
              <label className="space-y-1 text-sm font-medium text-brand-800">
                To
                <Select value={to} onChange={(e) => setTo(e.target.value)}>
                  <option value="">Choose…</option>
                  {toOptions.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} ({qty(l.id)})
                    </option>
                  ))}
                </Select>
              </label>
            </div>

            {/* 4. Quantity and note */}
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1 text-sm font-medium text-brand-800">
                How many
                <div className="flex gap-2">
                  <Input
                    name="quantity"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={fromQty || undefined}
                    step={1}
                    required
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="flex-1"
                  />
                  {fromQty > 0 && (
                    <Button type="button" variant="secondary" onClick={() => setQuantity(String(fromQty))}>
                      All ({fromQty})
                    </Button>
                  )}
                </div>
              </label>
              <label className="space-y-1 text-sm font-medium text-brand-800">
                Note <span className="font-normal text-brand-400">(optional)</span>
                <Input name="note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. For orientation week" />
              </label>
            </div>
          </>
        )}

        {state.error && <Alert>{state.error}</Alert>}
        {state.success && lastMove && !pending && (
          <Alert tone="success">
            Moved {lastMove}.{" "}
            {item && (
              <Link href={`/items/${item.id}`} className="underline">
                View item
              </Link>
            )}
          </Alert>
        )}

        <Button type="submit" disabled={pending || !item || !variantId || !from || !to || !quantity} className="w-full sm:w-auto">
          {pending ? "Moving…" : "Move stock"}
        </Button>
      </form>
    </Card>
  );
}
