import type { Metadata } from "next";
import Link from "next/link";
import { BarList } from "@/components/charts/bar-list";
import { CsvButton } from "@/components/charts/csv-button";
import { LineChart } from "@/components/charts/line-chart";
import { Card, CardHeader, PageHeader, Table } from "@/components/ui";
import { getCurrentProfile, isAdmin } from "@/lib/auth";
import { formatDate, todayInDallas } from "@/lib/format";
import { formatMoney, formatMoneyCompact } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Reports" };

const PRESETS = [
  { key: "30d", label: "Last 30 days", days: 30 },
  { key: "90d", label: "Last 90 days", days: 90 },
  { key: "12m", label: "Last 12 months", days: 365 },
] as const;
const GROUPS = { category: "Category", location: "Location", item: "Item" } as const;
const SERIES_COLORS = ["var(--color-chart-1)", "var(--color-chart-2)", "var(--color-chart-3)"];
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function shift(date: string, days: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
const short = (date: string) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));

type Usage = { bucket: string; group_id: string | null; group_name: string; units_out: number; units_in: number };
type Mover = { item_id: string; item_name: string; category_name: string | null; units_out: number; movements: number; on_hand: number };
type Loss = { item_id: string; item_name: string; size_label: string | null; kind: string; units: number; value: number };
type CheckoutReport = {
  most_borrowed: { item_id: string; name: string; times: number; units: number }[];
  overdue: { id: string; number: number; borrower_name: string; project: string | null; due_date: string; closed_at: string | null; still_out: boolean; days_late: number }[];
  totals: { checkouts: number; returned_late: number; still_overdue: number };
};

const LOSS_KINDS: Record<string, string> = {
  damaged: "Damaged",
  lost: "Lost / missing",
  correction_loss: "Count corrections (short)",
  correction_gain: "Count corrections (found)",
};

