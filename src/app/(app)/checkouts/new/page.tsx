import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { canEdit, getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { searchCheckoutable } from "../actions";
import { CheckoutForm } from "./checkout-form";

export const metadata: Metadata = { title: "Check out" };

export default async function NewCheckoutPage({ searchParams }: PageProps<"/checkouts/new">) {
  const params = await searchParams;
  const profile = await getCurrentProfile();
  if (!canEdit(profile.role)) {
    return <PageHeader title="Check out" description="You have view-only access. Ask an admin for edit access." />;
  }
  const supabase = await createClient();
  const itemId = typeof params.item === "string" ? params.item : null;
  const kitId = typeof params.kit === "string" ? params.kit : null;

  const [{ data: people }, { data: locations }, { data: kits }, initialItems] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email").order("full_name"),
    supabase.from("locations").select("id, name").is("archived_at", null).order("sort_order").order("name"),
    supabase.from("kits").select("id, name").is("archived_at", null).order("name"),
    itemId ? searchCheckoutable("", itemId) : Promise.resolve([]),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-2 text-sm">
        <Link href="/checkouts" className="text-brand-500 hover:underline">
          ← Checked out
        </Link>
      </div>
      <PageHeader title="Check out" description="Stock leaves its location now and comes back when it's checked in." />
      <CheckoutForm
        people={(people ?? []).map((p) => ({ id: p.id, name: p.full_name ?? p.email ?? "Unnamed" }))}
        locations={locations ?? []}
        kits={kits ?? []}
        initialItems={initialItems}
        initialKitId={kitId}
      />
    </div>
  );
}
