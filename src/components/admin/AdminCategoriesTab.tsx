'use client';

import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Plus, Pencil, Trash2, EyeOff } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ApiError } from '@/lib/api';
import {
  fetchAdminCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from '@/lib/admin';
import type { Category } from '@/lib/shops';

const schema = z.object({
  name: z.string().trim().min(1, 'Required').max(60),
  icon: z.string().max(40).optional().or(z.literal('')),
  image: z.string().url('Must be a URL').optional().or(z.literal('')),
  sortOrder: z.coerce.number().int().optional(),
  isActive: z.boolean().optional(),
  // '' means top-level group; otherwise it's a parent _id.
  parent: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export function AdminCategoriesTab() {
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Category | null>(null);
  const [open, setOpen] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const r = await fetchAdminCategories();
      setCategories(r.categories);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Could not load categories.');
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  function openCreate() {
    setEditing(null);
    setOpen(true);
  }
  function openEdit(c: Category) {
    setEditing(c);
    setOpen(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-semibold">Categories</h2>
          <p className="text-sm text-muted-foreground">
            Categories shop owners pick from. Inactive ones don&apos;t show to customers.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Add category
        </Button>
      </div>

      {loadError && (
        <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
          {loadError}
        </div>
      )}

      {categories === null ? (
        <div className="py-10 flex items-center justify-center text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          Loading…
        </div>
      ) : categories.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No categories yet. Add the first one.
          </CardContent>
        </Card>
      ) : (
        <GroupedCategoryList categories={categories} onEdit={openEdit} />
      )}

      <CategoryDialog
        open={open}
        onOpenChange={setOpen}
        category={editing}
        allCategories={categories || []}
        onSaved={async () => {
          setOpen(false);
          await refresh();
        }}
      />
    </div>
  );
}

/**
 * Groups categories by parent. Top-level groups render as section headers
 * with their direct children listed underneath. Orphans (parent missing
 * from active set) fall under an "Other" section.
 */
function GroupedCategoryList({
  categories,
  onEdit,
}: {
  categories: Category[];
  onEdit: (c: Category) => void;
}) {
  // Parent here comes from the admin API populated, so `parent` is either
  // null/undefined OR an object { _id, name }.
  const tops = categories.filter((c) => !c.parent);
  const childrenByParent = new Map<string, Category[]>();
  const orphans: Category[] = [];
  const topIds = new Set(tops.map((t) => t._id));

  for (const c of categories) {
    if (!c.parent) continue;
    const parentId = typeof c.parent === 'string' ? c.parent : c.parent._id;
    if (!topIds.has(parentId)) {
      orphans.push(c);
      continue;
    }
    if (!childrenByParent.has(parentId)) childrenByParent.set(parentId, []);
    childrenByParent.get(parentId)!.push(c);
  }

  if (tops.length === 0) {
    return (
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {categories.map((c) => (
          <CategoryCard key={c._id} category={c} onEdit={() => onEdit(c)} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {tops.map((top) => {
        const kids = childrenByParent.get(top._id) || [];
        return (
          <section key={top._id} className="space-y-2">
            <div className="flex items-center gap-2 px-1">
              <span className="text-lg" aria-hidden>{top.icon || '📦'}</span>
              <h3 className="text-sm font-semibold">{top.name}</h3>
              <span className="text-xs text-muted-foreground">
                ({kids.length} {kids.length === 1 ? 'subcategory' : 'subcategories'})
              </span>
              <Button variant="ghost" size="sm" className="ml-auto h-7 text-xs" onClick={() => onEdit(top)}>
                <Pencil className="h-3 w-3 mr-1" />
                Edit group
              </Button>
            </div>
            {kids.length > 0 && (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 pl-6">
                {kids.map((c) => (
                  <CategoryCard key={c._id} category={c} onEdit={() => onEdit(c)} />
                ))}
              </div>
            )}
          </section>
        );
      })}

      {orphans.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <h3 className="text-sm font-semibold text-orange-600">Other (parent missing)</h3>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 pl-6">
            {orphans.map((c) => (
              <CategoryCard key={c._id} category={c} onEdit={() => onEdit(c)} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function CategoryCard({
  category,
  onEdit,
}: {
  category: Category & { sortOrder?: number; isActive?: boolean };
  onEdit: () => void;
}) {
  return (
    <Card className={category.isActive === false ? 'opacity-60' : ''}>
      <CardContent className="py-4">
        <button
          type="button"
          onClick={onEdit}
          className="w-full text-left flex items-center gap-3 hover:bg-accent/30 rounded-md p-1.5 -m-1.5 transition-colors"
        >
          {category.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={category.image}
              alt=""
              className="h-10 w-10 rounded-md object-cover bg-muted"
            />
          ) : (
            <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center text-lg">
              {category.icon || '📦'}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium">{category.name}</span>
              {category.isActive === false && (
                <Badge variant="secondary">
                  <EyeOff className="h-3 w-3 mr-1" />
                  Hidden
                </Badge>
              )}
            </div>
            {category.sortOrder !== undefined && (
              <span className="text-xs text-muted-foreground">sort {category.sortOrder}</span>
            )}
          </div>
          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </CardContent>
    </Card>
  );
}

interface DialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  category: Category | null;
  allCategories: Category[];
  onSaved: () => void | Promise<void>;
}

function CategoryDialog({ open, onOpenChange, category, allCategories, onSaved }: DialogProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Top-level groups only — children can't have children (one-level limit).
  // When editing a parent, exclude itself to prevent self-reference.
  const parentOptions = allCategories.filter(
    (c) => !c.parent && (!category || c._id !== category._id)
  );

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      icon: '',
      image: '',
      sortOrder: 0,
      isActive: true,
      parent: '',
    },
  });

  useEffect(() => {
    if (!open) return;
    if (category) {
      const currentParentId = !category.parent
        ? ''
        : typeof category.parent === 'string'
          ? category.parent
          : category.parent._id;
      form.reset({
        name: category.name,
        icon: category.icon || '',
        image: category.image || '',
        sortOrder: (category as Category & { sortOrder?: number }).sortOrder ?? 0,
        isActive: (category as Category & { isActive?: boolean }).isActive ?? true,
        parent: currentParentId,
      });
    } else {
      form.reset({ name: '', icon: '', image: '', sortOrder: 0, isActive: true, parent: '' });
    }
    setServerError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, category?._id]);

  const onSubmit = form.handleSubmit(async (data) => {
    setServerError(null);
    try {
      const payload = {
        name: data.name,
        icon: data.icon || undefined,
        image: data.image || undefined,
        sortOrder: data.sortOrder,
        isActive: data.isActive,
        parent: data.parent ? data.parent : null,
      };
      if (category) await updateCategory(category._id, payload);
      else await createCategory(payload);
      await onSaved();
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : 'Could not save.');
    }
  });

  async function onDelete() {
    if (!category) return;
    if (!confirm(`Hide "${category.name}"?`)) return;
    setDeleting(true);
    try {
      await deleteCategory(category._id);
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
          <DialogTitle>{category ? 'Edit category' : 'Add category'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="c-name">Name</Label>
            <Input id="c-name" {...form.register('name')} placeholder="Bakery, Grocery, …" />
            {form.formState.errors.name && (
              <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="c-icon">Icon (emoji)</Label>
              <Input id="c-icon" {...form.register('icon')} placeholder="🥖" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-sort">Sort order</Label>
              <Input
                id="c-sort"
                type="number"
                step="1"
                inputMode="numeric"
                {...form.register('sortOrder')}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="c-parent">Parent group</Label>
            <select
              id="c-parent"
              {...form.register('parent')}
              className="w-full px-3 py-2 border rounded-md text-sm bg-background"
            >
              <option value="">— Top-level group (no parent) —</option>
              {parentOptions.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.icon ? `${p.icon} ` : ''}{p.name}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-muted-foreground">
              Pick a parent to nest this under it. Top-level groups have no parent.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="c-image">Image URL</Label>
            <Input id="c-image" type="url" {...form.register('image')} placeholder="https://..." />
            {form.formState.errors.image && (
              <p className="text-xs text-destructive">{form.formState.errors.image.message}</p>
            )}
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...form.register('isActive')} className="rounded" />
            Active (visible to shop owners and customers)
          </label>

          {serverError && (
            <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
              {serverError}
            </div>
          )}

          <DialogFooter className="gap-2">
            {category && (
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
                Hide
              </Button>
            )}
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {category ? 'Save' : 'Add'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
