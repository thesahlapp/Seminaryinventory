"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { authorize } from "@/lib/auth";
import { friendlyError } from "@/lib/errors";
import { formText, sanitizeSearch } from "@/lib/format";

// Purchase orders and suppliers are admin-only (they include costs); the
// database enforces this too.

export type PoItemOption = {
  id: string;
  name: string;
  sku: string | null;
  unitCost: number | null;
  variants: { id: string; label: string | null }[];
};

export async function searchPoItems(query: string): Promise<PoItemOption[]> {
  const auth = await authorize("admin");
  if ("error" in auth) return [];
  const q = sanitizeSearch(query).slice(0, 100);
  let request = auth.supabase
    .from("items")
    .select("id, name, sku, item_costs(unit_cost), item_variants(id, archived_at, sizes(label, sort_order))")
    .is("archived_at", null)
    .order("name")
    .limit(20);
  if (q) request = request.or(`name.ilike.*${q}*,sku.ilike.*${q}*`);
  const { data } = await request;
  return (data ?? []).map((i) => ({
    id: i.id,
    name: i.name,
    sku: i.sku,
    unitCost: i.item_costs?.unit_cost != null ? Number(i.item_costs.unit_cost) : null,
    variants: i.item_variants
      .filter((v) => !v.archived_at)
      .sort((a, b) => (a.sizes?.sort_order ?? 0) - (b.sizes?.sort_order ?? 0))
      .map((v) => ({ id: v.id, label: v.sizes?.label ?? null })),
  }));
}

type LineInput = { variant_id: string; quantity_ordered: number; unit_cost: number | null };

export async function savePurchaseOrder(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorize("admin");
  if ("error" in auth) return { error: auth.error };
  const { supabase } = auth;

  const id = formText(formData, "id");
  const supplierId = formText(formData, "supplier_id");
  const locationId = formText(formData, "destination_location_id");
  if (!supplierId) return { error: "Choose a supplier." };
  if (!locationId) return { error: "Choose where the delivery goes." };

  let lines: LineInput[];
  try {
    lines = JSON.parse(String(formData.get("lines") ?? "[]"));
  } catch {
    return { error: "Something went wrong with the item list. Please try again." };
  }
  if (!lines.length) return { error: "Add at least one item." };
  if (lines.some((l) => !Number.isInteger(l.quantity_ordered) || l.quantity_ordered < 1)) return { error: "Quantities must be 1 or more." };
  if (lines.some((l) => l.unit_cost !== null && (!Number.isFinite(l.unit_cost) || l.unit_cost < 0))) return { error: "Unit costs must be amounts like 12.50." };
  const merged = new Map<string, LineInput>();
  for (const l of lines) {
    const existing = merged.get(l.variant_id);
    merged.set(l.variant_id, existing ? { ...existing, quantity_ordered: existing.quantity_ordered + l.quantity_ordered } : l);
  }

  const markOrdered = formData.get("intent") === "order";
  const values = {
    supplier_id: supplierId,
    destination_location_id: locationId,
    expected_date: formText(formData, "expected_date"),
    notes: formText(formData, "notes"),
    ...(markOrdered ? { status: "ordered" as const, ordered_at: new Date().toISOString() } : {}),
  };

  let poId = id;
  if (id) {
    const { data: existing } = await supabase.from("purchase_orders").select("status").eq("id", id).single();
    if (existing?.status !== "draft") return { error: "Only draft purchase orders can be edited." };
    const { error } = await supabase.from("purchase_orders").update(values).eq("id", id);
    if (error) return { error: friendlyError(error) };
    const { error: deleteError } = await supabase.from("purchase_order_lines").delete().eq("purchase_order_id", id);
    if (deleteError) return { error: friendlyError(deleteError) };
  } else {
    const { data, error } = await supabase.from("purchase_orders").insert(values).select("id").single();
    if (error) return { error: friendlyError(error) };
    poId = data.id;
  }

  const { error: linesError } = await supabase
    .from("purchase_order_lines")
    .insert([...merged.values()].map((l) => ({ ...l, purchase_order_id: poId! })));
  if (linesError) return { error: friendlyError(linesError) };

  redirect(`/purchase-orders/${poId}`);
}

