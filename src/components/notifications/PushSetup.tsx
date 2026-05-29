'use client';

/**
 * PushSetup — drop-in widget for any role surface (shop / customer / delivery)
 * to opt into Web Push.
 *
 * Renders one of three states:
 *   1. Banner ("Get alerts when…") if push is supported & not yet enabled
 *   2. Amber "blocked" banner if Notification.permission === 'denied'
 *   3. Inline subscribed-state controls (Test · Turn off) below children
 *
 * Pass `headline` and `subline` to customize the copy per role.
 */

import { useEffect, useState } from 'react';
import { BellRing, BellOff, Loader2, Send } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/stores/auth';
import {
  getPushStatus,
  subscribeToPush,
  unsubscribeFromPush,
  sendTestPush,
  type PushStatus,
} from '@/lib/push';

interface Props {
  /** Big bold title in the banner. */
  headline: string;
  /** Smaller line below. */
  subline: string;
  /** Where the notification will navigate when tapped — informational only. */
  className?: string;
}

export function PushSetup({ headline, subline, className }: Props) {
  const token = useAuth((s) => s.token);
  const [status, setStatus] = useState<PushStatus>('unsupported');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPushStatus().then(setStatus).catch(() => setStatus('unsupported'));
  }, []);

  const enable = async () => {
    if (!token) {
      setError('Please sign in first.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const next = await subscribeToPush(token);
      setStatus(next);
      if (next === 'denied') {
        setError(
          'You\u2019ve blocked notifications for this site. Enable them from your browser settings.'
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not enable push notifications.');
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      const next = await unsubscribeFromPush(token);
      setStatus(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not disable push.');
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      await sendTestPush(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send test push.');
    } finally {
      setBusy(false);
    }
  };

  /* ----------- unsupported: hide entirely ----------- */
  if (status === 'unsupported') return null;

  /* ----------- subscribed: tiny inline controls ----------- */
  if (status === 'granted-subscribed') {
    return (
      <div
        className={`inline-flex items-center gap-1.5 text-xs text-muted-foreground ${className || ''}`}
      >
        <button
          onClick={test}
          disabled={busy}
          className="text-brand-green font-semibold hover:underline disabled:opacity-50 inline-flex items-center gap-1"
          title="Send a test notification"
        >
          <Send className="h-3 w-3" />
          Test notification
        </button>
        <span aria-hidden>·</span>
        <button
          onClick={disable}
          disabled={busy}
          className="hover:text-foreground hover:underline disabled:opacity-50"
        >
          Turn off
        </button>
        {error && <span className="text-destructive ml-2">{error}</span>}
      </div>
    );
  }

  /* ----------- denied: amber notice ----------- */
  if (status === 'denied') {
    return (
      <div
        className={`rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 flex items-start gap-3 ${className || ''}`}
      >
        <BellOff className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-amber-900">
            Notifications are blocked
          </div>
          <div className="text-xs text-amber-800 mt-0.5">
            Enable them from your browser settings (lock icon in the address bar)
            to receive alerts when the app is closed.
          </div>
        </div>
      </div>
    );
  }

  /* ----------- default / granted-unsubscribed: green "Enable" banner ----------- */
  return (
    <div
      className={`rounded-xl border border-brand-green/30 bg-brand-greenLight px-4 py-3 flex items-start gap-3 ${className || ''}`}
    >
      <BellRing className="h-5 w-5 text-brand-green shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold text-brand-green">{headline}</div>
        <div className="text-xs text-brand-green/85 mt-0.5">{subline}</div>
        {error && <div className="text-xs text-destructive mt-1">{error}</div>}
      </div>
      <Button
        size="sm"
        onClick={enable}
        disabled={busy}
        className="shrink-0"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Enable'}
      </Button>
    </div>
  );
}
