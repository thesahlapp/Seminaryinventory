"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { arrayMove, rectSortingStrategy, SortableContext, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Card, CardHeader } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { deleteItemPhoto, uploadItemPhotos } from "@/lib/upload-photos";
import { PhotoButtons } from "./photo-buttons";

export type EditablePhoto = {
  id: string;
  storage_path: string;
  thumbnail_path: string | null;
  caption: string | null;
  sort_order: number;
  url: string | null;
};

const CAPTION_SUGGESTIONS = ["Front", "Back", "Tag", "Label", "Damage", "Detail", "In use"];

/** Add, reorder (drag), caption and delete an item's photos. The first photo is the cover. */
export function PhotoEditor({ itemId, photos }: { itemId: string; photos: EditablePhoto[] }) {
  const router = useRouter();
  const [order, setOrder] = useState(photos);
  const [lastProps, setLastProps] = useState(photos);
  const [busy, setBusy] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  // Take fresh photos from the server after uploads/deletes.
  if (lastProps !== photos) {
    setLastProps(photos);
    setOrder(photos);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  async function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = order.findIndex((p) => p.id === active.id);
    const to = order.findIndex((p) => p.id === over.id);
    const next = arrayMove(order, from, to);
    setOrder(next);

    setBusy("Saving order…");
    const supabase = createClient();
    const results = await Promise.all(
      next.map((photo, index) =>
        photo.sort_order === index ? null : supabase.from("item_photos").update({ sort_order: index }).eq("id", photo.id),
      ),
    );
    const failed = results.find((r) => r?.error);
    setErrors(failed?.error ? [failed.error.message] : []);
    setBusy(null);
    router.refresh();
  }

  async function upload(files: File[]) {
    setErrors([]);
    const start = order.reduce((max, p) => Math.max(max, p.sort_order), -1) + 1;
    const failed = await uploadItemPhotos(itemId, files, start, (done, total) =>
      setBusy(done < total ? `Uploading ${done + 1} of ${total}…` : null),
    );
    setBusy(null);
    setErrors(failed);
    router.refresh();
  }

  async function remove(photo: EditablePhoto) {
    if (!window.confirm("Delete this photo?")) return;
    setBusy("Deleting…");
    const error = await deleteItemPhoto(photo);
    setBusy(null);
    setErrors(error ? [error] : []);
    router.refresh();
  }

  async function saveCaption(photo: EditablePhoto, caption: string) {
    const value = caption.trim().slice(0, 80) || null;
    if (value === (photo.caption ?? null)) return;
    const { error } = await createClient().from("item_photos").update({ caption: value }).eq("id", photo.id);
    setErrors(error ? [error.message] : []);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader title="Photos" actions={busy && <span className="text-sm text-brand-500">{busy}</span>} />
      <div className="space-y-4 p-4">
        {errors.map((e) => (
          <Alert key={e}>{e}</Alert>
        ))}
        {order.length > 0 ? (
          <>
            <p className="text-xs text-brand-500">
              Drag photos to reorder (on a phone, press and hold first). The first photo is the cover in the inventory.
            </p>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={order.map((p) => p.id)} strategy={rectSortingStrategy}>
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {order.map((photo, index) => (
                    <SortablePhoto
                      key={photo.id}
                      photo={photo}
                      isCover={index === 0}
                      disabled={Boolean(busy)}
                      onDelete={() => remove(photo)}
                      onCaption={(c) => saveCaption(photo, c)}
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
            <datalist id="photo-captions">
              {CAPTION_SUGGESTIONS.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </>
        ) : (
          <p className="text-sm text-brand-400">No photos yet.</p>
        )}
        <PhotoButtons onFiles={upload} disabled={Boolean(busy)} />
      </div>
    </Card>
  );
}

function SortablePhoto({
  photo,
  isCover,
  disabled,
  onDelete,
  onCaption,
}: {
  photo: EditablePhoto;
  isCover: boolean;
  disabled: boolean;
  onDelete: () => void;
  onCaption: (caption: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: photo.id });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`rounded-lg border border-cream-300 bg-cream-100 p-2 ${isDragging ? "z-10 shadow-xl ring-2 ring-brand-400" : ""}`}
    >
      <div
        {...attributes}
        {...listeners}
        className="relative cursor-grab touch-none overflow-hidden rounded-md active:cursor-grabbing"
        aria-label={`Photo${photo.caption ? `: ${photo.caption}` : ""}. Drag to reorder.`}
      >
        {photo.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo.url} alt="" className="aspect-square w-full object-cover" draggable={false} />
        ) : (
          <div className="flex aspect-square items-center justify-center text-xs text-brand-400">Unavailable</div>
        )}
        {isCover && (
          <span className="absolute left-1.5 top-1.5 rounded bg-black/65 px-1.5 py-0.5 text-[11px] font-medium text-white">Cover</span>
        )}
      </div>
      <div className="mt-2 flex items-center gap-1.5">
        <input
          type="text"
          list="photo-captions"
          defaultValue={photo.caption ?? ""}
          placeholder="Caption"
          maxLength={80}
          aria-label="Caption"
          onBlur={(e) => onCaption(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          className="min-w-0 flex-1 rounded-md border border-cream-400 bg-cream-50 px-2 py-1 text-sm text-ink placeholder:text-brand-300"
        />
        <button
          type="button"
          onClick={onDelete}
          disabled={disabled}
          aria-label="Delete photo"
          className="rounded-md px-2 py-1 text-sm text-red-700 hover:bg-red-50"
        >
          ✕
        </button>
      </div>
    </li>
  );
}
