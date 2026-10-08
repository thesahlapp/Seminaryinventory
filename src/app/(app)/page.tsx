import type { Metadata } from "next";
import Link from "next/link";
import { AlertIcon, MoveIcon, PlusIcon, ScanIcon } from "@/components/icons";
import { QuantityChange } from "@/components/quantity-change";
import { Badge, Card, CardHeader, EmptyState } from "@/components/ui";
import { canEdit, getCurrentProfile, isAdmin } from "@/lib/auth";
import { formatDate, formatDateTime, REASON_LABELS, todayInDallas } from "@/lib/format";
import { formatMoneyCompact } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Dashboard" };

type Summary = {
  items: number;
  units: number;
  checked_out_units: number;
  open_checkouts: number;
  overdue_checkouts: number;
  low_stock: number;
};

export default async function DashboardPage() {
  const profile = await getCurrentProfile();
  const admin = isAdmin(profile.role);
  const editor = canEdit(profile.role);
  const supabase = await createClient();

  const [summary, value, lowStock, checkouts, activity] = await Promise.all([
    supabase.rpc("dashboard_summary"),
    admin ? supabase.rpc("inventory_value") : null,
    supabase.from("low_stock").select("item_id, item_name, size_label, on_hand, min_quantity").order("shortfall", { ascending: false }).limit(8),
    supabase
      .from("checkouts")
      .select("id, number, borrower_name, project, due_date, checkout_lines(quantity, returned_good, returned_damaged, missing)")
      .is("closed_at", null)
      .order("due_date")
      .limit(8),
    supabase
      .from("stock_movements")
      .select("id, changed_at, old_quantity, new_quantity, reason, changed_by_email, profiles(full_name), locations(name), item_variants(item_id, items(name), sizes(label))")
      .order("changed_at", { ascending: false })
      .limit(20),
  ]);

  const s = (summary.data ?? {}) as Summary;
  const totalValue = value?.data ? Number((value.data as { total_cost: number }).total_cost) : null;
  const today = todayInDallas();

  const tiles = [
    { label: "Items", value: Number(s.items ?? 0).toLocaleString(), href: "/items" },
    { label: "Units on hand", value: Number(s.units ?? 0).toLocaleString(), href: "/items" },
    { label: "Checked out", value: Number(s.checked_out_units ?? 0).toLocaleString(), href: "/checkouts" },
    ...(admin && totalValue !== null ? [{ label: "Total value", value: formatMoneyCompact(totalValue), href: "/reports" }] : []),
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-brand-700">
          Salaam{profile.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}
        </h1>
        <p className="text-sm text-brand-500">{formatDate(new Date().toISOString())}</p>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-3 gap-2 sm:max-w-lg">
        <QuickLink href="/scan" label="Scan" icon={<ScanIcon className="size-6" />} primary />
        {editor && <QuickLink href="/items/new" label="Add item" icon={<PlusIcon className="size-6" />} />}
        {editor && <QuickLink href="/locations/move" label="Move stock" icon={<MoveIcon className="size-6" />} />}
      </div>

      {/* Totals */}
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((tile) => (
          <Link key={tile.label} href={tile.href} className="rounded-xl border border-cream-300 bg-cream-50 p-4 shadow-sm transition hover:border-brand-300">
            <dt className="text-xs font-medium uppercase tracking-wide text-brand-500">{tile.label}</dt>
            <dd className="mt-1 font-display text-2xl font-semibold tabular-nums text-brand-700 sm:text-3xl">{tile.value}</dd>
          </Link>
        ))}
      </dl>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Low stock */}
        <Card>
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                Low stock {Number(s.low_stock) > 0 && <Badge tone="danger">{s.low_stock}</Badge>}
              </span>
            }
            actions={
              <div className="flex items-center gap-3 text-sm">
                {admin && Number(s.low_stock) > 0 && (
                  <Link href="/purchase-orders/new?from=low-stock" className="font-medium text-brand-600 hover:underline">
                    Create PO
                  </Link>
                )}
                <Link href="/items?low=1" className="text-brand-500 hover:underline">
                  View all
                </Link>
              </div>
            }
          />
          {!lowStock.data?.length ? (
            <EmptyState>Nothing is below its minimum. Set minimums on an item&apos;s edit page.</EmptyState>
          ) : (
            <ul className="divide-y divide-cream-200">
              {lowStock.data.map((row) => (
                <li key={`${row.item_id}-${row.size_label}`}>
                  <Link href={`/items/${row.item_id}`} className="flex items-center justify-between gap-3 px-5 py-2.5 hover:bg-cream-100">
                    <span className="min-w-0 truncate text-sm font-medium text-brand-800">
                      {row.item_name}
                      {row.size_label && <span className="font-normal text-brand-500"> · {row.size_label}</span>}
                    </span>
                    <span className="shrink-0 text-sm tabular-nums">
                      <span className="font-semibold text-red-700">{row.on_hand}</span>
                      <span className="text-brand-400"> / min {row.min_quantity}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Checked out */}
        <Card>
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                Checked out {Number(s.overdue_checkouts) > 0 && <Badge tone="danger">{s.overdue_checkouts} overdue</Badge>}
              </span>
            }
            actions={
              <Link href="/checkouts" className="text-sm text-brand-500 hover:underline">
                View all
              </Link>
            }
          />
          {!checkouts.data?.length ? (
            <EmptyState>Nothing is checked out right now.</EmptyState>
          ) : (
            <ul className="divide-y divide-cream-200">
              {checkouts.data.map((c) => {
                const overdue = c.due_date < today;
                const units = c.checkout_lines.reduce((n, l) => n + l.quantity - l.returned_good - l.returned_damaged - l.missing, 0);
                return (
                  <li key={c.id}>
                    <Link href={`/checkouts/${c.id}`} className="flex items-center justify-between gap-3 px-5 py-2.5 hover:bg-cream-100">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-brand-800">
                          {c.borrower_name}
                          {c.project && <span className="font-normal text-brand-500"> · {c.project}</span>}
                        </span>
                        <span className="text-xs text-brand-400">
                          #{c.number} · {units} unit{units === 1 ? "" : "s"}
                        </span>
                      </span>
                      <span className={`shrink-0 text-xs font-medium ${overdue ? "text-red-700" : "text-brand-500"}`}>
                        {overdue && <AlertIcon className="mr-1 inline size-3.5 align-[-2px]" />}
                        {overdue ? "Overdue · " : "Due "}
                        {formatDate(`${c.due_date}T12:00:00`)}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      {/* Recent activity */}
      <Card>
        <CardHeader
          title="Recent activity"
          actions={
            <Link href="/history" className="text-sm text-brand-500 hover:underline">
              Full history
            </Link>
          }
        />
        {!activity.data?.length ? (
          <EmptyState>No stock changes yet.</EmptyState>
        ) : (
          <ul className="divide-y divide-cream-200">
            {activity.data.map((m) => (
              <li key={m.id} className="flex items-start justify-between gap-3 px-5 py-2.5 text-sm">
                <div className="min-w-0">
                  <Link href={`/items/${m.item_variants.item_id}`} className="font-medium text-brand-800 hover:underline">
                    {m.item_variants.items.name}
                  </Link>
                  {m.item_variants.sizes && <span className="text-brand-500"> · {m.item_variants.sizes.label}</span>}
                  <p className="text-xs text-brand-400">
                    {REASON_LABELS[m.reason]} at {m.locations.name} · {m.profiles?.full_name ?? m.changed_by_email ?? "—"} ·{" "}
                    {formatDateTime(m.changed_at)}
                  </p>
                </div>
                <span className="shrink-0">
                  <QuantityChange from={m.old_quantity} to={m.new_quantity} compact />
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function QuickLink({ href, label, icon, primary }: { href: string; label: string; icon: React.ReactNode; primary?: boolean }) {
  return (
    <Link
      href={href}
      className={`flex flex-col items-center justify-center gap-1 rounded-xl py-3 text-sm font-semibold shadow-sm transition ${
        primary ? "bg-brand text-cream hover:opacity-90" : "border border-cream-300 bg-cream-50 text-brand-700 hover:border-brand-300"
      }`}
    >
      {icon}
      {label}
    </Link>
  );
}
