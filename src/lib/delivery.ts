import { api } from './api';
import { useAuth } from '@/stores/auth';
import type { OrderItem, OrderRecipient, OrderStatus } from './owner-orders';

/**
 * Delivery partner API client.
 * 5a: profile, job feed, accept, lifecycle.
 * 5b: adds shop/recipient coords (already returned by the backend, now in types).
 */

function token() {
  return useAuth.getState().token;
}

export interface DeliveryProfile {
  _id: string;
  user: string;
  available: boolean;
  currentLocation?: { type: 'Point'; coordinates: [number, number]; updatedAt?: string };
  vehicleType?: 'bike' | '3wheeler' | 'tataAce' | 'pickup8ft' | 'tata407';
  vehicleNumber?: string;
  licenseNumber?: string;
  walletBalance: number;
  totalEarnings: number;
  totalDeliveries: number;
  rating: number;
  ratingCount: number;
}

export interface JobShop {
  _id: string;
  name: string;
  logo?: string;
  address?: { line1?: string; city?: string; state?: string; pincode?: string };
  /** GeoJSON Point [lng, lat]. Returned by GET /delivery/my-jobs (populated). */
  location?: { type: 'Point'; coordinates: [number, number] };
}

/** A pickup available to grab (from GET /jobs). */
export interface AvailableJob {
  orderId: string;
  shop: JobShop | null;
  items: OrderItem[];
  total: number;
  deliveryFee?: number;
  recipient?: OrderRecipient;
  vehicleId?: string;
  distanceKm?: number;
  isSplit?: boolean;
  createdAt: string;
  distanceToShopKm: number | null;
}

/** A job already assigned to this partner (from GET /my-jobs). */
export interface MyJob {
  _id: string;
  shop: JobShop;
  items: OrderItem[];
  total: number;
  deliveryFee?: number;
  recipient?: OrderRecipient;
  vehicleId?: string;
  distanceKm?: number;
  status: OrderStatus;
  isSplit?: boolean;
  createdAt: string;
  updatedAt: string;
}

// ---- profile ----

export async function fetchDeliveryProfile() {
  return api<{ profile: DeliveryProfile }>('/delivery/me', { token: token() });
}

export async function updateDeliveryProfile(patch: {
  available?: boolean;
  vehicleType?: DeliveryProfile['vehicleType'];
  vehicleNumber?: string;
  licenseNumber?: string;
}) {
  return api<{ profile: DeliveryProfile }>('/delivery/me', {
    method: 'PATCH',
    body: patch,
    token: token(),
  });
}

// ---- job feed ----

export async function fetchJobs(lng: number, lat: number, radiusKm: number) {
  return api<{ jobs: AvailableJob[] }>(
    `/delivery/jobs?lng=${lng}&lat=${lat}&radiusKm=${radiusKm}`,
    { token: token() }
  );
}

export async function fetchMyJobs() {
  return api<{ jobs: MyJob[] }>('/delivery/my-jobs', { token: token() });
}

// ---- grab + lifecycle ----

export async function acceptJob(orderId: string) {
  return api<{ order: MyJob }>(`/delivery/jobs/${orderId}/accept`, {
    method: 'POST',
    token: token(),
  });
}

export async function markPickedUp(orderId: string) {
  return api<{ order: MyJob }>(`/delivery/jobs/${orderId}/pickup`, {
    method: 'POST',
    token: token(),
  });
}

export async function markOnWay(orderId: string) {
  return api<{ order: MyJob }>(`/delivery/jobs/${orderId}/onway`, {
    method: 'POST',
    token: token(),
  });
}

export async function markDelivered(orderId: string) {
  return api<{ order: MyJob }>(`/delivery/jobs/${orderId}/deliver`, {
    method: 'POST',
    token: token(),
  });
}
