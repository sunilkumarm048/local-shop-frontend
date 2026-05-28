'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Store } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { createShop } from '@/lib/owner';
import { fetchCategoryTree } from '@/lib/shops';
import { ApiError } from '@/lib/api';
import type { AddressHints, LatLng } from './LocationPicker';
import type { CategoryNode, Shop } from '@/lib/shops';
import { ImageUploader } from '@/components/uploads/ImageUploader';

// Leaflet touches `window` at import time — dynamic-import with ssr:false.
const LocationPicker = dynamic(() => import('./LocationPicker'), {
  ssr: false,
  loading: () => (
    <div className="h-72 rounded-md border flex items-center justify-center text-sm text-muted-foreground">
      Loading map…
    </div>
  ),
});

const schema = z.object({
  name: z.string().trim().min(2, 'At least 2 characters').max(80),
  description: z.string().max(500).optional(),
  phone: z.string().trim().min(10, 'At least 10 digits').max(20).optional().or(z.literal('')),
  logo: z.string().url('Must be a URL').optional().or(z.literal('')),
  coverImage: z.string().url('Must be a URL').optional().or(z.literal('')),
  category: z.string().optional(),
  address: z.object({
    line1: z.string().min(1, 'Required').max(120),
    line2: z.string().max(120).optional().or(z.literal('')),
    city: z.string().min(1, 'Required').max(60),
    state: z.string().min(1, 'Required').max(60),
    pincode: z.string().min(4, 'Required').max(10),
  }),
});

type FormData = z.infer<typeof schema>;

interface Props {
  onCreated: (shop: Shop) => void;
}

