import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Badge, Card, CardHeader, Field, Input, PageHeader, Select, Textarea } from "@/components/ui";
import { canEdit, getCurrentProfile } from "@/lib/auth";
import { formatDate, formatDateTime, todayInDallas } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { checkIn, updateCheckoutDetails } from "../actions";

export const metadata: Metadata = { title: "Check-out" };

export default async function CheckoutPage({ params }: PageProps<"/checkouts/[id]">) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  const editor = canEdit(profile.role);
  const supabase = await createClient();

  const [{ data: checkout }, { data: locations }] = await Promise.all([
    supabase
      .from("checkouts")
      .select(
        "id, number, borrower_name, project, due_date, notes, created_at, closed_at, kits(id, name), creator:profiles!checkouts_created_by_fkey(full_name, email), checkout_lines(id, quantity, returned_good, returned_damaged, missing, condition_note, returned_at, location_id, locations(name), item_variants(item_id, items(name), sizes(label)))",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase.from("locations").select("id, name").is("archived_at", null).order("sort_order").order("name"),
  ]);
  if (!checkout) notFound();

  const today = todayInDallas();
  const overdue = !checkout.closed_at && checkout.due_date < today;
  const lines = checkout.checkout_lines.map((l) => ({ ...l, out: l.quantity - l.returned_good - l.returned_damaged - l.missing }));
  const open = lines.filter((l) => l.out > 0);

  return (
    <div className="space-y-6">
      <div className="text-sm">
        <Link href="/checkouts" className="text-brand-500 hover:underline">
          ← Checked out
        </Link>
      </div>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {checkout.borrower_name}
            {checkout.closed_at ? (
              <Badge tone="muted">Returned</Badge>
            ) : overdue ? (
              <Badge tone="danger">Overdue</Badge>
            ) : (
              <Badge tone="brand">Out</Badge>
            )}
          </span>
        }
        description={
          <>
            Check-out #{checkout.number}
            {checkout.project && ` · ${checkout.project}`}
            {checkout.kits && (
              <>
                {" · Kit: "}
                <Link href={`/kits/${checkout.kits.id}`} className="underline">
                  {checkout.kits.name}
                </Link>
              </>
            )}
            <br />
            Out since {formatDateTime(checkout.created_at)}
            {checkout.creator && ` (by ${checkout.creator.full_name ?? checkout.creator.email})`} · due{" "}
            <span className={overdue ? "font-semibold text-red-700" : ""}>{formatDate(`${checkout.due_date}T12:00:00`)}</span>
          </>
        }
      />

      {checkout.closed_at && (
        <p role="status" className="rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-800">
          Everything is checked in. This check-out was closed {formatDateTime(checkout.closed_at)}.
        </p>
      )}

      {editor && open.length > 0 && (
        <Card>
          <CardHeader title="Check in" />
          <ActionForm action={checkIn} resetOnSuccess className="space-y-4 p-4">
            <input type="hidden" name="checkout_id" value={checkout.id} />
            <p className="text-sm text-brand-500">
              Enter what came back. Good and damaged items go back into stock; missing items are recorded as lost.
            </p>
            <ul className="space-y-3">
              {open.map((line) => (
                <li key={line.id} className="rounded-lg border border-cream-300 bg-cream-100 p-3">
                  <input type="hidden" name="line_id" value={line.id} />
                  <p className="font-medium text-brand-800">
                    {line.item_variants.items.name}
                    {line.item_variants.sizes && <span className="text-brand-500"> · {line.item_variants.sizes.label}</span>}
                    <span className="ml-2 text-sm font-normal text-brand-500">{line.out} still out</span>
                  </p>
                  <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-[repeat(3,6rem)_1fr]">
                    <label className="space-y-1 text-xs font-medium text-brand-600">
                      Good
                      <Input name={`good:${line.id}`} type="number" inputMode="numeric" min={0} max={line.out} defaultValue={line.out} />
                    </label>
                    <label className="space-y-1 text-xs font-medium text-amber-800">
                      Damaged
                      <Input name={`damaged:${line.id}`} type="number" inputMode="numeric" min={0} max={line.out} placeholder="0" />
                    </label>
                    <label className="space-y-1 text-xs font-medium text-red-700">
                      Missing
                      <Input name={`missing:${line.id}`} type="number" inputMode="numeric" min={0} max={line.out} placeholder="0" />
                    </label>
                    <label className="col-span-3 space-y-1 text-xs font-medium text-brand-600 sm:col-span-1">
                      Return to
                      <Select name={`location:${line.id}`} defaultValue={line.location_id}>
                        {(locations ?? []).map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.name}
                          </option>
                        ))}
                      </Select>
                    </label>
                  </div>
                  <Input name={`note:${line.id}`} placeholder="Condition note (optional), e.g. scratched lens" className="mt-2" />
                </li>
              ))}
            </ul>
            <SubmitButton>Check in</SubmitButton>
          </ActionForm>
        </Card>
      )}

      <Card>
        <CardHeader title="Items" />
        <ul className="divide-y divide-cream-200">
          {lines.map((line) => (
            <li key={line.id} className="flex flex-wrap items-start justify-between gap-2 px-5 py-3 text-sm">
              <div>
                <Link href={`/items/${line.item_variants.item_id}`} className="font-medium text-brand-800 hover:underline">
                  {line.item_variants.items.name}
                </Link>
                {line.item_variants.sizes && <span className="text-brand-500"> · {line.item_variants.sizes.label}</span>}
                <p className="text-xs text-brand-400">
                  {line.quantity} taken from {line.locations.name}
                  {line.returned_at && ` · last check-in ${formatDateTime(line.returned_at)}`}
                </p>
                {line.condition_note && <p className="text-xs text-brand-600">“{line.condition_note}”</p>}
              </div>
              <div className="flex flex-wrap gap-1">
                {line.out > 0 && <Badge tone="warning">{line.out} out</Badge>}
                {line.returned_good > 0 && <Badge tone="brand">{line.returned_good} good</Badge>}
                {line.returned_damaged > 0 && <Badge tone="warning">{line.returned_damaged} damaged</Badge>}
                {line.missing > 0 && <Badge tone="danger">{line.missing} missing</Badge>}
              </div>
            </li>
          ))}
        </ul>
      </Card>

      {editor && !checkout.closed_at && (
        <Card>
          <CardHeader title="Details" />
          <ActionForm action={updateCheckoutDetails} className="grid gap-4 p-4 sm:grid-cols-2">
            <input type="hidden" name="id" value={checkout.id} />
            <Field label="Due back" htmlFor="due_date">
              <Input id="due_date" name="due_date" type="date" defaultValue={checkout.due_date} required />
            </Field>
            <Field label="Project or job" htmlFor="project">
              <Input id="project" name="project" defaultValue={checkout.project ?? ""} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Notes" htmlFor="notes">
                <Textarea id="notes" name="notes" defaultValue={checkout.notes ?? ""} />
              </Field>
            </div>
            <div>
              <SubmitButton variant="secondary">Save details</SubmitButton>
            </div>
          </ActionForm>
        </Card>
      )}
    </div>
  );
}
