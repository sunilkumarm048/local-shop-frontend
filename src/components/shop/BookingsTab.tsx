'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Loader2,
  Phone,
  MapPin,
  User,
  Clock,
  Calendar,
  Navigation,
  Check,
  X,
} from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api';
import {
  initNotificationSound,
  startShopOrderAlert,
  stopShopOrderAlert,
} from '@/lib/notificationSound';
import { ensurePushSubscribed } from '@/lib/push';
import { useAuth } from '@/stores/auth';
import type { Shop } from '@/lib/shops';

/** Great-circle distance in km between two [lng, lat] points (haversine). */
function distanceKm(
  a: [number, number] | undefined,
  b: [number, number] | undefined
): number | null {
  if (!a || !b) return null;
  const [lng1, lat1] = a;
  const [lng2, lat2] = b;
  if ([lng1, lat1, lng2, lat2].some((n) => typeof n !== 'number' || Number.isNaN(n))) {
    return null;
  }
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371; // km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m away`;
  return `${km.toFixed(1)} km away`;
}
import {
  fetchIncomingBookings,
  updateBookingStatus,
  type Booking,
  type BookingStatusUpdate,
} from '@/lib/booking';

const STATUS_LABEL: Record<string, string> = {
  requested: 'New request',
  accepted: 'Accepted',
  scheduled: 'Scheduled',
  on_the_way: 'On the way',
  in_progress: 'In progress',
  completed: 'Completed',
  declined: 'Declined',
  cancelled: 'Cancelled',
};

const STATUS_STYLE: Record<string, string> = {
  requested: 'bg-amber-100 text-amber-800',
  accepted: 'bg-blue-100 text-blue-800',
  scheduled: 'bg-blue-100 text-blue-800',
  on_the_way: 'bg-indigo-100 text-indigo-800',
  in_progress: 'bg-indigo-100 text-indigo-800',
  completed: 'bg-green-100 text-green-800',
  declined: 'bg-gray-100 text-gray-600',
  cancelled: 'bg-gray-100 text-gray-600',
};

// What the provider can do next from each status (label + target status).
const NEXT_ACTIONS: Record<string, Array<{ label: string; to: BookingStatusUpdate['status'] }>> = {
  accepted: [{ label: 'On the way', to: 'on_the_way' }],
  scheduled: [{ label: 'On the way', to: 'on_the_way' }],
  on_the_way: [{ label: 'Start work', to: 'in_progress' }],
  in_progress: [{ label: 'Mark complete', to: 'completed' }],
};

const FILTERS = [
  { id: 'active', label: 'Active' },
  { id: 'requested', label: 'New' },
  { id: 'completed', label: 'Completed' },
  { id: 'all', label: 'All' },
];

const ACTIVE_STATUSES = ['accepted', 'scheduled', 'on_the_way', 'in_progress'];

