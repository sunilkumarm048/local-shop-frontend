'use client';

import type { NotificationKind } from '@/stores/notifications';

/**
 * Sound + tab-title flash for notifications.
 *
 * Why a module not a hook: notifications can fire from anywhere (socket
 * listener, manual UI actions). A module gives us a single function call
 * site (`playNotificationSound('new-order')`) without needing React context.
 *
 * iOS autoplay unlock:
 *   iOS Safari blocks `audio.play()` until the user has interacted with the
 *   page at least once. We listen for the first user interaction and
 *   pre-prime each audio element by calling play().then(pause()). After that,
 *   subsequent plays work.
 *
 * Tab title flash:
 *   When the page is hidden (user is on another tab), we flash the title
 *   between "Local Shop" and "🔔 (N) Local Shop" every second so the user
 *   notices in their browser tab strip. The Visibility API tells us when
 *   they come back so we can restore the original title.
 */

const SOUND_PATHS: Record<NotificationKind, string | null> = {
  'new-order': '/sounds/new-order.mp3',
  'order-status': '/sounds/status-update.mp3',
  'new-job': '/sounds/new-job.mp3',
  'admin-alert': '/sounds/admin-alert.mp3',
  info: null, // silent — for low-priority info toasts
};

// One Audio element per sound, cached after first construction.
const audioCache = new Map<string, HTMLAudioElement>();
let audioUnlocked = false;

function getAudio(path: string): HTMLAudioElement | null {
  if (typeof window === 'undefined') return null;
  if (!audioCache.has(path)) {
    const a = new Audio(path);
    a.preload = 'auto';
    a.volume = 0.8;
    audioCache.set(path, a);
  }
  return audioCache.get(path) || null;
}

/**
 * Call from a user-interaction event handler (click, tap) once on app boot.
 * iOS will then allow .play() on cached Audio elements without further
 * user gestures.
 *
 * Safe to call multiple times — it's a no-op after the first run.
 */
export function unlockAudio() {
  if (audioUnlocked) return;
  audioUnlocked = true;
  for (const path of Object.values(SOUND_PATHS)) {
    if (!path) continue;
    const a = getAudio(path);
    if (!a) continue;
    // Silent play then immediate pause — this primes the element on iOS.
    a.muted = true;
    const p = a.play();
    if (p && typeof p.then === 'function') {
      p.then(() => {
        a.pause();
        a.currentTime = 0;
        a.muted = false;
      }).catch(() => {
        a.muted = false; // play rejected — that's OK, we tried
      });
    }
  }
}

export function playNotificationSound(kind: NotificationKind) {
  if (typeof window === 'undefined') return;
  const path = SOUND_PATHS[kind];
  if (!path) return;
  const a = getAudio(path);
  if (!a) return;
  try {
    a.currentTime = 0;
    const p = a.play();
    if (p && typeof p.catch === 'function') {
      p.catch((err) => {
        // Common on first play before unlock — not worth logging in prod
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[sound] play() rejected:', err.message);
        }
      });
    }
  } catch {
    // Audio not loaded / browser doesn't allow — silent fail
  }
}

// ============================================================
// Tab title flashing
// ============================================================

const ORIGINAL_TITLE = typeof document !== 'undefined' ? document.title : 'Local Shop';
let unreadCount = 0;
let flashInterval: ReturnType<typeof setInterval> | null = null;
let flashIsAlt = false;

function applyTitle() {
  if (typeof document === 'undefined') return;
  if (unreadCount === 0) {
    document.title = ORIGINAL_TITLE;
    return;
  }
  document.title = flashIsAlt
    ? `🔔 (${unreadCount}) ${ORIGINAL_TITLE}`
    : `(${unreadCount}) ${ORIGINAL_TITLE}`;
}

function startFlashing() {
  if (flashInterval) return;
  flashInterval = setInterval(() => {
    flashIsAlt = !flashIsAlt;
    applyTitle();
  }, 1_000);
}

function stopFlashing() {
  if (flashInterval) {
    clearInterval(flashInterval);
    flashInterval = null;
  }
  flashIsAlt = false;
  applyTitle();
}

/**
 * Call when a new notification arrives while the page might be hidden.
 * If the page is visible, this is essentially a no-op (count increments but
 * the visibility-change handler will reset it the moment they look).
 */
export function bumpUnread() {
  if (typeof document === 'undefined') return;
  if (document.visibilityState === 'visible') return;
  unreadCount += 1;
  startFlashing();
}

/** Reset on user activity. Wired automatically by setupTabFlasher(). */
function clearUnread() {
  unreadCount = 0;
  stopFlashing();
}

/**
 * One-time setup: install the visibilitychange listener so we clear the
 * unread count + restore the title when the user returns to the tab.
 * Idempotent.
 */
let tabFlasherSetup = false;
export function setupTabFlasher() {
  if (typeof document === 'undefined') return;
  if (tabFlasherSetup) return;
  tabFlasherSetup = true;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      clearUnread();
    }
  });
}
