'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Phone, MapPin, User, Store, Wrench, Search, X, Clock } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ApiError } from '@/lib/api';
import { fetchAdminBookings, type AdminBooking } from '@/lib/admin';

const STATUS_OPTIONS = [
  ['active', 'Active'],
  ['requested', 'Requested'],
  ['accepted', 'Accepted'],
  ['scheduled', 'Scheduled'],
  ['on_the_way', 'On the way'],
  ['in_progress', 'In progress'],
  ['completed', 'Completed'],
  ['declined', 'Declined'],
  ['cancelled', 'Cancelled'],
  ['all', 'All'],
] as const;

function statusVariant(
  s: string
): 'default' | 'success' | 'warning' | 'destructive' | 'secondary' {
  if (s === 'requested') return 'warning';
  if (s === 'completed') return 'success';
  if (s === 'declined' || s === 'cancelled') return 'destructive';
  if (['accepted', 'scheduled', 'on_the_way', 'in_progress'].includes(s)) return 'default';
  return 'secondary';
}

function prettyStatus(s: string): string {
  return s.replace(/_/g, ' ');
}

export function AdminBookingsTab() {
  const [status, setStatus] = useState<string>('active');
  const [bookings, setBookings] = useState<AdminBooking[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const r = await fetchAdminBookings({ status });
      setBookings(r.bookings);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Could not load bookings.');
    } finally {
      setRefreshing(false);
    }
  }, [status]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Client-side search over loaded bookings: booking id, service name,
  // provider, customer/contact name & phone, category.
  const q = search.trim().toLowerCase();
  const filtered =
    bookings == null
      ? null
      : q === ''
        ? bookings
        : bookings.filter((b) => {
            const hay = [
              b._id,
              b._id.slice(-6),
              b.serviceName,
              b.serviceCategory?.name,
              b.provider?.name,
              b.provider?.phone,
              b.customer?.name,
              b.customer?.phone,
              b.customer?.email,
              b.contactName,
              b.contactPhone,
              b.status,
            ]
              .filter(Boolean)
              .join(' ')
              .toLowerCase();
            return hay.includes(q);
          });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold">Service bookings</h2>
          <p className="text-sm text-muted-foreground">
            {filtered
              ? `${filtered.length} booking${filtered.length === 1 ? '' : 's'}${
                  q ? ` matching “${search.trim()}”` : ''
                }`
              : 'Loading…'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search id, service, provider, customer…"
              className="h-9 w-60 rounded-md border border-input bg-background pl-8 pr-8 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {STATUS_OPTIONS.map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
          <Button variant="outline" size="sm" onClick={refresh} disabled={refreshing}>
            {refreshing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Refreshing…
              </>
            ) : (
              'Refresh'
            )}
          </Button>
        </div>
      </div>

      {loadError && (
        <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
          {loadError}
        </div>
      )}

      {bookings === null ? (
        <div className="py-10 flex items-center justify-center text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          Loading…
        </div>
      ) : filtered && filtered.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {q ? `No bookings match “${search.trim()}”.` : 'No bookings match.'}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered?.map((b) => (
            <BookingRow key={b._id} booking={b} />
          ))}
        </div>
      )}
    </div>
  );
}

