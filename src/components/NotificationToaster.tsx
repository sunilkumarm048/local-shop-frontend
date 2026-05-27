'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { X, ShoppingBag, Package, Truck, ShieldAlert, Bell } from 'lucide-react';

import { useNotifications, type Notification, type NotificationKind } from '@/stores/notifications';

/**
 * Floating toast stack in the top-right corner. Each notification renders
 * for `ttl` ms, then auto-dismisses. Clicking the body navigates to `href`
 * if provided. The × button dismisses without navigating.
 *
 * Stack grows downward, newest on top. Capped to 5 visible at once via CSS
 * (older ones still in queue but offscreen).
 */

const ICONS: Record<NotificationKind, typeof Bell> = {
  'new-order': ShoppingBag,
  'order-status': Package,
  'new-job': Truck,
  'admin-alert': ShieldAlert,
  info: Bell,
};

const ACCENT_CLASSES: Record<NotificationKind, string> = {
  'new-order': 'border-l-brand-green',
  'order-status': 'border-l-blue-500',
  'new-job': 'border-l-orange-500',
  'admin-alert': 'border-l-red-500',
  info: 'border-l-gray-400',
};

export function NotificationToaster() {
  const queue = useNotifications((s) => s.queue);

  return (
    <div
      className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-[calc(100%-2rem)] sm:w-96 pointer-events-none"
      role="region"
      aria-label="Notifications"
      aria-live="polite"
    >
      {queue.slice(-5).map((n) => (
        <Toast key={n.id} notification={n} />
      ))}
    </div>
  );
}

function Toast({ notification }: { notification: Notification }) {
  const dismiss = useNotifications((s) => s.dismiss);
  const Icon = ICONS[notification.kind] || Bell;
  const accent = ACCENT_CLASSES[notification.kind] || 'border-l-gray-400';

  useEffect(() => {
    if (!notification.ttl) return;
    const t = setTimeout(() => dismiss(notification.id), notification.ttl);
    return () => clearTimeout(t);
  }, [notification.id, notification.ttl, dismiss]);

  const content = (
    <>
      <Icon className="h-5 w-5 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm truncate">{notification.title}</div>
        {notification.body && (
          <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{notification.body}</div>
        )}
      </div>
    </>
  );

  return (
    <div
      className={`pointer-events-auto bg-card text-card-foreground rounded-md shadow-lg border border-l-4 ${accent} animate-in slide-in-from-right-2 fade-in duration-200`}
    >
      <div className="flex items-start gap-2 p-3 pr-8 relative">
        {notification.href ? (
          <Link
            href={notification.href}
            onClick={() => dismiss(notification.id)}
            className="flex items-start gap-2 flex-1 hover:opacity-80"
          >
            {content}
          </Link>
        ) : (
          <div className="flex items-start gap-2 flex-1">{content}</div>
        )}
        <button
          type="button"
          onClick={() => dismiss(notification.id)}
          className="absolute top-2 right-2 p-1 rounded hover:bg-muted text-muted-foreground"
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
