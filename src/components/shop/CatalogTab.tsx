'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Search, Plus, IndianRupee, Check, AlertCircle, PackagePlus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ApiError } from '@/lib/api';
import {
  fetchTemplates,
  cloneFromTemplates,
  type ProductTemplate,
  type BulkCloneResponse,
} from '@/lib/templates';

/**
 * Shop-side Catalog tab.
 *
 * UX flow:
 *   1. Owner sees groups (Grains, Pulses, …) as tabs at top with counts
 *   2. Clicks a group → shows its templates as cards
 *   3. Ticks the ones they sell — opens a row showing price (pre-filled from
 *      template's suggestedPrice, editable) + stock input
 *   4. Bottom sticky bar shows "Add N products" — clicking bulk-clones
 *   5. After clone, success banner shows count created vs skipped
 *
 * Selections are kept in state per session — switching groups doesn't lose
 * the previous group's selections.
 */

interface Props {
  shopId: string;
  /** Callback so the parent (Products tab) can refresh after a clone. */
  onCloned?: (created: number) => void;
}

interface Selection {
  templateId: string;
  price: number;
  stock: number;
}

export function CatalogTab({ shopId, onCloned }: Props) {
  const [templates, setTemplates] = useState<ProductTemplate[] | null>(null);
  const [groupCounts, setGroupCounts] = useState<Record<string, number>>({});
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [selections, setSelections] = useState<Record<string, Selection>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successResp, setSuccessResp] = useState<BulkCloneResponse | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await fetchTemplates({ q: query.trim() || undefined });
      setTemplates(r.templates);
      setGroupCounts(r.groupCounts);
      // Default to the first group with templates
      const firstGroup = Object.keys(r.groupCounts).sort()[0];
      if (!activeGroup && firstGroup) setActiveGroup(firstGroup);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load template catalog.');
    }
  }, [query, activeGroup]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-search when query changes (debounced via timeout)
  useEffect(() => {
    const t = setTimeout(() => {
      load();
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const visibleTemplates = useMemo(() => {
    if (!templates) return [];
    if (!activeGroup) return templates;
    return templates.filter((t) => t.group === activeGroup);
  }, [templates, activeGroup]);

  const groups = useMemo(() => Object.keys(groupCounts).sort(), [groupCounts]);
  const selectedCount = Object.keys(selections).length;

  function toggleSelect(tpl: ProductTemplate) {
    setSelections((prev) => {
      const next = { ...prev };
      if (next[tpl._id]) {
        delete next[tpl._id];
      } else {
        next[tpl._id] = { templateId: tpl._id, price: tpl.suggestedPrice, stock: 0 };
      }
      return next;
    });
  }

  function updateSelection(templateId: string, patch: Partial<Selection>) {
    setSelections((prev) => ({
      ...prev,
      [templateId]: { ...prev[templateId], ...patch },
    }));
  }

  async function doClone() {
    if (selectedCount === 0) return;
    setBusy(true);
    setError(null);
    setSuccessResp(null);
    try {
      const r = await cloneFromTemplates(shopId, Object.values(selections));
      setSuccessResp(r);
      setSelections({}); // Clear selection after success
      onCloned?.(r.created);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Bulk add failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 pb-24">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <PackagePlus className="h-5 w-5" />
          Add from catalog
        </h2>
        <p className="text-xs text-muted-foreground">
          Tick the items you sell. Suggested prices are editable — set your own per product, then add them all in one go.
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search products (e.g. rice, dal, soap…)"
          className="w-full pl-9 pr-3 py-2 border rounded-md text-sm"
        />
      </div>

      {/* Group tabs */}
      {groups.length > 0 && (
        <div className="flex gap-1 border-b overflow-x-auto">
          {groups.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setActiveGroup(g)}
              className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${
                activeGroup === g
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {g} <span className="text-xs text-muted-foreground">({groupCounts[g]})</span>
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {successResp && (
        <div className="text-sm bg-brand-greenLight/40 text-brand-green rounded-md px-3 py-2 flex items-start gap-2">
          <Check className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <div className="font-medium">
              Added {successResp.created} {successResp.created === 1 ? 'product' : 'products'} to your store.
            </div>
            {successResp.skipped.length > 0 && (
              <div className="text-xs mt-0.5">
                Skipped {successResp.skipped.length} (already in your store).
              </div>
            )}
          </div>
        </div>
      )}

      {templates === null && (
        <div className="py-12 flex items-center justify-center text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          Loading catalog…
        </div>
      )}

      {templates && visibleTemplates.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            {query.trim() ? `No catalog items match "${query}"` : 'No items in this group.'}
          </CardContent>
        </Card>
      )}

      {visibleTemplates.length > 0 && (
        <div className="space-y-2">
          {visibleTemplates.map((tpl) => {
            const sel = selections[tpl._id];
            return (
              <Card key={tpl._id} className={sel ? 'border-brand-green/40 bg-brand-greenLight/10' : ''}>
                <CardContent className="pt-3 pb-3 space-y-2">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={!!sel}
                      onChange={() => toggleSelect(tpl)}
                      className="mt-1 h-4 w-4 accent-brand-green"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{tpl.name}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                        {tpl.weight && <span>{tpl.weight}</span>}
                        <Badge variant="default" className="text-[10px]">
                          Suggested ₹{tpl.suggestedPrice}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {sel && (
                    <div className="grid grid-cols-2 gap-2 pl-7">
                      <label className="block">
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Your price (₹)</span>
                        <div className="relative">
                          <IndianRupee className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                          <input
                            type="number"
                            value={sel.price}
                            min={0}
                            onChange={(e) => updateSelection(tpl._id, { price: Number(e.target.value) })}
                            className="w-full pl-7 pr-2 py-1.5 border rounded-md text-sm"
                          />
                        </div>
                      </label>
                      <label className="block">
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Initial stock</span>
                        <input
                          type="number"
                          value={sel.stock}
                          min={0}
                          onChange={(e) => updateSelection(tpl._id, { stock: Number(e.target.value) })}
                          className="w-full px-2 py-1.5 border rounded-md text-sm"
                          placeholder="0"
                        />
                      </label>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Sticky bottom action bar */}
      {selectedCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-background border-t shadow-lg py-3 px-4 z-30">
          <div className="container max-w-3xl flex items-center gap-3">
            <div className="flex-1">
              <div className="font-semibold text-sm">{selectedCount} selected</div>
              <div className="text-xs text-muted-foreground">
                Total inventory value: ₹{Object.values(selections).reduce((s, x) => s + x.price * (x.stock || 1), 0).toLocaleString()}
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => setSelections({})} disabled={busy}>
              Clear
            </Button>
            <Button onClick={doClone} disabled={busy} className="min-w-[160px]">
              {busy ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Add {selectedCount} {selectedCount === 1 ? 'product' : 'products'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
  
