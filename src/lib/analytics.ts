import { api } from './api';
import { useAuth } from '@/stores/auth';

function token() {
  return useAuth.getState().token;
}

/**
 * Analytics API client.
 * Two parallel surfaces — shop owner and delivery partner — each return a
 * dense daily series and summary stats.
 */

export interface AnalyticsRange {
  from: string;
  to: string;
  days: number;
}

export interface DailyPoint {
  /** YYYY-MM-DD UTC */
  day: string;
  orders: number;
  revenue: number;
}

export interface TopProduct {
  name: string;
  qty: number;
  revenue: number;
}

// ---- Shop ----

export interface ShopAnalyticsSummary {
  totalOrders: number;
  totalRevenue: number;
  avgOrderValue: number;
  completionRate: number;
  delivered: number;
}

export interface ShopAnalyticsResponse {
  shop: { _id: string; name: string };
  range: AnalyticsRange;
  summary: ShopAnalyticsSummary;
  series: DailyPoint[];
  topProducts: TopProduct[];
}

export async function fetchShopAnalytics(days = 30, shopId?: string) {
  const params = new URLSearchParams();
  params.set('days', String(days));
  if (shopId) params.set('shopId', shopId);
  return api<ShopAnalyticsResponse>(`/shops/mine/analytics?${params.toString()}`, {
    token: token(),
  });
}

// ---- Delivery partner ----

export interface DeliveryAnalyticsSummary {
  totalDeliveries: number;
  totalEarnings: number;
  totalDistanceKm: number;
  avgEarningPerDelivery: number;
  groceryCount: number;
  transportCount: number;
}

export interface DeliveryAnalyticsResponse {
  range: AnalyticsRange;
  summary: DeliveryAnalyticsSummary;
  series: DailyPoint[];
}

export async function fetchDeliveryAnalytics(days = 30) {
  return api<DeliveryAnalyticsResponse>(`/delivery/me/analytics?days=${days}`, {
    token: token(),
  });
}
