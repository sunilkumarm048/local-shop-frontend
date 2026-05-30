'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

interface Props {
  photos: string[];
}

/**
 * Owner-curated photo gallery shown on the customer shop-detail page.
 * Horizontal strip of thumbnails; tapping one opens a simple lightbox.
 * Renders nothing if the shop has no gallery photos.
 */
export function ShopGallery({ photos }: Props) {
  const [active, setActive] = useState<string | null>(null);

  if (!photos || photos.length === 0) return null;

  return (
    <section className="space-y-2">
      <h2 className="text-base font-bold tracking-tight">Photos</h2>
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-none">
        {photos.map((url, i) => (
          <button
            key={i}
            onClick={() => setActive(url)}
            className="shrink-0 rounded-lg overflow-hidden border"
            aria-label={`View photo ${i + 1}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt=""
              loading="lazy"
              className="h-32 w-32 object-cover hover:opacity-90 transition"
            />
          </button>
        ))}
      </div>

      {/* Lightbox */}
      {active && (
        <div
          onClick={() => setActive(null)}
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
        >
          <button
            onClick={() => setActive(null)}
            aria-label="Close"
            className="absolute top-4 right-4 h-10 w-10 rounded-full bg-white/20 text-white flex items-center justify-center"
          >
            <X className="h-5 w-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={active}
            alt=""
            className="max-h-[85vh] max-w-full rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </section>
  );
}
