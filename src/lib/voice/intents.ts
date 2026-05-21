/**
 * Voice intent registry.
 *
 * Each intent has:
 *   - id: unique key (for logging / dedupe)
 *   - phrases: alternative voice triggers. Matching is substring-based and
 *     case-insensitive — "show me my orders" matches "my orders".
 *   - scope: where the intent is available. 'global' = everywhere.
 *     Role scopes ('customer'/'shop'/'delivery'/'admin') only fire when
 *     the user is on the matching dashboard.
 *   - run: receives a context object, performs the action.
 *
 * The matcher walks phrases by length (longest first) so "my transport
 * bookings" wins over "my orders" if both appear in a transcript.
 */

import type { useRouter } from 'next/navigation';

export type VoiceScope = 'global' | 'customer' | 'shop' | 'delivery' | 'admin';

export interface VoiceContext {
  router: ReturnType<typeof useRouter>;
  /** Current pathname so intents can decide what's relevant. */
  pathname: string;
  /** Convenience — drives a "logout" intent without re-importing here. */
  onLogout: () => void;
}

export interface VoiceIntent {
  id: string;
  phrases: string[];
  scope: VoiceScope;
  description: string;
  run: (ctx: VoiceContext) => void;
}

// ----------------------------------------------------------------------------
// Intent definitions.
// ----------------------------------------------------------------------------

export const INTENTS: VoiceIntent[] = [
  // ----- global navigation -----
  {
    id: 'go_home',
    phrases: ['go home', 'home page', 'home screen'],
    scope: 'global',
    description: 'Go to the home page',
    run: ({ router }) => router.push('/'),
  },
  {
    id: 'logout',
    phrases: ['log out', 'sign out', 'logout'],
    scope: 'global',
    description: 'Sign out of your account',
    run: ({ onLogout }) => onLogout(),
  },

  // ----- customer-side -----
  {
    id: 'customer_home',
    phrases: ['shop near me', 'find shops', 'nearby shops', 'browse shops', 'go shopping'],
    scope: 'customer',
    description: 'Find shops nearby',
    run: ({ router }) => router.push('/customer'),
  },
  {
    id: 'open_cart',
    phrases: ['open cart', 'show cart', 'my cart', 'view cart', 'go to cart'],
    scope: 'customer',
    description: 'Open your cart',
    run: ({ router }) => router.push('/cart'),
  },
  {
    id: 'checkout',
    phrases: ['checkout', 'go to checkout', 'place order', 'pay now'],
    scope: 'customer',
    description: 'Go to checkout',
    run: ({ router }) => router.push('/checkout'),
  },
  {
    id: 'my_orders',
    phrases: ['my orders', 'order history', 'past orders', 'show my orders', 'view orders'],
    scope: 'customer',
    description: 'See your past orders',
    run: ({ router }) => router.push('/orders'),
  },
  {
    id: 'book_transport',
    phrases: [
      'book transport',
      'i need a vehicle',
      'book a vehicle',
      'move something',
      'rent a truck',
      'transport booking',
    ],
    scope: 'customer',
    description: 'Book transport (any vehicle)',
    run: ({ router }) => router.push('/transport'),
  },
  {
    id: 'my_transport_bookings',
    phrases: ['my transport bookings', 'my bookings', 'transport history', 'my deliveries'],
    scope: 'customer',
    description: 'See your transport bookings',
    run: ({ router }) => router.push('/transport/my-bookings'),
  },

  // ----- shop owner -----
  {
    id: 'shop_dashboard',
    phrases: ['my shop', 'shop dashboard', 'go to shop'],
    scope: 'shop',
    description: 'Open the shop dashboard',
    run: ({ router }) => router.push('/shop'),
  },

  // ----- delivery partner -----
  {
    id: 'delivery_dashboard',
    phrases: ['my jobs', 'delivery jobs', 'job feed', 'show jobs', 'available work'],
    scope: 'delivery',
    description: 'Open the delivery dashboard',
    run: ({ router }) => router.push('/delivery'),
  },

  // ----- admin -----
  {
    id: 'admin_panel',
    phrases: ['admin panel', 'admin dashboard', 'open admin'],
    scope: 'admin',
    description: 'Open the admin panel',
    run: ({ router }) => router.push('/admin'),
  },
];

// ----------------------------------------------------------------------------
// Matcher.
// ----------------------------------------------------------------------------

/**
 * Pick the best-matching intent for a transcript.
 *
 * Strategy: case-insensitive substring match, preferring longer phrases.
 * If two intents both match, the one with the longer matched phrase wins
 * — so "my transport bookings" beats "my bookings" even though both contain
 * "bookings".
 *
 * Returns null if nothing matches.
 */
export function matchIntent(
  transcript: string,
  options: { roleScope: VoiceScope | null }
): { intent: VoiceIntent; matchedPhrase: string } | null {
  const text = transcript.toLowerCase().trim();
  if (!text) return null;

  // Filter to applicable intents.
  const applicable = INTENTS.filter((i) => i.scope === 'global' || i.scope === options.roleScope);

  // Score each phrase: longer = better signal. We collect candidates first,
  // then pick the one whose matched phrase is longest.
  let best: { intent: VoiceIntent; matchedPhrase: string; len: number } | null = null;
  for (const intent of applicable) {
    for (const phrase of intent.phrases) {
      const p = phrase.toLowerCase();
      if (text.includes(p)) {
        if (!best || p.length > best.len) {
          best = { intent, matchedPhrase: phrase, len: p.length };
        }
      }
    }
  }
  return best ? { intent: best.intent, matchedPhrase: best.matchedPhrase } : null;
}

/**
 * Helper for the help / "what can you say" UI — returns the intents
 * relevant to the current scope, deduped by id.
 */
export function intentsForScope(scope: VoiceScope | null): VoiceIntent[] {
  return INTENTS.filter((i) => i.scope === 'global' || i.scope === scope);
}
