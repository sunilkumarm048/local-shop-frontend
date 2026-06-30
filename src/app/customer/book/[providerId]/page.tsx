'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link' ;
import {
  Loader2,
  ArrowLeft,
  CalendarPlus,
  Check,
  Store,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { ApiError } from '@/lib/api';
import { fetchShop, type Shop } from '@/lib/shops';
import { createBooking } from '@/lib/booking';
import { useAuth } from '@/stores/auth';

const TIME_SLOTS = [
  '8–10 AM',
  '10–12 PM',
  '12–2 PM',
  '2–4 PM',
  '4–6 PM',
  '6–8 PM',
];

// Next 7 days as selectable date chips.
function nextDays(n: number) {
  const out: { iso: string; label: string; sub: string }[] = [];
  const today = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const iso = d.toISOString();
    const label =
      i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString(undefined, { weekday: 'short' });
    const sub = d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
    out.push({ iso, label, sub });
  }
  return out;
}

export default function BookServicePage() {
  const router = useRouter();
  const params = useParams<{ providerId: string }>();
  const providerId = params?.providerId;
  const user = useAuth((s) => s.user);
  const token = useAuth((s) => s.token);

  const [shop, setShop] = useState<Shop | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [serviceName, setServiceName] = useState('');
  const [when, setWhen] = useState<'schedule' | 'now'>('schedule');
  const [dateIso, setDateIso] = useState<string>('');
  const [slot, setSlot] = useState<string>('');

  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [addressLine, setAddressLine] = useState('');
  const [notes, setNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const days = useMemo(() => nextDays(7), []);

  useEffect(() => {
    if (!token) {
      router.replace(`/login?next=/customer/book/${providerId}`);
    }
  }, [token, providerId, router]);

  useEffect(() => {
    if (!providerId) return;
    setLoading(true);
    fetchShop(providerId)
      .then((r) => setShop(r.shop))
      .catch((err) =>
        setLoadError(err instanceof ApiError ? err.message : 'Could not load provider.')
      )
      .finally(() => setLoading(false));
  }, [providerId]);

  // Prefill contact + address from the user's profile.
  useEffect(() => {
    if (!user) return;
    setContactName((v) => v || user.name || '');
    setContactPhone((v) => v || user.phone || '');
    const a = user.addresses?.[0];
    if (a) {
      const parts = [a.line1, a.line2, a.city, a.state, a.pincode].filter(Boolean);
      setAddressLine((v) => v || parts.join(', '));
    }
  }, [user]);

  async function submit() {
    setError(null);
    if (!serviceName.trim()) {
      setError('Tell the provider what you need.');
      return;
    }
    if (when === 'schedule' && (!dateIso || !slot)) {
      setError('Pick a date and a time slot.');
      return;
    }
    setSubmitting(true);
    try {
      const firstAddr = user?.addresses?.[0];
      await createBooking({
        providerId: providerId!,
        serviceName: serviceName.trim(),
        requestNow: when === 'now',
        scheduledDate: when === 'schedule' ? dateIso : undefined,
        scheduledSlot: when === 'schedule' ? slot : undefined,
        contactName: contactName.trim() || undefined,
        contactPhone: contactPhone.trim() || undefined,
        notes: notes.trim() || undefined,
        address: firstAddr
          ? {
              label: firstAddr.label,
              line1: firstAddr.line1,
              line2: firstAddr.line2,
              city: firstAddr.city,
              state: firstAddr.state,
              pincode: firstAddr.pincode,
              location: firstAddr.location
                ? {
                    lng: firstAddr.location.coordinates[0],
                    lat: firstAddr.location.coordinates[1],
                  }
                : undefined,
            }
          : addressLine.trim()
            ? { line1: addressLine.trim() }
            : undefined,
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send your request.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) return null;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Loading…
      </div>
    );
  }

  if (loadError || !shop) {
    return (
      <div className="container max-w-lg py-10 text-center space-y-3">
        <p className="text-sm text-muted-foreground">{loadError || 'Provider not found.'}</p>
        <Button variant="outline" onClick={() => router.back()}>
          Go back
        </Button>
      </div>
    );
  }

  if (done) {
    return (
      <div className="container max-w-lg py-12 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-brand-greenLight mx-auto flex items-center justify-center">
          <Check className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-xl font-semibold">Request sent</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Your request for “{serviceName}” was sent to {shop.name}. They&apos;ll confirm a
          time, then come to your address. You can track it under My Bookings.
        </p>
        <div className="flex gap-2 justify-center pt-2">
          <Button variant="outline" asChild>
            <Link href="/customer">Back to home</Link>
          </Button>
          <Button asChild>
            <Link href="/customer/bookings">My bookings</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-lg py-6 space-y-5">
      <div className="flex items-center gap-2">
        <button
          onClick={() => router.back()}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-semibold">Book a service</h1>
      </div>

      {/* Provider */}
      <Card>
        <CardContent className="p-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-accent overflow-hidden flex items-center justify-center shrink-0">
            {shop.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={shop.logo} alt="" className="w-full h-full object-cover" />
            ) : (
              <Store className="h-5 w-5 text-primary" />
            )}
          </div>
          <div>
            <div className="font-semibold">{shop.name}</div>
            <div className="text-xs text-muted-foreground">Service provider</div>
          </div>
        </CardContent>
      </Card>

      {/* What */}
      <div>
        <Label htmlFor="service">What do you need?</Label>
        <Input
          id="service"
          value={serviceName}
          onChange={(e) => setServiceName(e.target.value)}
          placeholder="e.g. Fan installation, tap repair…"
        />
      </div>

      {/* When */}
      <div className="space-y-2">
        <Label>When?</Label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setWhen('schedule')}
            className={`flex-1 h-9 rounded-md text-sm font-medium border transition-colors ${
              when === 'schedule'
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-card border-border hover:bg-muted'
            }`}
          >
            Pick a time
          </button>
          <button
            type="button"
            onClick={() => setWhen('now')}
            className={`flex-1 h-9 rounded-md text-sm font-medium border transition-colors ${
              when === 'now'
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-card border-border hover:bg-muted'
            }`}
          >
            As soon as possible
          </button>
        </div>

        {when === 'schedule' && (
          <div className="space-y-3 pt-1">
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {days.map((d) => (
                <button
                  key={d.iso}
                  type="button"
                  onClick={() => setDateIso(d.iso)}
                  className={`shrink-0 w-16 py-2 rounded-lg border text-center transition-colors ${
                    dateIso === d.iso
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-card border-border hover:bg-muted'
                  }`}
                >
                  <div className="text-xs font-bold">{d.label}</div>
                  <div className="text-[10px] opacity-80">{d.sub}</div>
                </button>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {TIME_SLOTS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSlot(s)}
                  className={`py-2 rounded-lg border text-xs font-medium transition-colors ${
                    slot === s
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-card border-border hover:bg-muted'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Contact + address */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label htmlFor="cname">Your name</Label>
          <Input
            id="cname"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            placeholder="Name"
          />
        </div>
        <div>
          <Label htmlFor="cphone">Phone</Label>
          <Input
            id="cphone"
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            placeholder="Phone number"
          />
        </div>
      </div>
      <div>
        <Label htmlFor="addr">Address</Label>
        <Input
          id="addr"
          value={addressLine}
          onChange={(e) => setAddressLine(e.target.value)}
          placeholder="Where should they come?"
        />
        {user?.addresses && user.addresses.length > 0 && (
          <p className="text-[11px] text-muted-foreground mt-1">
            Using your saved address. Edit it in My Profile.
          </p>
        )}
      </div>

      <div>
        <Label htmlFor="notes">Notes (optional)</Label>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Describe the problem or any details…"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      <Button onClick={submit} disabled={submitting} className="w-full h-11">
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Sending…
          </>
        ) : (
          <>
            <CalendarPlus className="h-4 w-4 mr-2" />
            Send request
          </>
        )}
      </Button>
      <p className="text-[11px] text-muted-foreground text-center -mt-2">
        No payment now. The provider confirms before visiting.
      </p>
    </div>
  );
}
