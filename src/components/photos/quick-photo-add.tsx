"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert } from "@/components/ui";
import { uploadItemPhotos } from "@/lib/upload-photos";
import { PhotoButtons } from "./photo-buttons";

/** Take or choose photos straight from the item page. */
export function QuickPhotoAdd({ itemId, nextOrder }: { itemId: string; nextOrder: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  return (
    <div className="space-y-2">
      {errors.map((e) => (
        <Alert key={e}>{e}</Alert>
      ))}
      <div className="flex items-center gap-3">
        <PhotoButtons
          disabled={Boolean(busy)}
          onFiles={async (files) => {
            setErrors([]);
            const failed = await uploadItemPhotos(itemId, files, nextOrder, (done, total) =>
              setBusy(done < total ? `Uploading ${done + 1} of ${total}…` : null),
            );
            setBusy(null);
            setErrors(failed);
            router.refresh();
          }}
        />
        {busy && <span className="text-sm text-brand-500">{busy}</span>}
      </div>
    </div>
  );
}
