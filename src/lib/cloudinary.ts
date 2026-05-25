/**
 * Cloudinary direct-upload client — unsigned flow.
 *
 * The browser POSTs the file straight to Cloudinary using an unsigned
 * upload preset (`local_shop_uploads` by default). No backend roundtrip,
 * no API secret in client code. The preset is configured in Cloudinary
 * console to constrain folder, file size, and allowed types.
 *
 * If you ever switch to a signed flow (more security, lower abuse risk),
 * the upgrade path is:
 *   1. Add `routes/uploads.js` backend that returns { signature, timestamp, apiKey }
 *   2. Replace `buildFormData` here to fetch + include those fields
 *   3. Change the preset to "Signed" in Cloudinary
 *
 * Why XMLHttpRequest instead of fetch: fetch() can't report upload progress
 * (only download progress). For large doc photos we want a real progress bar.
 */

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || '';
const UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || '';

export type UploadKind = 'product' | 'shop' | 'document' | 'proof';

/** Folder paths inside the cloudinary account, scoped per upload kind. */
const KIND_FOLDERS: Record<UploadKind, string> = {
  product: 'local-shop/products',
  shop: 'local-shop/shops',
  document: 'local-shop/documents',
  proof: 'local-shop/proofs',
};

export interface UploadResult {
  /** Use this URL — it's HTTPS, CDN-served, stable. */
  secureUrl: string;
  /** Cloudinary's internal id; needed if you ever want to delete via Admin API. */
  publicId: string;
  /** Format like 'jpg', 'png', 'webp'. */
  format: string;
  bytes: number;
  width?: number;
  height?: number;
}

export interface UploadProgress {
  loaded: number;
  total: number;
  /** 0-100 */
  percent: number;
}

/**
 * Whether Cloudinary is configured (env vars present).
 * Components use this to decide whether to render the uploader or fall back
 * to a URL paste input — so the app keeps working even if env vars roll out
 * after the code deploy.
 */
export function isCloudinaryConfigured(): boolean {
  return Boolean(CLOUD_NAME && UPLOAD_PRESET);
}

export function getCloudName(): string {
  return CLOUD_NAME;
}

/**
 * Upload a single file. Returns the final URL.
 *
 * @param file Browser File object from <input type="file"> or drop
 * @param kind Determines the Cloudinary folder (product / shop / document / proof)
 * @param onProgress Optional progress callback (0-100 percent)
 * @param signal Optional AbortSignal to cancel mid-upload
 */
export async function uploadFile(
  file: File,
  kind: UploadKind,
  onProgress?: (p: UploadProgress) => void,
  signal?: AbortSignal
): Promise<UploadResult> {
  if (!isCloudinaryConfigured()) {
    throw new Error(
      'Image upload is not configured. Set NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME and NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET in your environment.'
    );
  }

  const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;

  const form = new FormData();
  form.append('file', file);
  form.append('upload_preset', UPLOAD_PRESET);
  // Folder override is honored only if the preset's "Use asset folder as
  // public id prefix" allows it. If the preset has a folder, this concatenates.
  form.append('folder', KIND_FOLDERS[kind]);

  return new Promise<UploadResult>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress({
          loaded: e.loaded,
          total: e.total,
          percent: Math.round((e.loaded / e.total) * 100),
        });
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const json = JSON.parse(xhr.responseText);
          resolve({
            secureUrl: json.secure_url,
            publicId: json.public_id,
            format: json.format,
            bytes: json.bytes,
            width: json.width,
            height: json.height,
          });
        } catch (err) {
          reject(new Error('Could not parse Cloudinary response: ' + (err as Error).message));
        }
      } else {
        // Cloudinary errors look like {"error":{"message":"Upload preset must be whitelisted ..."}}
        let msg = `Upload failed (HTTP ${xhr.status})`;
        try {
          const json = JSON.parse(xhr.responseText);
          if (json?.error?.message) msg = json.error.message;
        } catch {
          /* keep default msg */
        }
        reject(new Error(msg));
      }
    };

    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.onabort = () => reject(new Error('Upload cancelled'));

    if (signal) {
      signal.addEventListener('abort', () => xhr.abort());
    }

    xhr.send(form);
  });
}

/**
 * Client-side validation — checks before we bother starting the upload.
 * Returns null on success, error string on failure.
 */
export function validateFile(
  file: File,
  opts: { maxBytes?: number; allowedTypes?: string[] } = {}
): string | null {
  const maxBytes = opts.maxBytes ?? 5 * 1024 * 1024; // 5 MB default
  const allowedTypes = opts.allowedTypes ?? [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
  ];

  if (file.size > maxBytes) {
    return `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max is ${(maxBytes / 1024 / 1024).toFixed(0)} MB.`;
  }
  if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
    return `File type "${file.type || 'unknown'}" not allowed. Use ${allowedTypes
      .map((t) => t.replace('image/', '').replace('application/', ''))
      .join(', ')}.`;
  }
  return null;
}
