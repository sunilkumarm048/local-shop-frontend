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

export type UpdateShopPayload = Partial<CreateShopPayload> & {
  isOpen?: boolean;
  slotConfig?: {
    slotMinutes?: number;
    start?: string;
    end?: string;
    daysOff?: number[];
    maxDaysAhead?: number;
  };
};

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

/**
 * Admin/agent field-onboarding: create a shop on a shopkeeper's behalf.
 * Goes live immediately. Returns the new shop + the placeholder owner id.
 */
export async function quickCreateShop(payload: {
  name: string;
  category: string;
  phone: string;
  ownerEmail: string;
  ownerPassword: string;
  description?: string;
  logo?: string;
  lat: number;
  lng: number;
  address?: { line1?: string; city?: string; pincode?: string };
}) {
  return api<{
    shop: Shop;
    ownerId: string;
    ownerEmail: string;
    reusedExistingAccount: boolean;
  }>('/admin/shops/quick-create', {
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

/**
 * Service provider toggles "available now" (live home-visit availability).
 */
export async function setShopAvailability(id: string, availableNow: boolean) {
  return api<{ _id: string; availableNow: boolean }>(
    `/shops/${id}/availability`,
    {
      method: 'PATCH',
      body: { availableNow },
      token: token(),
    }
  );
}

/** Live location ping — updates the provider's shop position (app-open only). */
export async function pingShopLocation(id: string, lat: number, lng: number) {
  return api<{ ok: boolean }>(`/shops/${id}/location`, {
    method: 'PATCH',
    body: { lat, lng },
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

/**
 * Backfill/overwrite product images from the catalog templates (matched by
 * name). Returns how many products were updated.
 */
export async function syncProductImages(shopId: string) {
  return api<{ updated: number; scanned: number }>(
    `/shops/${shopId}/products/sync-images`,
    {
      method: 'POST',
      token: token(),
    }
  );
}
