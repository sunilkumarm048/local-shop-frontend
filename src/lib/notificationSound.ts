/**
 * Notification sound — small singleton wrapper around HTMLAudioElement.
 *
 * Why singleton: we want the same audio buffer across the whole app session
 * (cheaper, and lets us pause an in-flight sound if a new one fires before
 * the previous finishes). Each "play" rewinds and plays the same element.
 *
 * Mute preference is persisted in localStorage under `localshop-sound-muted`
 * so the toggle survives reloads.
 *
 * Autoplay note: browsers block audio playback until the user has interacted
 * with the page at least once (any click, keypress, etc). We swallow the
 * resulting promise rejection — once the user interacts, subsequent plays
 * work fine. The shop owner is actively using the dashboard, so this is
 * almost never a real issue.
 */

const STORAGE_KEY = 'localshop-sound-muted';
const SOUND_SRC = '/sounds/order-notification.mp3';

let audio: HTMLAudioElement | null = null;

function getAudio(): HTMLAudioElement | null {
  if (typeof window === 'undefined') return null; // SSR guard
  if (!audio) {
    audio = new Audio(SOUND_SRC);
    audio.preload = 'auto';
    audio.volume = 0.7;
  }
  return audio;
}

/** Is the notification sound currently muted? Reads from localStorage. */
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
    /* private mode, storage disabled — fail silently, sound just won't persist */
  }
}

/** Play the notification chime. No-op if muted or before user interaction. */
export function playNotification(): void {
  if (isNotificationMuted()) return;
  const el = getAudio();
  if (!el) return;
  try {
    el.currentTime = 0; // rewind so a quick burst still gets the full chime
    el.play().catch(() => {
      /* autoplay blocked or another transient play() rejection — ignore */
    });
  } catch {
    /* defensive — should never throw, but never let it bubble up */
  }
}
