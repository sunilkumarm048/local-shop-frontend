'use client';

import { create } from 'zustand';

/**
 * A notification is a small, transient UI object — toast bubble + sound +
 * optional tab-title flash. They originate from socket events handled in
 * NotificationListener and stack in this queue. Each is auto-dismissed
 * after `ttl` ms (default 6000).
 *
 * Kept deliberately simple: no persistence, no read/unread, no history.
 * If we want a notification CENTER later (bell icon with a dropdown of
 * past notifications), we'll add a separate `notifications` array in
 * localStorage. For now this is purely "alert me right now."
 */

export type NotificationKind =
  | 'new-order' // shop owner: customer placed an order
  | 'order-status' // shop owner / customer: status changed
  | 'new-job' // delivery partner: job assigned
  | 'admin-alert' // admin: something needs attention
  | 'info'; // generic — no sound by default

export interface Notification {
  /** Stable id so we can dismiss by id. */
  id: string;
  kind: NotificationKind;
  title: string;
  body?: string;
  /** Optional click target — when user taps the toast they navigate here. */
  href?: string;
  /** ms to auto-dismiss. Default 6000. Use 0 to keep until user dismisses. */
  ttl?: number;
  createdAt: number;
}

interface NotificationState {
  queue: Notification[];
  push: (n: Omit<Notification, 'id' | 'createdAt'>) => string;
  dismiss: (id: string) => void;
  clear: () => void;
}

function generateId() {
  return `n_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export const useNotifications = create<NotificationState>((set) => ({
  queue: [],
  push: (n) => {
    const id = generateId();
    const notif: Notification = {
      ...n,
      id,
      createdAt: Date.now(),
      ttl: n.ttl ?? 6_000,
    };
    set((state) => ({ queue: [...state.queue, notif] }));
    return id;
  },
  dismiss: (id) =>
    set((state) => ({ queue: state.queue.filter((n) => n.id !== id) })),
  clear: () => set({ queue: [] }),
}));
