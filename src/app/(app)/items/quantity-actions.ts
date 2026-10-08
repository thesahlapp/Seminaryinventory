"use server";

import { authorize } from "@/lib/auth";
import { friendlyError } from "@/lib/errors";

/*
 * Instant quantity changes from the +/− buttons and the tap-to-type field.
 * The history records:  + as "Received",  − as "Issued",  a typed number as
 * "Count correction". (The item page has a form for other reasons and notes.)
 */

type QuantityResult = { quantity: number } | { error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validIds(variantId: string, locationId: string) {
  return UUID.test(variantId) && UUID.test(locationId);
}

export async function adjustQuantity(variantId: string, locationId: string, delta: number): Promise<QuantityResult> {
  if (!validIds(variantId, locationId) || !Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 1_000_000) {
    return { error: "Invalid change." };
  }
  const auth = await authorize("edit");
  if ("error" in auth) return { error: auth.error };

  const { data, error } = await auth.supabase.rpc("change_stock", {
    p_variant_id: variantId,
    p_location_id: locationId,
    p_delta: delta,
    p_reason: delta > 0 ? "received" : "issued",
  });
  if (error) return { error: friendlyError(error) };
  return { quantity: data.new_quantity };
}

export async function setQuantity(variantId: string, locationId: string, quantity: number): Promise<QuantityResult> {
  if (!validIds(variantId, locationId) || !Number.isInteger(quantity) || quantity < 0 || quantity > 1_000_000) {
    return { error: "Enter a whole number, 0 or more." };
  }
  const auth = await authorize("edit");
  if ("error" in auth) return { error: auth.error };

  const { data, error } = await auth.supabase.rpc("set_stock", {
    p_variant_id: variantId,
    p_location_id: locationId,
    p_new_quantity: quantity,
    p_reason: "count_correction",
  });
  if (error) {
    // Typing the same number again is not an error worth showing.
    if (error.message.startsWith("Quantity is unchanged")) return { quantity };
    return { error: friendlyError(error) };
  }
  return { quantity: data.new_quantity };
}
