"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { authorize, getCurrentProfile } from "@/lib/auth";
import { friendlyError } from "@/lib/errors";
import { formText, sanitizeSearch } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export type KitItemOption = { id: string; name: string; sku: string | null; variants: { id: string; label: string | null }[] };

export async function searchKitItems(query: string): Promise<KitItemOption[]> {
  await getCurrentProfile();
  const supabase = await createClient();
  const q = sanitizeSearch(query).slice(0, 100);
  let request = supabase
    .from("items")
    .select("id, name, sku, item_variants(id, archived_at, sizes(label, sort_order))")
    .is("archived_at", null)
    .order("name")
    .limit(20);
  if (q) request = request.or(`name.ilike.*${q}*,sku.ilike.*${q}*`);
  const { data } = await request;
  return (data ?? []).map((i) => ({
    id: i.id,
    name: i.name,
    sku: i.sku,
    variants: i.item_variants
      .filter((v) => !v.archived_at)
      .sort((a, b) => (a.sizes?.sort_order ?? 0) - (b.sizes?.sort_order ?? 0))
      .map((v) => ({ id: v.id, label: v.sizes?.label ?? null })),
  }));
}

/** Creates or updates a kit and replaces its item list. Returns the kit id (for photo upload). */
export async function saveKit(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorize("edit");
  if ("error" in auth) return { error: auth.error };
  const { supabase } = auth;

  const id = formText(formData, "id");
  const name = formText(formData, "name");
  if (!name) return { error: "Give the kit a name." };

  let items: { variant_id: string; quantity: number }[];
  try {
    items = JSON.parse(String(formData.get("items") ?? "[]"));
  } catch {
    return { error: "Something went wrong with the item list. Please try again." };
  }
  if (!items.length) return { error: "Add at least one item to the kit." };
  if (items.some((i) => !Number.isInteger(i.quantity) || i.quantity < 1)) return { error: "Quantities must be 1 or more." };
  // Same item/size twice: add them up.
  const merged = new Map<string, number>();
  for (const i of items) merged.set(i.variant_id, (merged.get(i.variant_id) ?? 0) + i.quantity);

  const values = { name, description: formText(formData, "description") };
  const { data: kit, error } = id
    ? await supabase.from("kits").update(values).eq("id", id).select("id").single()
    : await supabase.from("kits").insert(values).select("id").single();
  if (error) return { error: friendlyError(error, { duplicate: `There's already a kit called "${name}".` }) };

  const { error: deleteError } = await supabase.from("kit_items").delete().eq("kit_id", kit.id);
  if (deleteError) return { error: friendlyError(deleteError) };
  const { error: insertError } = await supabase
    .from("kit_items")
    .insert([...merged].map(([variant_id, quantity]) => ({ kit_id: kit.id, variant_id, quantity })));
  if (insertError) return { error: friendlyError(insertError) };

  return { success: "Saved.", itemId: kit.id };
}

export async function setKitArchived(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorize("edit");
  if ("error" in auth) return { error: auth.error };
  const archive = formData.get("archive") === "true";
  const { error } = await auth.supabase
    .from("kits")
    .update({ archived_at: archive ? new Date().toISOString() : null })
    .eq("id", String(formData.get("id")));
  if (error) return { error: friendlyError(error) };
  refresh();
  return { success: archive ? "Kit archived." : "Kit restored." };
}

export async function deleteKit(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorize("edit");
  if ("error" in auth) return { error: auth.error };
  const id = String(formData.get("id"));
  const { data: kit } = await auth.supabase.from("kits").select("photo_path, thumbnail_path").eq("id", id).maybeSingle();
  const { error } = await auth.supabase.from("kits").delete().eq("id", id);
  if (error) return { error: friendlyError(error) };
  const paths = [kit?.photo_path, kit?.thumbnail_path].filter((p): p is string => Boolean(p));
  if (paths.length) await auth.supabase.storage.from("item-photos").remove(paths);
  redirect("/kits");
}
