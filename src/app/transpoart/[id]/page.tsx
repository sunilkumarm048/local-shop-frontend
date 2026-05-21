'use client';

import dynamic from 'next/dynamic';
import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Bike,
  CheckCircle2,
  Clock,
  Loader2,
  PackageCheck,
  Phone,
  Truck,
  XCircle,
} from 'lucide-react';

import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/stores/auth';
import { getSocket } from '@/lib/socket';
import { ApiError } from '@/lib/api';
import {
  cancelTransport,
  fetchTransportOrder,
  type TransportOrder,
} from '@/lib/transport';

const DeliveryMap = dynamic(() => import('@/components/delivery/DeliveryMap'), {
  ssr: false,
  loading: () => (
    <div className="h-[260px] rounded-lg border bg-muted/40 flex items-center justify-center text-sm text-muted-foreground">
      Loading map…
    </div>
  ),
});

interface LatLng {
  lat: number;
  lng: number;
}

const STATUS_STEPS = [
  { key: 'placed', label: 'Booked', icon: CheckCircle2 },
  { key: 'accepted', label: 'Partner assigned', icon: Clock },
  { key: 'picked_up', label: 'Picked up', icon: PackageCheck },
  { key: 'in_transit', label: 'In transit', icon: Truck },
  { key: 'delivered', label: 'Delivered', icon: CheckCircle2 },
];

const STATUS_DISPLAY_MAP: Record<string, string> = {
  pending_payment: 'placed',
};

