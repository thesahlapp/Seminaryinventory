"use client";

import { useRouter } from "next/navigation";
import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { SubmitButton } from "@/components/action-form";
import { PhotoButtons } from "@/components/photos/photo-buttons";
import { Alert, Card, Field, Input, LinkButton, Select, Textarea } from "@/components/ui";
import { initialActionState } from "@/lib/action-state";
import { uploadItemPhotos } from "@/lib/upload-photos";
import { createItem, updateItem } from "./actions";

type Category = { id: string; name: string; default_has_sizes: boolean };
type Size = { id: string; label: string; is_standard: boolean };
type Item = {
  id: string;
  name: string;
  sku: string | null;
  category_id: string | null;
  description: string | null;
  notes: string | null;
  has_sizes: boolean;
};

export function ItemForm({
  categories,
  sizes,
  item,
  sizingLocked = false,
}: {
  categories: Category[];
  sizes: Size[];
  /** Present when editing. */
  item?: Item;
  /** True when the item has stock history, so sized/unsized can no longer change. */
  sizingLocked?: boolean;
}) {
  const isEdit = Boolean(item);
  const router = useRouter();
  const [state, dispatch, pending] = useActionState(isEdit ? updateItem : createItem, initialActionState);
  const [hasSizes, setHasSizes] = useState(item?.has_sizes ?? false);
  const [sizesTouched, setSizesTouched] = useState(isEdit);
  const [photos, setPhotos] = useState<{ file: File; preview: string }[]>([]);
  const [uploading, setUploading] = useState<string | null>(null);
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);
  const handledItemId = useRef<string | null>(null);

  // After a new item is created: upload its photos, then open it.
  useEffect(() => {
    const itemId = state.itemId;
    if (!itemId || handledItemId.current === itemId) return;
    handledItemId.current = itemId;
    (async () => {
      if (photos.length) {
        const failed = await uploadItemPhotos(
          itemId,
          photos.map((p) => p.file),
          0,
          (done, total) => setUploading(done < total ? `Uploading photo ${done + 1} of ${total}…` : "Opening item…"),
        );
        if (failed.length) {
          setUploadErrors(failed);
          setUploading(null);
          return;
        }
      }
      router.push(`/items/${itemId}`);
    })();
  }, [state.itemId, photos, router]);

  // Free the preview images when the form goes away.
  const photosRef = useRef(photos);
  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);
  useEffect(() => () => photosRef.current.forEach((p) => URL.revokeObjectURL(p.preview)), []);

  return (
    <form
      onSubmit={(event) => {
        // Submitted by hand so React doesn't reset the form (and wipe typed values) on errors.
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(() => dispatch(formData));
      }}
    >
      <Card className="space-y-5 p-5">
        {item && <input type="hidden" name="id" value={item.id} />}
        {state.error && <Alert>{state.error}</Alert>}
        {uploadErrors.length > 0 && state.itemId && (
          <Alert>
            The item was created, but some photos didn&apos;t upload: {uploadErrors.join(" ")}{" "}
            <a href={`/items/${state.itemId}`} className="underline">
              Open the item
            </a>{" "}
            to try again.
          </Alert>
        )}

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Name" htmlFor="name">
            <Input id="name" name="name" required defaultValue={item?.name} placeholder="e.g. Black Hoodie" />
          </Field>
          <Field label="SKU" htmlFor="sku" hint="Optional. Must be unique.">
            <Input id="sku" name="sku" defaultValue={item?.sku ?? ""} placeholder="e.g. HOOD-BLK" />
          </Field>
          <Field label="Category" htmlFor="category_id">
            <Select
              id="category_id"
              name="category_id"
              defaultValue={item?.category_id ?? ""}
              onChange={(e) => {
                // New items follow the category's default until sizes are set by hand.
                const category = categories.find((c) => c.id === e.target.value);
                if (!sizesTouched && category) setHasSizes(category.default_has_sizes);
              }}
            >
              <option value="">Uncategorized</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Description" htmlFor="description">
          <Textarea id="description" name="description" defaultValue={item?.description ?? ""} />
        </Field>
        <Field label="Notes" htmlFor="notes" hint="Internal notes, e.g. supplier or reorder info.">
          <Textarea id="notes" name="notes" defaultValue={item?.notes ?? ""} />
        </Field>

        <fieldset className="space-y-3 rounded-lg border border-cream-300 p-4">
          <label className="flex items-center gap-2 text-sm font-medium text-brand-800">
            <input
              type="checkbox"
              name="has_sizes"
              checked={hasSizes}
              disabled={sizingLocked}
              onChange={(e) => {
                setHasSizes(e.target.checked);
                setSizesTouched(true);
              }}
              className="size-4 accent-[#2f6b47]"
            />
            This item comes in sizes
          </label>
          {sizingLocked && (
            <>
              {/* Disabled checkboxes aren't submitted, so send the current value. */}
              {hasSizes && <input type="hidden" name="has_sizes" value="on" />}
              <p className="text-xs text-brand-400">
                This can&apos;t be changed because stock has already been recorded for this item.
              </p>
            </>
          )}
          {isEdit && !sizingLocked && item?.has_sizes !== hasSizes && (
            <p className="text-xs text-amber-800">
              {hasSizes
                ? "After saving, add the sizes this item comes in from the item page."
                : "Saving will remove this item's sizes."}
            </p>
          )}

          {!isEdit && hasSizes && (
            <div>
              <p className="mb-2 text-xs text-brand-500">Which sizes? You can add or remove sizes later.</p>
              <div className="flex flex-wrap gap-2">
                {sizes.map((size) => (
                  <label
                    key={size.id}
                    className="flex cursor-pointer items-center gap-1.5 rounded-md border border-cream-400 bg-cream-50 px-3 py-1.5 text-sm has-[:checked]:border-brand has-[:checked]:bg-brand-50"
                  >
                    <input
                      type="checkbox"
                      name="size_ids"
                      value={size.id}
                      defaultChecked={size.is_standard}
                      className="accent-[#2f6b47]"
                    />
                    {size.label}
                  </label>
                ))}
              </div>
            </div>
          )}
        </fieldset>

        {!isEdit && (
          <fieldset className="space-y-3 rounded-lg border border-cream-300 p-4">
            <legend className="px-1 text-sm font-medium text-brand-800">Photos</legend>
            {photos.length > 0 && (
              <ul className="flex flex-wrap gap-2">
                {photos.map((photo, index) => (
                  <li key={photo.preview} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo.preview} alt="" className="size-20 rounded-md object-cover" />
                    <button
                      type="button"
                      onClick={() => {
                        URL.revokeObjectURL(photo.preview);
                        setPhotos(photos.filter((_, i) => i !== index));
                      }}
                      aria-label="Remove photo"
                      className="absolute -right-1.5 -top-1.5 flex size-6 items-center justify-center rounded-full bg-ink/80 text-xs text-cream"
                    >
                      ✕
                    </button>
                    {index === 0 && (
                      <span className="absolute inset-x-0 bottom-0 rounded-b-md bg-ink/60 text-center text-[10px] text-cream">
                        Cover
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <PhotoButtons
              onFiles={(files) =>
                setPhotos([...photos, ...files.map((file) => ({ file, preview: URL.createObjectURL(file) }))])
              }
            />
            <p className="text-xs text-brand-400">Photos are shrunk before uploading, so they&apos;re quick even on mobile data.</p>
          </fieldset>
        )}

        <div className="flex gap-2">
          <SubmitButton pending={pending || Boolean(uploading)} pendingText={uploading ?? "Saving…"}>
            {isEdit ? "Save changes" : "Create item"}
          </SubmitButton>
          <LinkButton href={item ? `/items/${item.id}` : "/items"} variant="secondary">
            Cancel
          </LinkButton>
        </div>
      </Card>
    </form>
  );
}