function BookingRow({ booking }: { booking: AdminBooking }) {
  const shortId = booking._id.slice(-6).toUpperCase();
  const [showHistory, setShowHistory] = useState(false);
  const history = booking.statusHistory ?? [];

  const schedule = booking.requestNow
    ? 'ASAP (Now)'
    : booking.scheduledDate
      ? `${new Date(booking.scheduledDate).toLocaleDateString()}${
          booking.scheduledSlot ? ` · ${booking.scheduledSlot}` : ''
        }`
      : booking.scheduledSlot || '—';

  const addr = booking.address
    ? [
        booking.address.line1,
        booking.address.line2,
        booking.address.city,
        booking.address.state,
        booking.address.pincode,
      ]
        .filter(Boolean)
        .join(', ')
    : '';

  return (
    <Card>
      <CardContent className="py-3 space-y-2">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold">#{shortId}</span>
            <Badge variant={statusVariant(booking.status)}>{prettyStatus(booking.status)}</Badge>
            {booking.serviceCategory?.name && (
              <Badge variant="secondary">
                {booking.serviceCategory.icon ? `${booking.serviceCategory.icon} ` : ''}
                {booking.serviceCategory.name}
              </Badge>
            )}
          </div>
          <div className="text-right">
            <div className="font-semibold flex items-center gap-1 justify-end">
              <Wrench className="h-3.5 w-3.5 text-muted-foreground" />
              {booking.serviceName}
            </div>
            <div className="text-[11px] text-muted-foreground flex items-center gap-1 justify-end">
              <Clock className="h-3 w-3" />
              {schedule}
            </div>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-x-3 gap-y-2 text-xs text-muted-foreground">
          {/* Provider */}
          {booking.provider && (
            <div className="space-y-0.5 min-w-0">
              <div className="flex items-center gap-1 text-foreground/80 font-medium">
                <Store className="h-3 w-3 shrink-0" />
                <span className="truncate">{booking.provider.name}</span>
              </div>
              {booking.provider.phone && (
                <a
                  href={`tel:${booking.provider.phone}`}
                  className="flex items-center gap-1 hover:text-foreground"
                >
                  <Phone className="h-3 w-3 shrink-0" />
                  <span className="truncate">{booking.provider.phone}</span>
                </a>
              )}
            </div>
          )}

          {/* Customer + service address */}
          <div className="space-y-0.5 min-w-0">
            <div className="flex items-center gap-1 text-foreground/80 font-medium">
              <User className="h-3 w-3 shrink-0" />
              <span className="truncate">
                {booking.contactName ||
                  booking.customer?.name ||
                  booking.customer?.email ||
                  'Customer'}
              </span>
            </div>
            {(booking.contactPhone || booking.customer?.phone) && (
              <a
                href={`tel:${booking.contactPhone || booking.customer?.phone}`}
                className="flex items-center gap-1 hover:text-foreground"
              >
                <Phone className="h-3 w-3 shrink-0" />
                <span className="truncate">
                  {booking.contactPhone || booking.customer?.phone}
                </span>
              </a>
            )}
            {addr && (
              <div className="flex items-start gap-1">
                <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                <span className="line-clamp-2">{addr}</span>
              </div>
            )}
          </div>
        </div>

        {booking.notes && (
          <div className="text-[11px] text-muted-foreground bg-muted/50 rounded px-2 py-1">
            Note: {booking.notes}
          </div>
        )}
        {booking.cancelReason && (
          <div className="text-[11px] text-destructive/80">
            Cancelled: {booking.cancelReason}
          </div>
        )}

        <div className="text-[10px] text-muted-foreground flex items-center gap-3 flex-wrap">
          <span>Booked: {new Date(booking.createdAt).toLocaleString()}</span>
          {booking.completedAt && (
            <span>Completed: {new Date(booking.completedAt).toLocaleString()}</span>
          )}
        </div>

        {/* Status-history timeline — the full audit trail of every status change. */}
        {history.length > 0 && (
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowHistory((v) => !v)}
              className="text-[11px] font-medium text-primary hover:underline flex items-center gap-1"
            >
              <Clock className="h-3 w-3" />
              {showHistory ? 'Hide' : 'Show'} status history ({history.length})
            </button>

            {showHistory && (
              <ol className="mt-2 border-l-2 border-muted pl-3 space-y-2">
                {history.map((h, i) => (
                  <li key={i} className="relative text-[11px]">
                    <span
                      className="absolute -left-[17px] top-1 h-2 w-2 rounded-full bg-primary ring-2 ring-background"
                      aria-hidden="true"
                    />
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={statusVariant(h.status)} className="text-[10px] py-0">
                        {prettyStatus(h.status)}
                      </Badge>
                      <span className="text-muted-foreground">
                        {new Date(h.at).toLocaleString()}
                      </span>
                    </div>
                    {h.note && (
                      <div className="text-muted-foreground mt-0.5 italic">
                        “{h.note}”
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
