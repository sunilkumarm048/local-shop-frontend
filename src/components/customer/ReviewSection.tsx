'use client';

import { useEffect, useState } from 'react';
import { Star, Loader2, Pencil, Trash2, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ImageUploader } from '@/components/uploads/ImageUploader';
import { useAuth } from '@/stores/auth';
import {
  fetchReviews,
  canReview as canReviewApi,
  submitReview,
  deleteReview,
  type Review,
} from '@/lib/reviews';
import { ApiError } from '@/lib/api';

interface Props {
  shopId: string;
  /** Shown next to the average; comes from the shop doc. */
  rating: number;
  ratingCount: number;
}

/* ----------------------------------------------------------------------- */
/* Star display + interactive star picker                                   */
/* ----------------------------------------------------------------------- */

function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          style={{ width: size, height: size }}
          className={
            n <= Math.round(value)
              ? 'fill-[#f0a500] text-[#f0a500]'
              : 'text-muted-foreground/30'
          }
        />
      ))}
    </span>
  );
}

function StarPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1" role="radiogroup" aria-label="Your rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(n)}
          className="p-0.5"
        >
          <Star
            className={`h-7 w-7 transition-colors ${
              n <= (hover || value)
                ? 'fill-[#f0a500] text-[#f0a500]'
                : 'text-muted-foreground/30'
            }`}
          />
        </button>
      ))}
    </div>
  );
}

/* ----------------------------------------------------------------------- */

export function ReviewSection({ shopId, rating, ratingCount }: Props) {
  const token = useAuth((s) => s.token);
  const user = useAuth((s) => s.user);

  const [reviews, setReviews] = useState<Review[]>([]);
  const [total, setTotal] = useState(0);
  const [mine, setMine] = useState<Review | null>(null);
  const [loading, setLoading] = useState(true);
  const [eligible, setEligible] = useState<boolean | null>(null);
  const [eligibleReason, setEligibleReason] = useState<string>('');

  const [editing, setEditing] = useState(false);

  function load() {
    setLoading(true);
    fetchReviews(shopId, token)
      .then((r) => {
        setReviews(r.reviews);
        setTotal(r.total);
        setMine(r.mine);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopId, token]);

  useEffect(() => {
    if (!token) {
      setEligible(false);
      return;
    }
    canReviewApi(shopId, token)
      .then((r) => {
        setEligible(r.canReview);
        setEligibleReason(r.reason);
      })
      .catch(() => setEligible(false));
  }, [shopId, token]);

  const otherReviews = mine
    ? reviews.filter((r) => r._id !== mine._id)
    : reviews;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Ratings & Reviews</h2>
      </div>

      {/* Summary */}
      <div className="flex items-center gap-3">
        <span className="text-3xl font-bold leading-none">
          {ratingCount > 0 ? rating.toFixed(1) : '—'}
        </span>
        <div>
          <Stars value={rating} size={16} />
          <p className="text-xs text-muted-foreground mt-0.5">
            {ratingCount > 0
              ? `${ratingCount} review${ratingCount > 1 ? 's' : ''}`
              : 'No reviews yet'}
          </p>
        </div>
      </div>

      {/* Write / edit area */}
      {!token ? (
        <p className="text-sm text-muted-foreground">
          Log in to leave a review.
        </p>
      ) : editing ? (
        <ReviewForm
          shopId={shopId}
          token={token}
          existing={mine}
          onDone={() => {
            setEditing(false);
            load();
          }}
          onCancel={() => setEditing(false)}
        />
      ) : mine ? (
        <MyReviewCard
          review={mine}
          onEdit={() => setEditing(true)}
          onDelete={async () => {
            await deleteReview(shopId, token);
            setMine(null);
            load();
          }}
        />
      ) : eligible ? (
        <Button onClick={() => setEditing(true)} className="w-full sm:w-auto">
          <Pencil className="h-4 w-4 mr-2" />
          Write a review
        </Button>
      ) : eligible === false ? (
        <p className="text-sm text-muted-foreground">
          {eligibleReason === 'no_delivered_order'
            ? 'You can review this shop after your first delivered order.'
            : 'Reviews are not available for your account on this shop.'}
        </p>
      ) : null}

      {/* Review list */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : otherReviews.length === 0 && !mine ? (
        <p className="text-sm text-muted-foreground">
          Be the first to review {' '}this shop.
        </p>
      ) : (
        <div className="space-y-4">
          {otherReviews.map((r) => (
            <ReviewCard key={r._id} review={r} />
          ))}
          {total > reviews.length && (
            <p className="text-xs text-muted-foreground text-center">
              Showing {reviews.length} of {total} reviews
            </p>
          )}
        </div>
      )}
    </section>
  );
}

