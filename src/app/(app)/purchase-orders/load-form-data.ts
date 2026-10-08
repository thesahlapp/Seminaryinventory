import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { PoItemOption } from "./actions";
import type { PoLine } from "./po-form";

type Supabase = Awaited<ReturnType<typeof createClient>>;
type OptionWithStock = Omit<PoItemOption, "variants"> & { variants: { id: string; label: string | null; onHand: number }[] };

/** Item options (sizes and current unit cost) for the given item ids. */
export async function poItemOptions(supabase: Supabase, itemIds: string[]) {
  if (!itemIds.length) return new Map<string, OptionWithStock>();
  const { data } = await supabase
    .from("items")
    .select("id, name, sku, item_costs(unit_cost), item_variants(id, archived_at, sizes(label, sort_order), stock_levels(quantity))")
    .in("id", itemIds);
  return new Map<string, OptionWithStock>(
    (data ?? []).map((i) => [
      i.id,
      {
        id: i.id,
        name: i.name,
        sku: i.sku,
        unitCost: i.item_costs?.unit_cost != null ? Number(i.item_costs.unit_cost) : null,
        variants: i.item_variants
          .filter((v) => !v.archived_at)
          .sort((a, b) => (a.sizes?.sort_order ?? 0) - (b.sizes?.sort_order ?? 0))
          .map((v) => ({ id: v.id, label: v.sizes?.label ?? null, onHand: v.stock_levels.reduce((n, l) => n + l.quantity, 0) })),
      },
    ]),
  );
}

/** Lines for everything at or below its minimum, with a quantity that brings it back above. */
export async function lowStockLines(supabase: Supabase, onlyItemId?: string): Promise<PoLine[]> {
  let query = supabase.from("low_stock").select("item_id, variant_id, shortfall");
  if (onlyItemId) query = query.eq("item_id", onlyItemId);
  const { data: low } = await query;
  const options = await poItemOptions(supabase, [...new Set((low ?? []).map((r) => r.item_id!))]);

  const lines: PoLine[] = [];
  // Size-specific minimums first (they say exactly which size is short).
  const ordered = [...(low ?? [])].sort((a, b) => Number(b.variant_id !== null) - Number(a.variant_id !== null));
  for (const row of ordered) {
    const option = options.get(row.item_id!);
    if (!option || !option.variants.length) continue;
    // Item-level minimum on a sized item: order the least-stocked size not already on the PO.
    const variantId =
      row.variant_id ??
      [...option.variants].filter((v) => !lines.some((l) => l.variantId === v.id)).sort((a, b) => a.onHand - b.onHand)[0]?.id;
    if (!variantId || lines.some((l) => l.variantId === variantId)) continue;
    lines.push({
      key: `${row.item_id}-${variantId}`,
      item: { ...option, variants: option.variants.map(({ id, label }) => ({ id, label })) },
      variantId,
      quantity: String(Math.max(1, Number(row.shortfall ?? 0) + 1)),
      unitCost: option.unitCost != null ? option.unitCost.toFixed(2) : "",
    });
  }
  return lines;
}
