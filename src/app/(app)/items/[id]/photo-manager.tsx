"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Alert, Button, Card, CardHeader } from "@/components/ui";
import { resizeImage } from "@/lib/resize-image";
import { createClient } from "@/lib/supabase/client";

type Photo = { id: string; storage_path: string; url: string | null; sort_order: number };

const BUCKET = "item-photos";
const ACCEPTED = "image/jpeg,image/png,image/webp,image/gif";

export function PhotoManager({
  itemId,
  itemName,
  photos,
  canEdit,
}: {
  itemId: string;
  itemName: string;
  photos: Photo[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const current = photos[Math.min(selected, photos.length - 1)];

  async function upload(files: FileList) {
    setError(null);
    const supabase = createClient();
    const startOrder = photos.reduce((max, p) => Math.max(max, p.sort_order), -1) + 1;

    for (const [index, file] of Array.from(files).entries()) {
      setBusy(`Uploading ${index + 1} of ${files.length}…`);
      const blob = await resizeImage(file);
      const extension = blob.type === "image/jpeg" ? "jpg" : (file.name.split(".").pop()?.toLowerCase() ?? "jpg");
      const path = `${itemId}/${crypto.randomUUID()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, blob, { contentType: blob.type || file.type });
      if (uploadError) {
        setError(`Couldn't upload ${file.name}: ${uploadError.message}`);
        continue;
      }

      const { error: rowError } = await supabase
        .from("item_photos")
        .insert({ item_id: itemId, storage_path: path, sort_order: startOrder + index });
      if (rowError) {
        await supabase.storage.from(BUCKET).remove([path]);
        setError(`Couldn't save ${file.name}: ${rowError.message}`);
      }
    }

    setBusy(null);
    if (inputRef.current) inputRef.current.value = "";
    router.refresh();
  }

  async function remove(photo: Photo) {
    if (!window.confirm("Delete this photo?")) return;
    setError(null);
    setBusy("Deleting…");
    const supabase = createClient();
    const { error: rowError } = await supabase.from("item_photos").delete().eq("id", photo.id);
    if (rowError) setError(rowError.message);
    else await supabase.storage.from(BUCKET).remove([photo.storage_path]);
    setBusy(null);
    setSelected(0);
    router.refresh();
  }

  async function makeCover(photo: Photo) {
    setError(null);
    setBusy("Saving…");
    const supabase = createClient();
    const reordered = [photo, ...photos.filter((p) => p.id !== photo.id)];
    for (const [index, p] of reordered.entries()) {
      if (p.sort_order !== index) {
        const { error: updateError } = await supabase.from("item_photos").update({ sort_order: index }).eq("id", p.id);
        if (updateError) setError(updateError.message);
      }
    }
    setBusy(null);
    setSelected(0);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader
        title="Photos"
        actions={
          canEdit && (
            <>
              <input
                ref={inputRef}
                type="file"
                accept={ACCEPTED}
                multiple
                className="hidden"
                onChange={(e) => e.target.files?.length && upload(e.target.files)}
              />
              <Button size="sm" variant="secondary" disabled={Boolean(busy)} onClick={() => inputRef.current?.click()}>
                {busy ?? "Add photos"}
              </Button>
            </>
          )
        }
      />
      <div className="space-y-3 p-4">
        {error && <Alert>{error}</Alert>}
        {current ? (
          <>
            <div className="relative overflow-hidden rounded-lg bg-cream-200">
              {current.url ? (
                // Signed URLs change on every request, so the image optimizer adds nothing here.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={current.url} alt={itemName} className="aspect-square w-full object-contain" />
              ) : (
                <div className="flex aspect-square items-center justify-center text-sm text-brand-400">
                  Photo unavailable
                </div>
              )}
              {canEdit && (
                <div className="absolute inset-x-2 bottom-2 flex justify-end gap-2">
                  {current.id !== photos[0]?.id && (
                    <Button size="sm" variant="secondary" disabled={Boolean(busy)} onClick={() => makeCover(current)}>
                      Make cover photo
                    </Button>
                  )}
                  <Button size="sm" variant="danger" disabled={Boolean(busy)} onClick={() => remove(current)}>
                    Delete
                  </Button>
                </div>
              )}
            </div>
            {photos.length > 1 && (
              <div className="flex flex-wrap gap-2">
                {photos.map((photo, index) => (
                  <button
                    key={photo.id}
                    type="button"
                    onClick={() => setSelected(index)}
                    className={`overflow-hidden rounded-md ring-2 ${photo.id === current.id ? "ring-brand" : "ring-transparent"}`}
                    aria-label={`Show photo ${index + 1}`}
                  >
                    {photo.url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photo.url} alt="" className="size-14 object-cover" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <button
            type="button"
            disabled={!canEdit || Boolean(busy)}
            onClick={() => inputRef.current?.click()}
            className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-cream-400 text-sm text-brand-400 enabled:hover:border-brand-300 enabled:hover:text-brand-600"
          >
            {canEdit ? (
              <>
                <span className="text-2xl">+</span>
                Add photos
              </>
            ) : (
              "No photos"
            )}
          </button>
        )}
      </div>
    </Card>
  );
}
