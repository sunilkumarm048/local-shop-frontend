'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Loader2,
  ArrowLeft,
  Phone,
  Clock,
  Calendar,
  Check,
  X,
  CalendarPlus,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ApiError } from '@/lib/api';
import { fetchMyBookings, cancelBooking, type Booking } from '@/lib/booking';
import { useAuth } from '@/stores/auth';

// The happy-path stages a booking moves through, in order. Used to draw the
// progress tracker. Terminal states (declined/cancelled) are shown separately.
const FLOW = [
  { id: 'requested', label: 'Requested' },
  { id: 'accepted', label: 'Accepted' },
  { id: 'scheduled', label: 'Scheduled' },
  { id: 'on_the_way', label: 'On the way' },
  { id: 'in_progress', label: 'In progress' },
  { id: 'completed', label: 'Completed' },
];

const TERMINAL = ['declined', 'cancelled'];

function providerOf(b: Booking) {
  return typeof b.provider === 'object' && b.provider ? b.provider : null;
}

export default function MyBookingsPage() {
  const router = useRouter();
  const token = useAuth((s) => s.token);

  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const list = await fetchMyBookings();
      setBookings(list);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load your bookings.');
    }
  }

  useEffect(() => {
    if (!token) {
      router.replace('/login?next=/customer/bookings');
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function cancel(id: string) {
    setBusyId(id);
    setError(null);
    try {
      const updated = await cancelBooking(id);
      setBookings((prev) =>
        prev ? prev.map((b) => (b._id === id ? { ...b, ...updated } : b)) : prev
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not cancel.');
    } finally {
      setBusyId(null);
    }
  }

  if (!token) return null;

  return (
    <div className="container max-w-2xl py-6 space-y-5">
      <div className="flex items-center gap-2">
        <Link href="/customer" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-semibold">My bookings</h1>
      </div>

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {bookings == null && !error ? (
        <div className="py-10 flex items-center justify-center text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          Loading…
        </div>
      ) : bookings && bookings.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <CalendarPlus className="h-8 w-8 text-muted-foreground/40 mx-auto" />
            <p className="text-sm text-muted-foreground">
              You haven&apos;t booked any services yet.
            </p>
            <Button asChild variant="outline">
              <Link href="/customer">Find a service</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {bookings?.map((b) => (
            <BookingTracker
              key={b._id}
              booking={b}
              busy={busyId === b._id}
              onCancel={() => cancel(b._id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function BookingTracker({
  booking,
  busy,
  onCancel,
}: {
  booking: Booking;
  busy: boolean;
  onCancel: () => void;
}) {
  const provider = providerOf(booking);
  const isTerminal = TERMINAL.includes(booking.status);
  const currentIndex = FLOW.findIndex((s) => s.id === booking.status);

  const when = booking.requestNow
    ? 'As soon as possible'
    : booking.scheduledDate
      ? `${new Date(booking.scheduledDate).toLocaleDateString('en-IN', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
        })}${booking.scheduledSlot ? ` · ${booking.scheduledSlot}` : ''}`
      : booking.scheduledSlot || '—';

  const canCancel = !['completed', 'cancelled', 'declined'].includes(booking.status);

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold text-sm">{booking.serviceName}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {provider?.name || 'Service provider'}
            </p>
          </div>
          <p className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
            {booking.requestNow ? <Clock className="h-3.5 w-3.5" /> : <Calendar className="h-3.5 w-3.5" />}
            {when}
          </p>
        </div>

        {/* Status display */}
        {isTerminal ? (
          <div
            className={`flex items-center gap-2 text-sm font-medium rounded-md px-3 py-2 ${
              booking.status === 'declined'
                ? 'bg-gray-100 text-gray-600'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            <X className="h-4 w-4" />
            {booking.status === 'declined'
              ? 'The provider declined this request.'
              : 'This booking was cancelled.'}
          </div>
        ) : (
          <div className="flex items-center gap-1 pt-1">
            {FLOW.map((stage, i) => {
              const reached = i <= currentIndex;
              const isLast = i === FLOW.length - 1;
              return (
                <div key={stage.id} className="flex items-center flex-1 last:flex-none">
                  <div className="flex flex-col items-center gap-1">
                    <div
                      className={`h-5 w-5 rounded-full flex items-center justify-center ${
                        reached ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {reached ? (
                        <Check className="h-3 w-3" />
                      ) : (
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      )}
                    </div>
                  </div>
                  {!isLast && (
                    <div
                      className={`h-0.5 flex-1 mx-0.5 ${
                        i < currentIndex ? 'bg-primary' : 'bg-muted'
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
        {!isTerminal && (
          <p className="text-xs font-medium text-primary -mt-1">
            {FLOW[currentIndex]?.label || booking.status}
          </p>
        )}

        {/* Contact + actions */}
        <div className="flex flex-wrap gap-2 pt-1">
          {provider?.phone && (
            <a
              href={`tel:${provider.phone}`}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-primary text-primary text-xs font-medium hover:bg-primary/10"
            >
              <Phone className="h-3.5 w-3.5" />
              Call provider
            </a>
          )}
          {canCancel && (
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={onCancel}
              className="text-destructive hover:text-destructive"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <X className="h-4 w-4 mr-1" />}
              Cancel
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
