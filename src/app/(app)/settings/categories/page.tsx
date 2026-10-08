import type { Metadata } from "next";
import { Input } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { AddEntryCard, EntryList, InlineField, ListRow } from "../list-ui";

export const metadata: Metadata = { title: "Categories" };

export default async function CategoriesPage() {
  const supabase = await createClient();
  const { data: categories, error } = await supabase
    .from("categories")
    .select("id, name, description, default_has_sizes, sort_order, archived_at, items(count)")
    .order("sort_order")
    .order("name");
  if (error) throw error;

  const active = categories.filter((c) => !c.archived_at);
  const archived = categories.filter((c) => c.archived_at);

  const row = (c: (typeof categories)[number]) => {
    const itemCount = c.items[0]?.count ?? 0;
    return (
      <ListRow
        key={c.id}
        table="categories"
        id={c.id}
        archived={Boolean(c.archived_at)}
        usage={`${itemCount} item${itemCount === 1 ? "" : "s"}`}
      >
        <CategoryFields category={c} />
      </ListRow>
    );
  };

  return (
    <div className="space-y-6">
      <AddEntryCard table="categories" title="Add a category">
        <CategoryFields />
      </AddEntryCard>
      <EntryList title="Categories" empty="No categories yet. Add your first one above.">
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

function CategoryFields({
  category,
}: {
  category?: { name: string; description: string | null; default_has_sizes: boolean; sort_order: number };
}) {
  return (
    <>
      <InlineField label="Name" className="min-w-40 flex-1">
        <Input name="name" defaultValue={category?.name} required placeholder="e.g. Apparel" />
      </InlineField>
      <InlineField label="Description" className="min-w-48 flex-[2]">
        <Input name="description" defaultValue={category?.description ?? ""} placeholder="Optional" />
      </InlineField>
      <InlineField label="Order" className="w-20">
        <Input name="sort_order" type="number" defaultValue={category?.sort_order ?? 0} />
      </InlineField>
      <label className="flex items-center gap-2 pb-2 text-sm text-brand-700">
        <input
          type="checkbox"
          name="default_has_sizes"
          defaultChecked={category?.default_has_sizes}
          className="size-4 accent-[#2f6b47]"
        />
        Items have sizes
      </label>
    </>
  );
}
