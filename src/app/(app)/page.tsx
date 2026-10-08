import type { Metadata } from "next";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <h1 className="font-display text-2xl font-semibold text-brand">Dashboard</h1>
      <Suspense fallback={<StatsSkeleton />}>
        <Stats />
      </Suspense>
    </div>
  );
}

async function Stats() {
  const supabase = await createClient();

  const [items, categories, locations, sizes] = await Promise.all([
    supabase.from("items").select("*", { count: "exact", head: true }).is("archived_at", null),
    supabase.from("categories").select("*", { count: "exact", head: true }).is("archived_at", null),
    supabase.from("locations").select("*", { count: "exact", head: true }).is("archived_at", null),
    supabase.from("sizes").select("*", { count: "exact", head: true }).is("archived_at", null),
  ]);

  const error = items.error ?? categories.error ?? locations.error ?? sizes.error;
  if (error) {
    return (
      <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        Could not load data from Supabase: {error.message}. Check that the migrations have been
        run.
      </p>
    );
  }

  const stats = [
    { label: "Items", value: items.count ?? 0 },
    { label: "Categories", value: categories.count ?? 0 },
    { label: "Locations", value: locations.count ?? 0 },
    { label: "Sizes", value: sizes.count ?? 0 },
  ];

  return (
    <dl className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {stats.map((stat) => (
        <div key={stat.label} className="rounded-xl border border-cream-300 bg-cream-50 p-5 shadow-sm">
          <dt className="text-sm text-brand-500">{stat.label}</dt>
          <dd className="mt-1 font-display text-3xl font-semibold text-brand tabular-nums">
            {stat.value.toLocaleString()}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="h-24 animate-pulse rounded-xl border border-cream-300 bg-cream-100" />
      ))}
    </div>
  );
}
