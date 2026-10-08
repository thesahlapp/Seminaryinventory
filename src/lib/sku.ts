import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

/** Escapes LIKE wildcards so a SKU is matched literally (case-insensitive). */
const literal = (value: string) => value.replace(/[\\%_]/g, (c) => `\\${c}`);

/** Finds the item (and size, if a size has its own SKU) for a SKU. SKUs are unique, ignoring case. */
export async function findBySku(supabase: SupabaseClient<Database>, sku: string): Promise<{ itemId: string; variantId: string | null } | null> {
  const value = sku.trim();
  if (!value) return null;
  const { data: item } = await supabase.from("items").select("id").ilike("sku", literal(value)).maybeSingle();
  if (item) return { itemId: item.id, variantId: null };
  const { data: variant } = await supabase.from("item_variants").select("id, item_id").ilike("sku", literal(value)).maybeSingle();
  return variant ? { itemId: variant.item_id, variantId: variant.id } : null;
}
