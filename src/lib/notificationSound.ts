/**
 * Notification sounds — multi-channel.
 *
 * Three independent channels, each with its own:
 *   - audio file in /public/sounds/
 *   - mute preference in localStorage (so a user with multiple roles can
 *     mute one channel without affecting the others)
 *   - public `play*()` function
 *
 * Implementation notes:
 *   1. One "primed" Audio element per channel, lazily created on first use.
 *   2. Each play() *clones* the primed element so concurrent calls never
 *      collide (a play-in-flight can't interrupt a fresh play).
 *   3. A single page-level "unlock" listener installed on first user gesture
 *      silently runs play()+pause() on every primed element, satisfying
 *      browser autoplay rules for all later automatic triggers (Socket.IO,
 *      timers, etc).
 */

const SRC = {
  shop: '/sounds/shop-new-order.mp3',
  customer: '/sounds/customer-update.mp3',
  delivery: '/sounds/delivery-new-job.mp3',
} as const;

const STORAGE_KEY = {
  shop: 'localshop-sound-muted-shop',
  customer: 'localshop-sound-muted-customer',
  delivery: 'localshop-sound-muted-delivery',
} as const;

type Channel = keyof typeof SRC;

const primed: Partial<Record<Channel, HTMLAudioElement>> = {};
let unlocked = false;

function getPrimed(channel: Channel): HTMLAudioElement | null {
  if (typeof window === 'undefined') return null;
  if (!primed[channel]) {
    const el = new Audio(SRC[channel]);
    el.preload = 'auto';
    el.volume = 0.7;
    el.load();
    primed[channel] = el;
  }
  return primed[channel] || null;
}

/**
 * Install a one-time user-gesture listener that unlocks audio playback for
 * ALL channels by issuing a silent play()+pause() on each primed element.
 */
function installUnlockListener() {
  if (typeof window === 'undefined' || unlocked) return;

  const unlock = () => {
    const channels: Channel[] = ['shop', 'customer', 'delivery'];
    let okCount = 0;

    Promise.all(
      channels.map((c) => {
        const el = getPrimed(c);
        if (!el) return Promise.resolve();
        const prevVol = el.volume;
        el.volume = 0;
        return el
          .play()
          .then(() => {
            el.pause();
            el.currentTime = 0;
            el.volume = prevVol;
            okCount += 1;
          })
          .catch(() => {
            // try again next gesture
          });
      })
    ).then(() => {
      if (okCount > 0) {
        unlocked = true;
        window.removeEventListener('click', unlock);
        window.removeEventListener('keydown', unlock);
        window.removeEventListener('touchstart', unlock);
      }
    });
  };

  window.addEventListener('click', unlock, { passive: true });
  window.addEventListener('keydown', unlock, { passive: true });
  window.addEventListener('touchstart', unlock, { passive: true });
}

/* --------------- mute preference helpers --------------- */

function isMuted(channel: Channel): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY[channel]) === '1';
  } catch {
    return false;
  }
}

function setMuted(channel: Channel, muted: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (muted) window.localStorage.setItem(STORAGE_KEY[channel], '1');
    else window.localStorage.removeItem(STORAGE_KEY[channel]);
  } catch {
    /* storage disabled — ignore */
  }
}

/* --------------- core play() --------------- */

function play(channel: Channel): void {
  if (isMuted(channel)) return;
  const base = getPrimed(channel);
  if (!base) return;
  const el = base.cloneNode(true) as HTMLAudioElement;
  el.volume = 0.7;
  el.play().catch((err) => {
    // eslint-disable-next-line no-console
    console.warn(`[notification sound:${channel}] play() blocked:`, err?.name || err);
  });
}

/* --------------- public API --------------- */

/** Call once near app boot (or first time a sound-using page mounts). */
export function initNotificationSound(): void {
  if (typeof window === 'undefined') return;
  // Prime all three so the first play has zero latency
  getPrimed('shop');
  getPrimed('customer');
  getPrimed('delivery');
  installUnlockListener();
}

/* Shop owner — new order */
export const playShopOrder = () => play('shop');
export const isShopSoundMuted = () => isMuted('shop');
export const setShopSoundMuted = (m: boolean) => setMuted('shop', m);

/* Customer — order status update */
export const playCustomerUpdate = () => play('customer');
export const isCustomerSoundMuted = () => isMuted('customer');
export const setCustomerSoundMuted = (m: boolean) => setMuted('customer', m);

/* Delivery partner — new job assigned */
export const playDeliveryJob = () => play('delivery');
export const isDeliverySoundMuted = () => isMuted('delivery');
export const setDeliverySoundMuted = (m: boolean) => setMuted('delivery', m);
