"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { authorize } from "@/lib/auth";
import { friendlyError } from "@/lib/errors";
import { formText, REASON_LABELS, type StockReason } from "@/lib/format";

const SKU_TAKEN = "Another item already uses that SKU.";

function readItemFields(formData: FormData) {
  return {
    name: formText(formData, "name"),
    sku: formText(formData, "sku"),
    category_id: formText(formData, "category_id"),
    description: formText(formData, "description"),
    notes: formText(formData, "notes"),
    has_sizes: formData.get("has_sizes") === "on",
  };
}

export async function createItem(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorize("edit");
  if ("error" in auth) return { error: auth.error };
  const { supabase } = auth;

  const { name, ...rest } = readItemFields(formData);
  if (!name) return { error: "Enter a name for the item." };

  const sizeIds = formData.getAll("size_ids").map(String);
  if (rest.has_sizes && sizeIds.length === 0) {
    return { error: "Pick at least one size, or untick “This item comes in sizes”." };
  }

  const { data: item, error } = await supabase
    .from("items")
    .insert({ name, ...rest })
    .select("id")
    .single();
  if (error) return { error: friendlyError(error, { duplicate: SKU_TAKEN }) };

  if (rest.has_sizes) {
    const { error: variantError } = await supabase
      .from("item_variants")
      .insert(sizeIds.map((size_id) => ({ item_id: item.id, size_id })));
    if (variantError) {
      await supabase.from("items").delete().eq("id", item.id);
      return { error: friendlyError(variantError) };
    }
  }

  redirect(`/items/${item.id}`);
}

export async function updateItem(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorize("edit");
  if ("error" in auth) return { error: auth.error };

  const id = String(formData.get("id"));
  const { name, ...rest } = readItemFields(formData);
  if (!name) return { error: "Enter a name for the item." };

  const { error } = await auth.supabase
    .from("items")
    .update({ name, ...rest })
    .eq("id", id);
  if (error) return { error: friendlyError(error, { duplicate: SKU_TAKEN }) };

  redirect(`/items/${id}`);
}

