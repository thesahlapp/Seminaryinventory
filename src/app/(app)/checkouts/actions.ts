"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { authorize, getCurrentProfile } from "@/lib/auth";
import { friendlyError } from "@/lib/errors";
import { formText, sanitizeSearch } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export type CheckoutableItem = {
  id: string;
  name: string;
  sku: string | null;
  variants: { id: string; label: string | null; levels: { location_id: string; quantity: number }[] }[];
};

/** Items that can be checked out, with what's available where. */
export async function searchCheckoutable(query: string, itemId?: string): Promise<CheckoutableItem[]> {
  await getCurrentProfile();
  const supabase = await createClient();
  const q = sanitizeSearch(query).slice(0, 100);
  let request = supabase
    .from("items")
    .select("id, name, sku, item_variants(id, archived_at, sizes(label, sort_order), stock_levels(location_id, quantity))")
    .eq("checkoutable", true)
    .is("archived_at", null)
    .order("name")
    .limit(20);
  if (itemId) request = request.eq("id", itemId);
  else if (q) request = request.or(`name.ilike.*${q}*,sku.ilike.*${q}*`);
  const { data } = await request;

  return (data ?? []).map((i) => ({
    id: i.id,
    name: i.name,
    sku: i.sku,
    variants: i.item_variants
      .filter((v) => !v.archived_at)
      .sort((a, b) => (a.sizes?.sort_order ?? 0) - (b.sizes?.sort_order ?? 0))
      .map((v) => ({ id: v.id, label: v.sizes?.label ?? null, levels: v.stock_levels })),
  }));
}

function borrowerFields(formData: FormData) {
  return {
    borrowerId: formText(formData, "borrower_id"),
    borrowerName: formText(formData, "borrower_name") ?? "",
    project: formText(formData, "project"),
    dueDate: formText(formData, "due_date"),
    notes: formText(formData, "notes"),
  };
}

export async function createCheckout(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorize("edit");
  if ("error" in auth) return { error: auth.error };
  const b = borrowerFields(formData);
  if (!b.borrowerName && !b.borrowerId) return { error: "Enter who is taking the items." };
  if (!b.dueDate) return { error: "Choose a due date." };

  const kitId = formText(formData, "kit_id");
  if (kitId) {
    const { data, error } = await auth.supabase.rpc("checkout_kit", {
      p_kit_id: kitId,
      p_borrower_name: b.borrowerName,
      p_due_date: b.dueDate,
      p_borrower_id: b.borrowerId ?? undefined,
      p_project: b.project ?? undefined,
      p_notes: b.notes ?? undefined,
    });
    if (error) return { error: friendlyError(error) };
    redirect(`/checkouts/${data.id}`);
  }

  let lines: unknown;
  try {
    lines = JSON.parse(String(formData.get("lines") ?? "[]"));
  } catch {
    return { error: "Something went wrong with the item list. Please try again." };
  }
  if (!Array.isArray(lines) || lines.length === 0) return { error: "Add at least one item." };

  const { data, error } = await auth.supabase.rpc("checkout_items", {
    p_borrower_name: b.borrowerName,
    p_due_date: b.dueDate,
    p_lines: lines as never,
    p_borrower_id: b.borrowerId ?? undefined,
    p_project: b.project ?? undefined,
    p_notes: b.notes ?? undefined,
  });
  if (error) return { error: friendlyError(error) };
  redirect(`/checkouts/${data.id}`);
}

/** Check in some or all lines: amounts good / damaged / missing per line. */
export async function checkIn(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorize("edit");
  if ("error" in auth) return { error: auth.error };
  const checkoutId = String(formData.get("checkout_id"));

  const lineIds = formData.getAll("line_id").map(String);
  const lines = [];
  for (const id of lineIds) {
    const num = (name: string) => {
      const raw = String(formData.get(`${name}:${id}`) ?? "").trim();
      return raw === "" ? 0 : Number(raw);
    };
    const good = num("good");
    const damaged = num("damaged");
    const missing = num("missing");
    if (![good, damaged, missing].every((n) => Number.isInteger(n) && n >= 0)) {
      return { error: "Amounts must be whole numbers, 0 or more." };
    }
    if (good + damaged + missing === 0) continue;
    lines.push({
      line_id: id,
      good,
      damaged,
      missing,
      note: formText(formData, `note:${id}`),
      location_id: formText(formData, `location:${id}`),
    });
  }
  if (!lines.length) return { error: "Enter how many came back (or are missing) for at least one item." };

  const { data, error } = await auth.supabase.rpc("checkin_items", { p_checkout_id: checkoutId, p_lines: lines as never });
  if (error) return { error: friendlyError(error) };
  refresh();
  return { success: data.closed_at ? "Everything is checked in. This check-out is closed." : "Checked in." };
}

export async function updateCheckoutDetails(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorize("edit");
  if ("error" in auth) return { error: auth.error };
  const dueDate = formText(formData, "due_date");
  if (!dueDate) return { error: "Choose a due date." };
  const { error } = await auth.supabase
    .from("checkouts")
    .update({ due_date: dueDate, project: formText(formData, "project"), notes: formText(formData, "notes") })
    .eq("id", String(formData.get("id")));
  if (error) return { error: friendlyError(error) };
  refresh();
  return { success: "Saved." };
}