/* ----------------------------------------------------------------------- */

function ReviewCard({ review }: { review: Review }) {
  return (
    <div className="border-b border-border pb-4 last:border-0">
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold uppercase">
          {(review.customerName || 'C').slice(0, 1)}
        </div>
        <div>
          <p className="text-sm font-semibold leading-none">
            {review.customerName || 'Customer'}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <Stars value={review.rating} />
            <span className="text-[11px] text-muted-foreground">
              {new Date(review.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>

      {review.comment && (
        <p className="text-sm mt-2 leading-relaxed">{review.comment}</p>
      )}

      {review.photos.length > 0 && (
        <div className="flex gap-2 mt-2 overflow-x-auto">
          {review.photos.map((url, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={url}
              alt=""
              className="h-20 w-20 rounded-md object-cover border shrink-0"
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MyReviewCard({
  review,
  onEdit,
  onDelete,
}: {
  review: Review;
  onEdit: () => void;
  onDelete: () => Promise<void>;
}) {
  const [deleting, setDeleting] = useState(false);
  return (
    <div className="rounded-lg border border-primary/40 bg-[#f0fbf2] p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-primary uppercase tracking-wide">
          Your review
        </span>
        <div className="flex gap-1">
          <button
            onClick={onEdit}
            aria-label="Edit review"
            className="p-1.5 rounded-md hover:bg-white text-muted-foreground"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={async () => {
              setDeleting(true);
              try {
                await onDelete();
              } finally {
                setDeleting(false);
              }
            }}
            aria-label="Delete review"
            className="p-1.5 rounded-md hover:bg-white text-destructive"
          >
            {deleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
      <div className="mt-1.5">
        <Stars value={review.rating} size={16} />
      </div>
      {review.comment && <p className="text-sm mt-1.5">{review.comment}</p>}
      {review.photos.length > 0 && (
        <div className="flex gap-2 mt-2 overflow-x-auto">
          {review.photos.map((url, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={url}
              alt=""
              className="h-16 w-16 rounded-md object-cover border shrink-0"
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------------- */

function ReviewForm({
  shopId,
  token,
  existing,
  onDone,
  onCancel,
}: {
  shopId: string;
  token: string;
  existing: Review | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [rating, setRating] = useState(existing?.rating || 0);
  const [comment, setComment] = useState(existing?.comment || '');
  const [photos, setPhotos] = useState<string[]>(existing?.photos || []);
  const [pendingPhoto, setPendingPhoto] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (rating < 1) {
      setError('Please pick a star rating.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await submitReview(shopId, token, { rating, comment, photos });
      onDone();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Could not save your review.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div>
        <p className="text-sm font-semibold mb-1.5">Your rating</p>
        <StarPicker value={rating} onChange={setRating} />
      </div>

      <Textarea
        placeholder="Share your experience (optional)…"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={3}
      />

      <div>
        <p className="text-sm font-semibold mb-1.5">
          Add photos ({photos.length}/6)
        </p>
        {photos.length > 0 && (
          <div className="flex gap-2 mb-2 flex-wrap">
            {photos.map((url, i) => (
              <div key={i} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt=""
                  className="h-16 w-16 rounded-md object-cover border"
                />
                <button
                  type="button"
                  onClick={() => setPhotos(photos.filter((_, j) => j !== i))}
                  aria-label="Remove photo"
                  className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-white flex items-center justify-center"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        {photos.length < 6 && (
          <ImageUploader
            value={pendingPhoto}
            onChange={(url) => {
              if (url) {
                setPhotos((p) => [...p, url].slice(0, 6));
                setPendingPhoto('');
              }
            }}
            kind="document"
            variant="thumbnail"
          />
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2">
        <Button onClick={submit} disabled={submitting}>
          {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {existing ? 'Update review' : 'Post review'}
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
