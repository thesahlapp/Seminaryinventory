import type { NextRequest } from "next/server";
import { isAdmin } from "@/lib/auth";
import { COLUMNS, csvResponse, fieldColumn, qtyColumn, toCsv } from "@/lib/csv";
import { type CategoryField, fieldInputValue } from "@/lib/custom-fields";
import { queryInventory } from "@/lib/inventory";
import { parseInventoryParams } from "@/lib/inventory-params";
import type { Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

const BATCH = 1000;

/**
 * Inventory as CSV: one row per item and size. Uses the same filters as the
 * inventory page (so "current view" and "everything" are the same code).
 * Costs are included for admins only (and the database only returns them to admins).
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return new Response("Please sign in.", { status: 401 });
  const { data: me } = await supabase.from("profiles").select("role").eq("id", claims.claims.sub).single();
  const admin = me ? isAdmin(me.role) : false;

  const params = parseInventoryParams(Object.fromEntries(request.nextUrl.searchParams.entries()));
  // Repeatable params (f=…) need getAll.
  params.fieldFilters = parseInventoryParams({ f: request.nextUrl.searchParams.getAll("f") }).fieldFilters;

  const [{ data: locations }, { data: categories }, { data: fieldRows }] = await Promise.all([
    supabase.from("locations").select("id, name, archived_at").order("sort_order").order("name"),
    supabase.from("categories").select("id, name"),
    supabase.from("category_fields").select("*").order("sort_order").order("label"),
  ]);
  const fields = (fieldRows ?? []) as CategoryField[];
  const categoryName = new Map((categories ?? []).map((c) => [c.id, c.name]));
  const fieldTypes = Object.fromEntries(fields.map((f) => [f.id, f.field_type]));
  const columnsLocations = (locations ?? []).filter((l) => (params.locations.length ? params.locations.includes(l.id) : !l.archived_at));

  // Every matching item (all pages).
  const items: Awaited<ReturnType<typeof queryInventory>>["data"] & object = [];
  for (let offset = 0; ; offset += BATCH) {
    const { data, error } = await queryInventory(supabase, params, fieldTypes, BATCH, offset);
    if (error) return new Response(`Export failed: ${error.message}`, { status: 500 });
    items.push(...data);
    if (data.length < BATCH) break;
  }

  const ids = items.map((i) => i.id);
  const details = new Map<string, { description: string | null; notes: string | null; min_quantity: number | null }>();
  const costs = new Map<string, { unit_cost: number | null; retail_price: number | null }>();
  const outByVariant = new Map<string, number>();
  for (let i = 0; i < ids.length; i += 300) {
    const chunk = ids.slice(i, i + 300);
    const [d, c, o] = await Promise.all([
      supabase.from("items").select("id, description, notes, min_quantity, item_variants(id)").in("id", chunk),
      admin ? supabase.from("item_costs").select("item_id, unit_cost, retail_price").in("item_id", chunk) : null,
      supabase.from("checked_out_quantities").select("variant_id, quantity, item_variants!inner(item_id)").in("item_variants.item_id", chunk),
    ]);
    for (const row of d.data ?? []) details.set(row.id, row);
    for (const row of c?.data ?? []) costs.set(row.item_id, row);
    for (const row of o.data ?? []) if (row.variant_id) outByVariant.set(row.variant_id, Number(row.quantity));
  }

  const header = [
    COLUMNS.itemId,
    COLUMNS.name,
    COLUMNS.sku,
    COLUMNS.category,
    COLUMNS.size,
    COLUMNS.description,
    COLUMNS.notes,
    COLUMNS.minQuantity,
    COLUMNS.sizeMinQuantity,
    COLUMNS.checkoutable,
    ...(admin ? [COLUMNS.unitCost, COLUMNS.retailPrice] : []),
    ...columnsLocations.map((l) => qtyColumn(l.name)),
    COLUMNS.checkedOut,
    ...fields.map((f) => fieldColumn(f.label, categoryName.get(f.category_id) ?? "?")),
  ];

  const rows: unknown[][] = [];
  for (const item of items) {
    const detail = details.get(item.id);
    const cost = costs.get(item.id);
    const values = (item.custom_fields ?? {}) as Record<string, Json>;
    const levels = (item.levels ?? []) as { variant_id: string; location_id: string; quantity: number }[];
    const variants = (item.variants ?? []) as { id: string; label: string | null; min_quantity: number | null }[];
    for (const variant of variants.length ? variants : [{ id: "", label: null, min_quantity: null }]) {
      rows.push([
        item.id,
        item.name,
        item.sku,
        item.category_name,
        variant.label,
        detail?.description,
        detail?.notes,
        detail?.min_quantity,
        variant.label ? variant.min_quantity : null,
        item.checkoutable ? "yes" : "no",
        ...(admin ? [cost?.unit_cost ?? null, cost?.retail_price ?? null] : []),
        ...columnsLocations.map((l) => levels.find((x) => x.variant_id === variant.id && x.location_id === l.id)?.quantity ?? 0),
        outByVariant.get(variant.id) ?? 0,
        ...fields.map((f) => (f.category_id === item.category_id ? fieldInputValue(f, values[f.id]) : "")),
      ]);
    }
  }

  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(new Date());
  const filtered = [...request.nextUrl.searchParams.keys()].some((k) => !["view", "sort", "dir", "page"].includes(k));
  return csvResponse(`qalam-inventory-${filtered ? "filtered-" : ""}${today}.csv`, toCsv(header, rows));
}
