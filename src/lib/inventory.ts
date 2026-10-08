import "server-only";
import { getPhotoUrls } from "@/lib/photos";
import { createClient } from "@/lib/supabase/server";

export const PAGE_SIZE = 60;

export const SORTS = {
  name: { label: "Name", defaultDir: "asc" },
  quantity: { label: "Quantity", defaultDir: "desc" },
  category: { label: "Category", defaultDir: "asc" },
  updated: { label: "Last updated", defaultDir: "desc" },
} as const;

export type SortKey = keyof typeof SORTS;
export type View = "grid" | "table";

export type InventoryParams = {
  q: string;
  categories: string[]; // category ids, plus "none" for uncategorized
  locations: string[];
  archived: boolean;
  sort: SortKey;
  dir: "asc" | "desc";
  view: View;
  page: number;
};

export type InventoryRow = {
  id: string;
  name: string;
  sku: string | null;
  hasSizes: boolean;
  categoryName: string | null;
  photoUrl: string | null;
  totalQuantity: number;
  lastUpdated: string;
  variants: { id: string; label: string | null }[];
  levels: { variant_id: string; location_id: string; quantity: number }[];
};

type SearchParams = Record<string, string | string[] | undefined>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function list(value: string | string[] | undefined) {
  if (value === undefined) return [];
  return (Array.isArray(value) ? value : [value]).flatMap((v) => v.split(",")).filter(Boolean);
}

function single(value: string | string[] | undefined) {
  return typeof value === "string" ? value : Array.isArray(value) ? (value[0] ?? "") : "";
}

/** Reads the inventory filters from the URL. A fixed location (location page) overrides `loc`. */
export function parseInventoryParams(sp: SearchParams, fixedLocationId?: string): InventoryParams {
  const sort = (single(sp.sort) in SORTS ? single(sp.sort) : "name") as SortKey;
  const dir = single(sp.dir) === "asc" || single(sp.dir) === "desc" ? (single(sp.dir) as "asc" | "desc") : SORTS[sort].defaultDir;

  return {
    q: single(sp.q).trim().slice(0, 100),
    categories: list(sp.cat).filter((c) => c === "none" || UUID.test(c)),
    locations: fixedLocationId ? [fixedLocationId] : list(sp.loc).filter((l) => UUID.test(l)),
    archived: single(sp.show) === "archived",
    sort,
    dir,
    view: single(sp.view) === "table" ? "table" : "grid",
    page: Math.max(1, Number(single(sp.page)) || 1),
  };
}

export async function loadInventory(params: InventoryParams) {
  const supabase = await createClient();

  const [result, categories, locations] = await Promise.all([
    supabase.rpc("inventory_items", {
      p_search: params.q || undefined,
      p_category_ids: params.categories.filter((c) => c !== "none"),
      p_uncategorized: params.categories.includes("none"),
      p_location_ids: params.locations,
      p_archived: params.archived,
      p_sort: params.sort,
      p_descending: params.dir === "desc",
      p_limit: PAGE_SIZE,
      p_offset: (params.page - 1) * PAGE_SIZE,
    }),
    supabase.from("categories").select("id, name").is("archived_at", null).order("sort_order").order("name"),
    supabase.from("locations").select("id, name, archived_at").order("sort_order").order("name"),
  ]);
  // The database function comes from migration 20261008000005; say so clearly if it hasn't been run.
  if (result.error && (result.error.code === "PGRST202" || result.error.message.includes("inventory_items"))) {
    return { setupNeeded: true as const };
  }
  if (result.error) throw result.error;
  if (categories.error) throw categories.error;
  if (locations.error) throw locations.error;

  const photoUrls = await getPhotoUrls(
    supabase,
    result.data.flatMap((row) => (row.photo_path ? [row.photo_path] : [])),
  );

  const rows: InventoryRow[] = result.data.map((row) => ({
    id: row.id,
    name: row.name,
    sku: row.sku ?? null,
    hasSizes: row.has_sizes,
    categoryName: row.category_name ?? null,
    photoUrl: row.photo_path ? (photoUrls[row.photo_path] ?? null) : null,
    totalQuantity: Number(row.total_quantity),
    lastUpdated: row.last_updated,
    variants: (row.variants ?? []) as InventoryRow["variants"],
    levels: (row.levels ?? []) as InventoryRow["levels"],
  }));

  const activeLocations = locations.data.filter((l) => !l.archived_at).map(({ id, name }) => ({ id, name }));
  // Quantities are shown for the filtered locations, or every active location.
  const shownLocations = params.locations.length
    ? locations.data.filter((l) => params.locations.includes(l.id)).map(({ id, name }) => ({ id, name }))
    : activeLocations;

  return {
    setupNeeded: false as const,
    rows,
    total: Number(result.data[0]?.total_count ?? 0),
    categories: categories.data,
    locations: activeLocations,
    shownLocations,
  };
}

/** Builds an inventory URL, keeping the current filters and applying changes. */
export function inventoryHref(basePath: string, params: InventoryParams, changes: Partial<InventoryParams>, fixedLocation = false) {
  const next = { ...params, ...changes };
  const search = new URLSearchParams();
  if (next.q) search.set("q", next.q);
  if (next.categories.length) search.set("cat", next.categories.join(","));
  if (!fixedLocation && next.locations.length) search.set("loc", next.locations.join(","));
  if (next.archived) search.set("show", "archived");
  if (next.sort !== "name") search.set("sort", next.sort);
  if (next.dir !== SORTS[next.sort].defaultDir) search.set("dir", next.dir);
  if (next.view !== "grid") search.set("view", next.view);
  if (next.page > 1) search.set("page", String(next.page));
  return `${basePath}${search.size ? `?${search}` : ""}`;
}