export async function setItemArchived(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorize("edit");
  if ("error" in auth) return { error: auth.error };

  const id = String(formData.get("id"));
  const archive = formData.get("archive") === "true";
  const { error } = await auth.supabase
    .from("items")
    .update({ archived_at: archive ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) return { error: friendlyError(error) };

  refresh();
  return { success: archive ? "Item archived. It's hidden from the item list." : "Item restored." };
}

export async function deleteItem(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorize("edit");
  if ("error" in auth) return { error: auth.error };
  const { supabase } = auth;

  const id = String(formData.get("id"));
  const { data: photos } = await supabase.from("item_photos").select("storage_path").eq("item_id", id);

  const { error } = await supabase.from("items").delete().eq("id", id);
  if (error) {
    return {
      error: friendlyError(error, {
        inUse: "This item has stock history, so it can't be deleted (the history must be kept). Archive it instead.",
      }),
    };
  }

  if (photos?.length) {
    await supabase.storage.from("item-photos").remove(photos.map((p) => p.storage_path));
  }

  redirect("/items");
}

// ---------------------------------------------------------------------------
// Sizes on an item
// ---------------------------------------------------------------------------

export async function addItemSizes(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorize("edit");
  if ("error" in auth) return { error: auth.error };

  const itemId = String(formData.get("item_id"));
  const sizeIds = formData.getAll("size_ids").map(String);
  if (sizeIds.length === 0) return { error: "Tick the sizes to add." };

  const { error } = await auth.supabase
    .from("item_variants")
    .insert(sizeIds.map((size_id) => ({ item_id: itemId, size_id })));
  if (error) return { error: friendlyError(error, { duplicate: "This item already has one of those sizes." }) };

  refresh();
  return { success: sizeIds.length === 1 ? "Size added." : `${sizeIds.length} sizes added.` };
}

export async function removeItemSize(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorize("edit");
  if ("error" in auth) return { error: auth.error };
  const { supabase } = auth;

  const variantId = String(formData.get("variant_id"));

  const { data: levels } = await supabase.from("stock_levels").select("quantity").eq("variant_id", variantId);
  if (levels?.some((l) => l.quantity > 0)) {
    return { error: "This size still has stock. Set its stock to 0 (or transfer it) before removing the size." };
  }

  const { error } = await supabase.from("item_variants").delete().eq("id", variantId);
  if (!error) {
    refresh();
    return { success: "Size removed." };
  }

  // Sizes with stock history are archived instead so the history stays intact.
  if (error.code === "23503") {
    const { error: archiveError } = await supabase
      .from("item_variants")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", variantId);
    if (archiveError) return { error: friendlyError(archiveError) };
    refresh();
    return { success: "Size hidden. It has stock history, so it was archived rather than deleted." };
  }

  return { error: friendlyError(error) };
}

export async function restoreItemSize(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorize("edit");
  if ("error" in auth) return { error: auth.error };

  const { error } = await auth.supabase
    .from("item_variants")
    .update({ archived_at: null })
    .eq("id", String(formData.get("variant_id")));
  if (error) return { error: friendlyError(error) };

  refresh();
  return { success: "Size restored." };
}

// ---------------------------------------------------------------------------
// Stock
// ---------------------------------------------------------------------------

const STOCK_REASONS = new Set<StockReason>(Object.keys(REASON_LABELS) as StockReason[]);

function readWholeNumber(formData: FormData, name: string) {
  const raw = formText(formData, name);
  if (raw === null || !/^-?\d+$/.test(raw)) return null;
  return Number(raw);
}

export async function changeStock(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorize("edit");
  if ("error" in auth) return { error: auth.error };
  const { supabase } = auth;

  const mode = formData.get("mode");
  const variantId = formText(formData, "variant_id");
  const locationId = formText(formData, "location_id");
  const quantity = readWholeNumber(formData, "quantity");
  const note = formText(formData, "note");
  const reason = formData.get("reason") as StockReason;

  if (!variantId) return { error: "Choose a size." };
  if (!locationId) return { error: "Choose a location." };
  if (quantity === null || quantity < 0) return { error: "Enter a whole number, 0 or more." };

  if (mode === "transfer") {
    const toLocationId = formText(formData, "to_location_id");
    if (!toLocationId) return { error: "Choose where to move the stock to." };
    if (quantity === 0) return { error: "Enter how many to move." };

    const { error } = await supabase.rpc("transfer_stock", {
      p_variant_id: variantId,
      p_from_location_id: locationId,
      p_to_location_id: toLocationId,
      p_quantity: quantity,
      p_note: note ?? undefined,
    });
    if (error) return { error: friendlyError(error) };
    refresh();
    return { success: `Moved ${quantity}.` };
  }

  if (!STOCK_REASONS.has(reason)) return { error: "Choose a reason." };

  if (mode === "set") {
    const { data, error } = await supabase.rpc("set_stock", {
      p_variant_id: variantId,
      p_location_id: locationId,
      p_new_quantity: quantity,
      p_reason: reason,
      p_note: note ?? undefined,
    });
    if (error) return { error: friendlyError(error) };
    refresh();
    return { success: `Updated: ${data.old_quantity} → ${data.new_quantity}.` };
  }

  if (mode === "add" || mode === "remove") {
    if (quantity === 0) return { error: "Enter how many." };
    const { data, error } = await supabase.rpc("change_stock", {
      p_variant_id: variantId,
      p_location_id: locationId,
      p_delta: mode === "add" ? quantity : -quantity,
      p_reason: reason,
      p_note: note ?? undefined,
    });
    if (error) return { error: friendlyError(error) };
    refresh();
    return { success: `Updated: ${data.old_quantity} → ${data.new_quantity}.` };
  }

  return { error: "Choose what you want to do." };
}
