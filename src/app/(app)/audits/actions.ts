"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { authorize, getCurrentProfile } from "@/lib/auth";
import { friendlyError } from "@/lib/errors";
import { formText, sanitizeSearch } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export async function startAudit(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorize("edit");
  if ("error" in auth) return { error: auth.error };
  const locationId = formText(formData, "location_id");
  if (!locationId) return { error: "Choose a location to count." };
  const { data, error } = await auth.supabase.rpc("start_audit", { p_location_id: locationId, p_notes: formText(formData, "notes") ?? undefined });
  if (error) return { error: friendlyError(error) };
  redirect(`/audits/${data.id}`);
}

export async function recordCount(auditId: string, variantId: string, counted: number | null) {
  const auth = await authorize("edit");
  if ("error" in auth) return { error: auth.error };
  if (counted !== null && (!Number.isInteger(counted) || counted < 0)) return { error: "Counts must be whole numbers, 0 or more." };
  const { data, error } = await auth.supabase.rpc("record_audit_count", {
    p_audit_id: auditId,
    p_variant_id: variantId,
    p_counted: counted as number,
  });
  if (error) return { error: friendlyError(error) };
  return { counted: data.counted_quantity, expected: data.expected_quantity, by: auth.profile.full_name ?? auth.profile.email ?? "You" };
}

export async function applyAudit(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorize("admin");
  if ("error" in auth) return { error: auth.error };
  const { error } = await auth.supabase.rpc("apply_audit", { p_audit_id: String(formData.get("id")) });
  if (error) return { error: friendlyError(error) };
  refresh();
  return { success: "Corrections applied. Stock now matches the count." };
}

export async function cancelAudit(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorize("admin");
  if ("error" in auth) return { error: auth.error };
  const { error } = await auth.supabase.rpc("cancel_audit", { p_audit_id: String(formData.get("id")) });
  if (error) return { error: friendlyError(error) };
  refresh();
  return { success: "Count cancelled. Stock wasn't changed." };
}

export type CountOption = { variantId: string; itemName: string; sizeLabel: string | null };

/** Item/size options for a scanned label or a search (to count something not on the list). */
export async function findCountOptions({ path, query }: { path?: string; query?: string }): Promise<CountOption[]> {
  await getCurrentProfile();
  const supabase = await createClient();
  const match = path?.match(/^\/q\/([iv])\/([0-9a-f-]{36})$/i);

  let request = supabase
    .from("item_variants")
    .select("id, archived_at, items!inner(name, archived_at), sizes(label, sort_order)")
    .is("archived_at", null)
    .is("items.archived_at", null)
    .limit(40);
  if (match?.[1] === "v") request = request.eq("id", match[2]);
  else if (match?.[1] === "i") request = request.eq("item_id", match[2]);
  else if (query && sanitizeSearch(query)) request = request.ilike("items.name", `%${sanitizeSearch(query)}%`);
  else return [];

  const { data } = await request;
  return (data ?? [])
    .sort((a, b) => a.items.name.localeCompare(b.items.name) || (a.sizes?.sort_order ?? 0) - (b.sizes?.sort_order ?? 0))
    .map((v) => ({ variantId: v.id, itemName: v.items.name, sizeLabel: v.sizes?.label ?? null }));
}
