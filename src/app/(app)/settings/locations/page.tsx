import type { Metadata } from "next";
import { Input } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { AddEntryCard, EntryList, InlineField, ListRow } from "../list-ui";

export const metadata: Metadata = { title: "Locations" };

export default async function LocationsPage() {
  const supabase = await createClient();
  const { data: locations, error } = await supabase
    .from("locations")
    .select("id, name, address, description, sort_order, archived_at, stock_levels(quantity)")
    .order("sort_order")
    .order("name");
  if (error) throw error;

  const active = locations.filter((l) => !l.archived_at);
  const archived = locations.filter((l) => l.archived_at);

  const row = (l: (typeof locations)[number]) => {
    const units = l.stock_levels.reduce((sum, s) => sum + s.quantity, 0);
    return (
      <ListRow
        key={l.id}
        table="locations"
        id={l.id}
        archived={Boolean(l.archived_at)}
        usage={`${units.toLocaleString()} unit${units === 1 ? "" : "s"} here`}
      >
        <LocationFields location={l} />
      </ListRow>
    );
  };

  return (
    <div className="space-y-6">
      <AddEntryCard table="locations" title="Add a location">
        <LocationFields />
      </AddEntryCard>
      <EntryList title="Locations" empty="No locations yet. Add where you keep stock, e.g. Warehouse or Front Office.">
        {active.map(row)}
      </EntryList>
      {archived.length > 0 && (
        <EntryList title={`Archived (${archived.length})`} empty="">
          {archived.map(row)}
        </EntryList>
      )}
    </div>
  );
}

function LocationFields({
  location,
}: {
  location?: { name: string; address: string | null; description: string | null; sort_order: number };
}) {
  return (
    <>
      <InlineField label="Name" className="min-w-40 flex-1">
        <Input name="name" defaultValue={location?.name} required placeholder="e.g. Warehouse" />
      </InlineField>
      <InlineField label="Address" className="min-w-48 flex-1">
        <Input name="address" defaultValue={location?.address ?? ""} placeholder="Optional" />
      </InlineField>
      <InlineField label="Description" className="min-w-48 flex-1">
        <Input name="description" defaultValue={location?.description ?? ""} placeholder="e.g. Room 104, shelf B" />
      </InlineField>
      <InlineField label="Order" className="w-20">
        <Input name="sort_order" type="number" defaultValue={location?.sort_order ?? 0} />
      </InlineField>
    </>
  );
}
