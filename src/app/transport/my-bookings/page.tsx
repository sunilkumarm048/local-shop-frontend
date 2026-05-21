'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Loader2, Plus, Truck } from 'lucide-react';

import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/stores/auth';
import { ApiError } from '@/lib/api';
import { fetchMyTransportOrders, type TransportOrder } from '@/lib/transport';

type Filter = 'active' | 'all';

const STATUS_LABEL: Record<TransportOrder['status'], string> = {
  pending_payment: 'Pending payment',
  placed: 'Booked',
  accepted: 'Partner assigned',
  picked_up: 'Picked up',
  in_transit: 'In transit',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

function statusVariant(
  s: TransportOrder['status']
): 'default' | 'success' | 'warning' | 'destructive' | 'secondary' {
  if (s === 'delivered') return 'success';
  if (s === 'cancelled') return 'destructive';
  if (s === 'placed' || s === 'pending_payment') return 'warning';
  return 'default';
}

export default function MyTransportBookingsPage() {
  const router = useRouter();
  const token = useAuth((s) => s.token);

  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(useAuth.persist.hasHydrated());
    return useAuth.persist.onFinishHydration(() => setHydrated(true));
  }, []);
  useEffect(() => {
    if (hydrated && !token) router.replace('/login?next=/transport/my-bookings');
  }, [hydrated, token, router]);

  const [filter, setFilter] = useState<Filter>('active');
  const [orders, setOrders] = useState<TransportOrder[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setOrders(null);
    fetchMyTransportOrders(filter)
      .then((r) => {
        if (!cancelled) setOrders(r.orders);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof ApiError ? e.message : 'Could not load.');
      });
    return () => {
      cancelled = true;
    };
  }, [filter, token]);

  if (!hydrated || !token) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Loading…
      </div>
    );
  }

  return (
    <>
      <Header />
      <main className="container py-5 space-y-4 max-w-2xl">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Truck className="h-5 w-5 text-brand-green" />
              My transport bookings
            </h1>
          </div>
          <Button asChild>
            <Link href="/transport">
              <Plus className="h-4 w-4 mr-1.5" />
              Book new
            </Link>
          </Button>
        </div>

        <div className="flex gap-1 border-b">
          {(['active', 'all'] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px capitalize transition-colors ${
                filter === f
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {error && (
          <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
            {error}
          </div>
        )}

        {orders === null ? (
          <div className="py-10 flex items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Loading…
          </div>
        ) : orders.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center space-y-3">
              <div className="text-4xl">📦</div>
              <p className="text-sm text-muted-foreground">
                No {filter === 'active' ? 'active' : ''} transport bookings yet.
              </p>
              <Button asChild>
                <Link href="/transport">Book one</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {orders.map((o) => (
              <BookingRow key={o._id} order={o} />
            ))}
          </div>
        )}
      </main>
    </>
  );
}

function BookingRow({ order }: { order: TransportOrder }) {
  const shortId = order._id.slice(-6).toUpperCase();
  return (
    <Link href={`/transport/${order._id}`} className="block">
      <Card className="hover:bg-accent/30 transition-colors">
        <CardContent className="py-3 space-y-2">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold">#{shortId}</span>
              <Badge variant={statusVariant(order.status)}>{STATUS_LABEL[order.status]}</Badge>
            </div>
            <div className="text-right">
              <div className="font-semibold">₹{order.total}</div>
              <div className="text-xs text-muted-foreground">
                {order.distanceKm ?? '?'} km
              </div>
            </div>
          </div>

          <div className="text-xs space-y-0.5">
            <div className="flex items-start gap-1.5">
              <span aria-hidden>📦</span>
              <span className="text-muted-foreground truncate">{order.pickup.address}</span>
            </div>
            <div className="flex items-start gap-1.5">
              <span aria-hidden>🎯</span>
              <span className="text-muted-foreground truncate">{order.drop.address}</span>
            </div>
          </div>

          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>{new Date(order.createdAt).toLocaleString()}</span>
            <ArrowRight className="h-3 w-3" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
