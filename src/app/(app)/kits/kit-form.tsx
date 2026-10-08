"use client";

import { useRouter } from "next/navigation";
import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { PhotoButtons } from "@/components/photos/photo-buttons";
import { Alert, Button, Card, Field, Input, Select, Textarea } from "@/components/ui";
import { initialActionState } from "@/lib/action-state";
import { resizeImage } from "@/lib/resize-image";
import { createClient } from "@/lib/supabase/client";
import { type KitItemOption, saveKit, searchKitItems } from "./actions";

type Line = { key: string; item: KitItemOption; variantId: string; quantity: string };

export function KitForm({
  kit,
}: {
  kit?: {
    id: string;
    name: string;
    description: string | null;
    photoUrl: string | null;
    photoPath: string | null;
    thumbnailPath: string | null;
    lines: { item: KitItemOption; variantId: string; quantity: number }[];
  };
}) {
  const router = useRouter();
  const [state, dispatch, pending] = useActionState(saveKit, initialActionState);
  const [lines, setLines] = useState<Line[]>(
    () => kit?.lines.map((l) => ({ key: crypto.randomUUID(), item: l.item, variantId: l.variantId, quantity: String(l.quantity) })) ?? [],
  );
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<KitItemOption[]>([]);
  const [photo, setPhoto] = useState<{ file: File; preview: string } | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const handled = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      const found = await searchKitItems(query);
      if (!cancelled) setResults(found);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  // After saving: upload a new photo (if any), then open the kit.
  useEffect(() => {
    const kitId = state.itemId;
    if (!kitId || handled.current === kitId + (state.success ?? "")) return;
    handled.current = kitId + (state.success ?? "");
    (async () => {
      if (photo) {
        setStatus("Uploading photo…");
        const supabase = createClient();
        const [full, thumb] = await Promise.all([resizeImage(photo.file, 1600, 0.85), resizeImage(photo.file, 400, 0.8)]);
        const base = `kits/${kitId}/${crypto.randomUUID()}`;
        const ext = (b: Blob) => (b.type === "image/jpeg" ? "jpg" : b.type.split("/")[1] ?? "jpg");
        const photoPath = `${base}.${ext(full)}`;
        const thumbPath = `${base}-thumb.${ext(thumb)}`;
        const up1 = await supabase.storage.from("item-photos").upload(photoPath, full, { contentType: full.type });
        const up2 = await supabase.storage.from("item-photos").upload(thumbPath, thumb, { contentType: thumb.type });
        if (!up1.error) {
          await supabase.from("kits").update({ photo_path: photoPath, thumbnail_path: up2.error ? null : thumbPath }).eq("id", kitId);
          const old = [kit?.photoPath, kit?.thumbnailPath].filter((p): p is string => Boolean(p));
          if (old.length) await supabase.storage.from("item-photos").remove(old);
        } else {
          setStatus(`The kit was saved, but the photo didn't upload: ${up1.error.message}`);
          return;
        }
      }
      router.push(`/kits/${kitId}`);
    })();
  }, [state, photo, kit, router]);

  const update = (key: string, changes: Partial<Line>) => setLines(lines.map((l) => (l.key === key ? { ...l, ...changes } : l)));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        startTransition(() => dispatch(formData));
      }}
    >
      <Card className="space-y-5 p-5">
        {kit && <input type="hidden" name="id" value={kit.id} />}
        <input type="hidden" name="items" value={JSON.stringify(lines.map((l) => ({ variant_id: l.variantId, quantity: Number(l.quantity) })))} />
        {state.error && <Alert>{state.error}</Alert>}
        {status && <Alert tone="success">{status}</Alert>}

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Kit name" htmlFor="name">
            <Input id="name" name="name" required defaultValue={kit?.name} placeholder="e.g. Shoot Kit A" />
          </Field>
          <Field label="Description" htmlFor="description" hint="Optional">
            <Textarea id="description" name="description" rows={1} defaultValue={kit?.description ?? ""} />
          </Field>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-brand-800">Photo</p>
          <div className="flex items-center gap-4">
            {(photo?.preview ?? kit?.photoUrl) && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo?.preview ?? kit?.photoUrl ?? ""} alt="" className="size-20 rounded-md object-cover" />
            )}
            <PhotoButtons onFiles={(files) => files[0] && setPhoto({ file: files[0], preview: URL.createObjectURL(files[0]) })} />
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium text-brand-800">Items in the kit</p>
          {lines.length > 0 && (
            <ul className="divide-y divide-cream-200 rounded-lg border border-cream-300">
              {lines.map((line) => {
                const sized = line.item.variants.some((v) => v.label);
                return (
                  <li key={line.key} className="flex flex-wrap items-center gap-2 px-3 py-2">
                    <span className="min-w-32 flex-1 text-sm font-medium text-brand-800">{line.item.name}</span>
                    {sized && (
                      <Select aria-label="Size" value={line.variantId} onChange={(e) => update(line.key, { variantId: e.target.value })} className="w-24">
                        {line.item.variants.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.label}
                          </option>
                        ))}
                      </Select>
                    )}
                    <Input
                      aria-label="Quantity"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      value={line.quantity}
                      onChange={(e) => update(line.key, { quantity: e.target.value })}
                      className="w-20"
                    />
                    <button type="button" onClick={() => setLines(lines.filter((l) => l.key !== line.key))} className="px-2 text-sm text-red-700" aria-label={`Remove ${line.item.name}`}>
                      ✕
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <Input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search items to add" aria-label="Search items to add" />
          <ul className="max-h-56 divide-y divide-cream-200 overflow-y-auto rounded-lg border border-cream-300">
            {results.length === 0 && <li className="px-3 py-2 text-sm text-brand-400">No matching items.</li>}
            {results.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  disabled={item.variants.length === 0}
                  onClick={() => setLines([...lines, { key: crypto.randomUUID(), item, variantId: item.variants[0].id, quantity: "1" }])}
                  className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm hover:bg-cream-100 disabled:opacity-50"
                >
                  <span className="font-medium text-brand-800">{item.name}</span>
                  <span className="text-xs text-brand-400">{item.variants.length === 0 ? "No sizes yet" : "Add"}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <Button type="submit" disabled={pending || Boolean(status && !state.error)}>
          {pending ? "Saving…" : kit ? "Save kit" : "Create kit"}
        </Button>
      </Card>
    </form>
  );
}
