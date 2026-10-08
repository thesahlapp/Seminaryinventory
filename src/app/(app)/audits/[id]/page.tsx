import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Badge, Card, CardHeader, EmptyState, PageHeader, Table } from "@/components/ui";
import { canEdit, getCurrentProfile, isAdmin } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { applyAudit, cancelAudit } from "../actions";
import { AuditCounter, type AuditLine } from "./audit-counter";

export const metadata: Metadata = { title: "Stock count" };

export default async function AuditPage({ params }: PageProps<"/audits/[id]">) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  const supabase = await createClient();
  const { data: audit } = await supabase
    .from("audits")
    .select(
      "id, number, status, notes, started_at, completed_at, location_id, locations(name), starter:profiles!audits_started_by_fkey(full_name, email), finisher:profiles!audits_completed_by_fkey(full_name, email), audit_lines(variant_id, expected_quantity, counted_quantity, counted_at, applied_old_quantity, applied_new_quantity, counter:profiles!audit_lines_counted_by_fkey(full_name, email), item_variants(item_id, items(name), sizes(label, sort_order)))",
    )
    .eq("id", id)
    .maybeSingle();
  if (!audit) notFound();

  const lines: (AuditLine & { itemId: string; appliedOld: number | null; appliedNew: number | null })[] = audit.audit_lines
    .map((l) => ({
      variantId: l.variant_id,
      itemId: l.item_variants.item_id,
      itemName: l.item_variants.items.name,
      sizeLabel: l.item_variants.sizes?.label ?? null,
      expected: l.expected_quantity,
      counted: l.counted_quantity,
      countedBy: l.counter?.full_name ?? l.counter?.email ?? null,
      appliedOld: l.applied_old_quantity,
      appliedNew: l.applied_new_quantity,
    }))
    .sort((a, b) => a.itemName.localeCompare(b.itemName) || (a.sizeLabel ?? "").localeCompare(b.sizeLabel ?? ""));

  const inProgress = audit.status === "in_progress";
  const counted = lines.filter((l) => l.counted !== null);
  const differences = counted.filter((l) => l.counted !== l.expected);

  return (
    <div className="space-y-6">
      <div className="text-sm">
        <Link href="/audits" className="text-brand-500 hover:underline">
          ← Stock counts
        </Link>
      </div>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            Count #{audit.number}: {audit.locations.name}
            <Badge tone={inProgress ? "warning" : audit.status === "completed" ? "brand" : "muted"}>
              {inProgress ? "Counting" : audit.status === "completed" ? "Applied" : "Cancelled"}
            </Badge>
          </span>
        }
        description={
          <>
            Started {formatDateTime(audit.started_at)} by {audit.starter?.full_name ?? audit.starter?.email ?? "—"}
            {audit.completed_at && ` · ${audit.status === "completed" ? "applied" : "cancelled"} ${formatDateTime(audit.completed_at)} by ${audit.finisher?.full_name ?? audit.finisher?.email ?? "—"}`}
            {audit.notes && (
              <>
                <br />
                {audit.notes}
              </>
            )}
          </>
        }
      />

      {inProgress && canEdit(profile.role) && <AuditCounter auditId={audit.id} lines={lines} />}

      <Card>
        <CardHeader title={inProgress ? "Review: expected vs counted" : "Results"} />
        {counted.length === 0 ? (
          <EmptyState>Nothing counted yet.</EmptyState>
        ) : (
          <>
            <p className="px-5 pt-3 text-sm text-brand-500">
              {counted.length} counted · {differences.length} difference{differences.length === 1 ? "" : "s"}
              {lines.length > counted.length && ` · ${lines.length - counted.length} not counted (left unchanged)`}
            </p>
            <Table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th className="text-right">Expected</th>
                  <th className="text-right">Counted</th>
                  <th className="text-right">Difference</th>
                  {!inProgress && <th className="text-right">Changed</th>}
                </tr>
              </thead>
              <tbody>
                {counted
                  .sort((a, b) => Math.abs(b.counted! - b.expected) - Math.abs(a.counted! - a.expected))
                  .map((l) => {
                    const diff = l.counted! - l.expected;
                    return (
                      <tr key={l.variantId} className={diff ? (diff < 0 ? "bg-red-50/70" : "bg-amber-50/70") : ""}>
                        <td>
                          <Link href={`/items/${l.itemId}`} className="font-medium text-brand-800 hover:underline">
                            {l.itemName}
                          </Link>
                          {l.sizeLabel && <span className="text-brand-500"> · {l.sizeLabel}</span>}
                          {l.countedBy && <span className="block text-xs text-brand-400">by {l.countedBy}</span>}
                        </td>
                        <td className="text-right tabular-nums">{l.expected}</td>
                        <td className="text-right font-semibold tabular-nums">{l.counted}</td>
                        <td className={`text-right font-semibold tabular-nums ${diff < 0 ? "text-red-700" : diff > 0 ? "text-amber-800" : "text-brand-400"}`}>
                          {diff > 0 ? `+${diff}` : diff || "—"}
                        </td>
                        {!inProgress && (
                          <td className="text-right tabular-nums text-brand-500">
                            {l.appliedOld !== null && l.appliedOld !== l.appliedNew ? `${l.appliedOld} → ${l.appliedNew}` : "—"}
                          </td>
                        )}
                      </tr>
                    );
                  })}
              </tbody>
            </Table>
          </>
        )}
        {inProgress && (
          <div className="flex flex-wrap items-center gap-3 border-t border-cream-300 p-4">
            {isAdmin(profile.role) ? (
              <>
                <ActionForm
                  action={applyAudit}
                  confirm={`Apply this count? Stock for the ${counted.length} counted item(s) will be set to the counted numbers and logged as "Audit correction".`}
                  className="flex flex-col gap-2"
                >
                  <input type="hidden" name="id" value={audit.id} />
                  <SubmitButton disabled={counted.length === 0}>Apply corrections</SubmitButton>
                </ActionForm>
                <ActionForm action={cancelAudit} confirm="Cancel this count? Nothing in stock will change." className="flex flex-col gap-2">
                  <input type="hidden" name="id" value={audit.id} />
                  <SubmitButton variant="ghost">Cancel count</SubmitButton>
                </ActionForm>
                <p className="text-xs text-brand-400">Applying sets each counted item to its counted number, even if stock changed while counting.</p>
              </>
            ) : (
              <p className="text-sm text-brand-500">When counting is finished, an admin reviews and applies the corrections.</p>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
