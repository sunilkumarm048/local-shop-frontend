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
  customer: string;
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
