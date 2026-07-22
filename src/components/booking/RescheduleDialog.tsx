'use client';

/**
 * RescheduleDialog — "Change slot" for an existing booking. The same dialog
 * serves both sides: the customer (from My Bookings) and the provider (from
 * the Bookings tab). Picks a free slot via SlotPicker, PATCHes
 * /bookings/:id/reschedule, and the backend notifies the other party.
 */

import { useState } from 'react';
import { X, Loader2, CalendarClock } from 'lucide-react';

import { SlotPicker } from '@/components/booking/SlotPicker';
import { rescheduleBooking, type Booking } from '@/lib/booking';
import { ApiError } from '@/lib/api';

export function RescheduleDialog({
  booking,
  providerId,
  onClose,
  onDone,
}: {
  booking: Booking;
  /** Provider (shop) id — availability is fetched for this provider. */
  providerId: string;
  onClose: () => void;
  /** Called with the updated booking after a successful reschedule. */
  onDone: (updated: Booking) => void;
}) {
  const [dateIso, setDateIso] = useState('');
  const [slot, setSlot] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!dateIso || !slot) {
      setError('Pick a date and a free slot.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const updated = await rescheduleBooking(booking._id, dateIso, slot);
      onDone(updated);
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not change the slot. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/50 flex items-end sm:items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-2xl shadow-xl w-full max-w-md p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="font-bold text-base flex items-center gap-2">
              <CalendarClock className="h-4 w-4" /> Change slot
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {booking.serviceName}
              {booking.scheduledSlot
                ? ` — currently ${booking.scheduledDate?.slice(0, 10)}, ${booking.scheduledSlot}`
                : ''}
            </div>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <SlotPicker
          providerId={providerId}
          dateIso={dateIso}
          slot={slot}
          onChange={(d, s) => {
            setDateIso(d);
            setSlot(s);
            setError(null);
          }}
        />

        {error && <div className="text-xs text-red-600 font-medium">{error}</div>}

        <button
          type="button"
          onClick={save}
          disabled={busy || !slot}
          className="w-full inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground font-bold text-sm py-2.5 rounded-lg disabled:opacity-50"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          Confirm new slot
        </button>
      </div>
    </div>
  );
}
