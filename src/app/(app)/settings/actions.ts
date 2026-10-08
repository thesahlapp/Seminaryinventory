"use server";

import { refresh } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { authorize } from "@/lib/auth";
import { friendlyError } from "@/lib/errors";
import { formText } from "@/lib/format";

type ListTable = "categories" | "locations" | "sizes";

const NOUN: Record<ListTable, string> = {
  categories: "Category",
  locations: "Location",
  sizes: "Size",
};

const IN_USE: Record<ListTable, string> = {
  categories:
    "This category still has items, so it can't be deleted. Move those items to another category, or archive the category instead.",
  locations:
    "This location holds stock or has stock history, so it can't be deleted. Archive it instead to hide it.",
  sizes: "Items use this size, so it can't be deleted. Archive it instead to hide it from new items.",
};

function readTable(formData: FormData): ListTable {
  const table = formData.get("table");
  if (table === "categories" || table === "locations" || table === "sizes") return table;
  throw new Error("Unknown list");
}

function readSortOrder(formData: FormData) {
  const value = Number(formData.get("sort_order") ?? 0);
  return Number.isFinite(value) ? Math.round(value) : 0;
}

export async function saveListEntry(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorize("admin");
  if ("error" in auth) return { error: auth.error };
  const { supabase } = auth;

  const table = readTable(formData);
  const id = formText(formData, "id");
  const sortOrder = readSortOrder(formData);
  let error;

  if (table === "categories") {
    const name = formText(formData, "name");
    if (!name) return { error: "Enter a name." };
    const values = {
      name,
      description: formText(formData, "description"),
      default_has_sizes: formData.get("default_has_sizes") === "on",
      sort_order: sortOrder,
    };
    ({ error } = id
      ? await supabase.from("categories").update(values).eq("id", id)
      : await supabase.from("categories").insert(values));
  } else if (table === "locations") {
    const name = formText(formData, "name");
    if (!name) return { error: "Enter a name." };
    const values = {
      name,
      address: formText(formData, "address"),
      description: formText(formData, "description"),
      sort_order: sortOrder,
    };
    ({ error } = id
      ? await supabase.from("locations").update(values).eq("id", id)
      : await supabase.from("locations").insert(values));
  } else {
    const label = formText(formData, "label");
    if (!label) return { error: "Enter a size label." };
    const values = { label, sort_order: sortOrder };
    ({ error } = id
      ? await supabase.from("sizes").update(values).eq("id", id)
      : await supabase.from("sizes").insert(values));
  }

  if (error) {
    return {
      error: friendlyError(error, { duplicate: `${NOUN[table]} "${formText(formData, "name") ?? formText(formData, "label")}" already exists.` }),
    };
  }

  refresh();
  return { success: id ? "Saved." : `${NOUN[table]} added.` };
}

export async function setListEntryArchived(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorize("admin");
  if ("error" in auth) return { error: auth.error };

  const table = readTable(formData);
  const id = String(formData.get("id"));
  const archive = formData.get("archive") === "true";

  const { error } = await auth.supabase
    .from(table)
    .update({ archived_at: archive ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) return { error: friendlyError(error) };

  refresh();
  return { success: archive ? "Archived." : "Restored." };
}

export async function deleteListEntry(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorize("admin");
  if ("error" in auth) return { error: auth.error };

  const table = readTable(formData);
  const id = String(formData.get("id"));

  const { error } = await auth.supabase.from(table).delete().eq("id", id);
  if (error) return { error: friendlyError(error, { inUse: IN_USE[table] }) };

  refresh();
  return { success: "Deleted." };
}
