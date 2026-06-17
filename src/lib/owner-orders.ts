import { api } from './api';
import { useAuth } from '@/stores/auth';

/**
 * Owner-side order management client (Phase 4b).
 * Separate from lib/orders.ts (customer checkout) and lib/owner.ts (shop/products).
 */

function token() {
  return useAuth.getState().token;
}

export type OrderStatus =
  | 'pending_payment'
  | 'placed'
  | 'accepted'
  | 'preparing'
  | 'ready_for_pickup'
  | 'picked_up'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled'
  | 'refunded';

export interface OrderItem {
  product?: string;
  name: string;
  price: number;
  qty: number;
  weight?: string;
  image?: string;
}

export interface OrderRecipient {
  name?: string;
  phone?: string;
  address?: string;
  location?: { type: 'Point'; coordinates: [number, number] };
}

export interface OwnerOrder {
  _id: string;
  cartId?: string;
  customer: string;
  shop: string;
  items: OrderItem[];
  subtotal: number;
  discount?: { amount: number; label?: string; source?: string };
  handlingFee?: number;
  platformFee?: number;
  deliveryFee?: number;
  total: number;
  deliveryMode?: 'delivery' | 'pickup';
  vehicleId?: string;
  distanceKm?: number;
  recipient?: OrderRecipient;
  status: OrderStatus;
  deliveryPartner?: {
    _id: string;
    name?: string | null;
    phone?: string | null;
    vehicleType?: string | null;
    vehicleNumber?: string | null;
  } | null;
  statusHistory?: Array<{ status: string; at: string; by?: string; note?: string }>;
  payment?: { method: 'razorpay' | 'cod'; status: string };
  isSplit?: boolean;
  placedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrderSibling {
  _id: string;
  shop: { _id: string; name: string; logo?: string };
  status: OrderStatus;
  items: OrderItem[];
  total: number;
  createdAt: string;
}

/**
 * List orders for a shop the caller owns.
 * status: 'active' (default) hides delivered/cancelled/refunded/pending_payment.
 */
export async function fetchShopOrders(
  shopId: string,
  status: 'active' | 'all' | OrderStatus = 'active'
) {
  return api<{ orders: OwnerOrder[] }>(`/orders/shop/${shopId}?status=${status}`, {
    token: token(),
  });
}

export async function fetchOrderSiblings(orderId: string) {
  return api<{ siblings: OrderSibling[] }>(`/orders/${orderId}/siblings`, {
    token: token(),
  });
}

/** Lifecycle transitions — thin wrappers over the POST alias endpoints. */
export async function acceptOrder(orderId: string) {
  return api<{ order: OwnerOrder }>(`/orders/${orderId}/accept`, {
    method: 'POST',
    token: token(),
  });
}

export async function rejectOrder(orderId: string, note?: string) {
  return api<{ order: OwnerOrder }>(`/orders/${orderId}/reject`, {
    method: 'POST',
    body: note ? { note } : undefined,
    token: token(),
  });
}

export async function markPreparing(orderId: string) {
  return api<{ order: OwnerOrder }>(`/orders/${orderId}/preparing`, {
    method: 'POST',
    token: token(),
  });
}

export async function markReady(orderId: string) {
  return api<{ order: OwnerOrder }>(`/orders/${orderId}/ready`, {
    method: 'POST',
    token: token(),
  });
}
