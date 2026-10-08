import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { canEdit, getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getItemStock } from "../actions";
import { MoveStockForm } from "./move-stock-form";

export const metadata: Metadata = { title: "Move stock" };

export default async function MoveStockPage({ searchParams }: PageProps<"/locations/move">) {
  const params = await searchParams;
  const profile = await getCurrentProfile();
  if (!canEdit(profile.role)) {
    return <PageHeader title="Move stock" description="You have view-only access. Ask an admin for edit access." />;
  }

  const itemId = typeof params.item === "string" ? params.item : null;
  const from = typeof params.from === "string" ? params.from : undefined;

  const supabase = await createClient();
  const [{ data: locations, error }, item] = await Promise.all([
    supabase.from("locations").select("id, name").is("archived_at", null).order("sort_order").order("name"),
    itemId ? getItemStock(itemId) : null,
  ]);
  if (error) throw error;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-2 text-sm">
        <Link href="/locations" className="text-brand-500 hover:underline">
          ← Locations
        </Link>
      </div>
      <PageHeader
        title="Move stock"
        description="Move units from one location to another. It's recorded in the history as a transfer."
      />
      <MoveStockForm locations={locations} initialItem={item} initialFrom={from} />
    </div>
  );
}
