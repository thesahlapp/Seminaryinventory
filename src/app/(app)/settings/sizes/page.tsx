import type { Metadata } from "next";
import { Badge, Input } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { AddEntryCard, EntryList, InlineField, ListRow } from "../list-ui";

export const metadata: Metadata = { title: "Sizes" };

export default async function SizesPage() {
  const supabase = await createClient();
  const { data: sizes, error } = await supabase
    .from("sizes")
    .select("id, label, sort_order, is_standard, archived_at, item_variants(count)")
    .order("sort_order")
    .order("label");
  if (error) throw error;

  const active = sizes.filter((s) => !s.archived_at);
  const archived = sizes.filter((s) => s.archived_at);

  const row = (s: (typeof sizes)[number]) => {
    const used = s.item_variants[0]?.count ?? 0;
    return (
      <ListRow
        key={s.id}
        table="sizes"
        id={s.id}
        archived={Boolean(s.archived_at)}
        usage={
          <>
            {s.is_standard && <Badge tone="brand">Standard</Badge>}{" "}
            {`used by ${used} item${used === 1 ? "" : "s"}`}
          </>
        }
      >
        <SizeFields size={s} />
      </ListRow>
    );
  };

  return (
    <div className="space-y-6">
      <AddEntryCard table="sizes" title="Add a custom size">
        <SizeFields />
      </AddEntryCard>
      <EntryList
        title="Sizes"
        empty="No sizes yet."
      >
        {active.map(row)}
      </EntryList>
      <p className="text-xs text-brand-400">
        Sizes appear in order of the &ldquo;Order&rdquo; number, lowest first. The standard sizes use 10, 20, 30…, so a
        custom size like &ldquo;3XL&rdquo; can go at 70, or &ldquo;Youth M&rdquo; at 5.
      </p>
      {archived.length > 0 && (
        <EntryList title={`Archived (${archived.length})`} empty="">
          {archived.map(row)}
        </EntryList>
      )}
    </div>
  );
}

function SizeFields({ size }: { size?: { label: string; sort_order: number } }) {
  return (
    <>
      <InlineField label="Label" className="min-w-32 flex-1">
        <Input name="label" defaultValue={size?.label} required placeholder="e.g. 3XL" />
      </InlineField>
      <InlineField label="Order" className="w-24">
        <Input name="sort_order" type="number" defaultValue={size?.sort_order ?? 70} />
      </InlineField>
    </>
  );
}
