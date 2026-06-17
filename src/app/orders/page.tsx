'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Header } from '@/components/layout/header';
import { Card, CardContent } from '@/components/ui/card';
import { SupportCard } from '@/components/support/SupportCard';
import { fetchMyOrders } from '@/lib/orders';

interface OrderRow {
  _id: string;
  shop: { name: string; logo?: string };
  total: number;
  status: string;
  createdAt: string;
}

const STATUS_LABEL: Record<string, string> = {
  pending_payment: 'Awaiting payment',
  placed: 'Placed',
  accepted: 'Accepted',
  preparing: 'Preparing',
  ready_for_pickup: 'Ready',
  picked_up: 'Picked up',
  out_for_delivery: 'On the way',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
};

export default function MyOrdersPage() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMyOrders()
      .then((r) => setOrders(r.orders as OrderRow[]))
      .catch((e) => setError(e.message || 'Could not load orders'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <Header />
      <main className="container py-6 space-y-4 max-w-2xl">
        <h1 className="text-2xl font-bold">My orders</h1>

        {error && (
          <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
            {error}
          </div>
        )}

        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />
          ))
        ) : orders.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No orders yet.{' '}
              <Link href="/customer" className="text-primary hover:underline">
                Browse shops
              </Link>
            </CardContent>
          </Card>
        ) : (
          orders.map((o) => (
            <Link key={o._id} href={`/orders/${o._id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <div className="font-medium">{o.shop.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(o.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">₹{o.total}</div>
                    <div className="text-xs text-muted-foreground">
                      {STATUS_LABEL[o.status] || o.status}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))
        )}

        {!loading && orders.length > 0 && (
          <SupportCard compact className="pt-2" />
        )}
      </main>
    </>
  );
}
