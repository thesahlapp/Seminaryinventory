import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { getCurrentProfile, isAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AdminOnly } from "../../admin-only";
import { poItemOptions } from "../../load-form-data";
import { PoForm } from "../../po-form";

export const metadata: Metadata = { title: "Edit purchase order" };

export default async function EditPurchaseOrderPage({ params }: PageProps<"/purchase-orders/[id]/edit">) {
  const profile = await getCurrentProfile();
  if (!isAdmin(profile.role)) return <AdminOnly title="Edit purchase order" />;
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: po }, { data: suppliers }, { data: locations }] = await Promise.all([
    supabase
      .from("purchase_orders")
      .select("id, number, status, supplier_id, destination_location_id, expected_date, notes, purchase_order_lines(variant_id, quantity_ordered, unit_cost, item_variants(item_id))")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("suppliers").select("id, name").order("name"),
    supabase.from("locations").select("id, name").is("archived_at", null).order("sort_order").order("name"),
  ]);
  if (!po) notFound();
  if (po.status !== "draft") redirect(`/purchase-orders/${po.id}`);

  const options = await poItemOptions(supabase, [...new Set(po.purchase_order_lines.map((l) => l.item_variants.item_id))]);
  const lines = po.purchase_order_lines.flatMap((l) => {
    const option = options.get(l.item_variants.item_id);
    return option
      ? [
          {
            key: l.variant_id,
            item: { ...option, variants: option.variants.map(({ id, label }) => ({ id, label })) },
            variantId: l.variant_id,
            quantity: String(l.quantity_ordered),
            unitCost: l.unit_cost != null ? Number(l.unit_cost).toFixed(2) : "",
          },
        ]
      : [];
  });

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={`Edit PO #${po.number}`} />
      <PoForm suppliers={suppliers ?? []} locations={locations ?? []} po={po} initialLines={lines} />
    </div>
  );
}