export default async function ReportsPage({ searchParams }: PageProps<"/reports">) {
  const profile = await getCurrentProfile();
  if (!isAdmin(profile.role)) return <PageHeader title="Reports" description="Reports include costs, so only admins can see them." />;

  const params = await searchParams;
  const today = todayInDallas();
  const preset = PRESETS.find((p) => p.key === params.range) ?? (params.from ? null : PRESETS[0]);
  const to = !preset && typeof params.to === "string" && DATE.test(params.to) ? params.to : today;
  const from = preset ? shift(today, -(preset.days - 1)) : typeof params.from === "string" && DATE.test(params.from) ? params.from : shift(today, -29);
  const group = (typeof params.group === "string" && params.group in GROUPS ? params.group : "category") as keyof typeof GROUPS;
  const days = Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1;
  const bucket = days <= 45 ? "day" : days <= 200 ? "week" : "month";

  const supabase = await createClient();
  const [usageRes, moversRes, lossesRes, valueRes, checkoutsRes, nowValue] = await Promise.all([
    supabase.rpc("report_usage", { p_from: from, p_to: to, p_group: group, p_bucket: bucket }),
    supabase.rpc("report_movers", { p_from: from, p_to: to }),
    supabase.rpc("report_losses", { p_from: from, p_to: to }),
    supabase.rpc("report_value_over_time", { p_from: days > 731 ? shift(to, -730) : from, p_to: to }),
    supabase.rpc("report_checkouts", { p_from: from, p_to: to }),
    supabase.rpc("inventory_value"),
  ]);
  const usage = (usageRes.data ?? []) as Usage[];
  const movers = (moversRes.data ?? []) as Mover[];
  const losses = (lossesRes.data ?? []) as Loss[];
  const valueSeries = (valueRes.data ?? []) as { day: string; units: number; value: number }[];
  const checkouts = (checkoutsRes.data ?? { most_borrowed: [], overdue: [], totals: { checkouts: 0, returned_late: 0, still_overdue: 0 } }) as CheckoutReport;
  const value = nowValue.data as { total_cost: number; total_retail: number; checked_out_cost: number; items_without_cost: number; by_category: { name: string; units: number; cost_value: number }[] } | null;
  const error = usageRes.error ?? moversRes.error ?? lossesRes.error ?? valueRes.error ?? checkoutsRes.error;

  // Usage: every bucket in range; top 3 groups by units out, the rest as "Other".
  const buckets: string[] = [];
  for (let d = from; d <= to; d = shift(d, 1)) {
    const key =
      bucket === "day" ? d : bucket === "week" ? startOfWeek(d) : `${d.slice(0, 7)}-01`;
    if (!buckets.includes(key)) buckets.push(key);
  }
  const totalsByGroup = new Map<string, { name: string; out: number; in: number }>();
  for (const row of usage) {
    const key = row.group_id ?? "none";
    const t = totalsByGroup.get(key) ?? { name: row.group_name, out: 0, in: 0 };
    t.out += Number(row.units_out);
    t.in += Number(row.units_in);
    totalsByGroup.set(key, t);
  }
  const rankedGroups = [...totalsByGroup.entries()].sort((a, b) => b[1].out - a[1].out);
  const top = rankedGroups.slice(0, 3).filter(([, t]) => t.out > 0);
  const usageSeries = [
    ...top.map(([key, t], i) => ({
      name: t.name,
      color: SERIES_COLORS[i],
      values: buckets.map((b) => usage.filter((u) => (u.group_id ?? "none") === key && u.bucket === b).reduce((n, u) => n + Number(u.units_out), 0)),
    })),
    ...(rankedGroups.length > top.length && rankedGroups.slice(top.length).some(([, t]) => t.out > 0)
      ? [
          {
            name: "Other",
            color: "var(--color-chart-other)",
            values: buckets.map((b) =>
              usage
                .filter((u) => !top.some(([key]) => key === (u.group_id ?? "none")) && u.bucket === b)
                .reduce((n, u) => n + Number(u.units_out), 0),
            ),
          },
        ]
      : []),
  ];
  const totalOut = usage.reduce((n, u) => n + Number(u.units_out), 0);
  const totalIn = usage.reduce((n, u) => n + Number(u.units_in), 0);

  const fastest = [...movers].filter((m) => Number(m.units_out) > 0).sort((a, b) => Number(b.units_out) - Number(a.units_out));
  const slowest = [...movers].filter((m) => Number(m.on_hand) > 0).sort((a, b) => Number(a.units_out) - Number(b.units_out) || Number(b.on_hand) - Number(a.on_hand));

  const lossTotals = Object.keys(LOSS_KINDS).map((kind) => ({
    kind,
    units: losses.filter((l) => l.kind === kind).reduce((n, l) => n + Number(l.units), 0),
    value: losses.filter((l) => l.kind === kind).reduce((n, l) => n + Number(l.value), 0),
  }));
  const shrinkValue = lossTotals.filter((l) => l.kind !== "correction_gain").reduce((n, l) => n + l.value, 0);

  const presetHref = (key: string) => `/reports?range=${key}&group=${group}`;
  const fileSuffix = `${from}-to-${to}`;

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" description={`${formatDate(`${from}T12:00:00`)} – ${formatDate(`${to}T12:00:00`)} · Dallas time`} />

      {/* Filters: one row, scoping everything below */}
      <form className="flex flex-wrap items-end gap-2" action="/reports">
        <div className="flex flex-wrap gap-1 rounded-lg bg-cream-200 p-1">
          {PRESETS.map((p) => (
            <Link
              key={p.key}
              href={presetHref(p.key)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${preset?.key === p.key ? "bg-cream-50 text-brand-700 shadow-sm" : "text-brand-600"}`}
            >
              {p.label}
            </Link>
          ))}
        </div>
        <label className="flex flex-col text-xs text-brand-500">
          From
          <input type="date" name="from" defaultValue={from} max={today} className="rounded-md border border-cream-400 bg-cream-50 px-2 py-1.5 text-sm text-ink" />
        </label>
        <label className="flex flex-col text-xs text-brand-500">
          To
          <input type="date" name="to" defaultValue={to} max={today} className="rounded-md border border-cream-400 bg-cream-50 px-2 py-1.5 text-sm text-ink" />
        </label>
        <label className="flex flex-col text-xs text-brand-500">
          Usage by
          <select name="group" defaultValue={group} className="rounded-md border border-cream-400 bg-cream-50 px-2 py-1.5 text-sm text-ink">
            {Object.entries(GROUPS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-cream">
          Apply
        </button>
      </form>

      {error && <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">Couldn&apos;t load a report: {error.message}</p>}

      {/* Headline figures */}
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Inventory value (at cost)" value={formatMoneyCompact(value?.total_cost ?? 0)} sub={value?.items_without_cost ? `${value.items_without_cost} items have no cost` : undefined} />
        <Tile label="Units out" value={totalOut.toLocaleString()} sub="Issued and checked out" />
        <Tile label="Units in" value={totalIn.toLocaleString()} sub="Received, returned, checked in" />
        <Tile label="Shrinkage" value={formatMoneyCompact(shrinkValue)} sub="Damaged, lost and short counts" />
      </dl>

      {/* Usage */}
      <Card>
        <CardHeader
          title={`Usage over time by ${GROUPS[group].toLowerCase()}`}
          actions={
            <CsvButton
              filename={`usage-by-${group}-${fileSuffix}.csv`}
              header={[GROUPS[group], "Units out", "Units in"]}
              rows={rankedGroups.map(([, t]) => [t.name, t.out, t.in])}
            />
          }
        />
        <div className="space-y-4 p-4">
          <p className="text-xs text-brand-500">Units issued or checked out per {bucket}. Top three shown; the rest are grouped as Other.</p>
          <LineChart
            ariaLabel={`Units out per ${bucket}`}
            labels={buckets.map((b) => (bucket === "month" ? new Intl.DateTimeFormat("en-US", { month: "short", year: "2-digit", timeZone: "UTC" }).format(new Date(`${b}T12:00:00Z`)) : short(b)))}
            series={usageSeries.length ? usageSeries : [{ name: "Units out", color: "var(--color-chart-single)", values: buckets.map(() => 0) }]}
          />
          <Table>
            <thead>
              <tr>
                <th>{GROUPS[group]}</th>
                <th className="text-right">Units out</th>
                <th className="text-right">Units in</th>
              </tr>
            </thead>
            <tbody>
              {rankedGroups.slice(0, 15).map(([key, t]) => (
                <tr key={key}>
                  <td>{group === "item" && key !== "none" ? <Link href={`/items/${key}`} className="hover:underline">{t.name}</Link> : t.name}</td>
                  <td className="text-right tabular-nums">{t.out.toLocaleString()}</td>
                  <td className="text-right tabular-nums">{t.in.toLocaleString()}</td>
                </tr>
              ))}
              {rankedGroups.length === 0 && (
                <tr>
                  <td colSpan={3} className="text-center text-brand-400">
                    No stock movement in this period.
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
        </div>
      </Card>

      {/* Movers */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Fastest moving"
            actions={
              <CsvButton
                filename={`movers-${fileSuffix}.csv`}
                header={["Item", "Category", "Units out", "Changes", "On hand"]}
                rows={movers.map((m) => [m.item_name, m.category_name, Number(m.units_out), Number(m.movements), Number(m.on_hand)])}
              />
            }
          />
          <div className="p-4">
            <BarList rows={fastest.slice(0, 10).map((m) => ({ label: m.item_name, value: Number(m.units_out), href: `/items/${m.item_id}` }))} empty="Nothing went out in this period." />
          </div>
        </Card>
        <Card>
          <CardHeader title="Slowest moving (in stock)" />
          <Table>
            <thead>
              <tr>
                <th>Item</th>
                <th className="text-right">Units out</th>
                <th className="text-right">On hand</th>
              </tr>
            </thead>
            <tbody>
              {slowest.slice(0, 10).map((m) => (
                <tr key={m.item_id}>
                  <td>
                    <Link href={`/items/${m.item_id}`} className="hover:underline">
                      {m.item_name}
                    </Link>
                  </td>
                  <td className="text-right tabular-nums">{Number(m.units_out).toLocaleString()}</td>
                  <td className="text-right tabular-nums">{Number(m.on_hand).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      </div>

      {/* Losses */}
      <Card>
        <CardHeader
          title="Losses and corrections"
          actions={
            <CsvButton
              filename={`losses-${fileSuffix}.csv`}
              header={["Item", "Size", "Type", "Units", "Value"]}
              rows={losses.map((l) => [l.item_name, l.size_label, LOSS_KINDS[l.kind] ?? l.kind, Number(l.units), Number(l.value)])}
            />
          }
        />
        <div className="space-y-4 p-4">
          <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {lossTotals.map((l) => (
              <Tile key={l.kind} label={LOSS_KINDS[l.kind]} value={`${l.units.toLocaleString()} units`} sub={formatMoney(l.value)} />
            ))}
          </dl>
          <Table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Type</th>
                <th className="text-right">Units</th>
                <th className="text-right">Value</th>
              </tr>
            </thead>
            <tbody>
              {losses.slice(0, 20).map((l, i) => (
                <tr key={i}>
                  <td>
                    <Link href={`/items/${l.item_id}`} className="hover:underline">
                      {l.item_name}
                    </Link>
                    {l.size_label && <span className="text-brand-500"> · {l.size_label}</span>}
                  </td>
                  <td>{LOSS_KINDS[l.kind] ?? l.kind}</td>
                  <td className="text-right tabular-nums">{Number(l.units).toLocaleString()}</td>
                  <td className="text-right tabular-nums">{formatMoney(l.value)}</td>
                </tr>
              ))}
              {losses.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center text-brand-400">
                    No losses or corrections in this period.
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
        </div>
      </Card>

      {/* Value over time */}
      <Card>
        <CardHeader
          title="Inventory value over time"
          actions={
            <CsvButton
              filename={`value-${fileSuffix}.csv`}
              header={["Date", "Units on hand", "Value at cost"]}
              rows={valueSeries.map((v) => [v.day, Number(v.units), Number(v.value)])}
            />
          }
        />
        <div className="space-y-4 p-4">
          <p className="text-xs text-brand-500">Stock on hand at the end of each day, valued at today&apos;s unit costs. Items without a cost count as $0.</p>
          <LineChart
            ariaLabel="Inventory value per day"
            labels={valueSeries.map((v) => short(v.day))}
            series={[{ name: "Value", color: "var(--color-chart-single)", values: valueSeries.map((v) => Number(v.value)) }]}
            valueFormat="money"
            area
          />
          {value && value.by_category.length > 0 && (
            <Table>
              <thead>
                <tr>
                  <th>Category (today)</th>
                  <th className="text-right">Units</th>
                  <th className="text-right">Value</th>
                </tr>
              </thead>
              <tbody>
                {value.by_category.map((c) => (
                  <tr key={c.name}>
                    <td>{c.name}</td>
                    <td className="text-right tabular-nums">{Number(c.units).toLocaleString()}</td>
                    <td className="text-right tabular-nums">{formatMoney(c.cost_value)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>
      </Card>

      {/* Check-outs */}
      <Card>
        <CardHeader
          title="Check-outs"
          actions={
            <CsvButton
              filename={`overdue-${fileSuffix}.csv`}
              header={["Check-out", "Borrower", "Project", "Due", "Returned", "Days late"]}
              rows={checkouts.overdue.map((o) => [o.number, o.borrower_name, o.project, o.due_date, o.closed_at?.slice(0, 10) ?? "still out", o.days_late])}
            />
          }
        />
        <div className="space-y-4 p-4">
          <dl className="grid grid-cols-3 gap-3">
            <Tile label="Check-outs" value={checkouts.totals.checkouts.toLocaleString()} />
            <Tile label="Returned late" value={checkouts.totals.returned_late.toLocaleString()} />
            <Tile label="Still overdue" value={checkouts.totals.still_overdue.toLocaleString()} />
          </dl>
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <p className="mb-2 text-sm font-medium text-brand-700">Most borrowed (times checked out)</p>
              <BarList
                rows={checkouts.most_borrowed.slice(0, 10).map((b) => ({ label: b.name, value: Number(b.times), href: `/items/${b.item_id}`, detail: `${b.units} units` }))}
                empty="Nothing was checked out in this period."
              />
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-brand-700">Overdue history</p>
              {checkouts.overdue.length === 0 ? (
                <p className="text-sm text-brand-400">Nothing came back late. </p>
              ) : (
                <ul className="divide-y divide-cream-200 text-sm">
                  {checkouts.overdue.slice(0, 10).map((o) => (
                    <li key={o.id} className="flex justify-between gap-2 py-2">
                      <Link href={`/checkouts/${o.id}`} className="hover:underline">
                        #{o.number} {o.borrower_name}
                        {o.project && <span className="text-brand-500"> · {o.project}</span>}
                      </Link>
                      <span className={o.still_out ? "font-medium text-red-700" : "text-brand-500"}>
                        {o.days_late} day{o.days_late === 1 ? "" : "s"} late{o.still_out ? " · still out" : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

function startOfWeek(date: string) {
  // Postgres date_trunc('week') starts weeks on Monday.
  const d = new Date(`${date}T12:00:00Z`);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-cream-300 bg-cream-50 px-4 py-3">
      <dt className="text-xs font-medium text-brand-500">{label}</dt>
      <dd className="mt-0.5 font-display text-xl font-semibold tabular-nums text-brand-700">{value}</dd>
      {sub && <dd className="text-xs text-brand-400">{sub}</dd>}
    </div>
  );
}
