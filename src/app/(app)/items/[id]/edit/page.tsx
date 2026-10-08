import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PhotoEditor } from "@/components/photos/photo-editor";
import { PageHeader } from "@/components/ui";
import { canEdit, getCurrentProfile, isAdmin } from "@/lib/auth";
import type { CategoryField } from "@/lib/custom-fields";
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
  const admin = isAdmin(profile.role);

  const supabase = await createClient();
  const [item, categories, fields, history, costs] = await Promise.all([
    supabase
      .from("items")
      .select(
        "id, name, sku, category_id, description, notes, has_sizes, checkoutable, min_quantity, custom_fields, item_photos(id, storage_path, thumbnail_path, sort_order, caption)",
      )
      .eq("id", id)
      .order("sort_order", { referencedTable: "item_photos" })
      .maybeSingle(),
    supabase.from("categories").select("id, name, default_has_sizes, archived_at").order("sort_order").order("name"),
    supabase.from("category_fields").select("*"),
    supabase
      .from("stock_movements")
      .select("id, item_variants!inner(item_id)", { count: "exact", head: true })
      .eq("item_variants.item_id", id),
    admin ? supabase.from("item_costs").select("unit_cost, retail_price").eq("item_id", id).maybeSingle() : null,
  ]);
  if (item.error) throw item.error;
  if (categories.error) throw categories.error;
  if (!item.data) notFound();

  const photos = item.data.item_photos;
  const photoUrls = await getPhotoUrls(supabase, photos.flatMap((p) => [p.storage_path, ...(p.thumbnail_path ? [p.thumbnail_path] : [])]));

  // Keep the item's current category in the list even if it was archived.
  const categoryOptions = categories.data.filter((c) => !c.archived_at || c.id === item.data?.category_id);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title={`Edit ${item.data.name}`} />
      <ItemForm
        item={item.data}
        categories={categoryOptions}
        fields={(fields.data ?? []) as CategoryField[]}
        sizes={[]}
        showCosts={admin}
        costs={costs?.data ?? null}
        sizingLocked={(history.count ?? 0) > 0}
      />
      <div id="photos" className="scroll-mt-20" />
      <PhotoEditor
        itemId={item.data.id}
        photos={photos.map((p) => ({
          id: p.id,
          storage_path: p.storage_path,
          thumbnail_path: p.thumbnail_path,
          caption: p.caption,
          sort_order: p.sort_order,
          url: photoUrls[p.thumbnail_path ?? p.storage_path] ?? photoUrls[p.storage_path] ?? null,
        }))}
      />
    </div>
  );
}
