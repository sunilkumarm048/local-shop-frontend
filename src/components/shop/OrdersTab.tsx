'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Loader2,
  PackageX,
  Phone,
  MapPin,
  Clock,
  Check,
  X,
  ChefHat,
  PackageCheck,
  Scissors,
  Bell,
  BellOff,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/stores/auth';
import { getSocket } from '@/lib/socket';
import { ApiError } from '@/lib/api';
import {
  playNotification,
  isNotificationMuted,
  setNotificationMuted,
} from '@/lib/notificationSound';
import {
  fetchShopOrders,
  fetchOrderSiblings,
  acceptOrder,
  rejectOrder,
  markPreparing,
  markReady,
  type OwnerOrder,
  type OrderStatus,
  type OrderSibling,
} from '@/lib/owner-orders';

interface Props {
  shopId: string;
}

// Tab definition: which statuses fall under each filter.
type TabId = 'all' | 'new' | 'preparing' | 'ready';
const TAB_STATUSES: Record<Exclude<TabId, 'all'>, OrderStatus[]> = {
  new: ['placed'],
  preparing: ['accepted', 'preparing'],
  ready: ['ready_for_pickup'],
};

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending_payment: 'Pending payment',
  placed: 'New',
  accepted: 'Accepted',
  preparing: 'Preparing',
  ready_for_pickup: 'Ready for pickup',
  picked_up: 'Picked up',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
};

