'use client';

import { useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Mic, X, Loader2, Volume2 } from 'lucide-react';

import { useCart } from '@/stores/cart';
import { useAuth } from '@/stores/auth';
import { useDeliveryLocation } from '@/stores/deliveryLocation';
import { createBooking } from '@/lib/booking';
import { ApiError } from '@/lib/api';
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
  /** Shops AND service providers, with distance from the customer. */
  shops: Array<{ shop: Shop; km: number | null }>;
  onSearch: (query: string) => void;
  onSelectShop: (shopId: string | null) => void;
  onSelectCategory: (category: string | null) => void;
  /** Switch the page between the Shop and Services tabs. */
  onSetMode: (mode: 'shop' | 'services') => void;
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
  createBooking: '🔧 Booking karu?',
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
  onSetMode,
}: VoiceAssistantProps) {
  const router = useRouter();
  const cart = useCart();
  const token = useAuth((s) => s.token);
  const user = useAuth((s) => s.user);
  const dLat = useDeliveryLocation((s) => s.lat);
  const dLng = useDeliveryLocation((s) => s.lng);

  // announce()/getLang() come from the hook created below — bridged via refs
  // so the action executor (which is passed INTO the hook) can speak results
  // in the conversation's language.
  const announceRef = useRef<(text: string, opts?: { lang?: string; appEvent?: string }) => void>(
    () => {}
  );
  const getLangRef = useRef<() => string>(() => 'hi-IN');

  /** Pick the app-feedback message matching the conversation language. */
  const msg = useCallback((od: string, hi: string, en: string) => {
    const l = getLangRef.current();
    return l.startsWith('od') ? od : l.startsWith('en') ? en : hi;
  }, []);

  const handleCreateBooking = useCallback(
    async (action: VoiceAction) => {
      const providerHit = findByName(
        shops.filter((x) => x.shop.isService),
        action.shopName,
        (x) => x.shop.name
      );

      // Issue 1: not signed in — bookings need an account.
      if (!token || !user) {
        announceRef.current(
          msg(
            'Booking ପାଇଁ ପ୍ରଥମେ login କରିବାକୁ ପଡ଼ିବ — login page ଖୋଲୁଛି।',
            'Booking ke liye pehle login karna hoga — login page khol raha hoon.',
            'You need to log in before booking — opening the login page.'
          ),
          { appEvent: 'Booking failed: user is not logged in; sending them to the login page.' }
        );
        setTimeout(() => router.push('/login?next=/customer'), 2500);
        return;
      }

      // Issue 2: provider not found in the current list.
      if (!providerHit) {
        announceRef.current(
          msg(
            'ଏହି provider ମିଳିଲେ ନାହିଁ — services list ଖୋଲୁଛି, ସେଠାରୁ ବାଛନ୍ତୁ।',
            'Yeh provider list me nahi mila — services list khol raha hoon, wahan se choose kar lo.',
            "Couldn't find that provider — opening the services list so you can choose."
          ),
          { appEvent: `Booking failed: provider "${action.shopName}" not found in the visible list.` }
        );
        onSetMode('services');
        return;
      }

      const provider = providerHit.shop;

      // Issue 3: provider is not available right now — be honest, don't book.
      if (provider.availableNow === false) {
        announceRef.current(
          msg(
            `${provider.name} ବର୍ତ୍ତମାନ available ନାହାଁନ୍ତି। ଅନ୍ୟ available provider ଦେଖନ୍ତୁ।`,
            `${provider.name} abhi available nahi hain. Services list me dusre available providers dekh lo.`,
            `${provider.name} isn't available right now. Check other available providers in the list.`
          ),
          { appEvent: `Booking failed: ${provider.name} is not available right now.` }
        );
        onSetMode('services');
        return;
      }

      // Build the same shape the booking form sends: saved address + live pin.
      const firstAddr = user.addresses?.[0];
      const address =
        typeof dLat === 'number' && typeof dLng === 'number'
          ? {
              line1: firstAddr?.line1,
              city: firstAddr?.city,
              state: firstAddr?.state,
              pincode: firstAddr?.pincode,
              location: { lng: dLng, lat: dLat },
            }
          : firstAddr
            ? {
                label: firstAddr.label,
                line1: firstAddr.line1,
                line2: firstAddr.line2,
                city: firstAddr.city,
                state: firstAddr.state,
                pincode: firstAddr.pincode,
              }
            : undefined;

      // Scheduling: the brain sends requestNow OR scheduledDate ("YYYY-MM-DD")
      // + scheduledSlot (one of the app's six slots). Normalise + validate,
      // falling back to "as soon as possible" if the schedule is unusable.
      const SLOTS = ['8–10 AM', '10–12 PM', '12–2 PM', '2–4 PM', '4–6 PM', '6–8 PM'];
      const rawSlot = String(action.scheduledSlot || '').replace(/-/g, '–').trim();
      const slot = SLOTS.find((x) => x === rawSlot) || SLOTS.find((x) => rawSlot && x.startsWith(rawSlot.split(' ')[0])) || null;
      const rawDate = String(action.scheduledDate || '').slice(0, 10);
      const dateIso = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? new Date(`${rawDate}T00:00:00.000Z`).toISOString() : null;
      const scheduled = action.requestNow !== true && dateIso && slot ? { scheduledDate: dateIso, scheduledSlot: slot } : null;

      try {
        await createBooking({
          providerId: provider._id,
          serviceName: (action.serviceName as string) || provider.category || 'Home service',
          requestNow: !scheduled,
          scheduledDate: scheduled?.scheduledDate,
          scheduledSlot: scheduled?.scheduledSlot,
          notes: (action.notes as string) || undefined,
          contactName: user.name || undefined,
          contactPhone: user.phone || undefined,
          address,
        });
        const when = scheduled
          ? `${new Date(scheduled.scheduledDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}, ${scheduled.scheduledSlot}`
          : null;
        announceRef.current(
          msg(
            when
              ? `Booking ହୋଇଗଲା! ${provider.name}, ${when} — accept କଲେ notification ଆସିବ।`
              : `Booking ହୋଇଗଲା! ${provider.name} ଙ୍କୁ request ପଠାଗଲା — accept କଲେ notification ଆସିବ। Bookings page ଖୋଲୁଛି।`,
            when
              ? `Booking ho gayi! ${provider.name}, ${when} — accept karte hi notification aayega.`
              : `Booking ho gayi! ${provider.name} ko request bhej di — accept karte hi notification aayega. Bookings page khol raha hoon.`,
            when
              ? `Booked! ${provider.name}, ${when} — you'll get a notification once they accept.`
              : `Booked! Your request went to ${provider.name} — you'll get a notification once they accept. Opening your Bookings page.`
          ),
          {
            appEvent: `Booking created successfully with ${provider.name} for "${action.serviceName}"${when ? ` scheduled ${when}` : ' (as soon as possible)'}. The user can track it on the Bookings page.`,
          }
        );
        setTimeout(() => router.push('/customer/bookings'), 4000);
      } catch (err) {
        // Issue 4: the API refused — tell the user the real reason.
        const reason = err instanceof ApiError ? err.message : 'network problem';
        announceRef.current(
          msg(
            `Sorry, booking ହୋଇପାରିଲା ନାହିଁ — ${reason}। ଟିକେ ପରେ ପୁଣି try କରନ୍ତୁ।`,
            `Sorry, booking nahi ho payi — ${reason}. Thodi der baad phir try karo, ya booking page se book kar lo.`,
            `Sorry, the booking failed — ${reason}. Try again in a bit, or book from the provider's page.`
          ),
          { appEvent: `Booking failed with error: ${reason}` }
        );
      }
    },
    [shops, token, user, dLat, dLng, router, onSetMode, msg]
  );

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
    const shopList: WorkerShop[] = shops.map(({ shop: s, km }) => ({
      shopName: s.name,
      category: s.category || null,
      isOpen: s.isOpen !== false,
      isService: s.isService === true,
      availableNow: s.availableNow === true,
      distanceKm: typeof km === 'number' ? Math.round(km * 10) / 10 : null,
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
          const hit = findByName(shops, action.shopName, (x) => x.shop.name);
          onSelectShop(hit ? hit.shop._id : null);
          break;
        }
        case 'createBooking':
          void handleCreateBooking(action);
          break;
        case 'bookProvider': {
          const hit = findByName(shops, action.shopName, (x) => x.shop.name);
          if (hit) setTimeout(() => router.push(`/customer/book/${hit.shop._id}`), 1200);
          else onSetMode('services');
          break;
        }
        case 'showServices':
          onSetMode('services');
          break;
        case 'showShops':
          onSetMode('shop');
          break;
        case 'openBookings':
          setTimeout(() => router.push('/customer/bookings'), 1200);
          break;
        case 'searchProduct':
          onSelectShop(null);
          onSearch(action.query || '');
          break;
        default:
          console.warn('[VoiceAssistant] Unknown action type:', action.type);
      }
    },
    [catalog, shops, cart, router, onSearch, onSelectShop, onSelectCategory, onSetMode, handleCreateBooking]
  );

  const va = useVoiceAssistant({ getContext, onExecuteAction: executeAction });
  announceRef.current = va.announce;
  getLangRef.current = va.getLang;

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
