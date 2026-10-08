"use server";

import { authorize } from "@/lib/auth";
import { type CategoryField, parseFieldInput } from "@/lib/custom-fields";
import { friendlyError } from "@/lib/errors";
import type { Database, Json } from "@/lib/supabase/database.types";
import type { createClient } from "@/lib/supabase/server";

/*
 * CSV import (admins only), in two steps that share one planner:
 *   previewImport -> what would be created/updated, with errors per row
 *   applyImport   -> does it, skipping rows with errors
 *
 * Each mapped row is { row, values } where values keys are:
 *   name sku category size description notes minQuantity sizeMinQuantity
 *   checkoutable unitCost retailPrice itemId  qty:<locationId>  field:<fieldId>
 */

export type MappedRow = { row: number; values: Record<string, string> };

export type RowResult = {
  row: number;
  status: "create" | "update" | "error";
  item: string;
  size: string | null;
  messages: string[];
};

export type ImportSummary = {
  itemsToCreate: number;
  itemsToUpdate: number;
  quantityChanges: number;
  categoriesToCreate: string[];
  sizesToCreate: string[];
  errorRows: number;
};

type Supabase = Awaited<ReturnType<typeof createClient>>;

const MAX_ROWS = 5000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await page(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

const lower = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

function wholeNumber(text: string, label: string, errors: string[]) {
  if (text === "") return undefined;
  if (!/^\d+$/.test(text.replace(/,/g, ""))) {
    errors.push(`${label} must be a whole number (got "${text}").`);
    return undefined;
  }
  return Number(text.replace(/,/g, ""));
}

function money(text: string, label: string, errors: string[]) {
  if (text === "") return undefined;
  const n = Number(text.replace(/[$,\s]/g, ""));
  if (!Number.isFinite(n) || n < 0) {
    errors.push(`${label} must be an amount like 12.50 (got "${text}").`);
    return undefined;
  }
  return Math.round(n * 100) / 100;
}

function yesNo(text: string, errors: string[]) {
  if (text === "") return undefined;
  const t = text.toLowerCase();
  if (["yes", "y", "true", "1"].includes(t)) return true;
  if (["no", "n", "false", "0"].includes(t)) return false;
  errors.push(`Checkoutable must be yes or no (got "${text}").`);
  return undefined;
}

type ExistingItem = {
  id: string;
  name: string;
  sku: string | null;
  category_id: string | null;
  has_sizes: boolean;
  custom_fields: Json;
  item_variants: { id: string; size_id: string | null }[];
};

type GroupPlan = {
  key: string;
  existing: ExistingItem | null;
  newId: string;
  rows: number[];
  name: string;
  categoryName: string | null;
  item: {
    sku?: string;
    description?: string;
    notes?: string;
    min_quantity?: number;
    checkoutable?: boolean;
    custom_fields: Record<string, Json>;
  };
  costs: { unit_cost?: number; retail_price?: number };
  sized: boolean;
  // size label (lowercase) -> { label, min, quantities by location }
  variants: Map<string, { label: string | null; min?: number; quantities: Map<string, number> }>;
  errors: Map<number, string[]>;
};

async function buildPlan(supabase: Supabase, rows: MappedRow[]) {
  const [categories, sizes, locations, fields, items] = await Promise.all([
    fetchAll<{ id: string; name: string }>((a, b) => supabase.from("categories").select("id, name").range(a, b)),
    fetchAll<{ id: string; label: string }>((a, b) => supabase.from("sizes").select("id, label").range(a, b)),
    fetchAll<{ id: string; name: string }>((a, b) => supabase.from("locations").select("id, name").range(a, b)),
    fetchAll<CategoryField>((a, b) => supabase.from("category_fields").select("*").range(a, b) as never),
    fetchAll<ExistingItem>((a, b) =>
      supabase.from("items").select("id, name, sku, category_id, has_sizes, custom_fields, item_variants(id, size_id)").range(a, b),
    ),
  ]);

  const categoryByName = new Map(categories.map((c) => [lower(c.name), c]));
  const sizeByLabel = new Map(sizes.map((s) => [lower(s.label), s]));
  const locationIds = new Set(locations.map((l) => l.id));
  const fieldById = new Map(fields.map((f) => [f.id, f]));
  const itemById = new Map(items.map((i) => [i.id, i]));
  const itemBySku = new Map(items.filter((i) => i.sku).map((i) => [lower(i.sku), i]));
  const itemByNameCategory = new Map(items.map((i) => [`${lower(i.name)}|${i.category_id ?? ""}`, i]));

  const categoriesToCreate = new Set<string>();
  const sizesToCreate = new Set<string>();
  const groups = new Map<string, GroupPlan>();
  const rowErrors = new Map<number, string[]>();

  for (const { row, values } of rows) {
    const v = (k: string) => (values[k] ?? "").trim();
    const errors: string[] = [];
    const name = v("name");
    const categoryName = v("category");
    const sizeLabel = v("size");

    const category = categoryName ? (categoryByName.get(lower(categoryName)) ?? null) : null;
    if (categoryName && !category) categoriesToCreate.add(categoryName);

    // Which item is this row about?
    const idValue = v("itemId");
    let existing: ExistingItem | null = null;
    if (idValue) {
      if (!UUID.test(idValue) || !itemById.has(idValue)) errors.push(`Item ID "${idValue}" wasn't found. Leave it blank to create a new item.`);
      else existing = itemById.get(idValue)!;
    } else if (v("sku")) {
      existing = itemBySku.get(lower(v("sku"))) ?? null;
    }
    if (!existing && !idValue && name) {
      existing = itemByNameCategory.get(`${lower(name)}|${category?.id ?? ""}`) ?? null;
    }
    if (!existing && !name) errors.push("Name is required for new items.");

    const key = existing ? `id:${existing.id}` : v("sku") ? `sku:${lower(v("sku"))}` : `name:${lower(name)}|${lower(categoryName)}`;
    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        existing,
        newId: crypto.randomUUID(),
        rows: [],
        name: existing?.name ?? name,
        categoryName: categoryName || null,
        item: { custom_fields: {} },
        costs: {},
        sized: existing ? existing.has_sizes : Boolean(sizeLabel),
        variants: new Map(),
        errors: new Map(),
      };
      groups.set(key, group);
    }
    group.rows.push(row);

    // Sizes
    if (existing && existing.has_sizes && !sizeLabel) errors.push(`"${group.name}" comes in sizes, so the Size column is needed.`);
    if (group.sized !== Boolean(sizeLabel) && !(existing && existing.has_sizes && !sizeLabel)) {
      errors.push(
        group.sized
          ? `"${group.name}" comes in sizes, so every row for it needs a size.`
          : `"${group.name}" doesn't use sizes${existing ? " (change that on its edit page first)" : " (other rows for it have no size)"}.`,
      );
    }
    if (sizeLabel && !sizeByLabel.has(lower(sizeLabel))) sizesToCreate.add(sizeLabel);

    // Item-level values (first non-empty value wins)
    const it = group.item;
    if (v("sku") && it.sku === undefined) it.sku = v("sku");
    if (v("description") && it.description === undefined) it.description = v("description");
    if (v("notes") && it.notes === undefined) it.notes = v("notes");
    const min = wholeNumber(v("minQuantity"), "Low stock minimum", errors);
    if (min !== undefined && it.min_quantity === undefined) it.min_quantity = min;
    const checkoutable = yesNo(v("checkoutable"), errors);
    if (checkoutable !== undefined && it.checkoutable === undefined) it.checkoutable = checkoutable;
    const unitCost = money(v("unitCost"), "Unit cost", errors);
    if (unitCost !== undefined && group.costs.unit_cost === undefined) group.costs.unit_cost = unitCost;
    const retail = money(v("retailPrice"), "Retail price", errors);
    if (retail !== undefined && group.costs.retail_price === undefined) group.costs.retail_price = retail;

    // Custom fields: must belong to this item's category.
    const itemCategoryId = category?.id ?? existing?.category_id ?? null;
    for (const [k, raw] of Object.entries(values)) {
      if (!k.startsWith("field:") || raw.trim() === "") continue;
      const field = fieldById.get(k.slice(6));
      if (!field) continue;
      if (field.category_id !== itemCategoryId) {
        const owner = categories.find((c) => c.id === field.category_id)?.name ?? "another category";
        errors.push(`"${field.label}" is a ${owner} field, but this item is ${categoryName || "uncategorized"}.`);
        continue;
      }
      const parsed = parseFieldInput(field, raw);
      if (parsed.error) errors.push(parsed.error);
      else if (parsed.value !== undefined) it.custom_fields[field.id] = parsed.value;
    }

    // Size row: minimum and quantities per location
    const variantKey = lower(sizeLabel);
    const variant = group.variants.get(variantKey) ?? { label: sizeLabel || null, quantities: new Map<string, number>() };
    const sizeMin = wholeNumber(v("sizeMinQuantity"), "Size minimum", errors);
    if (sizeMin !== undefined) {
      if (!sizeLabel) errors.push("Size minimum only applies to rows with a size.");
      else variant.min = sizeMin;
    }
    for (const [k, raw] of Object.entries(values)) {
      if (!k.startsWith("qty:")) continue;
      const locationId = k.slice(4);
      if (!locationIds.has(locationId)) continue;
      const qty = wholeNumber(raw.trim(), "Quantities", errors);
      if (qty !== undefined) variant.quantities.set(locationId, qty);
    }
    group.variants.set(variantKey, variant);

    if (errors.length) {
      rowErrors.set(row, errors);
      group.errors.set(row, errors);
    }
  }

  // A group with any bad row is skipped as a whole (so an item isn't half-imported).
  const results: RowResult[] = [];
  let quantityChanges = 0;
  for (const group of groups.values()) {
    const bad = group.errors.size > 0;
    if (!bad) for (const variant of group.variants.values()) quantityChanges += variant.quantities.size;
    for (const row of group.rows) {
      const own = rowErrors.get(row);
      const r = rows.find((x) => x.row === row)!;
      results.push({
        row,
        status: bad ? "error" : group.existing ? "update" : "create",
        item: group.name || "(no name)",
        size: (r.values.size ?? "").trim() || null,
        messages: own ?? (bad ? ["Skipped because another row for this item has an error."] : []),
      });
    }
  }
  results.sort((a, b) => a.row - b.row);

  const ok = [...groups.values()].filter((g) => g.errors.size === 0);
  const summary: ImportSummary = {
    itemsToCreate: ok.filter((g) => !g.existing).length,
    itemsToUpdate: ok.filter((g) => g.existing).length,
    quantityChanges,
    categoriesToCreate: [...categoriesToCreate],
    sizesToCreate: [...sizesToCreate],
    errorRows: results.filter((r) => r.status === "error").length,
  };

  return { results, summary, groups: ok, categoryByName, sizeByLabel };
}

