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
/**
 * Shop with admin-only fields surfaced (owner populated as full object).
 *
 * The base `Shop` type declares `owner` as a string (just the user ID, what
 * customer-facing endpoints return). Admin endpoints populate it with the
 * full user document, so we Omit the base field and redeclare it. Same
 * pattern for `isApproved`/`isBlocked` — present on the Mongoose document
 * but stripped from public shop endpoints.
 */
export interface AdminShop extends Omit<Shop, 'owner'> {
  owner?: { _id: string; name?: string; email?: string; phone?: string };
  adminNote?: string;
  isApproved?: boolean;
  isBlocked?: boolean;
  // 7c: discount lives on the shop document; surfaced here for admin oversight.
  discount?: {
    enabled: boolean;
    type: 'percent' | 'flat';
    value: number;
    label?: string;
  };
}

export interface AdminOrder {
  _id: string;
  status: string;
  total: number;
  subtotal: number;
  deliveryFee?: number;
  shop?: {
    _id: string;
    name: string;
    logo?: string;
    phone?: string;
    address?: { line1?: string; line2?: string; city?: string; state?: string; pincode?: string };
  };
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
  // 8b: null = top-level group. ObjectId string = child of that parent.
  // Omit the field entirely to leave unchanged on PATCH.
  parent?: string | null;
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

// ============================================================
// PHASE 7a — Pricing config
// ============================================================

export interface VehicleConfig {
  id: string;
  name?: string;
  icon?: string;
  maxKg: number;
  perKmRate: number;
  minFee: number;
}

export interface PricingConfig {
  _id?: string;
  key?: string;
  vehicles: Record<string, VehicleConfig>;
  handlingFee: number;
  platformFeePercent: number;
  globalDiscount?: { enabled: boolean; type: 'percent' | 'flat'; value: number; label?: string };
  updatedAt?: string;
}

export async function fetchPricingConfig() {
  return api<{ config: PricingConfig }>('/admin/pricing', { token: token() });
}

export interface PricingUpdateInput {
  vehicles?: Record<string, { maxKg: number; perKmRate: number; minFee: number }>;
  handlingFee?: number;
  platformFeePercent?: number;
}

export async function updatePricingConfig(input: PricingUpdateInput) {
  return api<{ config: PricingConfig }>('/admin/pricing', {
    method: 'PATCH',
    body: input,
    token: token(),
  });
}

// ============================================================
// PHASE 7a — Withdrawal admin
// ============================================================

export type WithdrawStatus = 'pending' | 'approved' | 'paid' | 'rejected';

export interface AdminWithdrawRequest {
  _id: string;
  deliveryPartner?: { _id: string; name?: string; email?: string; phone?: string } | string;
  amount: number;
  method: 'upi' | 'bank';
  upiId?: string;
  bankDetails?: { accountName: string; accountNumber: string; ifsc: string };
  status: WithdrawStatus;
  transactionRef?: string;
  rejectionReason?: string;
  createdAt: string;
  processedAt?: string;
}

export async function fetchAdminWithdrawals(status: WithdrawStatus | 'all' = 'pending') {
  return api<{ requests: AdminWithdrawRequest[] }>(`/admin/withdrawals?status=${status}`, {
    token: token(),
  });
}

export interface WithdrawProcessInput {
  action: 'approve' | 'paid' | 'reject';
  transactionRef?: string;
  rejectionReason?: string;
}

export async function processWithdrawal(id: string, input: WithdrawProcessInput) {
  return api<{ request: AdminWithdrawRequest }>(`/admin/withdrawals/${id}`, {
    method: 'PATCH',
    body: input,
    token: token(),
  });
}

// ============================================================
// PHASE 7c — Shop discount
// ============================================================

export interface ShopDiscount {
  enabled: boolean;
  type: 'percent' | 'flat';
  value: number;
  label?: string;
}

export async function setShopDiscount(shopId: string, discount: ShopDiscount) {
  return api<{ shop: AdminShop }>(`/admin/shops/${shopId}/discount`, {
    method: 'PATCH',
    body: discount,
    token: token(),
  });
}

// ============================================================
// PHASE 7c — Product oversight
// ============================================================

export interface AdminProduct {
  _id: string;
  name: string;
  price: number;
  weight?: string;
  category?: string;
  imageUrl?: string;
  isActive: boolean;
  shop?: { _id: string; name: string } | string;
  createdAt: string;
}

export interface AdminProductsResponse {
  products: AdminProduct[];
  total: number;
  page: number;
  limit: number;
}

export async function fetchAdminProducts(opts: {
  q?: string;
  shopId?: string;
  page?: number;
  limit?: number;
  includeInactive?: boolean;
} = {}) {
  const params = new URLSearchParams();
  if (opts.q) params.set('q', opts.q);
  if (opts.shopId) params.set('shopId', opts.shopId);
  if (opts.page) params.set('page', String(opts.page));
  if (opts.limit) params.set('limit', String(opts.limit));
  if (opts.includeInactive) params.set('inactive', 'true');
  return api<AdminProductsResponse>(`/admin/products?${params.toString()}`, { token: token() });
}

export async function setProductActive(productId: string, isActive: boolean) {
  return api<{ product: AdminProduct }>(`/admin/products/${productId}`, {
    method: 'PATCH',
    body: { isActive },
    token: token(),
  });
}

// ============================================================
// PHASE 7c — Delivery partner doc verification
// ============================================================

export interface AdminDeliveryPartner {
  _id: string;
  user?: { _id: string; name?: string; email?: string; phone?: string };
  vehicleType?: string;
  vehicleNumber?: string;
  licenseNumber?: string;
  documents?: {
    drivingLicenseUrl?: string;
    aadhaarUrl?: string;
    vehicleRcUrl?: string;
    verified: boolean;
  };
  available?: boolean;
  walletBalance?: number;
  totalDeliveries?: number;
  updatedAt?: string;
}

export async function fetchAdminDeliveryPartners(filter: 'all' | 'pending' | 'true' | 'false' = 'pending') {
  return api<{ partners: AdminDeliveryPartner[] }>(
    `/admin/delivery-partners?verified=${filter}`,
    { token: token() }
  );
}

export async function setDeliveryPartnerVerified(userId: string, verified: boolean) {
  return api<{ profile: AdminDeliveryPartner }>(
    `/admin/delivery-partners/${userId}/verify`,
    { method: 'PATCH', body: { verified }, token: token() }
  );
}

/* ============================================================
 * QR flyer codes
 * ============================================================ */

export interface QrCodeRow {
  code: string;
  shopId: string | null;
  shopName: string | null;
  scans: number;
  note: string;
}

export async function fetchQrCodes(status: 'all' | 'linked' | 'blank' = 'all') {
  return api<{ total: number; linked: number; blank: number; codes: QrCodeRow[] }>(
    `/qr/admin/list?status=${status}`,
    { token: token() }
  );
}

export async function generateQrCodes(count: number) {
  return api<{ created: number; from: string; to: string; codes: string[] }>(
    `/qr/admin/generate`,
    { method: 'POST', body: { count }, token: token() }
  );
}

export async function linkQrCode(code: string, shopId: string, note?: string) {
  return api<{ code: string; shopId: string; shopName: string }>(
    `/qr/admin/${encodeURIComponent(code)}/link`,
    { method: 'POST', body: { shopId, note }, token: token() }
  );
}

export async function unlinkQrCode(code: string) {
  return api<{ code: string; status: string }>(
    `/qr/admin/${encodeURIComponent(code)}/unlink`,
    { method: 'POST', token: token() }
  );
}
