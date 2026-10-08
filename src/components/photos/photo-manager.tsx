"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Button, Card, CardHeader } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { deleteItemPhoto, uploadItemPhotos } from "@/lib/upload-photos";
import { PhotoButtons } from "./photo-buttons";

type Photo = { id: string; storage_path: string; thumbnail_path: string | null; url: string | null; sort_order: number };

/** Photos of an existing item: gallery, add (camera or files), delete, choose cover. */
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
  const [selected, setSelected] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  const current = photos[Math.min(selected, photos.length - 1)];

  async function upload(files: File[]) {
    setErrors([]);
    const startOrder = photos.reduce((max, p) => Math.max(max, p.sort_order), -1) + 1;
    const failed = await uploadItemPhotos(itemId, files, startOrder, (done, total) =>
      setBusy(done < total ? `Uploading ${done + 1} of ${total}…` : null),
    );
    setBusy(null);
    setErrors(failed);
    setSelected(photos.length);
    router.refresh();
  }

  async function remove(photo: Photo) {
    if (!window.confirm("Delete this photo?")) return;
    setBusy("Deleting…");
    const error = await deleteItemPhoto(photo);
    setBusy(null);
    setErrors(error ? [error] : []);
    setSelected(0);
    router.refresh();
  }

  async function makeCover(photo: Photo) {
    setBusy("Saving…");
    const supabase = createClient();
    const reordered = [photo, ...photos.filter((p) => p.id !== photo.id)];
    for (const [index, p] of reordered.entries()) {
      if (p.sort_order !== index) await supabase.from("item_photos").update({ sort_order: index }).eq("id", p.id);
    }
    setBusy(null);
    setSelected(0);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader title="Photos" actions={busy && <span className="text-sm text-brand-500">{busy}</span>} />
      <div className="space-y-3 p-4">
        {errors.map((e) => (
          <Alert key={e}>{e}</Alert>
        ))}
        {current ? (
          <>
            <div className="relative overflow-hidden rounded-lg bg-cream-200">
              {current.url ? (
                // Signed URLs change on every request, so the image optimizer adds nothing here.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={current.url} alt={itemName} className="aspect-square w-full object-contain" />
              ) : (
                <div className="flex aspect-square items-center justify-center text-sm text-brand-400">Photo unavailable</div>
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
          <div className="flex aspect-[4/3] items-center justify-center rounded-lg border-2 border-dashed border-cream-400 text-sm text-brand-400">
            No photos yet
          </div>
        )}
        {canEdit && <PhotoButtons onFiles={upload} disabled={Boolean(busy)} />}
      </div>
    </Card>
  );
}
