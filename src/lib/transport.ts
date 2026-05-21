import { api } from './api';
import { useAuth } from '@/stores/auth';

/**
 * Transport API client.
 * 6b.1: customer-side (quote, book, list, get, cancel).
 * 6b.2: delivery partner side (jobs, my-jobs, accept, lifecycle).
 */

function token() {
  return useAuth.getState().token;
}

export const VEHICLE_IDS = ['bike', '3wheeler', 'tataAce', 'pickup8ft', 'tata407'] as const;
export type VehicleId = (typeof VEHICLE_IDS)[number];

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

export interface TransportParty {
  name?: string;
  phone?: string;
  address?: string;
  location: { type: 'Point'; coordinates: [number, number] };
}

export type TransportStatus =
  | 'pending_payment'
  | 'placed'
  | 'accepted'
  | 'picked_up'
  | 'in_transit'
  | 'delivered'
  | 'cancelled';

export interface TransportOrder {
  _id: string;
  customer: string;
  deliveryPartner?: { _id: string; name?: string; phone?: string } | string;
  vehicleId: VehicleId;
  pickup: TransportParty;
  drop: TransportParty;
  distanceKm?: number;
  estimatedWeightKg?: number;
  notes?: string;
  fee: number;
  platformFee: number;
  total: number;
  status: TransportStatus;
  statusHistory?: Array<{ status: string; at: string; by?: string; note?: string }>;
  payment?: { method: 'razorpay' | 'cod'; status: string };
  placedAt?: string;
  deliveredAt?: string;
  createdAt: string;
  updatedAt: string;
}

/** A transport job in the partner feed — same as TransportOrder + distance-to-pickup. */
export interface AvailableTransportJob extends TransportOrder {
  distanceToPickupKm: number | null;
}

// ============ customer (6b.1) ============

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

// ============ delivery partner (6b.2) ============

export async function fetchTransportJobs(lng: number, lat: number, radiusKm: number) {
  return api<{ jobs: AvailableTransportJob[] }>(
    `/transport/jobs?lng=${lng}&lat=${lat}&radiusKm=${radiusKm}`,
    { token: token() }
  );
}

export async function fetchMyTransportJobs() {
  return api<{ jobs: TransportOrder[] }>('/transport/my-jobs', { token: token() });
}

export async function acceptTransportJob(id: string) {
  return api<{ order: TransportOrder }>(`/transport/${id}/accept`, {
    method: 'POST',
    token: token(),
  });
}

export async function transportPickup(id: string) {
  return api<{ order: TransportOrder }>(`/transport/${id}/pickup`, {
    method: 'POST',
    token: token(),
  });
}

export async function transportStart(id: string) {
  return api<{ order: TransportOrder }>(`/transport/${id}/start`, {
    method: 'POST',
    token: token(),
  });
}

export async function transportDeliver(id: string) {
  return api<{ order: TransportOrder }>(`/transport/${id}/deliver`, {
    method: 'POST',
    token: token(),
  });
}
