import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CartItem } from '@/types';

interface CartState {
  items: CartItem[];
  add: (item: Omit<CartItem, 'qty'>, qty?: number) => void;
  remove: (productId: string) => void;
  setQty: (productId: string, qty: number) => void;
  clear: () => void;
  totalItems: () => number;
  totalAmount: () => number;
  byShop: () => Record<string, CartItem[]>;
}

/**
 * Cart is client-side only. The authoritative total is recomputed server-side
 * at checkout — we never trust prices from the cart store when creating a
 * Razorpay order.
 */
export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],

      add: (item, qty = 1) =>
        set((state) => {
          const existing = state.items.find((i) => i.productId === item.productId);
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.productId === item.productId ? { ...i, qty: i.qty + qty } : i
              ),
            };
          }
          return { items: [...state.items, { ...item, qty }] };
        }),

      remove: (productId) =>
        set((state) => ({ items: state.items.filter((i) => i.productId !== productId) })),

      setQty: (productId, qty) =>
        set((state) => ({
          items:
            qty <= 0
              ? state.items.filter((i) => i.productId !== productId)
              : state.items.map((i) => (i.productId === productId ? { ...i, qty } : i)),
        })),

      clear: () => set({ items: [] }),

      totalItems: () => get().items.reduce((sum, i) => sum + i.qty, 0),

      totalAmount: () => get().items.reduce((sum, i) => sum + i.price * i.qty, 0),

      byShop: () =>
        get().items.reduce<Record<string, CartItem[]>>((acc, item) => {
          (acc[item.shopId] ||= []).push(item);
          return acc;
        }, {}),
    }),
    { name: 'localshop-cart' }
  )
);
