'use client';

import dynamic from 'next/dynamic';
import { use, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Clock, Package, Truck, PackageCheck, Bike, Phone } from 'lucide-react';

import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { fetchOrder } from '@/lib/orders';
import { useAuth } from '@/stores/auth';
import { getSocket } from '@/lib/socket';
import {
  initNotificationSound,
  playCustomerUpdate,
} from '@/lib/notificationSound';
import { PushSetup } from '@/components/notifications/PushSetup';
import { SupportCard } from '@/components/support/SupportCard';

// Leaflet on the map → dynamic with ssr:false. Reuses the delivery-side map
// component (it doesn't care who's viewing it).
const DeliveryMap = dynamic(() => import('@/components/delivery/DeliveryMap'), {
  ssr: false,
  loading: () => (
    <div className="h-[260px] rounded-lg border bg-muted/40 flex items-center justify-center text-sm text-muted-foreground">
      Loading map…
    </div>
  ),
});

// Split the lifecycle into two phases the customer sees separately:
// the shop preparing the order, then the delivery partner bringing it.
const SHOP_STEPS = [
  { key: 'placed', label: 'Placed', icon: CheckCircle2 },
  { key: 'accepted', label: 'Accepted', icon: Clock },
  { key: 'preparing', label: 'Preparing', icon: Package },
];

const DELIVERY_STEPS = [
  { key: 'picked_up', label: 'Picked up', icon: PackageCheck },
  { key: 'out_for_delivery', label: 'On the way', icon: Truck },
  { key: 'delivered', label: 'Delivered', icon: CheckCircle2 },
];

// Combined order used to compute how far the order has progressed overall.
const STATUS_STEPS = [...SHOP_STEPS, ...DELIVERY_STEPS];

// Human-readable vehicle labels for the partner card.
const VEHICLE_LABELS: Record<string, string> = {
  bike: 'Bike',
  '3wheeler': '3-Wheeler',
  tataAce: 'Tata Ace',
  pickup8ft: 'Pickup (8ft)',
  tata407: 'Tata 407',
};

// Statuses that fold into an earlier visible step (so the tracker doesn't jump
// forward and back when the order transits through `ready_for_pickup`).
const STATUS_DISPLAY_MAP: Record<string, string> = {
  ready_for_pickup: 'preparing',
};

interface PageProps {
  params: Promise<{ id: string }>;
}

interface OrderShape {
  _id: string;
  total: number;
  subtotal: number;
  deliveryFee: number;
  platformFee: number;
  handlingFee: number;
  discount?: { amount: number; label?: string };
  status: string;
  shop: {
    name: string;
    logo?: string;
    location?: { type: 'Point'; coordinates: [number, number] };
  };
  items: Array<{ name: string; qty: number; price: number }>;
  recipient: {
    name: string;
    phone: string;
    address: string;
    location?: { type: 'Point'; coordinates: [number, number] };
  };
  payment: { method: string; status: string };
  deliveryPartner?: {
    _id: string;
    name?: string | null;
    phone?: string | null;
    vehicleType?: string | null;
    vehicleNumber?: string | null;
  } | null;
  createdAt: string;
  placedAt?: string;
  deliveredAt?: string;
}

interface LatLng {
  lat: number;
  lng: number;
}

