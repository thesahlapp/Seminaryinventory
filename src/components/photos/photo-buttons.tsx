"use client";

import { useRef } from "react";
import { Button } from "@/components/ui";
import { PHOTO_ACCEPT } from "@/lib/upload-photos";

/** "Take photo" (opens the phone camera) and "Choose photos" (gallery / files). */
export function PhotoButtons({
  onFiles,
  disabled,
  size = "sm",
}: {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
  size?: "sm" | "md";
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef<HTMLInputElement>(null);

  const handle = (input: HTMLInputElement) => {
    const files = Array.from(input.files ?? []);
    input.value = "";
    if (files.length) onFiles(files);
  };

  return (
    <div className="flex flex-wrap gap-2">
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handle(e.currentTarget)}
      />
      <input
        ref={filesRef}
        type="file"
        accept={PHOTO_ACCEPT}
        multiple
        className="hidden"
        onChange={(e) => handle(e.currentTarget)}
      />
      <Button type="button" size={size} variant="secondary" disabled={disabled} onClick={() => cameraRef.current?.click()}>
        📷 Take photo
      </Button>
      <Button type="button" size={size} variant="secondary" disabled={disabled} onClick={() => filesRef.current?.click()}>
        Choose photos
      </Button>
    </div>
  );
}