function check(rows: MappedRow[]) {
  if (!rows.length) return "The file has no rows.";
  if (rows.length > MAX_ROWS) return `That's ${rows.length.toLocaleString()} rows; the limit is ${MAX_ROWS.toLocaleString()}. Split the file and import it in parts.`;
  if (!rows.some((r) => "name" in r.values || "sku" in r.values || "itemId" in r.values)) {
    return "Map at least one column to Name, SKU or Item ID so rows can be matched to items.";
  }
  return null;
}

export async function previewImport(rows: MappedRow[]): Promise<{ error?: string; summary?: ImportSummary; results?: RowResult[] }> {
  const auth = await authorize("admin");
  if ("error" in auth) return { error: auth.error };
  const problem = check(rows);
  if (problem) return { error: problem };
  try {
    const { results, summary } = await buildPlan(auth.supabase, rows);
    return { summary, results };
  } catch (e) {
    return { error: `Couldn't read the inventory to compare: ${(e as Error).message}` };
  }
}

export async function applyImport(rows: MappedRow[]): Promise<{ error?: string; done?: { created: number; updated: number; quantityChanges: number; failed: string[] } }> {
  const auth = await authorize("admin");
  if ("error" in auth) return { error: auth.error };
  const problem = check(rows);
  if (problem) return { error: problem };
  const { supabase } = auth;

  let plan;
  try {
    plan = await buildPlan(supabase, rows);
  } catch (e) {
    return { error: (e as Error).message };
  }
  const failed: string[] = [];

  // 1. New categories and sizes
  for (const name of plan.summary.categoriesToCreate) {
    const { data, error } = await supabase.from("categories").insert({ name }).select("id, name").single();
    if (error) return { error: `Couldn't create category "${name}": ${friendlyError(error)}` };
    plan.categoryByName.set(lower(name), data);
  }
  for (const label of plan.summary.sizesToCreate) {
    const { data, error } = await supabase.from("sizes").insert({ label, sort_order: 100 }).select("id, label").single();
    if (error) return { error: `Couldn't create size "${label}": ${friendlyError(error)}` };
    plan.sizeByLabel.set(lower(label), data);
  }

  // 2. Items
  let created = 0;
  let updated = 0;
  const changes: { variant_id: string; location_id: string; quantity: number }[] = [];
  for (const group of plan.groups) {
    const categoryId = group.categoryName ? (plan.categoryByName.get(lower(group.categoryName))?.id ?? null) : (group.existing?.category_id ?? null);
    const { custom_fields, ...fields } = group.item;
    let itemId: string;

    if (group.existing) {
      itemId = group.existing.id;
      const update: Database["public"]["Tables"]["items"]["Update"] = { ...fields };
      if (group.categoryName) update.category_id = categoryId;
      if (Object.keys(custom_fields).length) {
        update.custom_fields = { ...((group.existing.custom_fields as Record<string, Json>) ?? {}), ...custom_fields };
      }
      if (Object.keys(update).length) {
        const { error } = await supabase.from("items").update(update).eq("id", itemId);
        if (error) {
          failed.push(`${group.name}: ${friendlyError(error, { duplicate: "SKU already used by another item." })}`);
          continue;
        }
      }
      updated++;
    } else {
      itemId = group.newId;
      const { error } = await supabase.from("items").insert({
        id: itemId,
        name: group.name,
        category_id: categoryId,
        has_sizes: group.sized,
        ...fields,
        custom_fields,
      });
      if (error) {
        failed.push(`${group.name}: ${friendlyError(error, { duplicate: "SKU already used by another item." })}`);
        continue;
      }
      created++;
    }

    if (group.costs.unit_cost !== undefined || group.costs.retail_price !== undefined) {
      const { error } = await supabase.from("item_costs").upsert({ item_id: itemId, ...group.costs });
      if (error) failed.push(`${group.name} (cost): ${friendlyError(error)}`);
    }

    // Variants: find or create, then queue quantities.
    const { data: variants } = await supabase.from("item_variants").select("id, size_id").eq("item_id", itemId);
    for (const variant of group.variants.values()) {
      let variantId: string | undefined;
      if (group.sized) {
        const sizeId = plan.sizeByLabel.get(lower(variant.label))?.id;
        variantId = variants?.find((x) => x.size_id === sizeId)?.id;
        if (!variantId && sizeId) {
          const { data, error } = await supabase.from("item_variants").insert({ item_id: itemId, size_id: sizeId }).select("id").single();
          if (error) {
            failed.push(`${group.name} ${variant.label}: ${friendlyError(error)}`);
            continue;
          }
          variantId = data.id;
        }
      } else {
        variantId = variants?.find((x) => x.size_id === null)?.id;
      }
      if (!variantId) continue;
      if (variant.min !== undefined) await supabase.from("item_variants").update({ min_quantity: variant.min }).eq("id", variantId);
      for (const [locationId, quantity] of variant.quantities) changes.push({ variant_id: variantId, location_id: locationId, quantity });
    }
  }

  // 3. Quantities, in batches (each change logged in the history)
  let quantityChanges = 0;
  for (let i = 0; i < changes.length; i += 1000) {
    const { data, error } = await supabase.rpc("import_stock_levels", { p_changes: changes.slice(i, i + 1000) as never });
    if (error) failed.push(`Quantities: ${friendlyError(error)}`);
    else quantityChanges += data;
  }

  return { done: { created, updated, quantityChanges, failed } };
}
