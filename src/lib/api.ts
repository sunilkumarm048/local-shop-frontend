/**
 * Tiny fetch wrapper for the local-shop-api backend.
 * Reads JWT from the auth store (set on login/OTP verify).
 * Throws ApiError with status + parsed body on non-2xx.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

type ReqOptions = Omit<RequestInit, 'body'> & {
  body?: unknown;
  token?: string | null;
};

export async function api<T = unknown>(path: string, options: ReqOptions = {}): Promise<T> {
  const { body, token, headers, ...rest } = options;

  const finalHeaders: Record<string, string> = {
    Accept: 'application/json',
    ...(headers as Record<string, string>),
  };
  if (body !== undefined) finalHeaders['Content-Type'] = 'application/json';
  if (token) finalHeaders.Authorization = `Bearer ${token}`;

  // Safety net: never let a request hang forever (e.g. a stalled server keeping
  // the connection open). Abort after 30s so the UI can surface an error
  // instead of spinning indefinitely. Render free-tier cold starts can take
  // ~50s, so this is generous; bump if you stay on free tier.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...rest,
      headers: finalHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials: 'include',
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiError(0, 'The server took too long to respond. Please try again.', null);
    }
    throw new ApiError(0, 'Network error — check your connection and try again.', null);
  }
  clearTimeout(timeout);

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const parsed = isJson ? await res.json().catch(() => null) : await res.text();

  if (!res.ok) {
    const msg =
      (isJson && (parsed as { error?: string })?.error) ||
      `Request failed with status ${res.status}`;
    throw new ApiError(res.status, msg, parsed);
  }

  return parsed as T;
}
