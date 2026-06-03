'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { Loader2, Check, Plus, Store } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ImageUploader } from '@/components/uploads/ImageUploader';
import { fetchCategories, quickCreateShop } from '@/lib/owner';
import { ApiError } from '@/lib/api';
import type { Category } from '@/lib/shops';
import type { LatLng } from '@/components/shop/LocationPicker';

const LocationPicker = dynamic(
  () => import('@/components/shop/LocationPicker'),
  { ssr: false, loading: () => <div className="h-64 rounded-lg bg-muted animate-pulse" /> }
);

/**
 * Field-onboarding tool for admins/agents: list a shop on a shopkeeper's
 * behalf in seconds. Built for SPEED — minimal required fields, big inputs,
 * and a "save & add another" flow so an agent walking shop-to-shop can list
 * many in a row without leaving the form.
 *
 * Required: name, category, phone, map pin. Everything else optional.
 * Shops created here go live immediately (backend auto-approves them).
 */
export default function AdminQuickAddShopTab() {
  const [categories, setCategories] = useState<Category[]>([]);

  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [phone, setPhone] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [description, setDescription] = useState('');
  const [logo, setLogo] = useState('');
  const [location, setLocation] = useState<LatLng | null>(null);
  const [city, setCity] = useState('');
  const [line1, setLine1] = useState('');
  const [pincode, setPincode] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastAdded, setLastAdded] = useState<{
    name: string;
    email: string;
    password: string;
    reused: boolean;
  } | null>(null);

  useEffect(() => {
    fetchCategories()
      .then((r) => setCategories(r.categories || []))
      .catch(() => setCategories([]));
  }, []);

  // Only leaf categories (the ones shops actually belong to) — skip top-level
  // groups. A group is a category with no parent; its children have a parent.
  const leafCategories = categories.filter((c) => c.parent);

  function reset(keepArea = true) {
    setName('');
    setCategory('');
    setPhone('');
    setOwnerEmail('');
    setOwnerPassword('');
    setDescription('');
    setLogo('');
    if (!keepArea) {
      setLocation(null);
      setCity('');
      setLine1('');
      setPincode('');
    }
    setError(null);
  }

  async function submit() {
    setError(null);
    if (name.trim().length < 2) return setError('Enter the shop name.');
    if (!category) return setError('Pick a category.');
    if (phone.trim().length < 6) return setError('Enter a phone number.');
    if (!/\S+@\S+\.\S+/.test(ownerEmail)) return setError("Enter the owner's login email.");
    if (ownerPassword.length < 6) return setError('Password must be at least 6 characters.');
    if (!location) return setError('Drop a pin on the map for the shop location.');

    setSaving(true);
    try {
      const { shop, reusedExistingAccount } = await quickCreateShop({
        name: name.trim(),
        category,
        phone: phone.trim(),
        ownerEmail: ownerEmail.trim(),
        ownerPassword,
        description: description.trim() || undefined,
        logo: logo || undefined,
        lat: location.lat,
        lng: location.lng,
        address: {
          line1: line1.trim() || undefined,
          city: city.trim() || undefined,
          pincode: pincode.trim() || undefined,
        },
      });
      setLastAdded({
        name: shop.name,
        email: ownerEmail.trim(),
        password: ownerPassword,
        reused: reusedExistingAccount,
      });
      // Keep the area (pin/city) so the next nearby shop is faster to add;
      // clear the shop-specific fields.
      reset(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create the shop.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Store className="h-5 w-5" /> Quick add shop
        </h2>
        <p className="text-sm text-muted-foreground">
          List a shop on the owner’s behalf. Goes live immediately. The map pin
          and city are kept after saving so you can add nearby shops quickly.
        </p>
      </div>

      {lastAdded && (
        <div className="rounded-lg border border-primary/40 bg-[#f0fbf2] p-3 text-sm space-y-1.5">
          <div className="flex items-center gap-2 font-medium">
            <Check className="h-4 w-4 text-primary" />
            <span><strong>{lastAdded.name}</strong> added and live.</span>
          </div>
          <div className="text-muted-foreground">
            Give these login details to the shopkeeper (they’ll be asked to
            change the password on first login):
          </div>
          <div className="font-mono text-[13px] bg-white rounded p-2 border">
            <div>Email: {lastAdded.email}</div>
            <div>Password: {lastAdded.password}</div>
          </div>
          {lastAdded.reused && (
            <div className="text-xs text-amber-700">
              Note: an account with this email already existed — its password
              was NOT changed. The shop was linked to that existing account.
            </div>
          )}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Shop details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="Shop name *">
            <input
              className="input-base"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sonali Beauty Parlour"
            />
          </Field>

          <Field label="Category *">
            <select
              className="input-base"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">Select a category…</option>
              {leafCategories.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Phone *">
            <input
              className="input-base"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. 9876543210"
              inputMode="tel"
            />
          </Field>

          <div className="rounded-md border border-border bg-muted/40 p-3 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Owner login (give these to the shopkeeper)
            </p>
            <Field label="Login email *">
              <input
                className="input-base"
                type="email"
                value={ownerEmail}
                onChange={(e) => setOwnerEmail(e.target.value)}
                placeholder="shopkeeper@example.com"
                inputMode="email"
              />
            </Field>
            <Field label="Temporary password *">
              <input
                className="input-base"
                value={ownerPassword}
                onChange={(e) => setOwnerPassword(e.target.value)}
                placeholder="At least 6 characters"
              />
            </Field>
            <p className="text-xs text-muted-foreground">
              The shopkeeper will be asked to change this on their first login.
            </p>
          </div>

          <Field label="Short description">
            <input
              className="input-base"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Bridal makeup, hair styling, facials"
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Area / street">
              <input className="input-base" value={line1} onChange={(e) => setLine1(e.target.value)} placeholder="Narendrapur" />
            </Field>
            <Field label="City">
              <input className="input-base" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Cuttack" />
            </Field>
            <Field label="Pincode">
              <input className="input-base" value={pincode} onChange={(e) => setPincode(e.target.value)} placeholder="754293" inputMode="numeric" />
            </Field>
          </div>

          <Field label="Shop photo (optional)">
            <ImageUploader value={logo} onChange={(url) => setLogo(url || '')} kind="shop" variant="banner" />
          </Field>

          <Field label="Shop location * (drop a pin)">
            <LocationPicker value={location} onChange={(v) => setLocation(v)} />
          </Field>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-2">
            <Button onClick={submit} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
              Add shop
            </Button>
            <Button variant="ghost" onClick={() => reset(false)} disabled={saving}>
              Clear all
            </Button>
          </div>
        </CardContent>
      </Card>

      <style jsx>{`
        :global(.input-base) {
          width: 100%;
          border: 1px solid var(--border, #e5e7eb);
          border-radius: 0.5rem;
          padding: 0.6rem 0.75rem;
          font-size: 0.95rem;
          background: var(--background, #fff);
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium block mb-1.5">{label}</span>
      {children}
    </label>
  );
}
