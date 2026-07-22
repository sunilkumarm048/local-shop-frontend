import { api } from './api';
import { useAuth } from '@/stores/auth';

export type BookingStatus =
  | 'requested'
  | 'accepted'
  | 'scheduled'
  | 'on_the_way'
  | 'in_progress'
  | 'completed'
  | 'declined'
  | 'cancelled';

export interface Booking {
  _id: string;
  customer:
    | string
    | { _id: string; name?: string; phone?: string; avatar?: string };
  provider:
    | string
    | {
        _id: string;
        name?: string;
        logo?: string;
        phone?: string;
        location?: { type: 'Point'; coordinates: [number, number] };
      };
  serviceName: string;
  serviceCategory?: string;
  scheduledDate?: string;
  scheduledSlot?: string;
  requestNow?: boolean;
  address?: {
    label?: string;
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    pincode?: string;
    location?: { type: 'Point'; coordinates: [number, number] };
  };
  contactName?: string;
  contactPhone?: string;
  notes?: string;
  status: BookingStatus;
  statusHistory?: Array<{ status: BookingStatus; at: string; note?: string }>;
  cancelReason?: string;
  completedAt?: string;
  createdAt: string;
}

export interface CreateBookingInput {
  providerId: string;
  serviceName: string;
  serviceCategory?: string;
  requestNow?: boolean;
  scheduledDate?: string; // ISO
  scheduledSlot?: string;
  address?: {
    label?: string;
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    pincode?: string;
    location?: { lng: number; lat: number };
  };
  contactName?: string;
  contactPhone?: string;
  notes?: string;
}

function token() {
  return useAuth.getState().token;
}

export async function createBooking(input: CreateBookingInput) {
  const { booking } = await api<{ booking: Booking }>('/bookings', {
    method: 'POST',
    body: input,
    token: token(),
  });
  return booking;
}

export async function fetchMyBookings() {
  const { bookings } = await api<{ bookings: Booking[] }>('/bookings/mine', {
    token: token(),
  });
  return bookings;
}

export async function fetchBooking(id: string) {
  const { booking } = await api<{ booking: Booking }>(`/bookings/${id}`, {
    token: token(),
  });
  return booking;
}

export async function cancelBooking(id: string, reason?: string) {
  const { booking } = await api<{ booking: Booking }>(`/bookings/${id}/cancel`, {
    method: 'PATCH',
    body: { reason },
    token: token(),
  });
  return booking;
}

/* ---------- Provider side (Stage B) ---------- */

export async function fetchIncomingBookings(status?: string) {
  const qs = status ? `?status=${encodeURIComponent(status)}` : '';
  const { bookings } = await api<{ bookings: Booking[] }>(
    `/bookings/provider/incoming${qs}`,
    { token: token() }
  );
  return bookings;
}

export interface BookingStatusUpdate {
  status:
    | 'accepted'
    | 'declined'
    | 'scheduled'
    | 'on_the_way'
    | 'in_progress'
    | 'completed'
    | 'cancelled';
  note?: string;
  scheduledDate?: string;
  scheduledSlot?: string;
}

export async function updateBookingStatus(id: string, update: BookingStatusUpdate) {
  const { booking } = await api<{ booking: Booking }>(`/bookings/${id}/status`, {
    method: 'PATCH',
    body: update,
    token: token(),
  });
  return booking;
}

/* ------------------------- slots ------------------------- */

export interface SlotInfo {
  slot: string;
  free: boolean;
  past: boolean;
}

export interface SlotConfig {
  slotMinutes?: number;
  start?: string;
  end?: string;
  daysOff?: number[];
  maxDaysAhead?: number;
}

/** Availability for a provider on a date (public — used by the booking page). */
export async function fetchProviderSlots(providerId: string, dateIso: string) {
  return api<{ slots: SlotInfo[]; dayOff: boolean; config: SlotConfig }>(
    `/bookings/slots/${providerId}?date=${dateIso}`
  );
}

/** Move a booking to another slot (allowed for customer and provider). */
export async function rescheduleBooking(
  id: string,
  dateIso: string,
  slot: string
) {
  const { booking } = await api<{ booking: Booking }>(
    `/bookings/${id}/reschedule`,
    {
      method: 'PATCH',
      token: token(),
      body: { scheduledDate: dateIso, scheduledSlot: slot },
    }
  );
  return booking;
}