export function BookingsTab({ shop }: { shop?: Shop }) {
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('requested');
  const [busyId, setBusyId] = useState<string | null>(null);
  const busyIdRef = useRef<string | null>(null);
  useEffect(() => {
    busyIdRef.current = busyId;
  }, [busyId]);

  // Remember how many "new" (requested) bookings we last saw, so a poll that
  // brings in more can ring the shop alert. Starts null so the first load
  // (which may already contain requests) doesn't ring on page open.
  const prevRequestedRef = useRef<number | null>(null);

  async function load() {
    setError(null);
    try {
      const list = await fetchIncomingBookings();
      const requestedCount = list.filter((b) => b.status === 'requested').length;
      if (
        prevRequestedRef.current !== null &&
        requestedCount > prevRequestedRef.current
      ) {
        // Ring like an incoming call — loops until Accept/Decline stops it.
        startShopOrderAlert();
      }
      if (requestedCount === 0) {
        // Nothing pending anymore (e.g. customer cancelled) — go quiet.
        stopShopOrderAlert();
      }
      prevRequestedRef.current = requestedCount;
      setBookings(list);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load bookings.');
    }
  }

  const token = useAuth((s) => s.token);

  useEffect(() => {
    initNotificationSound();
    // If notification permission was granted before but the subscription got
    // lost (SW update / PWA reinstall), quietly restore it — no prompt.
    if (token) ensurePushSubscribed(token);
    load();
    // Auto-refresh so new requests and status changes appear on their own.
    const interval = setInterval(() => {
      if (!document.hidden && !busyIdRef.current) load();
    }, 15000);
    return () => {
      clearInterval(interval);
      stopShopOrderAlert(); // never leave a ring playing after leaving the tab
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function act(id: string, update: BookingStatusUpdate) {
    // Accept or Decline answers the alert — silence the ring immediately,
    // before the network round-trip, so the tap feels instant.
    if (update.status === 'accepted' || update.status === 'declined') {
      stopShopOrderAlert();
    }
    setBusyId(id);
    setError(null);
    try {
      const updated = await updateBookingStatus(id, update);
      setBookings((prev) =>
        prev ? prev.map((b) => (b._id === id ? { ...b, ...updated } : b)) : prev
      );
      // When the provider accepts a new request, jump to the Active view so the
      // job they just took is right in front of them (it leaves the New list).
      if (update.status === 'accepted') {
        setFilter('active');
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update the booking.');
    } finally {
      setBusyId(null);
    }
  }

  const visible =
    bookings == null
      ? null
      : bookings.filter((b) => {
          if (filter === 'all') return true;
          if (filter === 'active') return ACTIVE_STATUSES.includes(b.status);
          if (filter === 'requested') return b.status === 'requested';
          if (filter === 'completed') return b.status === 'completed';
          return true;
        });

  if (bookings == null && !error) {
    return (
      <div className="py-10 flex items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Loading bookings…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-lg font-semibold">Service bookings</h2>
        <div className="flex gap-1 bg-muted p-1 rounded-lg">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                filter === f.id
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {visible && visible.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No bookings here yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {visible?.map((b) => (
            <BookingCard
              key={b._id}
              booking={b}
              busy={busyId === b._id}
              shopCoords={shop?.location?.coordinates}
              onAct={(u) => act(b._id, u)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function BookingCard({
  booking,
  busy,
  shopCoords,
  onAct,
}: {
  booking: Booking;
  busy: boolean;
  shopCoords?: [number, number];
  onAct: (u: BookingStatusUpdate) => void;
}) {
  const cust =
    typeof booking.customer === 'object' && booking.customer ? booking.customer : null;
  const addr = booking.address;
  const addrLine = addr
    ? [addr.line1, addr.line2, addr.city, addr.pincode].filter(Boolean).join(', ')
    : '';
  const coords = addr?.location?.coordinates;
  const dist = distanceKm(shopCoords, coords);
  const directionsUrl = coords
    ? `https://www.google.com/maps/dir/?api=1&destination=${coords[1]},${coords[0]}&travelmode=driving`
    : addrLine
      ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addrLine)}&travelmode=driving`
      : null;

  const when = booking.requestNow
    ? 'As soon as possible'
    : booking.scheduledDate
      ? `${new Date(booking.scheduledDate).toLocaleDateString('en-IN', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
        })}${booking.scheduledSlot ? ` · ${booking.scheduledSlot}` : ''}`
      : booking.scheduledSlot || '—';

  const nextActions = NEXT_ACTIONS[booking.status] || [];

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold text-sm">{booking.serviceName}</p>
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
              <User className="h-3 w-3" />
              {booking.contactName || cust?.name || 'Customer'}
            </p>
          </div>
          <span
            className={`shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full ${
              STATUS_STYLE[booking.status] || 'bg-gray-100 text-gray-600'
            }`}
          >
            {STATUS_LABEL[booking.status] || booking.status}
          </span>
        </div>

        <div className="text-xs text-muted-foreground space-y-1">
          <p className="flex items-center gap-1.5">
            {booking.requestNow ? <Clock className="h-3.5 w-3.5" /> : <Calendar className="h-3.5 w-3.5" />}
            {when}
          </p>
          {(booking.contactPhone || cust?.phone) && (
            <p className="flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5" />
              <a href={`tel:${booking.contactPhone || cust?.phone}`} className="text-primary">
                {booking.contactPhone || cust?.phone}
              </a>
            </p>
          )}
          {addrLine && (
            <p className="flex items-start gap-1.5">
              <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>
                {addrLine}
                {dist != null && (
                  <span className="ml-1.5 inline-block font-semibold text-foreground">
                    · {formatDistance(dist)}
                  </span>
                )}
              </span>
            </p>
          )}
          {!addrLine && dist != null && (
            <p className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span className="font-semibold text-foreground">{formatDistance(dist)}</span>
            </p>
          )}
          {booking.notes && (
            <p className="text-muted-foreground/90 bg-muted rounded px-2 py-1.5 mt-1">
              {booking.notes}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2 pt-1">
          {booking.status === 'requested' && (
            <>
              <Button size="sm" disabled={busy} onClick={() => onAct({ status: 'accepted' })}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
                Accept
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => onAct({ status: 'declined' })}
                className="text-destructive hover:text-destructive"
              >
                <X className="h-4 w-4 mr-1" />
                Decline
              </Button>
            </>
          )}

          {nextActions.map((a) => (
            <Button key={a.to} size="sm" disabled={busy} onClick={() => onAct({ status: a.to })}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              {a.label}
            </Button>
          ))}

          {/* Directions appears once a job is accepted and there's an address */}
          {directionsUrl && ['accepted', 'scheduled', 'on_the_way', 'in_progress'].includes(booking.status) && (
            <a
              href={directionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-input text-xs font-medium hover:bg-accent"
            >
              <Navigation className="h-3.5 w-3.5" />
              Directions
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
