'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Mic, X, Loader2, Volume2 } from 'lucide-react';

import { useCart } from '@/stores/cart';
import type { Product, Shop } from '@/lib/shops';
import {
  useVoiceAssistant,
  type VoiceAction,
  type WorkerCartItem,
  type WorkerProduct,
  type WorkerShop,
} from '@/lib/voice/useVoiceAssistant';

/**
 * AI voice assistant for the customer page — ported from the old LocalShop
 * site. Talks to the same Cloudflare Worker (STT + AI + TTS happen there);
 * this component supplies the catalog context and executes confirmed actions
 * against the new app: zustand cart, Next router, and the page's own
 * search / shop / category state via the props below.
 */

interface VoiceAssistantProps {
  /** Full unfiltered catalog currently loaded on the page. */
  catalog: Array<{ product: Product; shop: Shop }>;
  shops: Shop[];
  onSearch: (query: string) => void;
  onSelectShop: (shopId: string | null) => void;
  onSelectCategory: (category: string | null) => void;
}

const ACTION_LABELS: Record<string, string> = {
  addToCart: '🛒 Add karu?',
  removeFromCart: '🗑️ Hatau?',
  changeQty: '🔢 Qty change karu?',
  showCart: '📋 Cart kholu?',
  clearCart: '🚫 Cart khali karu?',
  selectCategory: '📂 Filter karu?',
  selectShop: '🏪 Shop dikhau?',
  searchProduct: '🔍 Search karu?',
  goToCheckout: '💳 Checkout chalu?',
  trackOrder: '📦 Track karu?',
  showOrderHistory: '📜 Orders dikhau?',
};

/** Loose name match: exact → contains → contained-by. */
function findByName<T>(list: T[], name: string | undefined, get: (t: T) => string): T | null {
  const n = (name || '').trim().toLowerCase();
  if (!n) return null;
  return (
    list.find((x) => get(x).toLowerCase() === n) ||
    list.find((x) => get(x).toLowerCase().includes(n)) ||
    list.find((x) => n.includes(get(x).toLowerCase())) ||
    null
  );
}

export function VoiceAssistant({
  catalog,
  shops,
  onSearch,
  onSelectShop,
  onSelectCategory,
}: VoiceAssistantProps) {
  const router = useRouter();
  const cart = useCart();

  const getContext = useCallback(() => {
    const products: WorkerProduct[] = catalog.map(({ product, shop }) => ({
      name: product.name,
      price: Number(product.price) || 0,
      mrp: product.mrp ? Number(product.mrp) : null,
      weight: product.weight || null,
      shopName: shop.name || null,
      category: shop.category || null,
      inStock: shop.isOpen !== false,
    }));
    const shopList: WorkerShop[] = shops.map((s) => ({
      shopName: s.name,
      category: s.category || null,
      isOpen: s.isOpen !== false,
    }));
    const cartItems: WorkerCartItem[] = cart.items.map((i) => ({
      name: i.name,
      qty: i.qty,
      price: i.price,
    }));
    return { products: products.slice(0, 200), shops: shopList, cart: cartItems };
  }, [catalog, shops, cart.items]);

  const executeAction = useCallback(
    (action: VoiceAction) => {
      switch (action.type) {
        case 'addToCart': {
          const hit = findByName(catalog, action.productName, (x) => x.product.name);
          if (hit) {
            cart.add(
              {
                productId: hit.product._id,
                shopId: hit.shop._id,
                name: hit.product.name,
                price: hit.product.price,
                weight: hit.product.weight,
                image: hit.product.image,
              },
              action.qty || 1
            );
          }
          break;
        }
        case 'removeFromCart': {
          const item = findByName(cart.items, action.productName, (i) => i.name);
          if (item) cart.remove(item.productId);
          break;
        }
        case 'changeQty': {
          const item = findByName(cart.items, action.productName, (i) => i.name);
          if (item && typeof action.qty === 'number') cart.setQty(item.productId, action.qty);
          break;
        }
        case 'clearCart':
          cart.clear();
          break;
        case 'showCart':
        case 'goToCheckout':
          setTimeout(() => router.push('/checkout'), 1200);
          break;
        case 'trackOrder':
        case 'showOrderHistory':
          setTimeout(() => router.push('/orders'), 1200);
          break;
        case 'selectCategory':
          onSelectCategory(action.category || null);
          break;
        case 'selectShop': {
          const shop = findByName(shops, action.shopName, (s) => s.name);
          onSelectShop(shop ? shop._id : null);
          break;
        }
        case 'searchProduct':
          onSelectShop(null);
          onSearch(action.query || '');
          break;
        default:
          console.warn('[VoiceAssistant] Unknown action type:', action.type);
      }
    },
    [catalog, shops, cart, router, onSearch, onSelectShop, onSelectCategory]
  );

  const va = useVoiceAssistant({ getContext, onExecuteAction: executeAction });

  return (
    <>
      {/* Floating mic — sits above the header's other FABs */}
      <button
        type="button"
        onClick={va.toggle}
        aria-label="Voice assistant"
        style={{ transform: `scale(${1 + va.volume})` }}
        className={`fixed bottom-4 right-4 z-40 h-14 w-14 rounded-full text-white shadow-lg flex items-center justify-center transition-colors ${
          va.active ? 'bg-red-500 hover:bg-red-600' : 'bg-brand-green hover:bg-brand-green/90'
        }`}
      >
        {va.active ? <X className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
      </button>

      {/* Conversation panel */}
      {va.active && (
        <div className="fixed bottom-20 right-4 left-4 sm:left-auto sm:w-96 z-40 bg-white rounded-xl shadow-2xl border p-4 space-y-2">
          <div className="flex items-center gap-2">
            {va.mode === 'listening' && (
              <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />
            )}
            {va.mode === 'thinking' && <Loader2 className="h-4 w-4 animate-spin text-brand-green" />}
            {va.mode === 'speaking' && <Volume2 className="h-4 w-4 text-brand-green" />}
            <span className="text-sm font-semibold">
              {va.status ||
                (va.mode === 'listening'
                  ? 'Listening…'
                  : va.mode === 'thinking'
                    ? 'Thinking…'
                    : va.mode === 'speaking'
                      ? 'Speaking…'
                      : 'Voice assistant')}
            </span>
          </div>

          {va.transcript && (
            <p className="text-sm text-muted-foreground">🗣️ {va.transcript}</p>
          )}
          {va.reply && <p className="text-sm">{va.reply}</p>}

          {va.pendingAction && (
            <div className="inline-flex items-center text-xs font-semibold bg-amber-100 text-amber-800 rounded-full px-3 py-1">
              ⏳ {ACTION_LABELS[va.pendingAction.type] || 'Confirm karu?'}
            </div>
          )}

          {va.error && (
            <p className="text-xs text-destructive bg-destructive/10 rounded-md px-2 py-1.5">
              {va.error}
            </p>
          )}

          <p className="text-[11px] text-muted-foreground">
            Bolke try karo: “ek kilo chini add karo”, “cart dikhao”, “checkout chalo”
          </p>
        </div>
      )}
    </>
  );
}
