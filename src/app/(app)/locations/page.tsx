import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Card, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { canEdit, getCurrentProfile, isAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Locations" };

export default async function LocationsPage() {
  const profile = await getCurrentProfile();
  const supabase = await createClient();
  const { data: locations, error } = await supabase
    .from("location_summaries")
    .select("id, name, address, description, archived_at, item_count, total_units")
    .order("sort_order")
    .order("name");
  if (error) throw error;

  const active = locations.filter((l) => !l.archived_at);
  // Archived locations are listed only while they still hold stock.
  const archived = locations.filter((l) => l.archived_at && Number(l.total_units) > 0);

  return (
    <div>
      <PageHeader
        title="Locations"
        description="Where stock is kept. Open a location to see everything stored there."
        actions={
          <>
            {isAdmin(profile.role) && (
              <LinkButton href="/settings/locations" variant="secondary">
                Manage locations
              </LinkButton>
            )}
            {canEdit(profile.role) && <LinkButton href="/locations/move">Move stock</LinkButton>}
          </>
        }
      />

      {active.length === 0 ? (
        <Card>
          <EmptyState>
            No locations yet.{" "}
            {isAdmin(profile.role) ? (
              <Link href="/settings/locations" className="underline">
                Add your first location
              </Link>
            ) : (
              "Ask an admin to add one."
            )}
          </EmptyState>
        </Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[...active, ...archived].map((location) => (
            <li key={location.id}>
              <Link
                href={`/locations/${location.id}`}
                className="flex h-full flex-col rounded-xl border border-cream-300 bg-cream-50 p-5 shadow-sm transition hover:border-brand-300"
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-display text-lg font-semibold text-brand-700">{location.name}</h2>
                  {location.archived_at && <Badge tone="muted">Archived</Badge>}
                </div>
                {(location.address || location.description) && (
                  <p className="mt-1 text-sm text-brand-500">
                    {[location.address, location.description].filter(Boolean).join(" · ")}
                  </p>
                )}
                <dl className="mt-auto flex gap-6 pt-4">
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-brand-400">Items</dt>
                    <dd className="font-display text-2xl font-semibold tabular-nums text-brand-700">
                      {Number(location.item_count).toLocaleString()}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-brand-400">Units</dt>
                    <dd className="font-display text-2xl font-semibold tabular-nums text-brand-700">
                      {Number(location.total_units).toLocaleString()}
                    </dd>
                  </div>
                </dl>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
