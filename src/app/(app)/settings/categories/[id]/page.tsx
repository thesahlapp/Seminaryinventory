import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Badge, Card, CardHeader, EmptyState, Input, Select } from "@/components/ui";
import { FIELD_TYPE_LABELS, type FieldType } from "@/lib/custom-fields";
import { createClient } from "@/lib/supabase/server";
import { deleteCategoryField, saveCategoryField } from "../../field-actions";
import { InlineField } from "../../list-ui";

export const metadata: Metadata = { title: "Custom fields" };

const EXAMPLES = "Examples: Serial number (text) for gear, Color and Material for clothing, Expiration date for consumables.";

export default async function CategoryFieldsPage({ params }: PageProps<"/settings/categories/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: category }, { data: fields }] = await Promise.all([
    supabase.from("categories").select("id, name").eq("id", id).maybeSingle(),
    supabase.from("category_fields").select("*").eq("category_id", id).order("sort_order").order("label"),
  ]);
  if (!category) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/settings/categories" className="text-sm text-brand-500 hover:underline">
          ← Categories
        </Link>
        <h2 className="mt-1 font-display text-xl font-semibold text-brand-700">Custom fields for {category.name}</h2>
        <p className="text-sm text-brand-500">
          These fields appear on the add/edit form and the item page for items in this category, and can be used to
          search, filter and sort. {EXAMPLES}
        </p>
      </div>

      <Card>
        <CardHeader title="Add a field" />
        <ActionForm action={saveCategoryField} resetOnSuccess className="flex flex-wrap items-end gap-3 px-5 py-4">
          <input type="hidden" name="category_id" value={category.id} />
          <InlineField label="Name" className="min-w-40 flex-1">
            <Input name="label" required placeholder="e.g. Serial number" />
          </InlineField>
          <InlineField label="Type" className="w-36">
            <Select name="field_type" defaultValue="text">
              {(Object.keys(FIELD_TYPE_LABELS) as FieldType[]).map((t) => (
                <option key={t} value={t}>
                  {FIELD_TYPE_LABELS[t]}
                </option>
              ))}
            </Select>
          </InlineField>
          <InlineField label="Dropdown choices (comma separated)" className="min-w-56 flex-[2]">
            <Input name="options" placeholder="e.g. Black, White, Green" />
          </InlineField>
          <InlineField label="Order" className="w-20">
            <Input name="sort_order" type="number" defaultValue={(fields?.length ?? 0) * 10} />
          </InlineField>
          <SubmitButton>Add</SubmitButton>
        </ActionForm>
      </Card>

      <Card>
        <CardHeader title={`Fields (${fields?.length ?? 0})`} />
        {!fields?.length ? (
          <EmptyState>No custom fields yet.</EmptyState>
        ) : (
          <ul className="divide-y divide-cream-200">
            {fields.map((field) => (
              <li key={field.id} className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-end">
                <ActionForm action={saveCategoryField} className="flex flex-1 flex-wrap items-end gap-3">
                  <input type="hidden" name="id" value={field.id} />
                  <InlineField label="Name" className="min-w-40 flex-1">
                    <Input name="label" defaultValue={field.label} required />
                  </InlineField>
                  <div className="flex flex-col gap-1 pb-2 text-xs font-medium text-brand-500">
                    Type
                    <Badge tone="brand">{FIELD_TYPE_LABELS[field.field_type]}</Badge>
                  </div>
                  {field.field_type === "select" && (
                    <InlineField label="Choices" className="min-w-56 flex-[2]">
                      <Input name="options" defaultValue={field.options.join(", ")} />
                    </InlineField>
                  )}
                  <InlineField label="Order" className="w-20">
                    <Input name="sort_order" type="number" defaultValue={field.sort_order} />
                  </InlineField>
                  <SubmitButton variant="secondary">Save</SubmitButton>
                </ActionForm>
                <ActionForm
                  action={deleteCategoryField}
                  confirm={`Delete the "${field.label}" field? Values already entered will no longer be shown.`}
                  className="flex flex-col gap-2"
                >
                  <input type="hidden" name="id" value={field.id} />
                  <SubmitButton variant="danger" size="sm" pendingText="…">
                    Delete
                  </SubmitButton>
                </ActionForm>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
