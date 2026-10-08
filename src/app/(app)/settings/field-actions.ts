"use server";

import { refresh } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { authorize } from "@/lib/auth";
import type { FieldType } from "@/lib/custom-fields";
import { friendlyError } from "@/lib/errors";
import { formText } from "@/lib/format";

const TYPES: FieldType[] = ["text", "number", "date", "select", "boolean"];

export async function saveCategoryField(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorize("admin");
  if ("error" in auth) return { error: auth.error };

  const id = formText(formData, "id");
  const label = formText(formData, "label");
  if (!label) return { error: "Enter a name for the field." };
  const sortOrder = Math.round(Number(formData.get("sort_order") ?? 0)) || 0;
  const options = (formText(formData, "options") ?? "")
    .split(/[,\n]/)
    .map((o) => o.trim())
    .filter(Boolean);

  if (id) {
    const { data: existing } = await auth.supabase.from("category_fields").select("field_type").eq("id", id).single();
    if (existing?.field_type === "select" && options.length === 0) return { error: "A dropdown needs at least one choice." };
    const { error } = await auth.supabase.from("category_fields").update({ label, options, sort_order: sortOrder }).eq("id", id);
    if (error) return { error: friendlyError(error, { duplicate: `This category already has a field called "${label}".` }) };
  } else {
    const type = formData.get("field_type") as FieldType;
    if (!TYPES.includes(type)) return { error: "Choose a field type." };
    if (type === "select" && options.length === 0) return { error: "A dropdown needs at least one choice." };
    const { error } = await auth.supabase.from("category_fields").insert({
      category_id: String(formData.get("category_id")),
      label,
      field_type: type,
      options: type === "select" ? options : [],
      sort_order: sortOrder,
    });
    if (error) return { error: friendlyError(error, { duplicate: `This category already has a field called "${label}".` }) };
  }

  refresh();
  return { success: id ? "Saved." : "Field added." };
}

export async function deleteCategoryField(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorize("admin");
  if ("error" in auth) return { error: auth.error };
  const { error } = await auth.supabase.from("category_fields").delete().eq("id", String(formData.get("id")));
  if (error) return { error: friendlyError(error) };
  refresh();
  return { success: "Field deleted." };
}
