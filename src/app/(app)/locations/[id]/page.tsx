import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { InventoryBrowser } from "@/components/inventory/inventory-browser";
import { Badge, LinkButton, PageHeader } from "@/components/ui";
import { canEdit, getCurrentProfile, isAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Location" };

export default async function LocationPage({ params, searchParams }: PageProps<"/locations/[id]">) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  const editor = canEdit(profile.role);

  const supabase = await createClient();
  const { data: location } = await supabase
    .from("location_summaries")
    .select("id, name, address, description, archived_at, item_count, total_units")
    .eq("id", id)
    .maybeSingle();
  if (!location?.id) notFound();

  return (
    <div>
      <div className="mb-2 text-sm">
        <Link href="/locations" className="text-brand-500 hover:underline">
          ← Locations
        </Link>
      </div>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {location.name}
            {location.archived_at && <Badge tone="muted">Archived</Badge>}
          </span>
        }
        description={
          <>
            {[location.address, location.description].filter(Boolean).join(" · ")}
            {(location.address || location.description) && <br />}
            {Number(location.item_count).toLocaleString()} items · {Number(location.total_units).toLocaleString()} units
          </>
        }
        actions={
          editor && (
            <LinkButton href={`/locations/move?from=${location.id}`} variant="secondary">
              Move stock from here
            </LinkButton>
          )
        }
      />
      <InventoryBrowser
        searchParams={await searchParams}
        basePath={`/locations/${location.id}`}
        canEdit={editor && !location.archived_at}
        showCosts={isAdmin(profile.role)}
        fixedLocationId={location.id}
      />
    </div>
  );
}