export function ShopWizard({ onCreated }: Props) {
  const [location, setLocation] = useState<LatLng | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [serverError, setServerError] = useState<string | null>(null);
  // Own submit flag — RHF's formState.isSubmitting can get stuck if a request
  // hangs or the error path doesn't settle the promise (e.g. 401 token expiry).
  // A manual flag with a guaranteed finally() always resets the button.
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      description: '',
      phone: '',
      logo: '',
      coverImage: '',
      category: '',
      address: { line1: '', line2: '', city: '', state: '', pincode: '' },
    },
  });

  useEffect(() => {
    fetchCategoryTree()
      .then((r) => setCategories(r.categories))
      .catch(() => setCategories([]));
  }, []);

  /**
   * When the user drops/drags a pin or selects a search result, the picker
   * reverse-geocodes and hands us hints. We fill any address fields the user
   * hasn't typed in yet — without overwriting their input.
   */
  function handleLocationChange(ll: LatLng, hints?: AddressHints) {
    setLocation(ll);
    setLocationError(null);
    if (!hints) return;
    const current = form.getValues('address');
    const patch: Partial<typeof current> = {};
    if (!current.line1?.trim() && hints.line1) patch.line1 = hints.line1;
    if (!current.city?.trim() && hints.city) patch.city = hints.city;
    if (!current.state?.trim() && hints.state) patch.state = hints.state;
    if (!current.pincode?.trim() && hints.pincode) patch.pincode = hints.pincode;
    if (Object.keys(patch).length) {
      form.setValue('address', { ...current, ...patch }, { shouldValidate: true });
    }
  }

  const onSubmit = form.handleSubmit(async (data) => {
    setServerError(null);
    setLocationError(null);
    if (!location) {
      setLocationError('Drop a pin on the map to set your shop location.');
      return;
    }
    setSubmitting(true);
    try {
      const { shop } = await createShop({
        name: data.name,
        description: data.description || undefined,
        phone: data.phone || undefined,
        logo: data.logo || undefined,
        coverImage: data.coverImage || undefined,
        category: data.category || undefined,
        address: {
          line1: data.address.line1,
          line2: data.address.line2 || undefined,
          city: data.address.city,
          state: data.address.state,
          pincode: data.address.pincode,
        },
        location: { lng: location.lng, lat: location.lat },
      });
      onCreated(shop);
    } catch (err) {
      // Surface a useful message. 401 = expired/invalid session — tell the
      // owner to sign in again rather than leaving them staring at a spinner.
      if (err instanceof ApiError && err.status === 401) {
        setServerError('Your session has expired. Please log out and sign in again, then retry.');
      } else if (err instanceof ApiError) {
        setServerError(err.message);
      } else {
        setServerError('Could not create your shop. Check your connection and try again.');
      }
    } finally {
      // ALWAYS reset — success, handled error, or unexpected throw.
      setSubmitting(false);
    }
  });

  return (
    <Card className="max-w-3xl mx-auto">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-brand-greenLight text-brand-green flex items-center justify-center">
            <Store className="h-5 w-5" />
          </div>
          <div>
            <CardTitle>Create your shop</CardTitle>
            <CardDescription>
              This is what customers will see when they browse nearby shops.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <form onSubmit={onSubmit} className="space-y-8">
          {/* Basics */}
          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Basics
            </h2>

            <div className="space-y-2">
              <Label htmlFor="name">Shop name</Label>
              <Input id="name" {...form.register('name')} placeholder="e.g. Sharma Kirana Store" />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                {...form.register('description')}
                placeholder="What kinds of products you sell, opening hours, anything special…"
                rows={3}
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone (for orders)</Label>
                <Input id="phone" type="tel" {...form.register('phone')} placeholder="9876543210" />
                {form.formState.errors.phone && (
                  <p className="text-xs text-destructive">{form.formState.errors.phone.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <select
                  id="category"
                  {...form.register('category')}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">— Select your shop type —</option>
                  {/* 8b: nested categories rendered as <optgroup> labeled with
                      the parent group; only children (subcategories) are
                      selectable, which keeps shop data clean and analytics
                      precise. If a top-level group has no children yet, we
                      still surface it as a selectable option so it isn't lost. */}
                  {categories.map((group) =>
                    group.children.length > 0 ? (
                      <optgroup
                        key={group._id}
                        label={`${group.icon ? group.icon + ' ' : ''}${group.name}`}
                      >
                        {group.children.map((c) => (
                          <option key={c._id} value={c._id}>
                            {c.icon ? `${c.icon} ` : ''}{c.name}
                          </option>
                        ))}
                      </optgroup>
                    ) : (
                      <option key={group._id} value={group._id}>
                        {group.icon ? `${group.icon} ` : ''}{group.name}
                      </option>
                    )
                  )}
                </select>
                <p className="text-[10px] text-muted-foreground">
                  Pick the specific shop type that best fits your business.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <Label>Shop logo</Label>
                <ImageUploader
                  value={form.watch('logo') || ''}
                  onChange={(url) => form.setValue('logo', url, { shouldValidate: true, shouldDirty: true })}
                  kind="shop"
                  variant="thumbnail"
                />
                {form.formState.errors.logo && (
                  <p className="text-xs text-destructive">{form.formState.errors.logo.message}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label>Cover image</Label>
                <ImageUploader
                  value={form.watch('coverImage') || ''}
                  onChange={(url) =>
                    form.setValue('coverImage', url, { shouldValidate: true, shouldDirty: true })
                  }
                  kind="shop"
                  variant="banner"
                />
                {form.formState.errors.coverImage && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.coverImage.message}
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* Location pin — placed BEFORE address so reverse-geocode autofills below */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Pin shop location on map
            </h2>
            <LocationPicker value={location} onChange={handleLocationChange} />
            {locationError && <p className="text-xs text-destructive">{locationError}</p>}
            <p className="text-xs text-muted-foreground">
              Address fields below auto-fill from your pin. Edit them if anything looks off.
            </p>
          </section>

          {/* Address */}
          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Address
            </h2>

            <div className="space-y-2">
              <Label htmlFor="address.line1">Address line 1</Label>
              <Input id="address.line1" {...form.register('address.line1')} />
              {form.formState.errors.address?.line1 && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.address.line1.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="address.line2">Address line 2</Label>
              <Input id="address.line2" {...form.register('address.line2')} />
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="address.city">City</Label>
                <Input id="address.city" {...form.register('address.city')} />
                {form.formState.errors.address?.city && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.address.city.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="address.state">State</Label>
                <Input id="address.state" {...form.register('address.state')} />
                {form.formState.errors.address?.state && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.address.state.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="address.pincode">Pincode</Label>
                <Input id="address.pincode" {...form.register('address.pincode')} />
                {form.formState.errors.address?.pincode && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.address.pincode.message}
                  </p>
                )}
              </div>
            </div>
          </section>

          {serverError && (
            <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
              {serverError}
            </div>
          )}

          <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create shop
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
