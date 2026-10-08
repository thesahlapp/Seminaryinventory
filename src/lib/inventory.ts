import "server-only";
import type { CategoryField } from "@/lib/custom-fields";
import { fieldFiltersForDb, type InventoryParams } from "@/lib/inventory-params";
import { getPhotoUrls } from "@/lib/photos";
import type { Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

export { parseInventoryParams, inventoryHref } from "@/lib/inventory-params";

export const PAGE_SIZE = 60;

export type InventoryRow = {
  id: string;
  name: string;
  sku: string | null;
  hasSizes: boolean;
  categoryName: string | null;
  photoUrl: string | null;
  totalQuantity: number;
  checkedOut: number;
  lowStock: boolean;
  lastUpdated: string;
  customFields: Record<string, Json>;
  unitCost: number | null;
  variants: { id: string; label: string | null; min_quantity: number | null }[];
  levels: { variant_id: string; location_id: string; quantity: number }[];
};

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Calls inventory_items() with the page's filters. */
export async function queryInventory(supabase: Supabase, params: InventoryParams, fieldTypes: Record<string, string>, limit: number, offset: number) {
  return supabase.rpc("inventory_items", {
    p_search: params.q || undefined,
    p_category_ids: params.categories.filter((c) => c !== "none"),
    p_uncategorized: params.categories.includes("none"),
    p_location_ids: params.locations,
    p_archived: params.archived,
    p_sort: params.sort,
    p_descending: params.dir === "desc",
    p_limit: limit,
    p_offset: offset,
    p_low_stock: params.lowStock,
    p_checkoutable: params.checkoutable,
    p_field_filters: fieldFiltersForDb(params.fieldFilters, fieldTypes),
  });
}

export async function loadInventory(params: InventoryParams, { withCosts = false } = {}) {
  const supabase = await createClient();

  const [categories, locations, fields] = await Promise.all([
    supabase.from("categories").select("id, name").is("archived_at", null).order("sort_order").order("name"),
    supabase.from("locations").select("id, name, archived_at").order("sort_order").order("name"),
    supabase.from("category_fields").select("*").order("sort_order").order("label"),
  ]);
  if (categories.error) throw categories.error;
  if (locations.error) throw locations.error;

  const allFields = (fields.data ?? []) as CategoryField[];
  const fieldTypes = Object.fromEntries(allFields.map((f) => [f.id, f.field_type]));

  const result = await queryInventory(supabase, params, fieldTypes, PAGE_SIZE, (params.page - 1) * PAGE_SIZE);
  // The database function comes from the latest migrations; say so clearly if they haven't been run.
  if (result.error && (result.error.code === "PGRST202" || result.error.message.includes("inventory_items"))) {
    return { setupNeeded: true as const };
  }
  if (result.error) throw result.error;

  const [photoUrls, costs] = await Promise.all([
    getPhotoUrls(supabase, result.data.flatMap((row) => (row.photo_path ? [row.photo_path] : []))),
    withCosts && result.data.length
      ? supabase.from("item_costs").select("item_id, unit_cost").in("item_id", result.data.map((r) => r.id))
      : null,
  ]);
  const costByItem = new Map((costs?.data ?? []).map((c) => [c.item_id, c.unit_cost === null ? null : Number(c.unit_cost)]));

  const rows: InventoryRow[] = result.data.map((row) => ({
    id: row.id,
    name: row.name,
    sku: row.sku ?? null,
    hasSizes: row.has_sizes,
    categoryName: row.category_name ?? null,
    photoUrl: row.photo_path ? (photoUrls[row.photo_path] ?? null) : null,
    totalQuantity: Number(row.total_quantity),
    checkedOut: Number(row.checked_out ?? 0),
    lowStock: Boolean(row.low_stock),
    lastUpdated: row.last_updated,
    customFields: (row.custom_fields ?? {}) as Record<string, Json>,
    unitCost: costByItem.get(row.id) ?? null,
    variants: (row.variants ?? []) as InventoryRow["variants"],
    levels: (row.levels ?? []) as InventoryRow["levels"],
  }));

  const activeLocations = locations.data.filter((l) => !l.archived_at).map(({ id, name }) => ({ id, name }));
  // Quantities are shown for the filtered locations, or every active location.
  const shownLocations = params.locations.length
    ? locations.data.filter((l) => params.locations.includes(l.id)).map(({ id, name }) => ({ id, name }))
    : activeLocations;

  // Custom fields become filters/sort options when exactly one category is chosen.
  const singleCategory = params.categories.length === 1 && params.categories[0] !== "none" ? params.categories[0] : null;
  const categoryFields = singleCategory ? allFields.filter((f) => f.category_id === singleCategory) : [];

  return {
    setupNeeded: false as const,
    rows,
    total: Number(result.data[0]?.total_count ?? 0),
    categories: categories.data,
    locations: activeLocations,
    shownLocations,
    categoryFields,
  };
}
