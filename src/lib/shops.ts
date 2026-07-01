import { api } from './api';

export interface Shop {
  _id: string;
  name: string;
  logo?: string;
  coverImage?: string;
  description?: string;
  category?: string;
  phone?: string;
  isOpen: boolean;
  /** True when this shop is a service provider (plumber, electrician, etc.). */
  isService?: boolean;
  /** Service providers: currently available for home visits. */
  availableNow?: boolean;
  /** Service providers: currently on an active booking, so not bookable. */
  busy?: boolean;
  rating: number;
  ratingCount: number;
  gallery?: string[];
  address?: {
    line1?: string;
    city?: string;
    state?: string;
    pincode?: string;
  };
  location: {
    type: 'Point';
    coordinates: [number, number]; // [lng, lat]
  };
}

export interface Product {
  _id: string;
  shop: string;
  name: string;
  description?: string;
  image?: string;
  price: number;
  mrp?: number;
  weight?: string;
  stock: number;
  inStock: boolean;
  // Admin/owner can soft-hide products via the Phase 7c admin Products tab.
  // Defaults true server-side; absent from old documents created before 7c.
  isActive?: boolean;
}

export interface Category {
  _id: string;
  name: string;
  icon?: string;
  image?: string;
  sortOrder?: number;
  isActive?: boolean;
  // 8b: nesting. Null/missing on top-level groups, ObjectId string on children.
  // The admin GET endpoint populates this with { _id, name } objects;
  // public GET returns it as a plain id string.
  parent?: string | { _id: string; name: string } | null;
}

/**
 * Tree-shape variant returned by `/api/shops/categories?tree=true`.
 * Top-level groups carry a `children` array of their direct subcategories.
 */
export interface CategoryNode extends Category {
  children: Category[];
}

export async function fetchNearbyShops(params: {
  lng?: number;
  lat?: number;
  radiusKm?: number;
  category?: string;
  q?: string;
}) {
  const search = new URLSearchParams();
  if (params.lng != null) search.set('lng', String(params.lng));
  if (params.lat != null) search.set('lat', String(params.lat));
  if (params.radiusKm) search.set('radiusKm', String(params.radiusKm));
  if (params.category) search.set('category', params.category);
  if (params.q) search.set('q', params.q);
  const qs = search.toString();
  return api<{ shops: Shop[] }>(`/shops${qs ? `?${qs}` : ''}`);
}

/**
 * Ask the backend to AI-correct a raw search query (typos, half-words).
 * Always resolves to something usable — falls back to the raw query.
 */
export async function normalizeSearch(q: string) {
  const original = q.trim();
  if (!original) return { original: '', query: '', corrected: false };
  try {
    return await api<{ original: string; query: string; corrected: boolean }>(
      `/search/normalize?q=${encodeURIComponent(original)}`
    );
  } catch {
    return { original, query: original, corrected: false };
  }
}

export async function fetchCategories() {
  return api<{ categories: Category[] }>('/shops/categories');
}

/**
 * 8b: returns the category tree (parents at top, each with a `children` array).
 * Used by the customer browse page to render group → subcategory navigation.
 */
export async function fetchCategoryTree() {
  return api<{ categories: CategoryNode[] }>('/shops/categories?tree=true');
}

export async function fetchShop(id: string) {
  return api<{ shop: Shop }>(`/shops/${id}`);
}

export async function fetchShopProducts(id: string) {
  return api<{ products: Product[] }>(`/shops/${id}/products`);
}
