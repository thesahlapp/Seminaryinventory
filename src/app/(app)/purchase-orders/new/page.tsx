import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { getCurrentProfile, isAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AdminOnly } from "../admin-only";
import { lowStockLines, poItemOptions } from "../load-form-data";
import { PoForm, type PoLine } from "../po-form";

export const metadata: Metadata = { title: "New purchase order" };

export default async function NewPurchaseOrderPage({ searchParams }: PageProps<"/purchase-orders/new">) {
  const profile = await getCurrentProfile();
  if (!isAdmin(profile.role)) return <AdminOnly title="New purchase order" />;
  const params = await searchParams;
  const supabase = await createClient();

  const [{ data: suppliers }, { data: locations }] = await Promise.all([
    supabase.from("suppliers").select("id, name").is("archived_at", null).order("name"),
    supabase.from("locations").select("id, name").is("archived_at", null).order("sort_order").order("name"),
  ]);

  let lines: PoLine[] = [];
  let note: string | null = null;
  if (params.from === "low-stock") {
    lines = await lowStockLines(supabase);
    note = `Pre-filled with ${lines.length} item${lines.length === 1 ? "" : "s"} at or below their minimum. Adjust quantities as needed.`;
  } else if (typeof params.item === "string") {
    lines = await lowStockLines(supabase, params.item);
    if (!lines.length) {
      const option = (await poItemOptions(supabase, [params.item])).get(params.item);
      if (option?.variants.length) {
        lines = [
          {
            key: option.id,
            item: { ...option, variants: option.variants.map(({ id, label }) => ({ id, label })) },
            variantId: option.variants[0].id,
            quantity: "1",
            unitCost: option.unitCost != null ? option.unitCost.toFixed(2) : "",
          },
        ];
      }
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-2 text-sm">
        <Link href="/purchase-orders" className="text-brand-500 hover:underline">
          ← Purchase orders
        </Link>
      </div>
      <PageHeader title="New purchase order" description={note} />
      <PoForm suppliers={suppliers ?? []} locations={locations ?? []} initialLines={lines} />
    </div>
  );
}
