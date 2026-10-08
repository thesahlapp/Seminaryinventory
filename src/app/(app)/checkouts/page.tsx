import type { Metadata } from "next";
import Link from "next/link";
import { AlertIcon } from "@/components/icons";
import { Badge, Card, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { canEdit, getCurrentProfile } from "@/lib/auth";
import { formatDate, todayInDallas } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Checked out" };

const VIEWS = { open: "Checked out", overdue: "Overdue", returned: "Returned" } as const;

export default async function CheckoutsPage({ searchParams }: PageProps<"/checkouts">) {
  const params = await searchParams;
  const view = (typeof params.view === "string" && params.view in VIEWS ? params.view : "open") as keyof typeof VIEWS;
  const profile = await getCurrentProfile();
  const supabase = await createClient();
  const today = todayInDallas();

  let query = supabase
    .from("checkouts")
    .select(
      "id, number, borrower_name, project, due_date, created_at, closed_at, kits(name), checkout_lines(quantity, returned_good, returned_damaged, missing, item_variants(items(name), sizes(label)))",
    )
    .limit(200);
  if (view === "returned") query = query.not("closed_at", "is", null).order("closed_at", { ascending: false });
  else query = query.is("closed_at", null).order("due_date");
  if (view === "overdue") query = query.lt("due_date", today);
  const { data: checkouts, error } = await query;
  if (error) throw error;

  return (
    <div>
      <PageHeader
        title="Checked out"
        description="Gear that's been borrowed or taken on jobs."
        actions={canEdit(profile.role) && <LinkButton href="/checkouts/new">Check out</LinkButton>}
      />
      <nav className="mb-4 flex gap-1 rounded-lg bg-cream-200 p-1 sm:inline-flex">
        {(Object.keys(VIEWS) as (keyof typeof VIEWS)[]).map((key) => (
          <Link
            key={key}
            href={key === "open" ? "/checkouts" : `/checkouts?view=${key}`}
            aria-current={view === key ? "page" : undefined}
            className={`flex-1 rounded-md px-4 py-1.5 text-center text-sm font-medium ${
              view === key ? "bg-cream-50 text-brand-700 shadow-sm" : "text-brand-600"
            }`}
          >
            {VIEWS[key]}
          </Link>
        ))}
      </nav>

      {checkouts.length === 0 ? (
        <Card>
          <EmptyState>
            {view === "overdue" ? "Nothing is overdue." : view === "returned" ? "Nothing has been returned yet." : "Nothing is checked out right now."}
          </EmptyState>
        </Card>
      ) : (
        <ul className="space-y-3">
          {checkouts.map((c) => {
            const overdue = !c.closed_at && c.due_date < today;
            const outstanding = c.checkout_lines
              .map((l) => ({ ...l, out: l.quantity - l.returned_good - l.returned_damaged - l.missing }))
              .filter((l) => view === "returned" || l.out > 0);
            const units = outstanding.reduce((n, l) => n + (view === "returned" ? l.quantity : l.out), 0);
            return (
              <li key={c.id}>
                <Link
                  href={`/checkouts/${c.id}`}
                  className={`block rounded-xl border bg-cream-50 p-4 shadow-sm transition hover:border-brand-300 ${
                    overdue ? "border-red-300 ring-1 ring-red-200" : "border-cream-300"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-brand-800">
                        {c.borrower_name}
                        {c.project && <span className="font-normal text-brand-500"> · {c.project}</span>}
                      </p>
                      <p className="text-xs text-brand-400">
                        #{c.number} · {formatDate(c.created_at)}
                        {c.kits && ` · Kit: ${c.kits.name}`}
                      </p>
                    </div>
                    {view === "returned" ? (
                      <Badge tone="muted">Returned {c.closed_at && formatDate(c.closed_at)}</Badge>
                    ) : overdue ? (
                      <Badge tone="danger">
                        <AlertIcon className="mr-1 size-3.5" /> Overdue · due {formatDate(`${c.due_date}T12:00:00`)}
                      </Badge>
                    ) : (
                      <Badge tone="neutral">Due {formatDate(`${c.due_date}T12:00:00`)}</Badge>
                    )}
                  </div>
                  <p className="mt-2 text-sm text-brand-600">
                    {outstanding
                      .slice(0, 6)
                      .map((l) => `${view === "returned" ? l.quantity : l.out} × ${l.item_variants.items.name}${l.item_variants.sizes ? ` (${l.item_variants.sizes.label})` : ""}`)
                      .join(", ")}
                    {outstanding.length > 6 && `, +${outstanding.length - 6} more`}
                    <span className="text-brand-400"> · {units} unit{units === 1 ? "" : "s"}</span>
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
