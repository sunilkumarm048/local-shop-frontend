import { api } from './api';
import type { Shop } from './shops';

export interface Review {
  _id: string;
  shop: string;
  customer: string;
  customerName?: string;
  rating: number;
  comment: string;
  photos: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ReviewsResponse {
  reviews: Review[];
  total: number;
  /** The caller's own review, if logged in and they have one. */
  mine: Review | null;
}

export async function fetchReviews(
  shopId: string,
  token?: string | null,
  params: { limit?: number; skip?: number } = {}
) {
  const search = new URLSearchParams();
  if (params.limit) search.set('limit', String(params.limit));
  if (params.skip) search.set('skip', String(params.skip));
  const qs = search.toString();
  return api<ReviewsResponse>(
    `/shops/${shopId}/reviews${qs ? `?${qs}` : ''}`,
    { token }
  );
}

/** Whether the logged-in customer is allowed to review this shop. */
export async function canReview(shopId: string, token: string) {
  return api<{ canReview: boolean; reason: string }>(
    `/shops/${shopId}/reviews/can`,
    { token }
  );
}

/** Create or edit (upsert) the caller's review. */
export async function submitReview(
  shopId: string,
  token: string,
  body: { rating: number; comment?: string; photos?: string[] }
) {
  return api<{ review: Review }>(`/shops/${shopId}/reviews`, {
    method: 'PUT',
    token,
    body,
  });
}

/** Delete the caller's own review. */
export async function deleteReview(shopId: string, token: string) {
  return api<{ ok: boolean }>(`/shops/${shopId}/reviews`, {
    method: 'DELETE',
    token,
  });
}

/** Owner: replace the shop's photo gallery with the given array of URLs. */
export async function updateGallery(
  shopId: string,
  token: string,
  gallery: string[]
) {
  return api<{ shop: Shop }>(`/shops/${shopId}/gallery`, {
    method: 'PUT',
    token,
    body: { gallery },
  });
}
