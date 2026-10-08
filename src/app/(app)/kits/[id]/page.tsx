import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { AlertIcon } from "@/components/icons";
import { QrCard } from "@/components/qr/qr-card";
import { Badge, Card, CardHeader, EmptyState, LinkButton, PageHeader, Table } from "@/components/ui";
import { canEdit, getCurrentProfile } from "@/lib/auth";
import { formatDate, todayInDallas } from "@/lib/format";
import { loadKits } from "@/lib/kits";
import { createClient } from "@/lib/supabase/server";
import { deleteKit, setKitArchived } from "../actions";

export const metadata: Metadata = { title: "Kit" };

export default async function KitPage({ params }: PageProps<"/kits/[id]">) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  const editor = canEdit(profile.role);
  const [kit] = await loadKits({ id });
  if (!kit) notFound();

  const supabase = await createClient();
  const { data: open } = await supabase
    .from("checkouts")
    .select("id, number, borrower_name, project, due_date")
    .eq("kit_id", kit.id)
    .is("closed_at", null)
    .order("due_date");
  const today = todayInDallas();

  return (
    <div className="space-y-6">
      <div className="text-sm">
        <Link href="/kits" className="text-brand-500 hover:underline">
          ← Kits
        </Link>
      </div>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {kit.name}
            {kit.archived ? <Badge tone="muted">Archived</Badge> : kit.short.length ? <Badge tone="danger">Short</Badge> : <Badge tone="brand">Ready</Badge>}
          </span>
        }
        description={kit.description}
        actions={
          editor && (
            <>
              {!kit.archived && <LinkButton href={`/checkouts/new?kit=${kit.id}`}>Check out kit</LinkButton>}
              <LinkButton href={`/kits/${kit.id}/edit`} variant="secondary">
                Edit
              </LinkButton>
              <ActionForm action={setKitArchived} className="flex flex-col gap-2">
                <input type="hidden" name="id" value={kit.id} />
                <input type="hidden" name="archive" value={kit.archived ? "false" : "true"} />
                <SubmitButton variant="secondary" pendingText="…">
                  {kit.archived ? "Restore" : "Archive"}
                </SubmitButton>
              </ActionForm>
              <ActionForm action={deleteKit} confirm={`Delete the kit “${kit.name}”? Its items aren't affected.`} className="flex flex-col gap-2">
                <input type="hidden" name="id" value={kit.id} />
                <SubmitButton variant="danger" pendingText="…">
                  Delete
                </SubmitButton>
              </ActionForm>
            </>
          )
        }
      />

      {kit.short.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertIcon className="mt-0.5 size-4 shrink-0" />
          Not enough stock to check out this kit: {kit.short.map((l) => `${l.itemName}${l.sizeLabel ? ` (${l.sizeLabel})` : ""} needs ${l.needed}, ${l.available} available`).join("; ")}.
        </div>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader title={`Items (${kit.lines.length})`} />
            <Table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th className="text-right">Needed</th>
                  <th className="text-right">Available</th>
                  <th>
                    <span className="sr-only">Status</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {kit.lines.map((line) => {
                  const short = line.available < line.needed;
                  return (
                    <tr key={line.variantId} className={short ? "bg-red-50/60" : ""}>
                      <td>
                        <Link href={`/items/${line.itemId}`} className="font-medium text-brand-800 hover:underline">
                          {line.itemName}
                        </Link>
                        {line.sizeLabel && <span className="text-brand-500"> · {line.sizeLabel}</span>}
                      </td>
                      <td className="text-right tabular-nums">{line.needed}</td>
                      <td className={`text-right font-semibold tabular-nums ${short ? "text-red-700" : ""}`}>{line.available}</td>
                      <td>{short ? <Badge tone="danger">Short {line.needed - line.available}</Badge> : <Badge tone="brand">OK</Badge>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </Card>

          <Card>
            <CardHeader title="Currently checked out" />
            {!open?.length ? (
              <EmptyState>This kit isn&apos;t checked out.</EmptyState>
            ) : (
              <ul className="divide-y divide-cream-200">
                {open.map((c) => (
                  <li key={c.id}>
                    <Link href={`/checkouts/${c.id}`} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm hover:bg-cream-100">
                      <span>
                        <span className="font-medium text-brand-800">{c.borrower_name}</span>
                        {c.project && <span className="text-brand-500"> · {c.project}</span>}
                        <span className="text-brand-400"> · #{c.number}</span>
                      </span>
                      <span className={c.due_date < today ? "font-medium text-red-700" : "text-brand-500"}>
                        {c.due_date < today ? "Overdue · " : "Due "}
                        {formatDate(`${c.due_date}T12:00:00`)} · Check in →
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
        <div className="space-y-6">
          {kit.photoUrl && (
            <Card className="overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={kit.photoUrl} alt={kit.name} className="aspect-square w-full object-contain" />
            </Card>
          )}
          <QrCard kind="kit" id={kit.id} title={kit.name} />
        </div>
      </div>
    </div>
  );
}
