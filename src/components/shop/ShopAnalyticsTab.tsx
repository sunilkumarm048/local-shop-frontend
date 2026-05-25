'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Loader2,
  IndianRupee,
  ShoppingBag,
  TrendingUp,
  CheckCircle2,
  Package,
} from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { BarChart } from '@/components/ui/BarChart';
import { ApiError } from '@/lib/api';
import {
  fetchShopAnalytics,
  type ShopAnalyticsResponse,
} from '@/lib/analytics';

/**
 * Shop owner analytics dashboard.
 *
 * Layout:
 *   [ days picker ]
 *   [ 4 KPI cards ]
 *   [ orders/day bar chart ]
 *   [ revenue/day bar chart ]
 *   [ top 5 products list with proportional bars ]
 */

const DAYS_OPTIONS = [7, 30, 90] as const;

export function ShopAnalyticsTab() {
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [data, setData] = useState<ShopAnalyticsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const r = await fetchShopAnalytics(days);
      setData(r);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load analytics.');
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold">Analytics</h2>
          <p className="text-xs text-muted-foreground">
            How your shop is performing over the last {days} days.
          </p>
        </div>
        <div className="flex gap-1 bg-muted rounded-md p-1">
          {DAYS_OPTIONS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDays(d)}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                days === d
                  ? 'bg-white text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{error}</div>
      )}

      {loading && (
        <div className="py-12 flex items-center justify-center text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          Crunching numbers…
        </div>
      )}

      {!loading && data && (
        <>
          {/* KPI strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiCard
              icon={ShoppingBag}
              label="Orders"
              value={String(data.summary.totalOrders)}
            />
            <KpiCard
              icon={IndianRupee}
              label="Revenue"
              value={`₹${data.summary.totalRevenue.toLocaleString()}`}
            />
            <KpiCard
              icon={TrendingUp}
              label="Avg order"
              value={`₹${data.summary.avgOrderValue}`}
            />
            <KpiCard
              icon={CheckCircle2}
              label="Completion"
              value={`${data.summary.completionRate}%`}
              sub={`${data.summary.delivered}/${data.summary.totalOrders}`}
            />
          </div>

          {/* Daily orders */}
          <Card>
            <CardContent className="pt-4 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Orders per day</h3>
                <span className="text-xs text-muted-foreground">{data.summary.totalOrders} total</span>
              </div>
              <BarChart
                data={data.series.map((s) => ({ label: s.day, value: s.orders }))}
                color="#0C831F"
              />
            </CardContent>
          </Card>

          {/* Daily revenue */}
          <Card>
            <CardContent className="pt-4 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Revenue per day</h3>
                <span className="text-xs text-muted-foreground">
                  ₹{data.summary.totalRevenue.toLocaleString()} total
                </span>
              </div>
              <BarChart
                data={data.series.map((s) => ({ label: s.day, value: s.revenue }))}
                color="#F8CD46"
                formatValue={(v) => `₹${v}`}
              />
            </CardContent>
          </Card>

          {/* Top products */}
          {data.topProducts.length > 0 && (
            <Card>
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold flex items-center gap-1.5">
                    <Package className="h-4 w-4" />
                    Top products
                  </h3>
                  <span className="text-xs text-muted-foreground">by units sold</span>
                </div>
                <TopProductsList items={data.topProducts} />
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

// ============================================================

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof IndianRupee;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-3 pb-3 text-center">
        <Icon className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
        <div className="text-base font-bold leading-tight truncate">{value}</div>
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground mt-0.5">
          {label}
        </div>
        {sub && <div className="text-[10px] text-muted-foreground/70 mt-0.5">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function TopProductsList({ items }: { items: Array<{ name: string; qty: number; revenue: number }> }) {
  const maxQty = Math.max(1, ...items.map((i) => i.qty));
  return (
    <div className="space-y-2">
      {items.map((p, idx) => {
        const pct = (p.qty / maxQty) * 100;
        return (
          <div key={`${p.name}-${idx}`} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium truncate flex-1 pr-2">{p.name}</span>
              <span className="text-xs text-muted-foreground shrink-0">
                {p.qty} sold · ₹{p.revenue.toLocaleString()}
              </span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-brand-green rounded-full transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
