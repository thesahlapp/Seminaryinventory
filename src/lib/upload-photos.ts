import { createClient } from "@/lib/supabase/client";
import { resizeImage } from "./resize-image";

export const PHOTO_BUCKET = "item-photos";
export const PHOTO_ACCEPT = "image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif";

/**
 * Compresses and uploads photos for an item (browser only). Each photo is
 * stored twice: a ~1600px version for the item page and a ~400px thumbnail for
 * the inventory grid. Returns error messages for any that failed.
 */
export async function uploadItemPhotos(
  itemId: string,
  files: File[],
  startOrder: number,
  onProgress?: (done: number, total: number) => void,
) {
  const supabase = createClient();
  const errors: string[] = [];

  for (const [index, file] of files.entries()) {
    onProgress?.(index, files.length);
    const [full, thumb] = await Promise.all([resizeImage(file, 1600, 0.85), resizeImage(file, 400, 0.8)]);

    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(full.type)) {
      errors.push(`${file.name}: this photo format isn't supported here. Try a JPEG or PNG.`);
      continue;
    }

    const id = crypto.randomUUID();
    const extension = full.type === "image/jpeg" ? "jpg" : full.type.split("/")[1];
    const path = `${itemId}/${id}.${extension}`;
    const thumbPath = `${itemId}/${id}-thumb.${thumb.type === "image/jpeg" ? "jpg" : extension}`;

    const { error: uploadError } = await supabase.storage.from(PHOTO_BUCKET).upload(path, full, { contentType: full.type });
    if (uploadError) {
      errors.push(`${file.name}: ${uploadError.message}`);
      continue;
    }
    const { error: thumbError } = await supabase.storage
      .from(PHOTO_BUCKET)
      .upload(thumbPath, thumb, { contentType: thumb.type });

    const { error: rowError } = await supabase.from("item_photos").insert({
      item_id: itemId,
      storage_path: path,
      thumbnail_path: thumbError ? null : thumbPath,
      sort_order: startOrder + index,
    });
    if (rowError) {
      await supabase.storage.from(PHOTO_BUCKET).remove(thumbError ? [path] : [path, thumbPath]);
      errors.push(`${file.name}: ${rowError.message}`);
    }
  }

  onProgress?.(files.length, files.length);
  return errors;
}

export async function deleteItemPhoto(photo: { id: string; storage_path: string; thumbnail_path: string | null }) {
  const supabase = createClient();
  const { error } = await supabase.from("item_photos").delete().eq("id", photo.id);
  if (error) return error.message;
  await supabase.storage
    .from(PHOTO_BUCKET)
    .remove(photo.thumbnail_path ? [photo.storage_path, photo.thumbnail_path] : [photo.storage_path]);
  return null;
}
