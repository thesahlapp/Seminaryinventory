import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardHeader, EmptyState, LinkButton, PageHeader, Table } from "@/components/ui";
import { QuantityChange } from "@/components/quantity-change";
import { canEdit, getCurrentProfile } from "@/lib/auth";
import { formatDateTime, REASON_LABELS } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const supabase = await createClient();
  const profile = await getCurrentProfile();

  const [items, categories, locations, recent] = await Promise.all([
    supabase.from("items").select("*", { count: "exact", head: true }).is("archived_at", null),
    supabase.from("categories").select("*", { count: "exact", head: true }).is("archived_at", null),
    supabase.from("locations").select("*", { count: "exact", head: true }).is("archived_at", null),
    supabase
      .from("stock_movements")
      .select(
        "id, changed_at, old_quantity, new_quantity, reason, changed_by_email, profiles(full_name), locations(name), item_variants(item_id, items(name), sizes(label))",
      )
      .order("changed_at", { ascending: false })
      .limit(10),
  ]);

  const error = items.error ?? categories.error ?? locations.error ?? recent.error;
  if (error) {
    return (
      <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        Could not load data from Supabase: {error.message}. Check that the migrations have been run.
      </p>
    );
  }

  const stats = [
    { label: "Items", value: items.count ?? 0, href: "/items" },
    { label: "Categories", value: categories.count ?? 0, href: "/settings/categories" },
    { label: "Locations", value: locations.count ?? 0, href: "/settings/locations" },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Salaam${profile.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}`}
        actions={
          canEdit(profile.role) && (
            <>
              <LinkButton href="/items" variant="secondary">
                Browse items
              </LinkButton>
              <LinkButton href="/items/new">Add item</LinkButton>
            </>
          )
        }
      />

      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="rounded-xl border border-cream-300 bg-cream-50 p-5 shadow-sm transition hover:border-brand-300"
          >
            <dt className="text-sm text-brand-500">{stat.label}</dt>
            <dd className="mt-1 font-display text-3xl font-semibold tabular-nums text-brand">
              {stat.value.toLocaleString()}
            </dd>
          </Link>
        ))}
      </dl>

      <Card>
        <CardHeader
          title="Recent stock changes"
          actions={
            <Link href="/history" className="text-sm text-brand-500 hover:underline">
              View all
            </Link>
          }
        />
        {!recent.data?.length ? (
          <EmptyState>No stock changes yet. Add an item and record its stock to get started.</EmptyState>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>When</th>
                <th>Item</th>
                <th>Location</th>
                <th className="text-right">Change</th>
                <th>Reason</th>
                <th>By</th>
              </tr>
            </thead>
            <tbody>
              {recent.data.map((m) => (
                <tr key={m.id}>
                  <td className="whitespace-nowrap text-brand-500">{formatDateTime(m.changed_at)}</td>
                  <td>
                    <Link href={`/items/${m.item_variants.item_id}`} className="font-medium hover:underline">
                      {m.item_variants.items.name}
                    </Link>
                    {m.item_variants.sizes && (
                      <span className="text-brand-500"> · {m.item_variants.sizes.label}</span>
                    )}
                  </td>
                  <td>{m.locations.name}</td>
                  <td className="text-right">
                    <QuantityChange from={m.old_quantity} to={m.new_quantity} compact />
                  </td>
                  <td>{REASON_LABELS[m.reason]}</td>
                  <td className="text-brand-500">{m.profiles?.full_name ?? m.changed_by_email ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
