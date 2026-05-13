import { api } from './api';
import { useAuth } from '@/stores/auth';

export interface CheckoutInput {
  items: Array<{ productId: string; qty: number }>;
  recipient: {
    name: string;
    phone: string;
    address: string;
    location: { lng: number; lat: number };
  };
  vehicleId: 'bike' | '3wheeler' | 'tataAce' | 'pickup8ft' | 'tata407';
  paymentMethod: 'razorpay' | 'cod';
}

export interface CheckoutResponse {
  cartId: string;
  orders: Array<{ id: string; shopId: string; total: number; status: string }>;
  grandTotal: number;
  payment:
    | { method: 'cod' }
    | {
        method: 'razorpay';
        razorpayOrderId: string;
        razorpayKeyId: string;
        amount: number;
        currency: string;
      };
}

export async function checkout(input: CheckoutInput) {
  return api<CheckoutResponse>('/orders/checkout', {
    method: 'POST',
    body: input,
    token: useAuth.getState().token,
  });
}

export async function verifyPayment(input: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}) {
  return api<{ ok: true; count: number }>('/payments/verify', {
    method: 'POST',
    body: input,
    token: useAuth.getState().token,
  });
}

export async function fetchQuote(input: {
  items: Array<{ productId: string; qty: number }>;
  dropLocation?: { lng: number; lat: number };
  vehicleId?: string;
}) {
  return api<{
    quotes: Array<{
      shopId: string;
      shopName: string;
      subtotal: number;
      discount: { amount: number; label: string; source: string };
      deliveryFee: number;
      handlingFee: number;
      platformFee: number;
      total: number;
      distanceKm: number | null;
    }>;
    grandTotal: number;
  }>('/quotes/order', {
    method: 'POST',
    body: input,
  });
}

export async function fetchMyOrders() {
  return api<{ orders: Array<{ _id: string; shop: { name: string; logo?: string }; total: number; status: string; createdAt: string }> }>(
    '/orders/mine',
    { token: useAuth.getState().token }
  );
}

export async function fetchOrder(id: string) {
  return api<{ order: Record<string, unknown> }>(`/orders/${id}`, {
    token: useAuth.getState().token,
  });
}