export async function setPurchaseOrderStatus(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorize("admin");
  if ("error" in auth) return { error: auth.error };
  const status = formData.get("status");
  const id = String(formData.get("id"));
  const { data: po } = await auth.supabase.from("purchase_orders").select("status").eq("id", id).single();
  if (!po) return { error: "Purchase order not found." };

  if (status === "ordered" && po.status === "draft") {
    const { error } = await auth.supabase.from("purchase_orders").update({ status: "ordered", ordered_at: new Date().toISOString() }).eq("id", id);
    if (error) return { error: friendlyError(error) };
  } else if (status === "cancelled" && ["draft", "ordered", "partially_received"].includes(po.status)) {
    const { error } = await auth.supabase.from("purchase_orders").update({ status: "cancelled" }).eq("id", id);
    if (error) return { error: friendlyError(error) };
  } else {
    return { error: "That change isn't possible for this purchase order." };
  }
  refresh();
  return { success: status === "ordered" ? "Marked as ordered." : "Purchase order cancelled." };
}

export async function deletePurchaseOrder(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorize("admin");
  if ("error" in auth) return { error: auth.error };
  const id = String(formData.get("id"));
  const { data: po } = await auth.supabase.from("purchase_orders").select("status").eq("id", id).single();
  if (po?.status !== "draft") return { error: "Only drafts can be deleted. Cancel it instead." };
  const { error } = await auth.supabase.from("purchase_orders").delete().eq("id", id);
  if (error) return { error: friendlyError(error) };
  redirect("/purchase-orders");
}

export async function receivePurchaseOrder(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorize("admin");
  if ("error" in auth) return { error: auth.error };
  const lines = [];
  for (const id of formData.getAll("line_id").map(String)) {
    const raw = String(formData.get(`received:${id}`) ?? "").trim();
    if (raw === "") continue;
    if (!/^\d+$/.test(raw)) return { error: "Received amounts must be whole numbers." };
    if (Number(raw) > 0) lines.push({ line_id: id, quantity: Number(raw) });
  }
  if (!lines.length) return { error: "Enter how many arrived for at least one item." };

  const { data, error } = await auth.supabase.rpc("receive_purchase_order", {
    p_purchase_order_id: String(formData.get("id")),
    p_lines: lines as never,
    p_location_id: formText(formData, "location_id") ?? undefined,
    p_update_costs: formData.get("update_costs") === "on",
  });
  if (error) return { error: friendlyError(error) };
  refresh();
  return { success: data.status === "received" ? "Everything has arrived. Stock updated." : "Received. Stock updated; the rest is still on order." };
}

// ---------------------------------------------------------------------------
// Suppliers
// ---------------------------------------------------------------------------

export async function saveSupplier(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorize("admin");
  if ("error" in auth) return { error: auth.error };
  const id = formText(formData, "id");
  const name = formText(formData, "name");
  if (!name) return { error: "Enter the supplier's name." };
  const values = {
    name,
    contact_name: formText(formData, "contact_name"),
    email: formText(formData, "email"),
    phone: formText(formData, "phone"),
    website: formText(formData, "website"),
    notes: formText(formData, "notes"),
  };
  const { error } = id
    ? await auth.supabase.from("suppliers").update(values).eq("id", id)
    : await auth.supabase.from("suppliers").insert(values);
  if (error) return { error: friendlyError(error, { duplicate: `There's already a supplier called "${name}".` }) };
  refresh();
  return { success: id ? "Saved." : "Supplier added." };
}

export async function setSupplierArchived(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorize("admin");
  if ("error" in auth) return { error: auth.error };
  const archive = formData.get("archive") === "true";
  const { error } = await auth.supabase
    .from("suppliers")
    .update({ archived_at: archive ? new Date().toISOString() : null })
    .eq("id", String(formData.get("id")));
  if (error) return { error: friendlyError(error) };
  refresh();
  return { success: archive ? "Archived." : "Restored." };
}

export async function deleteSupplier(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorize("admin");
  if ("error" in auth) return { error: auth.error };
  const { error } = await auth.supabase.from("suppliers").delete().eq("id", String(formData.get("id")));
  if (error) return { error: friendlyError(error, { inUse: "This supplier has purchase orders, so it can't be deleted. Archive it instead." }) };
  refresh();
  return { success: "Deleted." };
}