export default function TransportTrackingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const token = useAuth((s) => s.token);

  const [order, setOrder] = useState<TransportOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [partnerPos, setPartnerPos] = useState<LatLng | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  useEffect(() => {
    fetchTransportOrder(id)
      .then((r) => setOrder(r.order))
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load booking.'));
  }, [id]);

  // Subscribe to live updates — backend emits `order:status_update` with
  // `kind: 'transport'`, and `delivery:location` once the partner is moving.
  useEffect(() => {
    if (!token) return;
    const socket = getSocket(token);
    if (!socket) return;

    socket.emit('order:join', { orderId: id });

    function onStatusUpdate(payload: {
      orderId: string;
      status: TransportOrder['status'];
    }) {
      if (payload.orderId === id) {
        setOrder((prev) => (prev ? { ...prev, status: payload.status } : prev));
      }
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

  async function onCancel() {
    if (!confirm('Cancel this booking? This can\'t be undone.')) return;
    setCancelling(true);
    setCancelError(null);
    try {
      const r = await cancelTransport(id);
      setOrder(r.order);
    } catch (err) {
      setCancelError(err instanceof ApiError ? err.message : 'Could not cancel.');
    } finally {
      setCancelling(false);
    }
  }

  if (error) {
    return (
      <>
        <Header />
        <main className="container py-16 text-center space-y-3">
          <p className="text-destructive">{error}</p>
          <Button asChild variant="link">
            <Link href="/transport">Book another</Link>
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

  const displayStatus = STATUS_DISPLAY_MAP[order.status] || order.status;
  const statusIndex = STATUS_STEPS.findIndex((s) => s.key === displayStatus);
  const isCancelled = order.status === 'cancelled';
  const canCancel = ['placed', 'pending_payment'].includes(order.status);

  // Map coords — backend stores [lng, lat], map wants {lat, lng}.
  const pickupLL: LatLng = {
    lng: order.pickup.location.coordinates[0],
    lat: order.pickup.location.coordinates[1],
  };
  const dropLL: LatLng = {
    lng: order.drop.location.coordinates[0],
    lat: order.drop.location.coordinates[1],
  };

  // Re-use DeliveryMap by mapping transport's pickup→shop, drop→customer.
  // It already supports two legs and an active leg highlight.
  const partnerAssigned =
    typeof order.deliveryPartner === 'object' ||
    ['picked_up', 'in_transit', 'delivered'].includes(order.status);
  const showMap = !isCancelled;
  const activeLeg: 'to_shop' | 'to_customer' | null =
    order.status === 'accepted' || order.status === 'picked_up'
      ? 'to_shop'
      : order.status === 'in_transit'
        ? 'to_customer'
        : null;

  const partnerName =
    typeof order.deliveryPartner === 'object' && order.deliveryPartner
      ? order.deliveryPartner.name
      : null;
  const partnerPhone =
    typeof order.deliveryPartner === 'object' && order.deliveryPartner
      ? order.deliveryPartner.phone
      : null;

  return (
    <>
      <Header />
      <main className="container py-6 space-y-5 max-w-2xl">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Truck className="h-5 w-5 text-brand-green" />
            Transport booking
          </h1>
          <p className="text-sm text-muted-foreground">
            Booked {new Date(order.createdAt).toLocaleString()}
          </p>
        </div>

        {/* Live map */}
        {showMap && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Bike className="h-4 w-4 text-brand-green" />
                Route
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
                shop={pickupLL}
                customer={dropLL}
                activeLeg={activeLeg}
                height={260}
              />
              {!partnerAssigned && (
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  Waiting for a driver to accept your booking…
                </p>
              )}
              {partnerAssigned && !partnerPos && (
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  Driver assigned — their location will appear here once they&apos;re moving.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Driver card */}
        {partnerAssigned && partnerName && (
          <Card>
            <CardContent className="py-3 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-brand-greenLight flex items-center justify-center text-lg">
                🛵
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Your driver
                </div>
                <div className="font-medium">{partnerName}</div>
              </div>
              {partnerPhone && (
                <Button asChild variant="outline" size="sm">
                  <a href={`tel:${partnerPhone}`}>
                    <Phone className="h-4 w-4 mr-1.5" />
                    Call
                  </a>
                </Button>
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
              <div className="text-destructive font-medium flex items-center gap-2">
                <XCircle className="h-4 w-4" />
                Booking cancelled
              </div>
            ) : (
              <ol className="space-y-3">
                {STATUS_STEPS.map((step, i) => {
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
            )}
          </CardContent>
        </Card>

        {/* Route details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Route</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-start gap-2">
              <div className="h-7 w-7 rounded-full bg-brand-greenLight flex items-center justify-center shrink-0">
                📦
              </div>
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Pickup
                </div>
                <div className="font-medium">{order.pickup.name}</div>
                {order.pickup.address && (
                  <div className="text-xs text-muted-foreground">{order.pickup.address}</div>
                )}
                {order.pickup.phone && (
                  <div className="text-xs text-muted-foreground">{order.pickup.phone}</div>
                )}
              </div>
            </div>
            <div className="pl-9 -my-1 text-muted-foreground">
              <ArrowRight className="h-3 w-3 rotate-90" />
            </div>
            <div className="flex items-start gap-2">
              <div className="h-7 w-7 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
                🎯
              </div>
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Drop
                </div>
                <div className="font-medium">{order.drop.name}</div>
                {order.drop.address && (
                  <div className="text-xs text-muted-foreground">{order.drop.address}</div>
                )}
                {order.drop.phone && (
                  <div className="text-xs text-muted-foreground">{order.drop.phone}</div>
                )}
              </div>
            </div>

            {order.notes && (
              <div className="border-t pt-2 text-xs">
                <span className="text-muted-foreground">Notes for driver: </span>
                {order.notes}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Charges */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Charges</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <div className="flex justify-between text-muted-foreground">
              <span>Fare ({order.distanceKm ?? '?'} km)</span>
              <span>₹{order.fee}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Platform fee</span>
              <span>₹{order.platformFee}</span>
            </div>
            <div className="flex justify-between font-semibold pt-1 border-t">
              <span>Total</span>
              <span>₹{order.total}</span>
            </div>
            <div className="text-xs text-muted-foreground pt-2 flex gap-2 items-center">
              <Badge variant={order.payment?.method === 'cod' ? 'secondary' : 'default'}>
                {order.payment?.method === 'cod' ? 'Cash on delivery' : 'Online'}
              </Badge>
              {order.payment?.status && <span>· {order.payment.status}</span>}
            </div>
          </CardContent>
        </Card>

        {cancelError && (
          <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
            {cancelError}
          </div>
        )}

        <div className="flex items-center gap-2">
          <Button asChild variant="outline" className="flex-1">
            <Link href="/transport/my-bookings">All bookings</Link>
          </Button>
          {canCancel && (
            <Button
              variant="outline"
              className="text-destructive hover:text-destructive flex-1"
              onClick={onCancel}
              disabled={cancelling}
            >
              {cancelling ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <XCircle className="h-4 w-4 mr-2" />
              )}
              Cancel booking
            </Button>
          )}
        </div>
      </main>
    </>
  );
}
