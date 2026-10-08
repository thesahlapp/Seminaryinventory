import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Badge, Card, CardHeader, EmptyState, Input } from "@/components/ui";
import { getCurrentProfile, isAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { deleteSupplier, saveSupplier, setSupplierArchived } from "../actions";
import { AdminOnly } from "../admin-only";

export const metadata: Metadata = { title: "Suppliers" };

type Supplier = { id?: string; name?: string; contact_name?: string | null; email?: string | null; phone?: string | null; website?: string | null; notes?: string | null };

function SupplierFields({ s }: { s?: Supplier }) {
  const field = (name: keyof Supplier, label: string, props: React.ComponentProps<typeof Input> = {}) => (
    <label className="flex min-w-40 flex-1 flex-col gap-1 text-xs font-medium text-brand-500">
      {label}
      <Input name={name} defaultValue={(s?.[name] as string | null | undefined) ?? ""} {...props} />
    </label>
  );
  return (
    <>
      {field("name", "Name", { required: true })}
      {field("contact_name", "Contact")}
      {field("email", "Email", { type: "email" })}
      {field("phone", "Phone", { type: "tel" })}
      {field("website", "Website", { placeholder: "https://" })}
      {field("notes", "Notes")}
    </>
  );
}

export default async function SuppliersPage() {
  const profile = await getCurrentProfile();
  if (!isAdmin(profile.role)) return <AdminOnly title="Suppliers" />;
  const supabase = await createClient();
  const { data: suppliers, error } = await supabase.from("suppliers").select("*").order("name");
  if (error) throw error;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/purchase-orders" className="text-sm text-brand-500 hover:underline">
          ← Purchase orders
        </Link>
        <h1 className="mt-1 font-display text-2xl font-semibold text-brand-700">Suppliers</h1>
      </div>
      <Card>
        <CardHeader title="Add a supplier" />
        <ActionForm action={saveSupplier} resetOnSuccess className="flex flex-wrap items-end gap-3 p-4">
          <SupplierFields />
          <SubmitButton>Add</SubmitButton>
        </ActionForm>
      </Card>
      <Card>
        <CardHeader title={`Suppliers (${suppliers.length})`} />
        {suppliers.length === 0 ? (
          <EmptyState>No suppliers yet.</EmptyState>
        ) : (
          <ul className="divide-y divide-cream-200">
            {suppliers.map((s) => (
              <li key={s.id} className="space-y-2 p-4">
                <div className="flex items-center gap-2">
                  {s.archived_at && <Badge tone="muted">Archived</Badge>}
                  {s.website && (
                    <a href={s.website.startsWith("http") ? s.website : `https://${s.website}`} target="_blank" rel="noreferrer" className="text-xs text-brand-500 underline">
                      Visit website
                    </a>
                  )}
                </div>
                <ActionForm action={saveSupplier} className="flex flex-wrap items-end gap-3">
                  <input type="hidden" name="id" value={s.id} />
                  <SupplierFields s={s} />
                  <SubmitButton variant="secondary">Save</SubmitButton>
                </ActionForm>
                <div className="flex gap-2">
                  <ActionForm action={setSupplierArchived} className="flex flex-col gap-2">
                    <input type="hidden" name="id" value={s.id} />
                    <input type="hidden" name="archive" value={s.archived_at ? "false" : "true"} />
                    <SubmitButton variant="ghost" size="sm" pendingText="…">
                      {s.archived_at ? "Restore" : "Archive"}
                    </SubmitButton>
                  </ActionForm>
                  <ActionForm action={deleteSupplier} confirm={`Delete ${s.name}?`} className="flex flex-col gap-2">
                    <input type="hidden" name="id" value={s.id} />
                    <SubmitButton variant="danger" size="sm" pendingText="…">
                      Delete
                    </SubmitButton>
                  </ActionForm>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
