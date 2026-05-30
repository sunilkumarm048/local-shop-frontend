'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, MapPin, Phone, Pencil } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { updateShop } from '@/lib/owner';
import { ApiError } from '@/lib/api';
import type { Shop } from '@/lib/shops';
import { ImageUploader } from '@/components/uploads/ImageUploader';
import { GalleryManager } from '@/components/shop/GalleryManager';

const editSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().max(500).optional().or(z.literal('')),
  phone: z.string().trim().min(10).max(20).optional().or(z.literal('')),
  logo: z.string().url().optional().or(z.literal('')),
  coverImage: z.string().url().optional().or(z.literal('')),
});

type EditForm = z.infer<typeof editSchema>;

interface Props {
  shop: Shop;
  onUpdated: (shop: Shop) => void;
}

export function StorefrontTab({ shop, onUpdated }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const addr = shop.address || {};
  const phone = shop.phone;

  return (
    <div className="space-y-4">
      <Card>
        {shop.coverImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={shop.coverImage}
            alt={shop.name}
            className="w-full h-40 object-cover rounded-t-lg"
          />
        )}
        <CardHeader>
          <div className="flex items-start gap-4">
            {shop.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={shop.logo}
                alt=""
                className="h-16 w-16 rounded-lg object-cover border bg-muted"
              />
            ) : (
              <div className="h-16 w-16 rounded-lg border bg-muted flex items-center justify-center text-2xl">
                🏪
              </div>
            )}
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle>{shop.name}</CardTitle>
                {!shop.isOpen && <Badge variant="destructive">Closed</Badge>}
              </div>
              {shop.description && (
                <p className="text-sm text-muted-foreground mt-1">{shop.description}</p>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {(addr.line1 || addr.city) && (
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                {addr.line1 && <div>{addr.line1}</div>}
                {[addr.city, addr.state, addr.pincode].filter(Boolean).join(', ')}
              </div>
            </div>
          )}
          {phone && (
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              {phone}
            </div>
          )}
        </CardContent>
      </Card>

      <GalleryManager shop={shop} onUpdated={onUpdated} />

      <EditDialog
        open={isEditing}
        onOpenChange={setIsEditing}
        shop={shop}
        onSaved={(s) => {
          setIsEditing(false);
          onUpdated(s);
        }}
      />
    </div>
  );
}

interface EditDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  shop: Shop;
  onSaved: (shop: Shop) => void;
}

function EditDialog({ open, onOpenChange, shop, onSaved }: EditDialogProps) {
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<EditForm>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      name: shop.name,
      description: shop.description || '',
      phone: shop.phone || '',
      logo: shop.logo || '',
      coverImage: shop.coverImage || '',
    },
  });

  const onSubmit = form.handleSubmit(async (data) => {
    setServerError(null);
    try {
      const { shop: updated } = await updateShop(shop._id, {
        name: data.name,
        description: data.description || undefined,
        phone: data.phone || undefined,
        logo: data.logo || undefined,
        coverImage: data.coverImage || undefined,
      });
      onSaved(updated);
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : 'Could not save.');
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit shop details</DialogTitle>
          <DialogDescription>
            Address and location pin aren&apos;t editable here yet — coming in a later release.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="e-name">Name</Label>
            <Input id="e-name" {...form.register('name')} />
            {form.formState.errors.name && (
              <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="e-description">Description</Label>
            <Textarea id="e-description" {...form.register('description')} rows={3} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="e-phone">Phone</Label>
            <Input id="e-phone" type="tel" {...form.register('phone')} />
          </div>
          <div className="space-y-3">
            <div>
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
            <div>
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

          {serverError && (
            <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
              {serverError}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
