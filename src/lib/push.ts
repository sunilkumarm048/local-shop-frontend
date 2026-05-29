/**
 * Frontend web-push helpers.
 *
 * Browser support: Chrome/Edge/Firefox/Opera on Android + desktop work
 * directly. Safari on iOS 16.4+ works ONLY for PWAs installed via "Add to
 * Home Screen". `isPushSupported()` reports the current environment honestly
 * so the UI can show the right message.
 *
 * State model:
 *   - `getPushStatus()` returns one of:
 *       'unsupported'    — browser doesn't have the APIs
 *       'denied'         — user blocked notifications in browser settings
 *       'default'        — never asked yet (or dismissed without choosing)
 *       'granted-unsubscribed' — has permission, no active subscription yet
 *       'granted-subscribed'   — fully wired and listening
 *
 * Everything lives in this one file; the OrdersTab consumes it.
 */

import { api } from './api';

/** Convert a base64url string to Uint8Array (required by PushManager). */
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const buf = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) buf[i] = raw.charCodeAt(i);
  return buf;
}

export type PushStatus =
  | 'unsupported'
  | 'denied'
  | 'default'
  | 'granted-unsubscribed'
  | 'granted-subscribed';

export function isPushSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/** Quick read — what state are we in right now? */
export async function getPushStatus(): Promise<PushStatus> {
  if (!isPushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  if (Notification.permission === 'default') return 'default';

  // permission === 'granted' — check whether we have an active subscription
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return 'granted-unsubscribed';
  const sub = await reg.pushManager.getSubscription();
  return sub ? 'granted-subscribed' : 'granted-unsubscribed';
}

/**
 * Subscribe the current user to push.
 *
 * Returns the resulting PushStatus so the UI can render. Throws on permission
 * denial or VAPID misconfiguration so the caller can show a toast.
 */
export async function subscribeToPush(token: string): Promise<PushStatus> {
  if (!isPushSupported()) throw new Error('Push notifications are not supported on this browser.');

  // 1. Make sure we have permission.
  let permission = Notification.permission;
  if (permission === 'default') {
    permission = await Notification.requestPermission();
  }
  if (permission !== 'granted') {
    return permission === 'denied' ? 'denied' : 'default';
  }

  // 2. Make sure the service worker is registered & ready.
  const reg = await navigator.serviceWorker.ready;

  // 3. Fetch VAPID public key from backend.
  const { publicKey, enabled } = await api<{ enabled: boolean; publicKey: string | null }>(
    '/notifications/vapid-public-key'
  );
  if (!enabled || !publicKey) {
    throw new Error('Push notifications are not configured on the server.');
  }

  // 4. Subscribe via PushManager (this is what calls FCM/APNs under the hood).
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true, // spec requires this
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }

  // 5. Tell the backend about it.
  const subJson = sub.toJSON();
  await api('/notifications/subscribe', {
    method: 'POST',
    token,
    body: {
      subscription: {
        endpoint: subJson.endpoint,
        keys: subJson.keys,
      },
      userAgent:
        typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 500) : '',
    },
  });

  return 'granted-subscribed';
}

/** Unsubscribe + notify backend. */
export async function unsubscribeFromPush(token: string): Promise<PushStatus> {
  if (!isPushSupported()) return 'unsupported';
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return await getPushStatus();
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return await getPushStatus();

  const endpoint = sub.endpoint;
  await sub.unsubscribe();
  try {
    await api('/notifications/unsubscribe', {
      method: 'POST',
      token,
      body: { endpoint },
    });
  } catch {
    /* network blip — local unsubscribe already happened, that's the important bit */
  }
  return 'granted-unsubscribed';
}

/** Send a test push to yourself — handy for onboarding "is it working?" UX. */
export async function sendTestPush(token: string): Promise<void> {
  await api('/notifications/test', { method: 'POST', token });
}
