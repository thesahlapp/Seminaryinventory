import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Badge, Card, CardHeader, EmptyState, Input, PageHeader, Select } from "@/components/ui";
import { canEdit, getCurrentProfile } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { startAudit } from "./actions";

export const metadata: Metadata = { title: "Stock counts" };

const STATUS = {
  in_progress: { label: "Counting", tone: "warning" },
  completed: { label: "Applied", tone: "brand" },
  cancelled: { label: "Cancelled", tone: "muted" },
} as const;

export default async function AuditsPage() {
  const profile = await getCurrentProfile();
  const supabase = await createClient();
  const [{ data: audits, error }, { data: locations }] = await Promise.all([
    supabase
      .from("audits")
      .select("id, number, status, started_at, completed_at, locations(name), starter:profiles!audits_started_by_fkey(full_name, email), audit_lines(counted_quantity, expected_quantity)")
      .order("started_at", { ascending: false })
      .limit(100),
    supabase.from("locations").select("id, name").is("archived_at", null).order("sort_order").order("name"),
  ]);
  if (error) throw error;

  return (
    <div className="space-y-6">
      <PageHeader title="Stock counts" description="Count everything at one location, compare with what the system expects, then apply corrections." />

      {canEdit(profile.role) && (
        <Card>
          <CardHeader title="Start a count" />
          <ActionForm action={startAudit} className="flex flex-wrap items-end gap-3 p-4">
            <label className="flex min-w-48 flex-1 flex-col gap-1 text-xs font-medium text-brand-500">
              Location
              <Select name="location_id" required defaultValue="">
                <option value="">Choose…</option>
                {(locations ?? []).map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </Select>
            </label>
            <label className="flex min-w-48 flex-[2] flex-col gap-1 text-xs font-medium text-brand-500">
              Note
              <Input name="notes" placeholder="Optional, e.g. End of semester count" />
            </label>
            <SubmitButton>Start count</SubmitButton>
          </ActionForm>
        </Card>
      )}

      <Card>
        <CardHeader title="Counts" />
        {!audits.length ? (
          <EmptyState>No counts yet.</EmptyState>
        ) : (
          <ul className="divide-y divide-cream-200">
            {audits.map((a) => {
              const counted = a.audit_lines.filter((l) => l.counted_quantity !== null);
              const differences = counted.filter((l) => l.counted_quantity !== l.expected_quantity).length;
              return (
                <li key={a.id}>
                  <Link href={`/audits/${a.id}`} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 hover:bg-cream-100">
                    <span>
                      <span className="font-medium text-brand-800">
                        #{a.number} · {a.locations.name}
                      </span>
                      <span className="block text-xs text-brand-400">
                        Started {formatDateTime(a.started_at)} by {a.starter?.full_name ?? a.starter?.email ?? "—"}
                      </span>
                    </span>
                    <span className="flex items-center gap-2 text-sm text-brand-500">
                      {counted.length}/{a.audit_lines.length} counted
                      {differences > 0 && <Badge tone="danger">{differences} differ</Badge>}
                      <Badge tone={STATUS[a.status].tone}>{STATUS[a.status].label}</Badge>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
