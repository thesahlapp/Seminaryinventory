"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import type { ActionState } from "@/lib/action-state";
import { authorize } from "@/lib/auth";
import { friendlyError } from "@/lib/errors";
import { formText } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";

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

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

type AppRole = Database["public"]["Enums"]["app_role"];

function readRole(formData: FormData): AppRole | null {
  const role = formData.get("role");
  return role === "admin" || role === "staff" || role === "viewer" ? role : null;
}

export async function changeUserRole(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorize("admin");
  if ("error" in auth) return { error: auth.error };

  const id = String(formData.get("id"));
  const role = readRole(formData);
  if (!role) return { error: "Choose a role." };

  const { error } = await auth.supabase.from("profiles").update({ role }).eq("id", id);
  if (error) return { error: friendlyError(error) };

  refresh();
  return { success: "Role updated." };
}

export async function inviteUser(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorize("admin");
  if ("error" in auth) return { error: auth.error };

  const admin = createAdminClient();
  if (!admin) return { error: "Inviting from the app needs SUPABASE_SECRET_KEY. See the note on this page." };

  const email = formText(formData, "email")?.toLowerCase();
  const fullName = formText(formData, "full_name");
  const role = readRole(formData) ?? "staff";
  if (!email || !email.includes("@")) return { error: "Enter a valid email address." };

  const origin = (await headers()).get("origin") ?? "";
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: fullName ? { full_name: fullName } : undefined,
    redirectTo: `${origin}/auth/confirm`,
  });
  if (error) {
    return {
      error: /already been registered|already exists/i.test(error.message)
        ? "That email already has an account."
        : `Could not send the invite: ${error.message}`,
    };
  }

  if (role !== "staff") {
    await admin.from("profiles").update({ role }).eq("id", data.user.id);
  }

  refresh();
  return { success: `Invitation sent to ${email}.` };
}

export async function removeUser(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorize("admin");
  if ("error" in auth) return { error: auth.error };

  const id = String(formData.get("id"));
  if (id === auth.profile.id) return { error: "You can't remove your own account." };

  const admin = createAdminClient();
  if (!admin) {
    return {
      error:
        "Removing users from the app needs SUPABASE_SECRET_KEY. You can also remove them in Supabase under Authentication → Users.",
    };
  }

  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) return { error: `Could not remove the user: ${error.message}` };

  refresh();
  return { success: "User removed. Their past stock changes stay in the history." };
}
