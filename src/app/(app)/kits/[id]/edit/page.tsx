import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { canEdit, getCurrentProfile } from "@/lib/auth";
import { loadKits } from "@/lib/kits";
import { createClient } from "@/lib/supabase/server";
import { KitForm } from "../../kit-form";

export const metadata: Metadata = { title: "Edit kit" };

export default async function EditKitPage({ params }: PageProps<"/kits/[id]/edit">) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!canEdit(profile.role)) return <PageHeader title="Edit kit" description="You have view-only access." />;
  const [kit] = await loadKits({ id });
  if (!kit) notFound();

  // Each line needs its item's sizes for the size picker.
  const supabase = await createClient();
  const { data: items } = await supabase
    .from("items")
    .select("id, name, sku, item_variants(id, archived_at, sizes(label, sort_order))")
    .in("id", [...new Set(kit.lines.map((l) => l.itemId))]);
  const options = new Map(
    (items ?? []).map((i) => [
      i.id,
      {
        id: i.id,
        name: i.name,
        sku: i.sku,
        variants: i.item_variants
          .filter((v) => !v.archived_at)
          .sort((a, b) => (a.sizes?.sort_order ?? 0) - (b.sizes?.sort_order ?? 0))
          .map((v) => ({ id: v.id, label: v.sizes?.label ?? null })),
      },
    ]),
  );

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={`Edit ${kit.name}`} />
      <KitForm
        kit={{
          id: kit.id,
          name: kit.name,
          description: kit.description,
          photoUrl: kit.photoUrl,
          photoPath: kit.photoPath,
          thumbnailPath: kit.thumbnailPath,
          lines: kit.lines.flatMap((l) => {
            const item = options.get(l.itemId);
            return item ? [{ item, variantId: l.variantId, quantity: l.needed }] : [];
          }),
        }}
      />
    </div>
  );
}