export default function OrderDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const token = useAuth((s) => s.token);

  const [order, setOrder] = useState<OrderShape | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [partnerPos, setPartnerPos] = useState<LatLng | null>(null);

  useEffect(() => {
    fetchOrder(id)
      .then((r) => {
        const ord = r.order as unknown as OrderShape;
        setOrder(ord);
        seenStatusRef.current = ord.status; // seed so first socket event doesn't chime
      })
      .catch((e) => setError(e.message || 'Could not load order'));
  }, [id]);

  // Init audio + prevent the initial fetch from triggering a chime (we only
  // want to chime on REAL transitions, not the first render).
  const seenStatusRef = useRef<string | null>(null);
  useEffect(() => {
    initNotificationSound();
  }, []);

  // Subscribe to live updates for this order.
  // Phase 4b/5a backend emits `order:status_update` (NOT `order:status` —
  // that was a bug in the v3 client that silently never matched).
  // Phase 5b adds `delivery:location` while the partner is moving.
  useEffect(() => {
    if (!token) return;
    const socket = getSocket(token);
    if (!socket) return;

    socket.emit('order:join', { orderId: id });

    function onStatusUpdate(payload: { orderId: string; status: string }) {
      if (payload.orderId !== id) return;
      // Chime only on a real status CHANGE — the first event after the fetch
      // primes the ref, so we don't chime on initial reconciliation.
      if (
        seenStatusRef.current !== null &&
        seenStatusRef.current !== payload.status
      ) {
        playCustomerUpdate();
      }
      seenStatusRef.current = payload.status;
      setOrder((prev) => (prev ? { ...prev, status: payload.status } : prev));
    }

    function onPartnerLocation(payload: { orderId: string; lat: number; lng: number }) {
      if (payload.orderId === id) {
        setPartnerPos({ lat: payload.lat, lng: payload.lng });
      }
    }

    socket.on('order:status_update', onStatusUpdate);
    socket.on('delivery:location', onPartnerLocation);

    return () => {
      socket.off('order:status_update', onStatusUpdate);
      socket.off('delivery:location', onPartnerLocation);
      socket.emit('order:leave', { orderId: id });
    };
  }, [id, token]);

  if (error) {
    return (
      <>
        <Header />
        <main className="container py-16 text-center">
          <p className="text-destructive">{error}</p>
          <Button asChild variant="link">
            <Link href="/customer">Back to shops</Link>
          </Button>
        </main>
      </>
    );
  }

  if (!order) {
    return (
      <>
        <Header />
        <main className="container py-6">
          <div className="h-32 rounded-xl bg-muted animate-pulse" />
        </main>
      </>
    );
  }

  // Map raw status to display status, then find its index in the visible list.
  const displayStatus = STATUS_DISPLAY_MAP[order.status] || order.status;
  const statusIndex = STATUS_STEPS.findIndex((s) => s.key === displayStatus);
  const isCancelled = order.status === 'cancelled' || order.status === 'refunded';

  // Extract coords for the map.
  const shopCoords = order.shop.location?.coordinates;
  const shopLL = shopCoords ? { lng: shopCoords[0], lat: shopCoords[1] } : null;
  const custCoords = order.recipient.location?.coordinates;
  const custLL = custCoords ? { lng: custCoords[0], lat: custCoords[1] } : null;

  // Show the map once a partner is assigned (status has advanced past
  // preparing). Before that, nothing's moving — no point.
  const partnerAssigned =
    !!order.deliveryPartner ||
    ['picked_up', 'out_for_delivery', 'delivered'].includes(order.status);
  const showMap = partnerAssigned && shopLL && !isCancelled;

  const activeLeg: 'to_shop' | 'to_customer' | null =
    order.status === 'picked_up' || order.status === 'ready_for_pickup'
      ? 'to_shop'
      : order.status === 'out_for_delivery'
        ? 'to_customer'
        : null;

  return (
    <>
      <Header />
      <main className="container py-6 space-y-6 max-w-2xl">
        <PushSetup
          headline="Get order updates"
          subline="Know the moment your order is accepted, on the way, and delivered — even with the app closed."
        />

        <div>
          <h1 className="text-2xl font-bold">Order from {order.shop.name}</h1>
          <p className="text-sm text-muted-foreground">
            Placed {new Date(order.createdAt).toLocaleString()}
          </p>
        </div>

        {/* Live delivery map */}
        {showMap && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Bike className="h-4 w-4 text-brand-green" />
                Live delivery
                {partnerPos && (
                  <span className="text-xs font-normal text-brand-green ml-auto">
                    Tracking
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DeliveryMap
                partner={partnerPos}
                shop={shopLL}
                customer={custLL}
                activeLeg={activeLeg}
                height={260}
              />
              {!partnerPos && (
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  Your delivery partner&apos;s location will appear here once they start
                  moving.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Status tracker */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status</CardTitle>
          </CardHeader>
          <CardContent>
            {isCancelled ? (
              <div className="text-destructive font-medium">Order {order.status}</div>
            ) : (
              <div className="space-y-5">
                {/* Shop phase */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                    Shop
                  </p>
                  <ol className="space-y-3">
                    {SHOP_STEPS.map((step) => {
                      const i = STATUS_STEPS.findIndex((s) => s.key === step.key);
                      const Icon = step.icon;
                      const done = i <= statusIndex;
                      const active = i === statusIndex;
                      return (
                        <li key={step.key} className="flex items-center gap-3">
                          <div
                            className={`h-8 w-8 rounded-full flex items-center justify-center ${
                              done
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            <Icon className="h-4 w-4" />
                          </div>
                          <span
                            className={`text-sm ${
                              active ? 'font-semibold' : done ? '' : 'text-muted-foreground'
                            }`}
                          >
                            {step.label}
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                </div>

                {/* Delivery phase */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                    Delivery
                  </p>

                  {/* Delivery partner card — shown once a partner is assigned */}
                  {order.deliveryPartner && (
                    <div className="mb-3 rounded-lg border bg-muted/40 p-3">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Bike className="h-4 w-4 text-primary shrink-0" />
                        <span>{order.deliveryPartner.name || 'Delivery partner'}</span>
                      </div>
                      <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                        {(order.deliveryPartner.vehicleType ||
                          order.deliveryPartner.vehicleNumber) && (
                          <div>
                            {[
                              order.deliveryPartner.vehicleType
                                ? VEHICLE_LABELS[order.deliveryPartner.vehicleType] ||
                                  order.deliveryPartner.vehicleType
                                : null,
                              order.deliveryPartner.vehicleNumber,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </div>
                        )}
                      </div>
                      {order.deliveryPartner.phone && (
                        <a href={`tel:${order.deliveryPartner.phone}`} className="mt-2 inline-block">
                          <Button size="sm" variant="outline">
                            <Phone className="h-4 w-4 mr-2" />
                            Call {order.deliveryPartner.phone}
                          </Button>
                        </a>
                      )}
                    </div>
                  )}

                  <ol className="space-y-3">
                    {DELIVERY_STEPS.map((step) => {
                      const i = STATUS_STEPS.findIndex((s) => s.key === step.key);
                      const Icon = step.icon;
                      const done = i <= statusIndex;
                      const active = i === statusIndex;
                      return (
                        <li key={step.key} className="flex items-center gap-3">
                          <div
                            className={`h-8 w-8 rounded-full flex items-center justify-center ${
                              done
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            <Icon className="h-4 w-4" />
                          </div>
                          <span
                            className={`text-sm ${
                              active ? 'font-semibold' : done ? '' : 'text-muted-foreground'
                            }`}
                          >
                            {step.label}
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Support — available while the order is in progress */}
        {!isCancelled && order.status !== 'delivered' && (
          <SupportCard orderId={order._id} />
        )}

        {/* Items */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Items</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {order.items.map((it, i) => (
              <div key={i} className="flex justify-between">
                <span>
                  {it.name} × {it.qty}
                </span>
                <span>₹{it.price * it.qty}</span>
              </div>
            ))}
            <div className="border-t pt-3 mt-3 space-y-1">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span>₹{order.subtotal}</span>
              </div>
              {order.discount && order.discount.amount > 0 && (
                <div className="flex justify-between text-primary">
                  <span>Discount</span>
                  <span>−₹{order.discount.amount}</span>
                </div>
              )}
              <div className="flex justify-between text-muted-foreground">
                <span>Delivery + fees</span>
                <span>₹{order.deliveryFee + order.handlingFee + order.platformFee}</span>
              </div>
              <div className="flex justify-between font-semibold pt-1">
                <span>Total</span>
                <span>₹{order.total}</span>
              </div>
            </div>
            <div className="text-xs text-muted-foreground pt-2">
              {order.payment.method === 'razorpay' ? 'Paid online' : 'Cash on delivery'} ·{' '}
              {order.payment.status}
            </div>
          </CardContent>
        </Card>

        {/* Delivery to */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Delivering to</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <div className="font-medium">{order.recipient.name}</div>
            <div className="text-muted-foreground">{order.recipient.phone}</div>
            <div className="text-muted-foreground">{order.recipient.address}</div>
          </CardContent>
        </Card>

        <Button asChild variant="outline" className="w-full">
          <Link href="/orders">View all orders</Link>
        </Button>
      </main>
    </>
  );
}
