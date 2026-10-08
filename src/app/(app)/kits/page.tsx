import type { Metadata } from "next";
import Link from "next/link";
import { KitIcon } from "@/components/icons";
import { Badge, Card, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { canEdit, getCurrentProfile } from "@/lib/auth";
import { loadKits } from "@/lib/kits";

export const metadata: Metadata = { title: "Kits" };

export default async function KitsPage() {
  const profile = await getCurrentProfile();
  const kits = await loadKits();

  return (
    <div>
      <PageHeader
        title="Kits"
        description="Bundles of items that go out together, like a camera kit."
        actions={canEdit(profile.role) && <LinkButton href="/kits/new">New kit</LinkButton>}
      />
      {kits.length === 0 ? (
        <Card>
          <EmptyState>No kits yet.</EmptyState>
        </Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {kits.map((kit) => (
            <li key={kit.id}>
              <Link href={`/kits/${kit.id}`} className="flex gap-3 rounded-xl border border-cream-300 bg-cream-50 p-3 shadow-sm transition hover:border-brand-300">
                {kit.thumbUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={kit.thumbUrl} alt="" className="size-20 shrink-0 rounded-lg object-cover" />
                ) : (
                  <span className="flex size-20 shrink-0 items-center justify-center rounded-lg bg-cream-200 text-brand-300">
                    <KitIcon className="size-8" />
                  </span>
                )}
                <span className="min-w-0">
                  <span className="block font-semibold text-brand-800">{kit.name}</span>
                  <span className="block text-xs text-brand-400">
                    {kit.lines.length} item{kit.lines.length === 1 ? "" : "s"} · {kit.lines.reduce((n, l) => n + l.needed, 0)} units
                  </span>
                  <span className="mt-2 block">
                    {kit.short.length ? <Badge tone="danger">Short {kit.short.length} item{kit.short.length === 1 ? "" : "s"}</Badge> : <Badge tone="brand">Ready</Badge>}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
