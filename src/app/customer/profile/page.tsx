'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Plus, Trash2, ArrowLeft, User as UserIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { ImageUploader } from '@/components/uploads/ImageUploader';
import { ApiError } from '@/lib/api';
import { updateProfile, refreshMe } from '@/lib/auth';
import { useAuth } from '@/stores/auth';
import type { UserAddress } from '@/types';

interface EditableAddress {
  label: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
}

function toEditable(a: UserAddress): EditableAddress {
  return {
    label: a.label || '',
    line1: a.line1 || '',
    line2: a.line2 || '',
    city: a.city || '',
    state: a.state || '',
    pincode: a.pincode || '',
  };
}

export default function CustomerProfilePage() {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const token = useAuth((s) => s.token);
  const [hydrated, setHydrated] = useState(false);

  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState('');
  const [addresses, setAddresses] = useState<EditableAddress[]>([]);

  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setHydrated(useAuth.persist.hasHydrated());
    const unsub = useAuth.persist.onFinishHydration(() => setHydrated(true));
    return unsub;
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!token) {
      router.replace('/login?next=/customer/profile');
      return;
    }
    // Pull the freshest profile so addresses are up to date.
    refreshMe();
  }, [hydrated, token, router]);

  // Seed form from the user once available.
  useEffect(() => {
    if (!user) return;
    setName(user.name || '');
    setAvatar(user.avatar || '');
    setAddresses((user.addresses || []).map(toEditable));
  }, [user]);

  function updateAddress(i: number, field: keyof EditableAddress, value: string) {
    setAddresses((prev) =>
      prev.map((a, idx) => (idx === i ? { ...a, [field]: value } : a))
    );
  }

  function addAddress() {
    setAddresses((prev) => [
      ...prev,
      { label: '', line1: '', line2: '', city: '', state: '', pincode: '' },
    ]);
  }

  function removeAddress(i: number) {
    setAddresses((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function save() {
    setSaving(true);
    setError(null);
    setSavedMsg(null);
    try {
      await updateProfile({
        name: name.trim() || undefined,
        avatar,
        addresses: addresses
          // Drop completely empty rows.
          .filter((a) => a.line1 || a.city || a.pincode || a.label)
          .map((a) => ({
            label: a.label || undefined,
            line1: a.line1 || undefined,
            line2: a.line2 || undefined,
            city: a.city || undefined,
            state: a.state || undefined,
            pincode: a.pincode || undefined,
          })),
      });
      setSavedMsg('Profile saved.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save your profile.');
    } finally {
      setSaving(false);
    }
  }

  if (!hydrated || (token && !user)) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Loading…
      </div>
    );
  }

  if (!token) return null; // redirecting

  return (
    <div className="container max-w-2xl py-6 space-y-6">
      <div className="flex items-center gap-2">
        <Link href="/customer" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-semibold">My Profile</h1>
      </div>

      {/* Basic details */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full overflow-hidden bg-muted flex items-center justify-center shrink-0">
              {avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatar} alt="" className="w-full h-full object-cover" />
              ) : (
                <UserIcon className="h-8 w-8 text-muted-foreground/50" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <Label className="text-xs text-muted-foreground">Profile photo</Label>
              <ImageUploader value={avatar} onChange={setAvatar} kind="shop" />
            </div>
          </div>

          <div>
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Phone</Label>
              <Input value={user?.phone || '—'} disabled />
              <p className="text-[11px] text-muted-foreground mt-1">
                Contact details can&apos;t be changed here.
              </p>
            </div>
            <div>
              <Label>Email</Label>
              <Input value={user?.email || '—'} disabled />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Address book */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Saved addresses</h2>
            <Button variant="outline" size="sm" onClick={addAddress}>
              <Plus className="h-4 w-4 mr-1" />
              Add address
            </Button>
          </div>

          {addresses.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">
              No saved addresses yet. Add one for faster checkout.
            </p>
          ) : (
            <div className="space-y-4">
              {addresses.map((a, i) => (
                <div key={i} className="border border-border rounded-lg p-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <Input
                      value={a.label}
                      onChange={(e) => updateAddress(i, 'label', e.target.value)}
                      placeholder="Label (Home, Work…)"
                      className="max-w-[200px]"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeAddress(i)}
                      aria-label="Remove address"
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <Input
                    value={a.line1}
                    onChange={(e) => updateAddress(i, 'line1', e.target.value)}
                    placeholder="Address line 1"
                  />
                  <Input
                    value={a.line2}
                    onChange={(e) => updateAddress(i, 'line2', e.target.value)}
                    placeholder="Address line 2 (optional)"
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <Input
                      value={a.city}
                      onChange={(e) => updateAddress(i, 'city', e.target.value)}
                      placeholder="City"
                    />
                    <Input
                      value={a.state}
                      onChange={(e) => updateAddress(i, 'state', e.target.value)}
                      placeholder="State"
                    />
                    <Input
                      value={a.pincode}
                      onChange={(e) => updateAddress(i, 'pincode', e.target.value)}
                      placeholder="Pincode"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
          {error}
        </div>
      )}
      {savedMsg && (
        <div className="text-sm text-brand-green bg-brand-green/10 rounded-md px-3 py-2">
          {savedMsg}
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving…
            </>
          ) : (
            'Save changes'
          )}
        </Button>
      </div>
    </div>
  );
}
