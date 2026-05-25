'use client';

import { ImageUploader } from './ImageUploader';

/**
 * Thin wrapper around ImageUploader for partner documents (DL / Aadhaar / RC).
 *
 * Differences from product/shop images:
 *   - Fixed 'document' kind (Cloudinary folder = local-shop/documents)
 *   - Larger size cap — 8 MB — since people often photograph IDs without compression
 *   - "banner" variant so the doc preview is large enough to read
 *
 * Future: if we add proper PDF support, this is where we'd relax validation
 * to allow application/pdf.
 */

interface Props {
  value: string;
  onChange: (url: string) => void;
  label: string;
  disabled?: boolean;
}

export function DocumentUploader({ value, onChange, label, disabled }: Props) {
  return (
    <ImageUploader
      value={value}
      onChange={onChange}
      kind="document"
      label={label}
      maxBytes={8 * 1024 * 1024}
      variant="banner"
      disabled={disabled}
    />
  );
}
