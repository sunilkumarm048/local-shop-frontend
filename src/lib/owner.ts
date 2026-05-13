import { api } from './api';
import { useAuth } from '@/stores/auth';
import type { Shop, Product, Category } from './shops';

/**
 * Owner-facing helpers. All require the user to be authenticated with the
 * 'shop' role — the backend enforces this; we just pass the token along.
 */

function token() {
  return useAuth.getState().token;
}

// ---------- Shop ----------

export interface ShopAddress {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
}

export interface OpeningHour {
  day: number; // 0 (Sun) – 6 (Sat)
  open: string; // "09:00"
  close: string; // "21:00"
}

export interface CreateShopPayload {
  name: string;
  description?: string;
  phone?: string;
  logo?: string;
  coverImage?: string;
  category?: string;
  address: ShopAddress;
  location: { lng: number; lat: number };
  openingHours?: OpeningHour[];
}

export type UpdateShopPayload = Partial<CreateShopPayload> & { isOpen?: boolean };

export async function fetchMyShops() {
  return api<{ shops: Shop[] }>('/shops/mine', { token: token() });
}

export async function createShop(payload: CreateShopPayload) {
  return api<{ shop: Shop }>('/shops', {
    method: 'POST',
    body: payload,
    token: token(),
  });
}

export async function updateShop(id: string, payload: UpdateShopPayload) {
  return api<{ shop: Shop }>(`/shops/${id}`, {
    method: 'PATCH',
    body: payload,
    token: token(),
  });
}

export async function fetchCategories() {
  return api<{ categories: Category[] }>('/shops/categories');
}

// ---------- Products ----------

export interface ProductPayload {
  name: string;
  description?: string;
  image?: string;
  category?: string;
  price: number;
  mrp?: number;
  stock: number;
  inStock?: boolean;
  weight?: string;
}

export async function fetchAllProductsForOwner(shopId: string) {
  return api<{ products: Product[] }>(`/shops/${shopId}/products/all`, {
    token: token(),
  });
}

export async function createProduct(shopId: string, payload: ProductPayload) {
  return api<{ product: Product }>(`/shops/${shopId}/products`, {
    method: 'POST',
    body: payload,
    token: token(),
  });
}

export async function updateProduct(
  shopId: string,
  productId: string,
  payload: Partial<ProductPayload> & { isActive?: boolean }
) {
  return api<{ product: Product }>(`/shops/${shopId}/products/${productId}`, {
    method: 'PATCH',
    body: payload,
    token: token(),
  });
}

export async function deleteProduct(shopId: string, productId: string) {
  return api<{ ok: boolean }>(`/shops/${shopId}/products/${productId}`, {
    method: 'DELETE',
    token: token(),
  });
}
