/**
 * Notification sound — robust version.
 *
 * Two design decisions matter:
 *
 * 1) We keep a single primed HTMLAudioElement (`primed`) but ALSO clone it on
 *    every play(). The clone strategy means a previous in-flight play() can
 *    never reject the new one with "interrupted" — each call gets its own
 *    element. This trades a bit of memory for reliability.
 *
 * 2) We "unlock" the audio context on the FIRST user gesture anywhere on the
 *    page (click, keydown, touchstart). Browsers require a user gesture before
 *    audio can play; after that gesture, audio plays freely for the rest of the
 *    session. By doing this once on any input, all later automatic events
 *    (like a Socket.IO order:new) play without issue.
 *
 * Mute preference persists in localStorage under `localshop-sound-muted`.
 */

const STORAGE_KEY = 'localshop-sound-muted';
const SOUND_SRC = '/sounds/order-notification.mp3';

let primed: HTMLAudioElement | null = null;
let unlocked = false;

function getPrimed(): HTMLAudioElement | null {
  if (typeof window === 'undefined') return null;
  if (!primed) {
    primed = new Audio(SOUND_SRC);
    primed.preload = 'auto';
    primed.volume = 0.7;
    primed.load();
  }
  return primed;
}

/**
 * Install a one-time user-gesture listener that "unlocks" autoplay by
 * issuing a silent play()+pause() on the primed element. Safe to call
 * many times — it self-removes after the first gesture.
 */
function installUnlockListener() {
  if (typeof window === 'undefined' || unlocked) return;
  const unlock = () => {
    const el = getPrimed();
    if (!el) return;
    // Silent prime: play muted, then pause and reset volume.
    const prevVol = el.volume;
    el.volume = 0;
    el
      .play()
      .then(() => {
        el.pause();
        el.currentTime = 0;
        el.volume = prevVol;
        unlocked = true;
        // Now that we know it worked, take the listeners off.
        window.removeEventListener('click', unlock);
        window.removeEventListener('keydown', unlock);
        window.removeEventListener('touchstart', unlock);
      })
      .catch(() => {
        // gesture wasn't enough on this browser — leave listeners attached
        // and try again on next gesture
      });
  };
  window.addEventListener('click', unlock, { passive: true });
  window.addEventListener('keydown', unlock, { passive: true });
  window.addEventListener('touchstart', unlock, { passive: true });
}

/** Is the notification sound currently muted? */
export function isNotificationMuted(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

/** Persist the mute preference. */
export function setNotificationMuted(muted: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (muted) window.localStorage.setItem(STORAGE_KEY, '1');
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* private mode / storage disabled */
  }
}

/**
 * Initialize the sound system. Call once near app boot (or on OrdersTab
 * mount). Primes the audio element and installs the autoplay unlock.
 */
export function initNotificationSound(): void {
  if (typeof window === 'undefined') return;
  getPrimed();
  installUnlockListener();
}

/**
 * Play the notification chime.
 *
 * Uses a *clone* of the primed element so concurrent calls never collide.
 * If the browser still blocks playback (no gesture yet), logs once and
 * exits silently — no console spam.
 */
export function playNotification(): void {
  if (isNotificationMuted()) return;
  const base = getPrimed();
  if (!base) return;

  // Clone so a previous play in flight can't interrupt this one.
  const el = base.cloneNode(true) as HTMLAudioElement;
  el.volume = 0.7;
  el.play().catch((err) => {
    // Most common cause: no user gesture on the page yet. Helpful for debugging.
    // eslint-disable-next-line no-console
    console.warn('[notification sound] play() blocked:', err?.name || err);
  });
}
