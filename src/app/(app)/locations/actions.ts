"use server";

import { refresh } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { authorize } from "@/lib/auth";
import { friendlyError } from "@/lib/errors";
import { formText, sanitizeSearch } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export type ItemStock = {
  id: string;
  name: string;
  sku: string | null;
  hasSizes: boolean;
  variants: { id: string; label: string | null }[];
  levels: { variant_id: string; location_id: string; quantity: number }[];
};

/** Items matching a name or SKU, for the Move stock item picker. */
export async function searchItems(query: string) {
  const q = sanitizeSearch(query).slice(0, 100);
  const supabase = await createClient();
  let request = supabase.from("items").select("id, name, sku").is("archived_at", null).order("name").limit(20);
  if (q) request = request.or(`name.ilike.*${q}*,sku.ilike.*${q}*`);
  const { data } = await request;
  return data ?? [];
}

/** An item's sizes and how many of each are at each location. */
export async function getItemStock(itemId: string): Promise<ItemStock | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("items")
    .select("id, name, sku, has_sizes, item_variants(id, archived_at, sizes(label, sort_order), stock_levels(location_id, quantity))")
    .eq("id", itemId)
    .maybeSingle();
  if (!data) return null;

  const variants = data.item_variants
    .filter((v) => !v.archived_at)
    .sort((a, b) => (a.sizes?.sort_order ?? 0) - (b.sizes?.sort_order ?? 0));

  return {
    id: data.id,
    name: data.name,
    sku: data.sku,
    hasSizes: data.has_sizes,
    variants: variants.map((v) => ({ id: v.id, label: v.sizes?.label ?? null })),
    levels: variants.flatMap((v) => v.stock_levels.map((l) => ({ variant_id: v.id, ...l }))),
  };
}

/** Moves units between two locations; logged as a transfer out + transfer in. */
export async function moveStock(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorize("edit");
  if ("error" in auth) return { error: auth.error };

  const variantId = formText(formData, "variant_id");
  const from = formText(formData, "from_location_id");
  const to = formText(formData, "to_location_id");
  const quantityText = formText(formData, "quantity") ?? "";
  const note = formText(formData, "note");

  if (!variantId) return { error: "Choose an item (and size)." };
  if (!from) return { error: "Choose where the stock is now." };
  if (!to) return { error: "Choose where it's going." };
  if (from === to) return { error: "Choose two different locations." };
  if (!/^\d+$/.test(quantityText) || Number(quantityText) === 0) return { error: "Enter how many to move." };

  const { error } = await auth.supabase.rpc("transfer_stock", {
    p_variant_id: variantId,
    p_from_location_id: from,
    p_to_location_id: to,
    p_quantity: Number(quantityText),
    p_note: note ?? undefined,
  });
  if (error) return { error: friendlyError(error) };

  refresh();
  return { success: `Moved ${quantityText}.` };
}
