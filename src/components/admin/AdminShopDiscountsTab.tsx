'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Percent, IndianRupee, Check, X, Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ApiError } from '@/lib/api';
import {
  fetchAdminShops,
  setShopDiscount,
  type AdminShop,
  type ShopDiscount,
} from '@/lib/admin';

/**
 * Per-shop discount editor.
 *
 * Lists all approved shops with their current discount settings; each row
 * has an inline editor. Saving a row PATCHes only that shop. The pricing
 * engine already applies shop discount during quote-time, so changes take
 * effect on the customer's very next quote.
 */

export default function AdminShopDiscountsTab() {
  const [shops, setShops] = useState<AdminShop[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await fetchAdminShops('approved');
      setShops(r.shops);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load shops.');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = (shops || []).filter(
    (s) => !query.trim() || s.name.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Shop discounts</h2>
        <p className="text-xs text-muted-foreground">
          Set per-shop offers. Active discounts apply automatically at checkout.
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search shops…"
          className="w-full pl-9 pr-3 py-2 border rounded-md text-sm"
        />
      </div>

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{error}</div>
      )}

      {shops === null && (
        <div className="py-8 flex items-center justify-center text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          Loading…
        </div>
      )}

      {shops && filtered.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            {shops.length === 0 ? 'No approved shops yet.' : 'No matches.'}
          </CardContent>
        </Card>
      )}

      {filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map((s) => (
            <ShopRow key={s._id} shop={s} onSaved={load} />
          ))}
        </div>
      )}
    </div>
  );
}

function ShopRow({ shop, onSaved }: { shop: AdminShop; onSaved: () => void | Promise<void> }) {
  const initial: ShopDiscount = {
    enabled: shop.discount?.enabled || false,
    type: shop.discount?.type || 'percent',
    value: shop.discount?.value || 0,
    label: shop.discount?.label || '',
  };
  const [draft, setDraft] = useState<ShopDiscount>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);

  async function save() {
    setBusy(true);
    setError(null);
    setSuccess(false);
    try {
      await setShopDiscount(shop._id, draft);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
      await onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Save failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className={draft.enabled ? 'border-brand-green/40' : ''}>
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="min-w-0">
            <div className="font-semibold truncate">{shop.name}</div>
            {shop.category && <div className="text-xs text-muted-foreground">{shop.category}</div>}
          </div>
          <Badge variant={draft.enabled ? 'success' : 'default'}>
            {draft.enabled ? 'Active' : 'Inactive'}
          </Badge>
        </div>

        {/* Toggle */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={draft.enabled}
            onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })}
            className="accent-brand-green"
          />
          <span className="text-sm">Discount enabled</span>
        </label>

        {draft.enabled && (
          <div className="space-y-2 bg-muted/30 rounded-md p-3">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDraft({ ...draft, type: 'percent' })}
                className={`flex items-center justify-center gap-1.5 p-2 rounded-md border-2 text-sm font-medium ${
                  draft.type === 'percent' ? 'border-brand-green bg-white' : 'border-transparent bg-white/40'
                }`}
              >
                <Percent className="h-3.5 w-3.5" />
                Percent off
              </button>
              <button
                type="button"
                onClick={() => setDraft({ ...draft, type: 'flat' })}
                className={`flex items-center justify-center gap-1.5 p-2 rounded-md border-2 text-sm font-medium ${
                  draft.type === 'flat' ? 'border-brand-green bg-white' : 'border-transparent bg-white/40'
                }`}
              >
                <IndianRupee className="h-3.5 w-3.5" />
                Flat amount
              </button>
            </div>

            <label className="block">
              <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                {draft.type === 'percent' ? 'Discount percent (1-100)' : 'Flat ₹ off'}
              </span>
              <input
                type="number"
                value={draft.value}
                onChange={(e) => setDraft({ ...draft, value: Number(e.target.value) })}
                min={0}
                max={draft.type === 'percent' ? 100 : 100000}
                className="mt-1 w-full px-3 py-2 border rounded-md text-sm"
              />
            </label>

            <label className="block">
              <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Label (shown at checkout)
              </span>
              <input
                type="text"
                value={draft.label || ''}
                onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                placeholder='e.g. "Weekend special" or "Min order ₹500"'
                maxLength={80}
                className="mt-1 w-full px-3 py-2 border rounded-md text-sm"
              />
            </label>
          </div>
        )}

        {error && (
          <div className="text-xs text-destructive bg-destructive/10 rounded px-2 py-1.5">{error}</div>
        )}

        <div className="flex items-center gap-2">
          <Button onClick={save} disabled={!dirty || busy} size="sm" className="flex-1">
            {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
            Save
          </Button>
          {dirty && !busy && (
            <Button variant="outline" size="sm" onClick={() => setDraft(initial)}>
              <X className="h-4 w-4" />
            </Button>
          )}
          {success && <span className="text-xs text-brand-green">Saved</span>}
        </div>
      </CardContent>
    </Card>
  );
}
