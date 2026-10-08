import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export const PHOTO_BUCKET = "item-photos";

/** Signed (temporary) URLs for private photos, keyed by storage path. */
export async function getPhotoUrls(supabase: SupabaseClient<Database>, paths: string[]) {
  const urls: Record<string, string> = {};
  if (paths.length === 0) return urls;

  const { data } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(paths, 60 * 60);
  for (const entry of data ?? []) {
    if (entry.path && entry.signedUrl) urls[entry.path] = entry.signedUrl;
  }
  return urls;
}
