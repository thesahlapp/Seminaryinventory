import "server-only";
import { getPhotoUrls } from "@/lib/photos";
import { createClient } from "@/lib/supabase/server";

export type KitLine = {
  variantId: string;
  itemId: string;
  itemName: string;
  sizeLabel: string | null;
  needed: number;
  available: number;
};

/** Kits with each item's needed vs available (on hand at active locations). */
export async function loadKits({ id, includeArchived = false }: { id?: string; includeArchived?: boolean } = {}) {
  const supabase = await createClient();
  let query = supabase
    .from("kits")
    .select(
      "id, name, description, photo_path, thumbnail_path, archived_at, kit_items(quantity, variant_id, item_variants(item_id, items(name), sizes(label, sort_order), stock_levels(quantity, locations(archived_at))))",
    )
    .order("name");
  if (id) query = query.eq("id", id);
  else if (!includeArchived) query = query.is("archived_at", null);
  const { data, error } = await query;
  if (error) throw error;

  const urls = await getPhotoUrls(
    supabase,
    data.flatMap((k) => [k.thumbnail_path, k.photo_path].filter((p): p is string => Boolean(p))),
  );

  return data.map((kit) => {
    const lines: KitLine[] = kit.kit_items
      .map((ki) => ({
        variantId: ki.variant_id,
        itemId: ki.item_variants.item_id,
        itemName: ki.item_variants.items.name,
        sizeLabel: ki.item_variants.sizes?.label ?? null,
        needed: ki.quantity,
        available: ki.item_variants.stock_levels
          .filter((l) => !l.locations?.archived_at)
          .reduce((n, l) => n + l.quantity, 0),
      }))
      .sort((a, b) => a.itemName.localeCompare(b.itemName));
    return {
      id: kit.id,
      name: kit.name,
      description: kit.description,
      archived: Boolean(kit.archived_at),
      photoUrl: kit.photo_path ? (urls[kit.photo_path] ?? null) : null,
      thumbUrl: kit.thumbnail_path ? (urls[kit.thumbnail_path] ?? null) : kit.photo_path ? (urls[kit.photo_path] ?? null) : null,
      photoPath: kit.photo_path,
      thumbnailPath: kit.thumbnail_path,
      lines,
      short: lines.filter((l) => l.available < l.needed),
    };
  });
}
