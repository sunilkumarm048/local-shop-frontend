'use client';

import { useState } from 'react';
import { Loader2, X, Check } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ImageUploader } from '@/components/uploads/ImageUploader';
import { updateGallery } from '@/lib/reviews';
import { useAuth } from '@/stores/auth';
import { ApiError } from '@/lib/api';
import type { Shop } from '@/lib/shops';

interface Props {
  shop: Shop;
  onUpdated: (shop: Shop) => void;
}

const MAX_PHOTOS = 12;

/**
 * Owner-side photo gallery manager, shown on the Storefront tab.
 * The owner adds/removes photos; "Save gallery" persists the full array.
 * These photos appear on the customer-facing shop detail page to attract
 * customers — separate from product images and review photos.
 */
export function GalleryManager({ shop, onUpdated }: Props) {
  const token = useAuth((s) => s.token);
  const [photos, setPhotos] = useState<string[]>(shop.gallery || []);
  const [pending, setPending] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const dirty =
    JSON.stringify(photos) !== JSON.stringify(shop.gallery || []);

  async function save() {
    if (!token) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const { shop: updated } = await updateGallery(shop._id, token, photos);
      onUpdated(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Could not save the gallery.'
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Photo gallery</CardTitle>
        <p className="text-sm text-muted-foreground">
          Add photos of your shop, work, or products. Customers see these on
          your shop page. ({photos.length}/{MAX_PHOTOS})
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {photos.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {photos.map((url, i) => (
              <div key={i} className="relative aspect-square">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt=""
                  className="w-full h-full rounded-md object-cover border"
                />
                <button
                  type="button"
                  onClick={() => setPhotos(photos.filter((_, j) => j !== i))}
                  aria-label="Remove photo"
                  className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-destructive text-white flex items-center justify-center shadow"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {photos.length < MAX_PHOTOS && (
          <ImageUploader
            value={pending}
            onChange={(url) => {
              if (url) {
                setPhotos((p) => [...p, url].slice(0, MAX_PHOTOS));
                setPending('');
              }
            }}
            kind="shop"
            variant="banner"
          />
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex items-center gap-3">
          <Button onClick={save} disabled={saving || !dirty}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save gallery
          </Button>
          {saved && (
            <span className="inline-flex items-center gap-1 text-sm text-primary font-medium">
              <Check className="h-4 w-4" /> Saved
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
