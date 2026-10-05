"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight, Expand, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type GalleryImage = { position: number; url: string };

export function VehicleGallery({
  images,
  label,
}: {
  images: GalleryImage[];
  label: string;
}) {
  const ordered = [...images].sort((a, b) => a.position - b.position);
  const [selected, setSelected] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const closeButton = useRef<HTMLButtonElement>(null);
  const touchStart = useRef<number | undefined>(undefined);
  const move = useCallback(
    (step: number) =>
      setSelected(
        (current) => (current + step + ordered.length) % ordered.length,
      ),
    [ordered.length],
  );

  useEffect(() => {
    if (!lightboxOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLightboxOpen(false);
      if (event.key === "ArrowLeft") move(-1);
      if (event.key === "ArrowRight") move(1);
    };
    window.addEventListener("keydown", keydown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", keydown);
    };
  }, [lightboxOpen, move]);

  function swipeEnd(clientX: number | undefined) {
    const start = touchStart.current;
    if (
      start !== undefined &&
      clientX !== undefined &&
      Math.abs(clientX - start) > 45
    )
      move(clientX < start ? 1 : -1);
  }

  if (!ordered.length) return null;
  const image = ordered[selected];
  const controls = ordered.length > 1;

  return (
    <>
      <div className="mx-auto w-full max-w-3xl">
        <div
          className="group relative aspect-[16/9] max-h-[27rem] overflow-hidden rounded-2xl bg-[var(--surface-subtle)]"
          onTouchStart={(event) => {
            touchStart.current = event.touches[0]?.clientX;
          }}
          onTouchEnd={(event) => swipeEnd(event.changedTouches[0]?.clientX)}
        >
          <button
            type="button"
            onClick={() => setLightboxOpen(true)}
            className="absolute inset-0 z-[1] focus:ring-2 focus:ring-[var(--focus)] focus:outline-none focus:ring-inset"
            aria-label={`Visa större bild av ${label}`}
          >
            <span className="sr-only">Öppna bildvisning</span>
          </button>
          <Image
            src={`${image.url}?width=960`}
            alt={`${label}, bild ${selected + 1} av ${ordered.length}`}
            fill
            unoptimized
            priority
            sizes="(min-width: 1024px) 48rem, 100vw"
            className="object-cover"
          />
          <span className="pointer-events-none absolute top-3 right-3 z-[2] flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white">
            <Expand size={17} />
          </span>
          {controls ? (
            <>
              <button
                type="button"
                onClick={() => move(-1)}
                aria-label="Föregående bild"
                className="absolute top-1/2 left-3 z-[3] flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white shadow hover:bg-black/75"
              >
                <ChevronLeft aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => move(1)}
                aria-label="Nästa bild"
                className="absolute top-1/2 right-3 z-[3] flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white shadow hover:bg-black/75"
              >
                <ChevronRight aria-hidden="true" />
              </button>
            </>
          ) : null}
          <span
            aria-live="polite"
            className="absolute bottom-3 left-1/2 z-[2] -translate-x-1/2 rounded-full bg-black/65 px-3 py-1 text-xs font-semibold text-white"
          >
            {selected + 1} / {ordered.length}
          </span>
        </div>
      </div>
      {lightboxOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Bildvisning för ${label}`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-3 sm:p-8"
          onTouchStart={(event) => {
            touchStart.current = event.touches[0]?.clientX;
          }}
          onTouchEnd={(event) => swipeEnd(event.changedTouches[0]?.clientX)}
        >
          <button
            ref={closeButton}
            type="button"
            onClick={() => setLightboxOpen(false)}
            aria-label="Stäng bildvisning"
            className="absolute top-4 right-4 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25"
          >
            <X aria-hidden="true" />
          </button>
          {controls ? (
            <>
              <button
                type="button"
                onClick={() => move(-1)}
                aria-label="Föregående bild i stor visning"
                className="absolute left-3 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 sm:left-6"
              >
                <ChevronLeft aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => move(1)}
                aria-label="Nästa bild i stor visning"
                className="absolute right-3 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 sm:right-6"
              >
                <ChevronRight aria-hidden="true" />
              </button>
            </>
          ) : null}
          <div className="relative h-[82vh] w-[min(90vw,78rem)]">
            <Image
              src={image.url}
              alt={`${label}, bild ${selected + 1} av ${ordered.length}`}
              fill
              unoptimized
              sizes="95vw"
              className="object-contain"
            />
          </div>
          <p
            aria-live="polite"
            className="absolute bottom-4 rounded-full bg-black/60 px-3 py-1 text-sm font-semibold text-white"
          >
            {selected + 1} / {ordered.length}
          </p>
        </div>
      ) : null}
    </>
  );
}
