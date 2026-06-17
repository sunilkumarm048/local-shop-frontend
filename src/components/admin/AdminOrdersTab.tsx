'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Phone, MapPin, User, Store, Truck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ApiError } from '@/lib/api';
import { fetchAdminOrders, type AdminOrder } from '@/lib/admin';

const STATUS_OPTIONS = [
  ['active', 'Active'],
  ['placed', 'Placed'],
  ['accepted', 'Accepted'],
  ['preparing', 'Preparing'],
  ['ready_for_pickup', 'Ready'],
  ['picked_up', 'Picked up'],
  ['out_for_delivery', 'Out for delivery'],
  ['delivered', 'Delivered'],
  ['cancelled', 'Cancelled'],
  ['all', 'All'],
] as const;

function statusVariant(s: string): 'default' | 'success' | 'warning' | 'destructive' | 'secondary' {
  if (s === 'placed') return 'warning';
  if (s === 'delivered') return 'success';
  if (s === 'cancelled' || s === 'refunded') return 'destructive';
  if (['accepted', 'preparing', 'ready_for_pickup', 'picked_up', 'out_for_delivery'].includes(s))
    return 'default';
  return 'secondary';
}

export function AdminOrdersTab() {
  const [status, setStatus] = useState<string>('active');
  const [orders, setOrders] = useState<AdminOrder[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const r = await fetchAdminOrders({ status });
      setOrders(r.orders);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Could not load orders.');
    } finally {
      setRefreshing(false);
    }
  }, [status]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold">Orders</h2>
          <p className="text-sm text-muted-foreground">
            {orders ? `${orders.length} order${orders.length === 1 ? '' : 's'}` : 'Loading…'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {STATUS_OPTIONS.map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
          <Button variant="outline" size="sm" onClick={refresh} disabled={refreshing}>
            {refreshing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Refreshing…
              </>
            ) : (
              'Refresh'
            )}
          </Button>
        </div>
      </div>

      {loadError && (
        <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
          {loadError}
        </div>
      )}

      {orders === null ? (
        <div className="py-10 flex items-center justify-center text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          Loading…
        </div>
      ) : orders.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No orders match.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {orders.map((o) => (
            <OrderRow key={o._id} order={o} />
          ))}
        </div>
      )}
    </div>
  );
}

function OrderRow({ order }: { order: AdminOrder }) {
  const shortId = order._id.slice(-6).toUpperCase();
  const itemCount = order.items.reduce((s, i) => s + i.qty, 0);

  return (
    <Card>
      <CardContent className="py-3 space-y-2">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold">#{shortId}</span>
            <Badge variant={statusVariant(order.status)}>{order.status}</Badge>
            {order.payment && (
              <Badge variant="secondary">
                {order.payment.method === 'cod' ? 'COD' : 'Prepaid'}
              </Badge>
            )}
            {order.isSplit && <Badge variant="warning">Split</Badge>}
          </div>
          <div className="text-right">
            <div className="font-semibold">₹{order.total}</div>
            <div className="text-xs text-muted-foreground">
              {itemCount} item{itemCount !== 1 ? 's' : ''}
            </div>
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-x-3 gap-y-2 text-xs text-muted-foreground">
          {/* Shop */}
          {order.shop && (
            <div className="space-y-0.5 min-w-0">
              <div className="flex items-center gap-1 text-foreground/80 font-medium">
                <Store className="h-3 w-3 shrink-0" />
                <span className="truncate">{order.shop.name}</span>
              </div>
              {order.shop.phone && (
                <a
                  href={`tel:${order.shop.phone}`}
                  className="flex items-center gap-1 hover:text-foreground"
                >
                  <Phone className="h-3 w-3 shrink-0" />
                  <span className="truncate">{order.shop.phone}</span>
                </a>
              )}
              {order.shop.address && (
                <div className="flex items-start gap-1">
                  <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                  <span className="line-clamp-2">
                    {[
                      order.shop.address.line1,
                      order.shop.address.line2,
                      order.shop.address.city,
                      order.shop.address.state,
                      order.shop.address.pincode,
                    ]
                      .filter(Boolean)
                      .join(', ')}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Customer + delivery address */}
          {(order.customer || order.recipient) && (
            <div className="space-y-0.5 min-w-0">
              <div className="flex items-center gap-1 text-foreground/80 font-medium">
                <User className="h-3 w-3 shrink-0" />
                <span className="truncate">
                  {order.recipient?.name ||
                    order.customer?.name ||
                    order.customer?.email ||
                    'Customer'}
                </span>
              </div>
              {(order.recipient?.phone || order.customer?.phone) && (
                <a
                  href={`tel:${order.recipient?.phone || order.customer?.phone}`}
                  className="flex items-center gap-1 hover:text-foreground"
                >
                  <Phone className="h-3 w-3 shrink-0" />
                  <span className="truncate">
                    {order.recipient?.phone || order.customer?.phone}
                  </span>
                </a>
              )}
              {order.recipient?.address && (
                <div className="flex items-start gap-1">
                  <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                  <span className="line-clamp-2">{order.recipient.address}</span>
                </div>
              )}
            </div>
          )}

          {/* Delivery partner + phone + time */}
          {order.deliveryPartner ? (
            <div className="space-y-0.5 min-w-0">
              <div className="flex items-center gap-1 text-foreground/80 font-medium">
                <Truck className="h-3 w-3 shrink-0" />
                <span className="truncate">{order.deliveryPartner.name || 'Partner'}</span>
              </div>
              {order.deliveryPartner.phone && (
                <a
                  href={`tel:${order.deliveryPartner.phone}`}
                  className="flex items-center gap-1 hover:text-foreground"
                >
                  <Phone className="h-3 w-3 shrink-0" />
                  <span className="truncate">{order.deliveryPartner.phone}</span>
                </a>
              )}
              <div className="text-[10px] text-muted-foreground/80">
                {order.status === 'delivered' ? 'Delivered' : 'Assigned'}:{' '}
                {new Date(order.updatedAt).toLocaleString()}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-muted-foreground/60 italic">
              <Truck className="h-3 w-3 shrink-0" />
              No partner yet
            </div>
          )}
        </div>

        <div className="text-[10px] text-muted-foreground">
          Ordered: {new Date(order.createdAt).toLocaleString()}
        </div>
      </CardContent>
    </Card>
  );
}
