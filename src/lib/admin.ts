import { api } from './api';
import { useAuth } from '@/stores/auth';
import type { Shop, Category } from './shops';

function token() {
  return useAuth.getState().token;
}

/* ============================================================
 * Admin client (Phase 6a)
 * ============================================================ */

export interface AdminSummary {
  pendingShops: number;
  totalShops: number;
  totalUsers: number;
  activeOrders: number;
  totalOrders: number;
}

export interface AdminUser {
  _id: string;
  name?: string;
  email?: string;
  phone?: string;
  roles: Array<'customer' | 'shop' | 'delivery' | 'admin'>;
  isBlocked: boolean;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  createdAt: string;
  lastLoginAt?: string;
}

/** Shop with admin-only fields surfaced (owner populated). */
export interface AdminShop extends Shop {
  owner?: { _id: string; name?: string; email?: string; phone?: string };
  adminNote?: string;
}

export interface AdminOrder {
  _id: string;
  status: string;
  total: number;
  subtotal: number;
  deliveryFee?: number;
  shop?: { _id: string; name: string; logo?: string };
  customer?: { _id: string; name?: string; email?: string; phone?: string };
  deliveryPartner?: { _id: string; name?: string; phone?: string };
  items: Array<{ name: string; qty: number; price: number }>;
  recipient?: { name?: string; phone?: string; address?: string };
  payment?: { method: string; status: string };
  isSplit?: boolean;
  createdAt: string;
  updatedAt: string;
}

// ---- summary ----

export async function fetchAdminSummary() {
  return api<{ summary: AdminSummary }>('/admin/summary', { token: token() });
}

// ---- shops ----

export async function fetchAdminShops(status: 'pending' | 'approved' | 'blocked' | 'all' = 'pending') {
  return api<{ shops: AdminShop[] }>(`/admin/shops?status=${status}`, { token: token() });
}

export async function approveShop(id: string) {
  return api<{ shop: AdminShop }>(`/admin/shops/${id}/approve`, {
    method: 'POST',
    token: token(),
  });
}

export async function rejectShop(id: string, opts: { block?: boolean; note?: string } = {}) {
  return api<{ shop: AdminShop }>(`/admin/shops/${id}/reject`, {
    method: 'POST',
    body: opts,
    token: token(),
  });
}

export async function blockShop(id: string, blocked: boolean) {
  return api<{ shop: AdminShop }>(`/admin/shops/${id}/block`, {
    method: 'POST',
    body: { blocked },
    token: token(),
  });
}

// ---- users ----

export async function fetchAdminUsers(opts: { role?: string; q?: string; blocked?: boolean } = {}) {
  const search = new URLSearchParams();
  if (opts.role) search.set('role', opts.role);
  if (opts.q) search.set('q', opts.q);
  if (opts.blocked !== undefined) search.set('blocked', String(opts.blocked));
  const qs = search.toString();
  return api<{ users: AdminUser[] }>(`/admin/users${qs ? `?${qs}` : ''}`, {
    token: token(),
  });
}

export async function blockUser(id: string, blocked: boolean) {
  return api<{ user: AdminUser }>(`/admin/users/${id}/block`, {
    method: 'POST',
    body: { blocked },
    token: token(),
  });
}

// ---- orders ----

export async function fetchAdminOrders(opts: { status?: string; shopId?: string } = {}) {
  const search = new URLSearchParams();
  if (opts.status) search.set('status', opts.status);
  if (opts.shopId) search.set('shopId', opts.shopId);
  const qs = search.toString();
  return api<{ orders: AdminOrder[] }>(`/admin/orders${qs ? `?${qs}` : ''}`, {
    token: token(),
  });
}

// ---- categories ----

export async function fetchAdminCategories() {
  return api<{ categories: Category[] }>('/admin/categories', { token: token() });
}

export interface CategoryPayload {
  name: string;
  icon?: string;
  image?: string;
  sortOrder?: number;
  isActive?: boolean;
}

export async function createCategory(payload: CategoryPayload) {
  return api<{ category: Category }>('/admin/categories', {
    method: 'POST',
    body: payload,
    token: token(),
  });
}

export async function updateCategory(id: string, payload: Partial<CategoryPayload>) {
  return api<{ category: Category }>(`/admin/categories/${id}`, {
    method: 'PATCH',
    body: payload,
    token: token(),
  });
}

export async function deleteCategory(id: string) {
  return api<{ ok: boolean }>(`/admin/categories/${id}`, {
    method: 'DELETE',
    token: token(),
  });
}
