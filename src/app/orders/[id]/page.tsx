'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Clock, Package, Truck } from 'lucide-react';

import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { fetchOrder } from '@/lib/orders';
import { useAuth } from '@/stores/auth';
import { getSocket } from '@/lib/socket';

const STATUS_STEPS = [
  { key: 'placed', label: 'Placed', icon: CheckCircle2 },
  { key: 'accepted', label: 'Accepted', icon: Clock },
  { key: 'preparing', label: 'Preparing', icon: Package },
  { key: 'out_for_delivery', label: 'On the way', icon: Truck },
  { key: 'delivered', label: 'Delivered', icon: CheckCircle2 },
];

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
  shop: { name: string; logo?: string };
  items: Array<{ name: string; qty: number; price: number }>;
  recipient: { name: string; phone: string; address: string };
  payment: { method: string; status: string };
  createdAt: string;
  placedAt?: string;
  deliveredAt?: string;
}

export default function OrderDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const token = useAuth((s) => s.token);

  const [order, setOrder] = useState<OrderShape | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchOrder(id)
      .then((r) => setOrder(r.order as unknown as OrderShape))
      .catch((e) => setError(e.message || 'Could not load order'));
  }, [id]);

  // Subscribe to live updates for this order
  useEffect(() => {
    if (!token) return;
    const socket = getSocket(token);
    if (!socket) return;

    socket.emit('order:join', { orderId: id });
    const onStatus = (payload: { orderId: string; status: string }) => {
      if (payload.orderId === id) {
        setOrder((prev) => (prev ? { ...prev, status: payload.status } : prev));
      }
    };
    socket.on('order:status', onStatus);

    return () => {
      socket.off('order:status', onStatus);
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

  const statusIndex = STATUS_STEPS.findIndex((s) => s.key === order.status);
  const isCancelled = order.status === 'cancelled' || order.status === 'refunded';

  return (
    <>
      <Header />
      <main className="container py-6 space-y-6 max-w-2xl">
        <div>
          <h1 className="text-2xl font-bold">Order from {order.shop.name}</h1>
          <p className="text-sm text-muted-foreground">
            Placed {new Date(order.createdAt).toLocaleString()}
          </p>
        </div>

        {/* Status tracker */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status</CardTitle>
          </CardHeader>
          <CardContent>
            {isCancelled ? (
              <div className="text-destructive font-medium">Order {order.status}</div>
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
