'use client';

import { useEffect } from 'react';

import { getSocket } from '@/lib/socket';
import { useAuth } from '@/stores/auth';
import { useNotifications } from '@/stores/notifications';
import {
  bumpUnread,
  playNotificationSound,
  setupTabFlasher,
  unlockAudio,
} from '@/lib/notification-sound';

/**
 * Global socket listener — mounts once at app root, subscribes to events
 * relevant to whatever role the current user holds, and dispatches
 * notifications.
 *
 * This runs in parallel with the per-component listeners that exist for
 * data refresh logic (e.g. OrdersTab's `onNewOrder` re-fetches the list).
 * We don't replace those — different concerns. This listener cares about
 * alerting the user; existing listeners care about syncing UI state.
 *
 * Audio unlock: iOS Safari rejects audio.play() until user has interacted.
 * We register a one-shot click handler on first mount that primes audio.
 */
export function NotificationListener() {
  const token = useAuth((s) => s.token);
  const user = useAuth((s) => s.user);

  // One-time setup on mount
  useEffect(() => {
    setupTabFlasher();
    const unlock = () => {
      unlockAudio();
      window.removeEventListener('click', unlock);
      window.removeEventListener('touchstart', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('click', unlock, { once: true });
    window.addEventListener('touchstart', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('click', unlock);
      window.removeEventListener('touchstart', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  useEffect(() => {
    if (!token || !user) return;
    const socket = getSocket(token);
    if (!socket) return;

    const push = useNotifications.getState().push;
    const roles = user.roles || [];

    // ---------- Shop owner events ----------
    const onNewOrder = () => {
      push({
        kind: 'new-order',
        title: 'New order!',
        body: 'A customer just placed an order. Tap to view.',
        href: '/shop',
      });
      playNotificationSound('new-order');
      bumpUnread();
    };

    // ---------- Status update — interpreted differently per role ----------
    const onStatusUpdate = (payload: {
      orderId: string;
      status: string;
      shopId?: string;
    }) => {
      // For shop owners: a delivered status is informational
      // For customers: every status is interesting
      const isCustomer = roles.includes('customer') && !roles.includes('shop');
      if (isCustomer) {
        push({
          kind: 'order-status',
          title: 'Order update',
          body: `Status: ${humanStatus(payload.status)}`,
          href: `/orders/${payload.orderId}`,
        });
        playNotificationSound('order-status');
        bumpUnread();
      } else if (roles.includes('shop') && payload.status === 'delivered') {
        push({
          kind: 'order-status',
          title: 'Order delivered',
          body: 'A customer order completed its delivery.',
          href: '/shop',
        });
        playNotificationSound('order-status');
        bumpUnread();
      }
    };

    // ---------- Delivery partner events ----------
    const onJobAssigned = (payload: { orderId?: string; kind?: 'transport' }) => {
      push({
        kind: 'new-job',
        title: 'New job assigned!',
        body: payload.kind === 'transport'
          ? 'A transport booking was auto-assigned to you.'
          : 'A delivery job was auto-assigned to you.',
        href: '/delivery',
      });
      playNotificationSound('new-job');
      bumpUnread();
    };

    // ---------- Admin events ----------
    const onAdminNewShop = (payload: { shopId: string; name: string }) => {
      push({
        kind: 'admin-alert',
        title: 'New shop registered',
        body: `${payload.name} is awaiting approval.`,
        href: '/admin',
      });
      playNotificationSound('admin-alert');
      bumpUnread();
    };

    // Subscribe to role-relevant events. Each socket.on is idempotent on
    // the listener function — re-mounts cleanly via the off() cleanup.
    if (roles.includes('shop')) {
      socket.on('order:new', onNewOrder);
      socket.on('order:status_update', onStatusUpdate);
    }
    if (roles.includes('customer')) {
      socket.on('order:status_update', onStatusUpdate);
    }
    if (roles.includes('delivery')) {
      socket.on('job:assigned', onJobAssigned);
    }
    if (roles.includes('admin')) {
      socket.on('admin:new_shop', onAdminNewShop);
    }

    return () => {
      socket.off('order:new', onNewOrder);
      socket.off('order:status_update', onStatusUpdate);
      socket.off('job:assigned', onJobAssigned);
      socket.off('admin:new_shop', onAdminNewShop);
    };
  }, [token, user]);

  return null;
}

function humanStatus(status: string): string {
  const map: Record<string, string> = {
    pending: 'Pending',
    confirmed: 'Confirmed by shop',
    preparing: 'Being prepared',
    ready: 'Ready for pickup',
    picked_up: 'Picked up by delivery',
    out_for_delivery: 'Out for delivery',
    delivered: 'Delivered 🎉',
    cancelled: 'Cancelled',
  };
  return map[status] || status;
}
