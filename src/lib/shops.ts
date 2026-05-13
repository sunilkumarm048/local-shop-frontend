import { api } from './api';

export interface ShopAddress {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  pincode?: string;
}

export interface OpeningHour {
  day: number; // 0 = Sun
  open: string; // "09:00"
  close: string; // "21:00"
}

export interface Shop {
  _id: string;
  name: string;
  slug?: string;
  owner?: string;
  ownerEmail?: string;
  logo?: string;
  coverImage?: string;
  description?: string;
  phone?: string;
  category?: string;
  isOpen: boolean;
  isApproved?: boolean;
  rating: number;
  ratingCount: number;
  openingHours?: OpeningHour[];
  address?: ShopAddress;
  location: {
    type: 'Point';
    coordinates: [number, number]; // [lng, lat]
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface Product {
  _id: string;
  shop: string;
  name: string;
  description?: string;
  image?: string;
  images?: string[];
  category?: string;
  price: number;
  mrp?: number;
  weight?: string;
  stock: number;
  inStock: boolean;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Category {
  _id: string;
  name: string;
  icon?: string;
  image?: string;
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

export async function fetchCategories() {
  return api<{ categories: Category[] }>('/shops/categories');
}

export async function fetchShop(id: string) {
  return api<{ shop: Shop }>(`/shops/${id}`);
}

export async function fetchShopProducts(id: string) {
  return api<{ products: Product[] }>(`/shops/${id}/products`);
}
