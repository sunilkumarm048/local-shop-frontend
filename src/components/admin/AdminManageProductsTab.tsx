'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Search, EyeOff, Eye, Package, Store as StoreIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ApiError } from '@/lib/api';
import {
  fetchAdminProducts,
  setProductActive,
  type AdminProduct,
} from '@/lib/admin';

/**
 * Cross-shop product moderation.
 *
 * Search by name or category, optionally include hidden products to review
 * past takedowns. Toggle visibility (soft-delete) per-row.
 *
 * Pagination is client-driven via the `page` query param.
 */

const LIMIT = 20;

export default function AdminManageProductsTab() {
  const [products, setProducts] = useState<AdminProduct[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetchAdminProducts({
        q: query.trim() || undefined,
        page,
        limit: LIMIT,
        includeInactive,
      });
      setProducts(r.products);
      setTotal(r.total);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load products.');
    } finally {
      setLoading(false);
    }
  }, [query, page, includeInactive]);

  useEffect(() => {
    load();
  }, [load]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [query, includeInactive]);

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Product oversight</h2>
        <p className="text-xs text-muted-foreground">
          Search products across all shops. Hide inappropriate listings; existing orders are unaffected.
        </p>
      </div>

      {/* Search + filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by product or category…"
            className="w-full pl-9 pr-3 py-2 border rounded-md text-sm"
          />
        </div>
        <label className="flex items-center gap-2 text-xs px-3 py-2 border rounded-md cursor-pointer hover:bg-muted/40">
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(e) => setIncludeInactive(e.target.checked)}
            className="accent-brand-green"
          />
          Include hidden
        </label>
      </div>

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{error}</div>
      )}

      {loading && products === null && (
        <div className="py-8 flex items-center justify-center text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          Loading…
        </div>
      )}

      {products && products.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No products match your search.
          </CardContent>
        </Card>
      )}

      {products && products.length > 0 && (
        <>
          <div className="text-xs text-muted-foreground">
            {total} product{total === 1 ? '' : 's'} match · page {page} of {totalPages}
          </div>
          <div className="space-y-2">
            {products.map((p) => (
              <ProductRow key={p._id} product={p} onChanged={load} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1 || loading}
              >
                ← Previous
              </Button>
              <span className="text-xs text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages || loading}
              >
                Next →
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ProductRow({ product, onChanged }: { product: AdminProduct; onChanged: () => void | Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const shopName = typeof product.shop === 'object' ? product.shop?.name : null;

  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      await setProductActive(product._id, !product.isActive);
      await onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Action failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className={product.isActive ? '' : 'opacity-60'}>
      <CardContent className="pt-3 pb-3">
        <div className="flex items-center gap-3">
          {product.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.imageUrl}
              alt={product.name}
              className="h-10 w-10 rounded-md object-cover bg-muted shrink-0"
            />
          ) : (
            <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center shrink-0">
              <Package className="h-4 w-4 text-muted-foreground" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm truncate">{product.name}</div>
            <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
              <span>₹{product.price}</span>
              {product.weight && <span>· {product.weight}</span>}
              {product.category && <span>· {product.category}</span>}
              {shopName && (
                <span className="flex items-center gap-0.5">
                  · <StoreIcon className="h-3 w-3" />
                  {shopName}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!product.isActive && <Badge variant="destructive">Hidden</Badge>}
            <Button
              variant={product.isActive ? 'outline' : 'default'}
              size="sm"
              onClick={toggle}
              disabled={busy}
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : product.isActive ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
        {error && (
          <div className="text-xs text-destructive bg-destructive/10 rounded px-2 py-1 mt-2">{error}</div>
        )}
      </CardContent>
    </Card>
  );
}
