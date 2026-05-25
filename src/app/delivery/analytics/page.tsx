'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Loader2,
  ChevronLeft,
  TrendingUp,
  IndianRupee,
  Truck,
  Package,
  Navigation,
  PieChart,
} from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { BarChart } from '@/components/ui/BarChart';
import { useAuth } from '@/stores/auth';
import { useUser } from '@/hooks/useUser';
import { ApiError } from '@/lib/api';
import {
  fetchDeliveryAnalytics,
  type DeliveryAnalyticsResponse,
} from '@/lib/analytics';

const DAYS_OPTIONS = [7, 30, 90] as const;

export default function DeliveryAnalyticsPage() {
  const router = useRouter();
  const { user } = useUser();
  const token = useAuth((s) => s.token);

  const [hydrated, setHydrated] = useState(false);
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [data, setData] = useState<DeliveryAnalyticsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setHydrated(useAuth.persist.hasHydrated());
    return useAuth.persist.onFinishHydration(() => setHydrated(true));
  }, []);
  useEffect(() => {
    if (hydrated && !token) router.replace('/login?next=/delivery/analytics');
  }, [hydrated, token, router]);
  useEffect(() => {
    if (user && !user.roles.includes('delivery')) router.replace('/customer');
  }, [user, router]);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const r = await fetchDeliveryAnalytics(days);
      setData(r);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load analytics.');
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    if (user?.roles.includes('delivery')) load();
  }, [user, load]);

  if (!hydrated || !token || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Loading…
      </div>
    );
  }
  if (!user.roles.includes('delivery')) return null;

  return (
    <div className="min-h-screen flex flex-col bg-[#f4f4f4]">
      <header className="sticky top-0 z-30 bg-[#1f1f1f] text-white shadow-sm">
        <div className="container flex items-center gap-2 py-3">
          <Link href="/delivery" className="text-white hover:bg-white/10 p-1.5 rounded-md">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <TrendingUp className="h-5 w-5" />
          <div className="text-sm font-bold">Analytics</div>
        </div>
      </header>

      <main className="flex-1 container py-5 space-y-5">
        <div className="flex items-center justify-end">
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
            Loading your stats…
          </div>
        )}

        {!loading && data && (
          <>
            {/* KPI strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <KpiCard
                icon={Package}
                label="Deliveries"
                value={String(data.summary.totalDeliveries)}
              />
              <KpiCard
                icon={IndianRupee}
                label="Earnings"
                value={`₹${data.summary.totalEarnings.toLocaleString()}`}
              />
              <KpiCard
                icon={Navigation}
                label="Distance"
                value={`${data.summary.totalDistanceKm} km`}
              />
              <KpiCard
                icon={TrendingUp}
                label="Avg / delivery"
                value={`₹${data.summary.avgEarningPerDelivery}`}
              />
            </div>

            {/* Grocery vs transport split */}
            <Card>
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-center gap-1.5">
                  <PieChart className="h-4 w-4" />
                  <h3 className="text-sm font-semibold">Job mix</h3>
                </div>
                <Mix grocery={data.summary.groceryCount} transport={data.summary.transportCount} />
              </CardContent>
            </Card>

            {/* Daily deliveries */}
            <Card>
              <CardContent className="pt-4 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Deliveries per day</h3>
                  <span className="text-xs text-muted-foreground">
                    {data.summary.totalDeliveries} total
                  </span>
                </div>
                <BarChart
                  data={data.series.map((s) => ({ label: s.day, value: s.orders }))}
                  color="#0C831F"
                />
              </CardContent>
            </Card>

            {/* Daily earnings */}
            <Card>
              <CardContent className="pt-4 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Earnings per day</h3>
                  <span className="text-xs text-muted-foreground">
                    ₹{data.summary.totalEarnings.toLocaleString()} total
                  </span>
                </div>
                <BarChart
                  data={data.series.map((s) => ({ label: s.day, value: s.revenue }))}
                  color="#F8CD46"
                  formatValue={(v) => `₹${v}`}
                />
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof IndianRupee;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardContent className="pt-3 pb-3 text-center">
        <Icon className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
        <div className="text-base font-bold leading-tight truncate">{value}</div>
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground mt-0.5">
          {label}
        </div>
      </CardContent>
    </Card>
  );
}

function Mix({ grocery, transport }: { grocery: number; transport: number }) {
  const total = grocery + transport;
  if (total === 0) {
    return <p className="text-sm text-muted-foreground text-center py-2">No deliveries yet</p>;
  }
  const groceryPct = (grocery / total) * 100;
  const transportPct = 100 - groceryPct;
  return (
    <div className="space-y-2">
      <div className="h-4 rounded-full overflow-hidden flex">
        <div
          className="bg-brand-green h-full transition-all"
          style={{ width: `${groceryPct}%` }}
          title={`${grocery} grocery deliveries`}
        />
        <div
          className="bg-orange-500 h-full transition-all"
          style={{ width: `${transportPct}%` }}
          title={`${transport} transport jobs`}
        />
      </div>
      <div className="flex justify-between text-xs">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-brand-green" />
          <span>{grocery} grocery</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-orange-500" />
          <span>{transport} transport</span>
          <Truck className="h-3 w-3 opacity-50" />
        </div>
      </div>
    </div>
  );
}
