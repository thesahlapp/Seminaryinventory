import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Badge, Card, CardHeader, Input, LinkButton, PageHeader, Select, Table } from "@/components/ui";
import { getCurrentProfile, isAdmin } from "@/lib/auth";
import { formatDate, formatDateTime } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { deletePurchaseOrder, receivePurchaseOrder, setPurchaseOrderStatus } from "../actions";
import { AdminOnly } from "../admin-only";
import { PO_STATUS } from "../status";

export const metadata: Metadata = { title: "Purchase order" };

export default async function PurchaseOrderPage({ params }: PageProps<"/purchase-orders/[id]">) {
  const profile = await getCurrentProfile();
  if (!isAdmin(profile.role)) return <AdminOnly title="Purchase order" />;
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: po }, { data: locations }] = await Promise.all([
    supabase
      .from("purchase_orders")
      .select(
        "id, number, status, expected_date, notes, created_at, ordered_at, received_at, destination_location_id, suppliers(id, name, contact_name, email, phone, website), locations(name), purchase_order_lines(id, quantity_ordered, quantity_received, unit_cost, item_variants(item_id, items(name), sizes(label)))",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase.from("locations").select("id, name").is("archived_at", null).order("sort_order").order("name"),
  ]);
  if (!po) notFound();

  const lines = po.purchase_order_lines;
  const total = lines.reduce((n, l) => n + l.quantity_ordered * Number(l.unit_cost ?? 0), 0);
  const receivable = po.status === "ordered" || po.status === "partially_received";
  const supplier = po.suppliers;

  return (
    <div className="space-y-6">
      <div className="text-sm">
        <Link href="/purchase-orders" className="text-brand-500 hover:underline">
          ← Purchase orders
        </Link>
      </div>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            PO #{po.number}
            <Badge tone={PO_STATUS[po.status].tone}>{PO_STATUS[po.status].label}</Badge>
          </span>
        }
        description={
          <>
            {supplier.name} · deliver to {po.locations.name}
            {po.expected_date && ` · expected ${formatDate(`${po.expected_date}T12:00:00`)}`}
            <br />
            Created {formatDateTime(po.created_at)}
            {po.ordered_at && ` · ordered ${formatDate(po.ordered_at)}`}
            {po.received_at && ` · received ${formatDate(po.received_at)}`}
          </>
        }
        actions={
          <>
            {po.status === "draft" && (
              <>
                <ActionForm action={setPurchaseOrderStatus} className="flex flex-col gap-2">
                  <input type="hidden" name="id" value={po.id} />
                  <input type="hidden" name="status" value="ordered" />
                  <SubmitButton>Mark ordered</SubmitButton>
                </ActionForm>
                <LinkButton href={`/purchase-orders/${po.id}/edit`} variant="secondary">
                  Edit
                </LinkButton>
                <ActionForm action={deletePurchaseOrder} confirm="Delete this draft?" className="flex flex-col gap-2">
                  <input type="hidden" name="id" value={po.id} />
                  <SubmitButton variant="danger">Delete</SubmitButton>
                </ActionForm>
              </>
            )}
            {(po.status === "ordered" || po.status === "partially_received") && (
              <ActionForm action={setPurchaseOrderStatus} confirm="Cancel this purchase order? Anything already received stays in stock." className="flex flex-col gap-2">
                <input type="hidden" name="id" value={po.id} />
                <input type="hidden" name="status" value="cancelled" />
                <SubmitButton variant="danger">Cancel PO</SubmitButton>
              </ActionForm>
            )}
          </>
        }
      />

      {po.status === "received" && (
        <p role="status" className="rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-800">
          Everything has arrived{po.received_at ? ` (${formatDate(po.received_at)})` : ""}. The stock was added to inventory and logged in the history.
        </p>
      )}

      {receivable && (
        <Card>
          <CardHeader title="Receive delivery" />
          <ActionForm action={receivePurchaseOrder} resetOnSuccess className="space-y-4 p-4">
            <input type="hidden" name="id" value={po.id} />
            <p className="text-sm text-brand-500">Enter what actually arrived. It&apos;s added to stock and recorded in the history as Received.</p>
            <ul className="divide-y divide-cream-200 rounded-lg border border-cream-300">
              {lines.map((line) => {
                const remaining = Math.max(0, line.quantity_ordered - line.quantity_received);
                return (
                  <li key={line.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2">
                    <input type="hidden" name="line_id" value={line.id} />
                    <span className="text-sm">
                      <span className="font-medium text-brand-800">{line.item_variants.items.name}</span>
                      {line.item_variants.sizes && <span className="text-brand-500"> · {line.item_variants.sizes.label}</span>}
                      <span className="block text-xs text-brand-400">
                        {line.quantity_received} of {line.quantity_ordered} received
                      </span>
                    </span>
                    <label className="flex items-center gap-2 text-xs text-brand-500">
                      Arrived
                      <Input name={`received:${line.id}`} type="number" inputMode="numeric" min={0} defaultValue={remaining || ""} placeholder="0" className="w-20" />
                    </label>
                  </li>
                );
              })}
            </ul>
            <div className="flex flex-wrap items-end gap-4">
              <label className="space-y-1 text-xs font-medium text-brand-500">
                Put into
                <Select name="location_id" defaultValue={po.destination_location_id} className="w-auto">
                  {(locations ?? []).map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="flex items-center gap-2 pb-2 text-sm text-brand-700">
                <input type="checkbox" name="update_costs" defaultChecked className="size-4 accent-[#2f6b47]" />
                Update each item&apos;s unit cost to this PO&apos;s price
              </label>
            </div>
            <SubmitButton>Receive</SubmitButton>
          </ActionForm>
        </Card>
      )}

      <Card>
        <CardHeader title="Items" />
        <Table>
          <thead>
            <tr>
              <th>Item</th>
              <th className="text-right">Ordered</th>
              <th className="text-right">Received</th>
              <th className="text-right">Unit cost</th>
              <th className="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.id}>
                <td>
                  <Link href={`/items/${line.item_variants.item_id}`} className="font-medium text-brand-800 hover:underline">
                    {line.item_variants.items.name}
                  </Link>
                  {line.item_variants.sizes && <span className="text-brand-500"> · {line.item_variants.sizes.label}</span>}
                </td>
                <td className="text-right tabular-nums">{line.quantity_ordered}</td>
                <td className={`text-right tabular-nums ${line.quantity_received < line.quantity_ordered ? "text-amber-800" : ""}`}>{line.quantity_received}</td>
                <td className="text-right tabular-nums">{formatMoney(line.unit_cost)}</td>
                <td className="text-right tabular-nums">{formatMoney(line.quantity_ordered * Number(line.unit_cost ?? 0))}</td>
              </tr>
            ))}
            <tr className="font-semibold">
              <td colSpan={4}>Total</td>
              <td className="text-right tabular-nums">{formatMoney(total)}</td>
            </tr>
          </tbody>
        </Table>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader title="Supplier" />
          <dl className="space-y-1 p-4 text-sm text-brand-700">
            <p className="font-medium text-brand-800">{supplier.name}</p>
            {supplier.contact_name && <p>{supplier.contact_name}</p>}
            {supplier.email && (
              <p>
                <a href={`mailto:${supplier.email}`} className="underline">
                  {supplier.email}
                </a>
              </p>
            )}
            {supplier.phone && <p>{supplier.phone}</p>}
            {supplier.website && (
              <p>
                <a href={supplier.website.startsWith("http") ? supplier.website : `https://${supplier.website}`} target="_blank" rel="noreferrer" className="underline">
                  {supplier.website}
                </a>
              </p>
            )}
          </dl>
        </Card>
        {po.notes && (
          <Card>
            <CardHeader title="Notes" />
            <p className="whitespace-pre-wrap p-4 text-sm text-brand-700">{po.notes}</p>
          </Card>
        )}
      </div>
    </div>
  );
}
