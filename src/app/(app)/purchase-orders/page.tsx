import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Card, EmptyState, LinkButton, PageHeader, Table } from "@/components/ui";
import { getCurrentProfile, isAdmin } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { AdminOnly } from "./admin-only";
import { PO_STATUS, type PoStatus } from "./status";

export const metadata: Metadata = { title: "Purchase orders" };

const FILTERS: Record<string, PoStatus[] | null> = {
  open: ["draft", "ordered", "partially_received"],
  all: null,
  received: ["received"],
  cancelled: ["cancelled"],
};

export default async function PurchaseOrdersPage({ searchParams }: PageProps<"/purchase-orders">) {
  const profile = await getCurrentProfile();
  if (!isAdmin(profile.role)) return <AdminOnly title="Purchase orders" />;
  const params = await searchParams;
  const filter = typeof params.status === "string" && params.status in FILTERS ? params.status : "open";

  const supabase = await createClient();
  let query = supabase
    .from("purchase_orders")
    .select("id, number, status, expected_date, created_at, suppliers(name), locations(name), purchase_order_lines(quantity_ordered, quantity_received, unit_cost)")
    .order("created_at", { ascending: false })
    .limit(200);
  const statuses = FILTERS[filter];
  if (statuses) query = query.in("status", statuses);
  const { data: orders, error } = await query;
  if (error) throw error;

  return (
    <div>
      <PageHeader
        title="Purchase orders"
        actions={
          <>
            <LinkButton href="/purchase-orders/suppliers" variant="secondary">
              Suppliers
            </LinkButton>
            <LinkButton href="/purchase-orders/new">New PO</LinkButton>
          </>
        }
      />
      <nav className="mb-4 flex flex-wrap gap-1 rounded-lg bg-cream-200 p-1 sm:inline-flex">
        {Object.keys(FILTERS).map((key) => (
          <Link
            key={key}
            href={key === "open" ? "/purchase-orders" : `/purchase-orders?status=${key}`}
            className={`rounded-md px-4 py-1.5 text-sm font-medium capitalize ${filter === key ? "bg-cream-50 text-brand-700 shadow-sm" : "text-brand-600"}`}
          >
            {key}
          </Link>
        ))}
      </nav>
      <Card>
        {orders.length === 0 ? (
          <EmptyState>No purchase orders here yet.</EmptyState>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>PO</th>
                <th>Supplier</th>
                <th>Status</th>
                <th className="hidden sm:table-cell">Expected</th>
                <th className="hidden md:table-cell">Deliver to</th>
                <th className="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((po) => {
                const total = po.purchase_order_lines.reduce((n, l) => n + l.quantity_ordered * Number(l.unit_cost ?? 0), 0);
                const received = po.purchase_order_lines.reduce((n, l) => n + l.quantity_received, 0);
                const ordered = po.purchase_order_lines.reduce((n, l) => n + l.quantity_ordered, 0);
                return (
                  <tr key={po.id}>
                    <td>
                      <Link href={`/purchase-orders/${po.id}`} className="font-medium text-brand-800 hover:underline">
                        #{po.number}
                      </Link>
                      <span className="block text-xs text-brand-400">{formatDate(po.created_at)}</span>
                    </td>
                    <td>{po.suppliers.name}</td>
                    <td>
                      <Badge tone={PO_STATUS[po.status].tone}>{PO_STATUS[po.status].label}</Badge>
                      {po.status === "partially_received" && <span className="block text-xs text-brand-400">{received} of {ordered}</span>}
                    </td>
                    <td className="hidden sm:table-cell">{po.expected_date ? formatDate(`${po.expected_date}T12:00:00`) : "—"}</td>
                    <td className="hidden md:table-cell">{po.locations.name}</td>
                    <td className="text-right tabular-nums">{formatMoney(total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