function statusVariant(s: OrderStatus): 'default' | 'success' | 'warning' | 'destructive' | 'secondary' {
  if (s === 'placed') return 'warning';
  if (s === 'accepted' || s === 'preparing') return 'default';
  if (s === 'ready_for_pickup') return 'success';
  if (s === 'cancelled' || s === 'refunded') return 'destructive';
  return 'secondary';
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function OrdersTab({ shopId }: Props) {
  const token = useAuth((s) => s.token);

  const [orders, setOrders] = useState<OwnerOrder[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>('all');
  const [newPing, setNewPing] = useState(false);
  // Notification sound mute toggle. Initial value is read from localStorage
  // on mount (after hydration) — we can't read it during render because that
  // would mismatch SSR. The initial false here is fine for the first paint
  // since unmute is the default state for everyone anyway.
  const [muted, setMuted] = useState(false);
  useEffect(() => {
    setMuted(isNotificationMuted());
  }, []);

  // Keep a ref of the current orders so the socket handler (registered once)
  // can read fresh state without re-subscribing on every update.
  const ordersRef = useRef<OwnerOrder[] | null>(null);
  ordersRef.current = orders;

  const refresh = useCallback(async () => {
    try {
      const r = await fetchShopOrders(shopId, 'active');
      setOrders(r.orders);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Could not load orders.');
    }
  }, [shopId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // ---- Socket.IO live updates ----
  // The shop owner's socket auto-joins `shop:<id>` on connect (Phase 4a
  // change in sockets/index.js). We just listen for the two events the
  // backend emits.
  useEffect(() => {
    const socket = getSocket(token);
    if (!socket) return;

    function onNewOrder() {
      // A new order landed for one of the owner's shops. Re-fetch the list
      // (cheap, capped at 200) rather than trying to merge a partial payload.
      playNotification();
      setNewPing(true);
      setTimeout(() => setNewPing(false), 4_000);
      refresh();
    }

    function onStatusUpdate(payload: { orderId: string; status: OrderStatus; shopId: string }) {
      // Could be from this owner's other tab/device. Patch in place if we
      // have the order; otherwise re-fetch (it may have just become active).
      const current = ordersRef.current;
      if (current?.some((o) => o._id === payload.orderId)) {
        setOrders((prev) =>
          prev
            ? prev.map((o) =>
                o._id === payload.orderId ? { ...o, status: payload.status } : o
              )
            : prev
        );
      } else {
        refresh();
      }
    }

    socket.on('order:new', onNewOrder);
    socket.on('order:status_update', onStatusUpdate);
    return () => {
      socket.off('order:new', onNewOrder);
      socket.off('order:status_update', onStatusUpdate);
    };
  }, [token, refresh]);

  // ---- Derived: counts + filtered view ----
  const visible = (orders || []).filter((o) => {
    if (tab === 'all') return true;
    return TAB_STATUSES[tab].includes(o.status);
  });

  const counts = {
    all: orders?.length ?? 0,
    new: (orders || []).filter((o) => TAB_STATUSES.new.includes(o.status)).length,
    preparing: (orders || []).filter((o) => TAB_STATUSES.preparing.includes(o.status)).length,
    ready: (orders || []).filter((o) => TAB_STATUSES.ready.includes(o.status)).length,
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            Orders
            {newPing && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-brand-green">
                <Bell className="h-3.5 w-3.5 animate-bounce" />
                New order
              </span>
            )}
          </h2>
          <p className="text-sm text-muted-foreground">
            {orders ? `${counts.all} active` : 'Loading…'} · updates live
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            aria-label={muted ? 'Unmute order sound' : 'Mute order sound'}
            title={muted ? 'Order sound is off — tap to turn on' : 'Order sound is on — tap to mute'}
            onClick={() => {
              const next = !muted;
              setMuted(next);
              setNotificationMuted(next);
              // Play once on unmute so the owner hears what to expect AND
              // so the browser unlocks autoplay for subsequent events.
              if (!next) playNotification();
            }}
            className={muted ? 'text-muted-foreground' : 'text-brand-green'}
          >
            {muted ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
          </Button>
          <Button variant="outline" size="sm" onClick={refresh}>
            Refresh
          </Button>
        </div>
      </div>

      {loadError && (
        <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
          {loadError}
        </div>
      )}

      {/* Status tabs */}
      <div className="flex gap-1 overflow-x-auto border-b">
        {(
          [
            ['all', 'All'],
            ['new', '⏳ New'],
            ['preparing', '👨‍🍳 Preparing'],
            ['ready', '📦 Ready'],
          ] as Array<[TabId, string]>
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${
              tab === id
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {label}
            <span
              className={`text-xs rounded-full px-1.5 min-w-5 text-center ${
                tab === id ? 'bg-primary text-primary-foreground' : 'bg-muted'
              }`}
            >
              {counts[id]}
            </span>
          </button>
        ))}
      </div>

      {/* List */}
      {orders === null ? (
        <div className="py-10 flex items-center justify-center text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          Loading orders…
        </div>
      ) : visible.length === 0 ? (
        <EmptyState tab={tab} />
      ) : (
        <div className="space-y-3">
          {visible.map((order) => (
            <OrderCard key={order._id} order={order} onChanged={refresh} />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function EmptyState({ tab }: { tab: TabId }) {
  const copy: Record<TabId, { title: string; sub: string }> = {
    all: { title: 'No active orders', sub: 'New orders appear here the moment a customer checks out.' },
    new: { title: 'No new orders', sub: 'Unaccepted orders will show up here.' },
    preparing: { title: 'Nothing being prepared', sub: 'Orders you accept move here.' },
    ready: { title: 'Nothing ready yet', sub: 'Mark orders ready and they wait here for pickup.' },
  };
  const { title, sub } = copy[tab];
  return (
    <Card>
      <CardContent className="py-10 flex flex-col items-center gap-2 text-center">
        <PackageX className="h-10 w-10 text-muted-foreground" />
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground max-w-xs">{sub}</p>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------

interface OrderCardProps {
  order: OwnerOrder;
  onChanged: () => void | Promise<void>;
}

function OrderCard({ order, onChanged }: OrderCardProps) {
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [siblings, setSiblings] = useState<OrderSibling[] | null>(null);
  const [siblingsOpen, setSiblingsOpen] = useState(false);

  async function runAction(label: string, fn: () => Promise<unknown>) {
    setBusy(label);
    setActionError(null);
    try {
      await fn();
      await onChanged();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Action failed.');
    } finally {
      setBusy(null);
    }
  }

  async function toggleSiblings() {
    if (siblingsOpen) {
      setSiblingsOpen(false);
      return;
    }
    setSiblingsOpen(true);
    if (siblings === null) {
      try {
        const r = await fetchOrderSiblings(order._id);
        setSiblings(r.siblings);
      } catch {
        setSiblings([]);
      }
    }
  }

  const shortId = order._id.slice(-6).toUpperCase();
  const itemCount = order.items.reduce((s, i) => s + i.qty, 0);

  return (
    <Card className={order.status === 'placed' ? 'border-brand-yellowDark/60' : ''}>
      <CardContent className="pt-4 space-y-3">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold">#{shortId}</span>
            <Badge variant={statusVariant(order.status)}>{STATUS_LABEL[order.status]}</Badge>
            {order.isSplit && (
              <Badge variant="warning" className="gap-1">
                <Scissors className="h-3 w-3" />
                Split
              </Badge>
            )}
            <Badge variant="secondary">{order.payment?.method === 'cod' ? 'COD' : 'Prepaid'}</Badge>
          </div>
          <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
            <Clock className="h-3 w-3" />
            {timeAgo(order.createdAt)}
          </span>
        </div>

        {/* Items */}
        <div className="text-sm space-y-1">
          {order.items.map((it, idx) => (
            <div key={idx} className="flex justify-between gap-2">
              <span className="text-muted-foreground">
                {it.qty}× {it.name}
                {it.weight ? ` (${it.weight})` : ''}
              </span>
              <span>₹{it.price * it.qty}</span>
            </div>
          ))}
          <div className="flex justify-between font-medium pt-1 border-t">
            <span>
              {itemCount} item{itemCount !== 1 ? 's' : ''} · total
            </span>
            <span>₹{order.total}</span>
          </div>
        </div>

        {/* Recipient */}
        {order.recipient && (
          <div className="text-xs text-muted-foreground space-y-0.5 bg-muted/40 rounded-md px-2.5 py-2">
            {order.recipient.name && (
              <div className="font-medium text-foreground">{order.recipient.name}</div>
            )}
            {order.recipient.phone && (
              <div className="flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {order.recipient.phone}
              </div>
            )}
            {order.recipient.address && (
              <div className="flex items-start gap-1">
                <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                {order.recipient.address}
              </div>
            )}
          </div>
        )}

        {/* Split siblings */}
        {order.isSplit && (
          <div>
            <button
              type="button"
              onClick={toggleSiblings}
              className="text-xs text-primary font-medium hover:underline"
            >
              {siblingsOpen ? 'Hide' : 'Show'} other shops in this order
            </button>
            {siblingsOpen && (
              <div className="mt-2 space-y-1.5">
                {siblings === null ? (
                  <p className="text-xs text-muted-foreground">Loading…</p>
                ) : siblings.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No sibling shops found.</p>
                ) : (
                  siblings.map((sib) => (
                    <div
                      key={sib._id}
                      className="flex items-center justify-between text-xs bg-muted/40 rounded px-2 py-1.5"
                    >
                      <span className="font-medium">{sib.shop?.name || 'Shop'}</span>
                      <Badge variant={statusVariant(sib.status)}>
                        {STATUS_LABEL[sib.status]}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {actionError && (
          <div className="text-xs text-destructive bg-destructive/10 rounded px-2 py-1.5">
            {actionError}
          </div>
        )}

        {/* Lifecycle actions */}
        <OrderActions order={order} busy={busy} runAction={runAction} />
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------

interface ActionsProps {
  order: OwnerOrder;
  busy: string | null;
  runAction: (label: string, fn: () => Promise<unknown>) => Promise<void>;
}

/**
 * Renders the buttons valid for the order's current status. Mirrors the
 * backend OWNER_TRANSITIONS guard — the server is still the source of truth,
 * this just hides buttons that would 409.
 */
function OrderActions({ order, busy, runAction }: ActionsProps) {
  const anyBusy = busy !== null;

  if (order.status === 'placed') {
    return (
      <div className="flex gap-2">
        <Button
          variant="outline"
          className="flex-1 text-destructive hover:text-destructive"
          disabled={anyBusy}
          onClick={() => runAction('reject', () => rejectOrder(order._id))}
        >
          {busy === 'reject' ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <X className="h-4 w-4 mr-2" />
          )}
          Reject
        </Button>
        <Button
          className="flex-1"
          disabled={anyBusy}
          onClick={() => runAction('accept', () => acceptOrder(order._id))}
        >
          {busy === 'accept' ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Check className="h-4 w-4 mr-2" />
          )}
          Accept
        </Button>
      </div>
    );
  }

  if (order.status === 'accepted') {
    return (
      <Button
        className="w-full"
        disabled={anyBusy}
        onClick={() => runAction('preparing', () => markPreparing(order._id))}
      >
        {busy === 'preparing' ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <ChefHat className="h-4 w-4 mr-2" />
        )}
        Start preparing
      </Button>
    );
  }

  if (order.status === 'preparing') {
    return (
      <Button
        className="w-full"
        disabled={anyBusy}
        onClick={() => runAction('ready', () => markReady(order._id))}
      >
        {busy === 'ready' ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <PackageCheck className="h-4 w-4 mr-2" />
        )}
        Mark ready for pickup
      </Button>
    );
  }

  if (order.status === 'ready_for_pickup') {
    return (
      <div className="text-xs text-center text-muted-foreground bg-brand-greenLight/40 rounded-md py-2">
        Waiting for a delivery partner to pick this up.
      </div>
    );
  }

  // picked_up / out_for_delivery / delivered / cancelled — no owner action
  return null;
}
  
