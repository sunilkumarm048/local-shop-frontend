'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Plus, Pencil, Trash2, PackageX } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  createProduct,
  deleteProduct,
  fetchAllProductsForOwner,
  updateProduct,
} from '@/lib/owner';
import { ApiError } from '@/lib/api';
import type { Product } from '@/lib/shops';
import { ImageUploader } from '@/components/uploads/ImageUploader';

const productSchema = z.object({
  name: z.string().trim().min(1, 'Required').max(120),
  description: z.string().max(1000).optional().or(z.literal('')),
  image: z.string().url('Must be a URL').optional().or(z.literal('')),
  price: z.coerce.number().min(0, 'Must be ≥ 0'),
  mrp: z.coerce.number().min(0).optional(),
  stock: z.coerce.number().int().min(0, 'Must be ≥ 0'),
  weight: z.string().max(20).optional().or(z.literal('')),
});

type ProductForm = z.infer<typeof productSchema>;

interface Props {
  shopId: string;
}

export function ProductsTab({ shopId }: Props) {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Product | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  async function refresh() {
    try {
      const r = await fetchAllProductsForOwner(shopId);
      setProducts(r.products);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Could not load products.');
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopId]);

  function openCreate() {
    setEditing(null);
    setIsOpen(true);
  }
  function openEdit(p: Product) {
    setEditing(p);
    setIsOpen(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Products</h2>
          <p className="text-sm text-muted-foreground">
            {products ? `${products.length} total` : 'Loading…'}
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Add product
        </Button>
      </div>

      {loadError && (
        <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
          {loadError}
        </div>
      )}

      {products && products.length === 0 && (
        <Card>
          <CardContent className="py-10 flex flex-col items-center gap-3 text-center">
            <PackageX className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No products yet. Add your first one to start receiving orders.
            </p>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Add your first product
            </Button>
          </CardContent>
        </Card>
      )}

      {products && products.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((p) => (
            <ProductCard key={p._id} product={p} onEdit={() => openEdit(p)} />
          ))}
        </div>
      )}

      <ProductDialog
        open={isOpen}
        onOpenChange={setIsOpen}
        shopId={shopId}
        product={editing}
        onSaved={async () => {
          setIsOpen(false);
          await refresh();
        }}
      />
    </div>
  );
}

// ----- Card -----

interface CardProps {
  product: Product;
  onEdit: () => void;
}

function ProductCard({ product, onEdit }: CardProps) {
  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={onEdit}
        className="text-left w-full hover:bg-accent/50 transition-colors"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={product.image || 'https://via.placeholder.com/400x300?text=No+image'}
          alt={product.name}
          className="w-full h-40 object-cover bg-muted"
        />
        <CardContent className="space-y-2 pt-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-medium leading-tight">{product.name}</h3>
            <Pencil className="h-4 w-4 text-muted-foreground shrink-0" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-semibold">₹{product.price}</span>
            {product.mrp && product.mrp > product.price && (
              <span className="text-xs text-muted-foreground line-through">₹{product.mrp}</span>
            )}
            {product.weight && (
              <span className="text-xs text-muted-foreground ml-auto">{product.weight}</span>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {product.isActive === false ? (
              <Badge variant="outline">Hidden</Badge>
            ) : product.inStock && product.stock > 0 ? (
              <Badge variant="success">In stock · {product.stock}</Badge>
            ) : (
              <Badge variant="destructive">Out of stock</Badge>
            )}
          </div>
        </CardContent>
      </button>
    </Card>
  );
}

// ----- Dialog form -----

interface DialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  shopId: string;
  product: Product | null;
  onSaved: () => void | Promise<void>;
}

function ProductDialog({ open, onOpenChange, shopId, product, onSaved }: DialogProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const form = useForm<ProductForm>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: '',
      description: '',
      image: '',
      price: 0,
      mrp: undefined,
      stock: 0,
      weight: '',
    },
  });

  // Reset form when editing target changes / dialog opens.
  useEffect(() => {
    if (!open) return;
    if (product) {
      form.reset({
        name: product.name,
        description: product.description || '',
        image: product.image || '',
        price: product.price,
        mrp: product.mrp,
        stock: product.stock,
        weight: product.weight || '',
      });
    } else {
      form.reset({ name: '', description: '', image: '', price: 0, stock: 0, weight: '' });
    }
    setServerError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, product?._id]);

  const onSubmit = form.handleSubmit(async (data) => {
    setServerError(null);
    try {
      const payload = {
        name: data.name,
        description: data.description || undefined,
        image: data.image || undefined,
        price: data.price,
        mrp: data.mrp,
        stock: data.stock,
        weight: data.weight || undefined,
      };
      if (product) {
        await updateProduct(shopId, product._id, payload);
      } else {
        await createProduct(shopId, payload);
      }
      await onSaved();
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : 'Could not save product.');
    }
  });

  async function onDelete() {
    if (!product) return;
    if (!confirm(`Hide "${product.name}" from your shop?`)) return;
    setDeleting(true);
    try {
      await deleteProduct(shopId, product._id);
      await onSaved();
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : 'Delete failed.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{product ? 'Edit product' : 'Add product'}</DialogTitle>
          <DialogDescription>
            {product ? 'Update product details below.' : 'New products appear in your shop immediately.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="p-name">Name</Label>
            <Input id="p-name" {...form.register('name')} />
            {form.formState.errors.name && (
              <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Product image</Label>
            <ImageUploader
              value={form.watch('image') || ''}
              onChange={(url) => form.setValue('image', url, { shouldValidate: true, shouldDirty: true })}
              kind="product"
              variant="thumbnail"
            />
            {form.formState.errors.image && (
              <p className="text-xs text-destructive">{form.formState.errors.image.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="p-description">Description</Label>
            <Textarea id="p-description" {...form.register('description')} rows={3} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="p-price">Price (₹)</Label>
              <Input
                id="p-price"
                type="number"
                step="0.01"
                inputMode="decimal"
                {...form.register('price')}
              />
              {form.formState.errors.price && (
                <p className="text-xs text-destructive">{form.formState.errors.price.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-mrp">MRP (₹)</Label>
              <Input
                id="p-mrp"
                type="number"
                step="0.01"
                inputMode="decimal"
                {...form.register('mrp')}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="p-stock">Stock</Label>
              <Input
                id="p-stock"
                type="number"
                step="1"
                inputMode="numeric"
                {...form.register('stock')}
              />
              {form.formState.errors.stock && (
                <p className="text-xs text-destructive">{form.formState.errors.stock.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-weight">Weight / size</Label>
              <Input id="p-weight" {...form.register('weight')} placeholder="500g, 1L, 12pcs" />
            </div>
          </div>

          {serverError && (
            <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
              {serverError}
            </div>
          )}

          <DialogFooter className="gap-2">
            {product && (
              <Button
                type="button"
                variant="outline"
                className="text-destructive hover:text-destructive sm:mr-auto"
                onClick={onDelete}
                disabled={deleting}
              >
                {deleting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                Delete
              </Button>
            )}
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {product ? 'Save' : 'Add product'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
