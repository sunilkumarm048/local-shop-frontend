'use client';

import { useCallback, useRef, useState } from 'react';
import { Loader2, ImagePlus, X, AlertCircle, Link as LinkIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  uploadFile,
  validateFile,
  isCloudinaryConfigured,
  type UploadKind,
  type UploadProgress,
} from '@/lib/cloudinary';

/**
 * Reusable image uploader with two modes:
 *
 *   Cloudinary mode (env vars present): drag-drop or click to pick → upload
 *     directly to Cloudinary → set URL via onChange
 *
 *   Fallback mode (env vars missing): URL paste input, so the app still
 *     works even if env vars roll out after the code deploy
 *
 * The decision is made once at module load — `isCloudinaryConfigured()` reads
 * Next's compile-time `process.env.NEXT_PUBLIC_*`. Add the env vars in
 * Vercel and redeploy to switch modes.
 *
 * `value` is the current URL (controlled). `onChange(url)` fires when a new
 * URL is available (post-upload or post-paste). Pass empty string '' to clear.
 */

interface Props {
  value: string;
  onChange: (url: string) => void;
  kind: UploadKind;
  /** Optional label shown above the dropzone */
  label?: string;
  /** Override default 5 MB cap */
  maxBytes?: number;
  /** Layout: small thumbnail (default) or full-width banner */
  variant?: 'thumbnail' | 'banner';
  /** Disable both upload and URL input */
  disabled?: boolean;
}

export function ImageUploader({
  value,
  onChange,
  kind,
  label,
  maxBytes,
  variant = 'thumbnail',
  disabled = false,
}: Props) {
  const cloudinaryEnabled = isCloudinaryConfigured();
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const startUpload = useCallback(
    async (file: File) => {
      setError(null);
      const validationError = validateFile(file, { maxBytes });
      if (validationError) {
        setError(validationError);
        return;
      }
      setProgress({ loaded: 0, total: file.size, percent: 0 });
      try {
        const result = await uploadFile(file, kind, setProgress);
        onChange(result.secureUrl);
      } catch (err) {
        setError((err as Error).message || 'Upload failed');
      } finally {
        setProgress(null);
      }
    },
    [kind, onChange, maxBytes]
  );

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragOver(false);
      if (disabled || progress) return;
      const file = e.dataTransfer.files?.[0];
      if (file) startUpload(file);
    },
    [startUpload, disabled, progress]
  );

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) startUpload(file);
      // Reset value so picking the same file again still fires onChange
      e.target.value = '';
    },
    [startUpload]
  );

  function clear() {
    onChange('');
    setError(null);
  }

  const dimClass = variant === 'banner' ? 'h-40' : 'h-28';
  const showImagePreview = value && value.trim() !== '';
  const sizeMb = ((maxBytes ?? 5 * 1024 * 1024) / 1024 / 1024).toFixed(0);

  return (
    <div className="space-y-2">
      {label && (
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      )}

      {/* Preview if we have a URL */}
      {showImagePreview && (
        <div className="relative inline-block group">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt="Uploaded preview"
            className={`${dimClass} rounded-md border object-cover bg-muted`}
          />
          {!disabled && (
            <button
              type="button"
              onClick={clear}
              aria-label="Remove image"
              className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-destructive text-white flex items-center justify-center shadow-md hover:bg-destructive/90"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Upload zone — only if Cloudinary is enabled */}
      {cloudinaryEnabled && !showUrlInput && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            if (!disabled && !progress) setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => !disabled && !progress && fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-md ${dimClass} flex flex-col items-center justify-center text-sm cursor-pointer transition-colors ${
            dragOver
              ? 'border-brand-green bg-brand-greenLight/30'
              : 'border-muted-foreground/20 hover:border-muted-foreground/40 bg-muted/20'
          } ${disabled || progress ? 'opacity-60 cursor-not-allowed' : ''}`}
        >
          {progress ? (
            <div className="w-full px-6 space-y-2">
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Uploading… {progress.percent}%
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand-green transition-all duration-100"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
            </div>
          ) : (
            <>
              <ImagePlus className="h-6 w-6 text-muted-foreground mb-1" />
              <span className="text-xs font-medium">
                {showImagePreview ? 'Replace image' : 'Click or drop an image'}
              </span>
              <span className="text-[10px] text-muted-foreground mt-0.5">
                JPG / PNG / WebP, up to {sizeMb} MB
              </span>
            </>
          )}
        </div>
      )}

      {/* URL fallback — either env vars missing, or user clicked "paste URL" */}
      {(!cloudinaryEnabled || showUrlInput) && (
        <div className="space-y-1">
          <input
            type="url"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="https://…"
            disabled={disabled}
            className="w-full px-3 py-2 border rounded-md text-sm"
          />
          {!cloudinaryEnabled && (
            <p className="text-[10px] text-muted-foreground">
              Image upload is not configured. Paste a public image URL instead.
            </p>
          )}
        </div>
      )}

      {/* Toggle URL paste fallback (only if Cloudinary works) */}
      {cloudinaryEnabled && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-muted-foreground"
          onClick={() => setShowUrlInput((s) => !s)}
        >
          <LinkIcon className="h-3 w-3 mr-1" />
          {showUrlInput ? 'Hide URL input' : 'Or paste a URL'}
        </Button>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={onFileChange}
        className="hidden"
      />

      {error && (
        <div className="flex items-start gap-1.5 text-xs text-destructive bg-destructive/10 rounded px-2 py-1.5">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
