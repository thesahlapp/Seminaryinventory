import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PhotoManager } from "@/components/photos/photo-manager";
import { PageHeader } from "@/components/ui";
import { canEdit, getCurrentProfile } from "@/lib/auth";
import { getPhotoUrls } from "@/lib/photos";
import { createClient } from "@/lib/supabase/server";
import { ItemForm } from "../../item-form";

export const metadata: Metadata = { title: "Edit item" };

export default async function EditItemPage({ params }: PageProps<"/items/[id]/edit">) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!canEdit(profile.role)) {
    return <PageHeader title="Edit item" description="You have view-only access. Ask an admin for edit access." />;
  }

  const supabase = await createClient();
  const [item, categories, history] = await Promise.all([
    supabase
      .from("items")
      .select("id, name, sku, category_id, description, notes, has_sizes, item_photos(id, storage_path, thumbnail_path, sort_order)")
      .eq("id", id)
      .order("sort_order", { referencedTable: "item_photos" })
      .maybeSingle(),
    supabase.from("categories").select("id, name, default_has_sizes, archived_at").order("sort_order").order("name"),
    supabase
      .from("stock_movements")
      .select("id, item_variants!inner(item_id)", { count: "exact", head: true })
      .eq("item_variants.item_id", id),
  ]);
  if (item.error) throw item.error;
  if (categories.error) throw categories.error;
  if (!item.data) notFound();

  const photos = item.data.item_photos;
  const photoUrls = await getPhotoUrls(supabase, photos.map((p) => p.storage_path));

  // Keep the item's current category in the list even if it was archived.
  const categoryOptions = categories.data.filter((c) => !c.archived_at || c.id === item.data?.category_id);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title={`Edit ${item.data.name}`} />
      <ItemForm
        item={item.data}
        categories={categoryOptions}
        sizes={[]}
        sizingLocked={(history.count ?? 0) > 0}
      />
      <PhotoManager
        itemId={item.data.id}
        itemName={item.data.name}
        canEdit
        photos={photos.map((p) => ({ ...p, url: photoUrls[p.storage_path] ?? null }))}
      />
    </div>
  );
}
