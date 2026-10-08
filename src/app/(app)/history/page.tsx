import type { Metadata } from "next";
import Link from "next/link";
import { Button, Card, EmptyState, Input, LinkButton, PageHeader, Select, Table } from "@/components/ui";
import { formatDateTime, REASON_LABELS, type StockReason } from "@/lib/format";
import { QuantityChange } from "@/components/quantity-change";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "History" };

const PAGE_SIZE = 50;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export default async function HistoryPage({ searchParams }: PageProps<"/history">) {
  const params = await searchParams;
  const str = (key: string) => (typeof params[key] === "string" ? (params[key] as string) : "");
  const itemId = str("item");
  const locationId = str("location");
  const reason = str("reason") in REASON_LABELS ? (str("reason") as StockReason) : "";
  const userId = str("user");
  const from = DATE.test(str("from")) ? str("from") : "";
  const to = DATE.test(str("to")) ? str("to") : "";
  const page = Math.max(1, Number(params.page) || 1);

  const supabase = await createClient();

  let query = supabase
    .from("stock_movements")
    .select(
      "id, changed_at, old_quantity, new_quantity, reason, reason_note, changed_by_email, profiles(full_name), locations(name), item_variants!inner(item_id, items(name), sizes(label))",
      { count: "exact" },
    )
    .order("changed_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (itemId) query = query.eq("item_variants.item_id", itemId);
  if (locationId) query = query.eq("location_id", locationId);
  if (reason) query = query.eq("reason", reason);
  if (userId) query = query.eq("changed_by", userId);
  // Dates are interpreted in Dallas time (Central).
  if (from) query = query.gte("changed_at", `${from}T00:00:00-06:00`);
  if (to) query = query.lte("changed_at", `${to}T23:59:59.999-06:00`);

  const [movements, locations, people, item] = await Promise.all([
    query,
    supabase.from("locations").select("id, name").order("sort_order").order("name"),
    supabase.from("profiles").select("id, full_name, email").order("full_name"),
    itemId ? supabase.from("items").select("id, name").eq("id", itemId).maybeSingle() : null,
  ]);
  if (movements.error) throw movements.error;
  if (locations.error) throw locations.error;
  if (people.error) throw people.error;

  const total = movements.count ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtered = Boolean(itemId || locationId || reason || userId || from || to);
  const pageHref = (n: number) => {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries({ item: itemId, location: locationId, reason, user: userId, from, to })) {
      if (value) next.set(key, value);
    }
    if (n > 1) next.set("page", String(n));
    return `/history${next.size ? `?${next}` : ""}`;
  };

  return (
    <div>
      <PageHeader
        title="History"
        description={`Every stock change, newest first. ${total.toLocaleString()} change${total === 1 ? "" : "s"}${filtered ? " match" : ""}.`}
      />

      <form className="mb-4 flex flex-wrap items-end gap-2">
        {item?.data && (
          <div className="flex items-center gap-2 rounded-md border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-800">
            <input type="hidden" name="item" value={item.data.id} />
            Item: <strong>{item.data.name}</strong>
          </div>
        )}
        <Select name="location" defaultValue={locationId} aria-label="Location" className="w-auto">
          <option value="">All locations</option>
          {locations.data.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </Select>
        <Select name="reason" defaultValue={reason} aria-label="Reason" className="w-auto">
          <option value="">All reasons</option>
          {Object.entries(REASON_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Select name="user" defaultValue={userId} aria-label="Person" className="w-auto">
          <option value="">Everyone</option>
          {people.data.map((p) => (
            <option key={p.id} value={p.id}>
              {p.full_name ?? p.email}
            </option>
          ))}
        </Select>
        <label className="flex flex-col text-xs text-brand-500">
          From
          <Input type="date" name="from" defaultValue={from} className="w-auto" />
        </label>
        <label className="flex flex-col text-xs text-brand-500">
          To
          <Input type="date" name="to" defaultValue={to} className="w-auto" />
        </label>
        <Button type="submit" variant="secondary">
          Filter
        </Button>
        {filtered && (
          <Link href="/history" className="self-center text-sm text-brand-500 hover:underline">
            Clear
          </Link>
        )}
      </form>

      <Card>
        {movements.data.length === 0 ? (
          <EmptyState>{filtered ? "No changes match those filters." : "No stock changes recorded yet."}</EmptyState>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>When</th>
                <th>Item</th>
                <th>Location</th>
                <th className="text-right">Old → New</th>
                <th>Reason</th>
                <th>By</th>
              </tr>
            </thead>
            <tbody>
              {movements.data.map((m) => (
                <tr key={m.id}>
                  <td className="whitespace-nowrap text-brand-500">{formatDateTime(m.changed_at)}</td>
                  <td>
                    <Link href={`/items/${m.item_variants.item_id}`} className="font-medium hover:underline">
                      {m.item_variants.items.name}
                    </Link>
                    {m.item_variants.sizes && <span className="text-brand-500"> · {m.item_variants.sizes.label}</span>}
                  </td>
                  <td>{m.locations.name}</td>
                  <td className="text-right">
                        <QuantityChange from={m.old_quantity} to={m.new_quantity} />
                      </td>
                  <td>
                    {REASON_LABELS[m.reason]}
                    {m.reason_note && <span className="block text-xs text-brand-400">{m.reason_note}</span>}
                  </td>
                  <td className="text-brand-500">{m.profiles?.full_name ?? m.changed_by_email ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      {pageCount > 1 && (
        <nav className="mt-4 flex items-center justify-between text-sm">
          {page > 1 ? (
            <LinkButton href={pageHref(page - 1)} variant="secondary" size="sm">
              ← Newer
            </LinkButton>
          ) : (
            <span />
          )}
          <span className="text-brand-500">
            Page {page} of {pageCount}
          </span>
          {page < pageCount ? (
            <LinkButton href={pageHref(page + 1)} variant="secondary" size="sm">
              Older →
            </LinkButton>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}
