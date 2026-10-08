"use server";

import { getCurrentProfile } from "@/lib/auth";
import { sanitizeSearch } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export type LabelSource = {
  kind: "item" | "location" | "kit";
  id: string;
  name: string;
  sku: string | null;
  sizes: { id: string; label: string }[];
};

/** Items, locations or kits matching a search, for the label picker. */
export async function searchLabelSources(kind: LabelSource["kind"], query: string): Promise<LabelSource[]> {
  await getCurrentProfile();
  const supabase = await createClient();
  const q = sanitizeSearch(query).slice(0, 100);

  if (kind === "item") {
    let request = supabase
      .from("items")
      .select("id, name, sku, has_sizes, item_variants(id, archived_at, sizes(label, sort_order))")
      .is("archived_at", null)
      .order("name")
      .limit(30);
    if (q) request = request.or(`name.ilike.*${q}*,sku.ilike.*${q}*`);
    const { data } = await request;
    return (data ?? []).map((i) => ({
      kind,
      id: i.id,
      name: i.name,
      sku: i.sku,
      sizes: i.has_sizes
        ? i.item_variants
            .filter((v) => !v.archived_at && v.sizes)
            .sort((a, b) => (a.sizes?.sort_order ?? 0) - (b.sizes?.sort_order ?? 0))
            .map((v) => ({ id: v.id, label: v.sizes!.label }))
        : [],
    }));
  }

  const table = kind === "location" ? "locations" : "kits";
  let request = supabase.from(table).select("id, name").is("archived_at", null).order("name").limit(30);
  if (q) request = request.ilike("name", `%${q}%`);
  const { data } = await request;
  return (data ?? []).map((r) => ({ kind, id: r.id, name: r.name, sku: null, sizes: [] }));
}

/** Loads specific sources (for links like /labels?item=…). */
export async function getLabelSource(kind: LabelSource["kind"], id: string): Promise<LabelSource | null> {
  const all = await searchLabelSources(kind, "");
  const found = all.find((s) => s.id === id);
  if (found) return found;
  // Not in the first page of results: fetch directly.
  const supabase = await createClient();
  if (kind === "item") {
    const { data } = await supabase.from("items").select("name").eq("id", id).maybeSingle();
    if (!data) return null;
    return (await searchLabelSources("item", data.name)).find((s) => s.id === id) ?? null;
  }
  const { data } = await supabase.from(kind === "location" ? "locations" : "kits").select("id, name").eq("id", id).maybeSingle();
  return data ? { kind, id: data.id, name: data.name, sku: null, sizes: [] } : null;
}
