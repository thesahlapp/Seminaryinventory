"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type GalleryPhoto = { id: string; url: string | null; caption: string | null };

/** Swipeable photos; tap one to view full screen (also swipeable). */
export function PhotoGallery({ photos, alt }: { photos: GalleryPhoto[]; alt: string }) {
  const [index, setIndex] = useState(0);
  const [fullscreen, setFullscreen] = useState<number | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  const goTo = (i: number) => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollTo({ left: i * track.clientWidth, behavior: "smooth" });
  };

  if (photos.length === 0) return null;

  return (
    <div>
      <div className="relative">
        <div
          ref={trackRef}
          onScroll={(e) => {
            const el = e.currentTarget;
            setIndex(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
          }}
          className="flex snap-x snap-mandatory overflow-x-auto rounded-lg bg-cream-200 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {photos.map((photo, i) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => setFullscreen(i)}
              className="relative w-full shrink-0 snap-center"
              aria-label={`View photo ${i + 1} of ${photos.length} full screen`}
            >
              {photo.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo.url} alt={photo.caption ? `${alt} — ${photo.caption}` : alt} className="aspect-square w-full object-contain" loading={i === 0 ? "eager" : "lazy"} />
              ) : (
                <div className="flex aspect-square items-center justify-center text-sm text-brand-400">Photo unavailable</div>
              )}
              {photo.caption && (
                <span className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-0.5 text-xs font-medium text-white">{photo.caption}</span>
              )}
            </button>
          ))}
        </div>
        {photos.length > 1 && (
          <>
            <ArrowButton side="left" disabled={index === 0} onClick={() => goTo(index - 1)} />
            <ArrowButton side="right" disabled={index === photos.length - 1} onClick={() => goTo(index + 1)} />
          </>
        )}
      </div>
      {photos.length > 1 && (
        <div className="mt-2 flex justify-center gap-1.5" aria-hidden>
          {photos.map((p, i) => (
            <span key={p.id} className={`size-2 rounded-full ${i === index ? "bg-brand-500" : "bg-cream-400"}`} />
          ))}
        </div>
      )}
      {fullscreen !== null && (
        <Lightbox photos={photos} start={fullscreen} alt={alt} onClose={() => setFullscreen(null)} />
      )}
    </div>
  );
}

function ArrowButton({ side, disabled, onClick }: { side: "left" | "right"; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={side === "left" ? "Previous photo" : "Next photo"}
      className={`absolute top-1/2 hidden size-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-lg text-white disabled:opacity-0 sm:flex ${
        side === "left" ? "left-2" : "right-2"
      }`}
    >
      {side === "left" ? "‹" : "›"}
    </button>
  );
}

function Lightbox({ photos, start, alt, onClose }: { photos: GalleryPhoto[]; start: number; alt: string; onClose: () => void }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(start);

  useEffect(() => {
    const track = trackRef.current;
    if (track) track.scrollLeft = start * track.clientWidth;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        const el = trackRef.current;
        if (!el) return;
        el.scrollBy({ left: (e.key === "ArrowRight" ? 1 : -1) * el.clientWidth, behavior: "smooth" });
      }
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [start, onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[60] flex flex-col bg-black" role="dialog" aria-modal="true" aria-label={`${alt} photos`}>
      <div className="flex items-center justify-between px-4 pb-2 pt-[calc(env(safe-area-inset-top)+0.5rem)] text-white">
        <span className="text-sm">
          {index + 1} / {photos.length}
          {photos[index]?.caption && <span className="ml-2 text-white/70">{photos[index].caption}</span>}
        </span>
        <button type="button" onClick={onClose} className="rounded-full bg-white/15 px-3 py-1.5 text-sm" aria-label="Close">
          ✕ Close
        </button>
      </div>
      <div
        ref={trackRef}
        onScroll={(e) => setIndex(Math.round(e.currentTarget.scrollLeft / Math.max(1, e.currentTarget.clientWidth)))}
        className="flex flex-1 snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {photos.map((photo) => (
          <div key={photo.id} className="flex h-full w-full shrink-0 snap-center items-center justify-center p-2">
            {photo.url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo.url} alt={photo.caption ?? alt} className="max-h-full max-w-full object-contain" />
            )}
          </div>
        ))}
      </div>
      <div className="h-[env(safe-area-inset-bottom)]" />
    </div>,
    document.body,
  );
}
