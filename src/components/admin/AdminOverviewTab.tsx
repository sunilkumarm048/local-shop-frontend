'use client';

import { useEffect, useState } from 'react';
import { Loader2, Store, Users, Package, ShoppingBag, AlertCircle } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { ApiError } from '@/lib/api';
import { fetchAdminSummary, type AdminSummary } from '@/lib/admin';

export function AdminOverviewTab({ goToTab }: { goToTab: (tab: 'shops' | 'orders') => void }) {
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAdminSummary()
      .then((r) => setSummary(r.summary))
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load summary.'));
  }, []);

  if (error) {
    return (
      <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
        {error}
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="py-10 flex items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Loading…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Big attention card if there are pending shops */}
      {summary.pendingShops > 0 && (
        <button
          type="button"
          onClick={() => goToTab('shops')}
          className="w-full text-left rounded-lg border-2 border-brand-yellowDark/50 bg-brand-yellow/20 p-4 flex items-center gap-3 hover:bg-brand-yellow/30 transition-colors"
        >
          <AlertCircle className="h-6 w-6 text-brand-yellowDark shrink-0" />
          <div className="flex-1">
            <div className="font-semibold">
              {summary.pendingShops} shop{summary.pendingShops === 1 ? '' : 's'} pending approval
            </div>
            <div className="text-sm text-muted-foreground">
              Click to review and approve or reject.
            </div>
          </div>
        </button>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          icon={Store}
          label="Approved shops"
          value={summary.totalShops}
          onClick={() => goToTab('shops')}
        />
        <StatCard
          icon={Users}
          label="Total users"
          value={summary.totalUsers}
        />
        <StatCard
          icon={Package}
          label="Active orders"
          value={summary.activeOrders}
          onClick={() => goToTab('orders')}
        />
        <StatCard
          icon={ShoppingBag}
          label="All-time orders"
          value={summary.totalOrders}
        />
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  onClick,
}: {
  icon: typeof Store;
  label: string;
  value: number;
  onClick?: () => void;
}) {
  const inner = (
    <CardContent className="py-5">
      <Icon className="h-5 w-5 text-muted-foreground mb-2" />
      <div className="text-2xl font-bold leading-none">{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </CardContent>
  );

  if (onClick) {
    return (
      <Card className="hover:bg-accent/30 cursor-pointer transition-colors" onClick={onClick}>
        {inner}
      </Card>
    );
  }
  return <Card>{inner}</Card>;
}
