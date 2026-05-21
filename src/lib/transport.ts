import { api } from './api';
import { useAuth } from '@/stores/auth';

/**
 * Transport booking API client (Phase 6b.1).
 */

function token() {
  return useAuth.getState().token;
}

export const VEHICLE_IDS = ['bike', '3wheeler', 'tataAce', 'pickup8ft', 'tata407'] as const;
export type VehicleId = (typeof VEHICLE_IDS)[number];

/** Returned by /transport/quote and /transport/quote-all. */
export interface VehicleQuote {
  vehicleId: VehicleId;
  vehicleName: string;
  icon?: string;
  distanceKm: number;
  fee: number;
  platformFee: number;
  total: number;
  minFee: number;
  perKmRate: number;
  maxKg: number;
}

export interface LatLng {
  lat: number;
  lng: number;
}

export interface PartyInput {
  name: string;
  phone: string;
  address: string;
  location: LatLng;
}

/** Transport order as stored & returned. */
export interface TransportOrder {
  _id: string;
  customer: string;
  deliveryPartner?: { _id: string; name?: string; phone?: string } | string;
  vehicleId: VehicleId;
  pickup: {
    name?: string;
    phone?: string;
    address?: string;
    location: { type: 'Point'; coordinates: [number, number] };
  };
  drop: {
    name?: string;
    phone?: string;
    address?: string;
    location: { type: 'Point'; coordinates: [number, number] };
  };
  distanceKm?: number;
  estimatedWeightKg?: number;
  notes?: string;
  fee: number;
  platformFee: number;
  total: number;
  status:
    | 'pending_payment'
    | 'placed'
    | 'accepted'
    | 'picked_up'
    | 'in_transit'
    | 'delivered'
    | 'cancelled';
  statusHistory?: Array<{ status: string; at: string; by?: string; note?: string }>;
  payment?: { method: 'razorpay' | 'cod'; status: string };
  placedAt?: string;
  deliveredAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ---------- quotes ----------

export async function quoteAll(pickup: LatLng, drop: LatLng) {
  return api<{ quotes: VehicleQuote[] }>('/transport/quote-all', {
    method: 'POST',
    body: { pickup, drop },
    token: token(),
  });
}

export async function quoteOne(vehicleId: VehicleId, pickup: LatLng, drop: LatLng) {
  return api<{ quote: VehicleQuote }>('/transport/quote', {
    method: 'POST',
    body: { vehicleId, pickup, drop },
    token: token(),
  });
}

// ---------- book / list / get / cancel ----------

export interface BookInput {
  vehicleId: VehicleId;
  pickup: PartyInput;
  drop: PartyInput;
  estimatedWeightKg?: number;
  notes?: string;
  paymentMethod?: 'cod' | 'razorpay';
}

export async function bookTransport(input: BookInput) {
  return api<{ order: TransportOrder }>('/transport', {
    method: 'POST',
    body: input,
    token: token(),
  });
}

export async function fetchMyTransportOrders(status: 'active' | 'all' = 'active') {
  return api<{ orders: TransportOrder[] }>(`/transport/mine?status=${status}`, {
    token: token(),
  });
}

export async function fetchTransportOrder(id: string) {
  return api<{ order: TransportOrder }>(`/transport/${id}`, { token: token() });
}

export async function cancelTransport(id: string) {
  return api<{ order: TransportOrder }>(`/transport/${id}/cancel`, {
    method: 'POST',
    token: token(),
  });
}
