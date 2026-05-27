'use client';

import { useState } from 'react';
import { Check, SlidersHorizontal, X } from 'lucide-react';

/* ----------------------------------------------------------------------- */
/* Shared types                                                             */
/* ----------------------------------------------------------------------- */

export type SortKey = 'relevance' | 'price-asc' | 'price-desc';

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'price-asc', label: 'Price: Low to High' },
  { value: 'price-desc', label: 'Price: High to Low' },
];

/** Discount thresholds, expressed as percentage off. null = no filter. */
export const DISCOUNT_OPTIONS: { value: number; label: string }[] = [
  { value: 10, label: '10% Off & above' },
  { value: 20, label: '20% Off & above' },
  { value: 30, label: '30% Off & above' },
  { value: 50, label: '50% Off & above' },
];

export interface FiltersState {
  sortBy: SortKey;
  priceMin: string;
  priceMax: string;
  /** Minimum discount % required (null = no filter). */
  minDiscount: number | null;
  /** Hide out-of-stock items. */
  inStockOnly: boolean;
}

export const EMPTY_FILTERS: FiltersState = {
  sortBy: 'relevance',
  priceMin: '',
  priceMax: '',
  minDiscount: null,
  inStockOnly: false,
};

interface Props {
  filters: FiltersState;
  onChange: (next: FiltersState) => void;
  productCount: number;
}

/* ----------------------------------------------------------------------- */
/* Inner panel — shared by desktop sidebar AND mobile drawer                */
/* ----------------------------------------------------------------------- */

function FiltersPanel({ filters, onChange, productCount }: Props) {
  const clearAll = () =>
    onChange({
      ...EMPTY_FILTERS,
      sortBy: filters.sortBy, // sort isn't really a "filter" — preserve it
    });

  const activeCount =
    (filters.priceMin ? 1 : 0) +
    (filters.priceMax ? 1 : 0) +
    (filters.minDiscount != null ? 1 : 0) +
    (filters.inStockOnly ? 1 : 0);

  return (
    <div className="bg-card">
      {/* Sort */}
      <div className="px-4 py-3 border-b">
        <div className="flex items-center justify-between gap-3">
          <label
            htmlFor="cf-sort"
            className="text-[12px] font-bold text-muted-foreground"
          >
            Sort by:
          </label>
          <select
            id="cf-sort"
            value={filters.sortBy}
            onChange={(e) =>
              onChange({ ...filters, sortBy: e.target.value as SortKey })
            }
            className="flex-1 max-w-[200px] text-sm font-semibold bg-transparent border-0 focus:outline-none focus:ring-0 cursor-pointer"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* FILTERS header */}
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <div>
          <div className="text-[13px] font-extrabold tracking-wide">FILTERS</div>
          <div className="text-[11px] text-muted-foreground">
            {productCount} Product{productCount === 1 ? '' : 's'}
          </div>
        </div>
        {activeCount > 0 && (
          <button
            onClick={clearAll}
            className="text-[11px] font-bold text-primary hover:underline"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Discount — single-select like Meesho */}
      <div className="px-4 py-3 border-b">
        <div className="text-[13px] font-bold mb-2">Discount</div>
        <div className="space-y-0.5">
          {DISCOUNT_OPTIONS.map((d) => {
            const checked = filters.minDiscount === d.value;
            return (
              <button
                key={d.value}
                type="button"
                onClick={() =>
                  onChange({
                    ...filters,
                    minDiscount: checked ? null : d.value,
                  })
                }
                className="w-full flex items-center gap-2 py-1.5 px-1 rounded hover:bg-muted/50 text-left"
              >
                <span
                  className={`h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 transition ${
                    checked
                      ? 'border-primary'
                      : 'border-muted-foreground/40'
                  }`}
                >
                  {checked && (
                    <span className="h-2 w-2 rounded-full bg-primary" />
                  )}
                </span>
                <span className="text-[13px] flex-1">{d.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Availability */}
      <div className="px-4 py-3 border-b">
        <div className="text-[13px] font-bold mb-2">Availability</div>
        <button
          type="button"
          onClick={() =>
            onChange({ ...filters, inStockOnly: !filters.inStockOnly })
          }
          className="w-full flex items-center gap-2 py-1.5 px-1 rounded hover:bg-muted/50 text-left"
        >
          <span
            className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 transition ${
              filters.inStockOnly
                ? 'bg-primary border-primary'
                : 'bg-card border-muted-foreground/40'
            }`}
          >
            {filters.inStockOnly && (
              <Check
                className="h-3 w-3 text-primary-foreground"
                strokeWidth={3}
              />
            )}
          </span>
          <span className="text-[13px] flex-1">In stock only</span>
        </button>
      </div>

      {/* Price range */}
      <div className="px-4 py-3">
        <div className="text-[13px] font-bold mb-2">Price range</div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            inputMode="numeric"
            min={0}
            placeholder="Min"
            value={filters.priceMin}
            onChange={(e) =>
              onChange({
                ...filters,
                priceMin: e.target.value.replace(/[^\d]/g, ''),
              })
            }
            className="w-full px-2 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <span className="text-muted-foreground text-xs">to</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            placeholder="Max"
            value={filters.priceMax}
            onChange={(e) =>
              onChange({
                ...filters,
                priceMax: e.target.value.replace(/[^\d]/g, ''),
              })
            }
            className="w-full px-2 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {[
            { lbl: '< ₹200', min: '', max: '200' },
            { lbl: '₹200–500', min: '200', max: '500' },
            { lbl: '₹500–1000', min: '500', max: '1000' },
            { lbl: '> ₹1000', min: '1000', max: '' },
          ].map((preset) => {
            const active =
              filters.priceMin === preset.min &&
              filters.priceMax === preset.max;
            return (
              <button
                key={preset.lbl}
                onClick={() =>
                  onChange({
                    ...filters,
                    priceMin: preset.min,
                    priceMax: preset.max,
                  })
                }
                className={`text-[10px] font-semibold px-2 py-1 rounded-full border transition ${
                  active
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border hover:bg-muted'
                }`}
              >
                {preset.lbl}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------------- */
/* Desktop: sticky left sidebar                                             */
/* ----------------------------------------------------------------------- */

export function ClothingFiltersSidebar(props: Props) {
  return (
    <aside className="hidden lg:block sticky top-20 self-start w-72 shrink-0 border rounded-xl overflow-hidden bg-card">
      <FiltersPanel {...props} />
    </aside>
  );
}

/* ----------------------------------------------------------------------- */
/* Mobile/Tablet: button + slide-in drawer                                  */
/* ----------------------------------------------------------------------- */

export function ClothingFiltersMobile(props: Props) {
  const [open, setOpen] = useState(false);
  const activeCount =
    (props.filters.priceMin ? 1 : 0) +
    (props.filters.priceMax ? 1 : 0) +
    (props.filters.minDiscount != null ? 1 : 0) +
    (props.filters.inStockOnly ? 1 : 0);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="lg:hidden inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-semibold hover:bg-muted relative"
      >
        <SlidersHorizontal className="h-4 w-4" />
        Filters
        {activeCount > 0 && (
          <span className="ml-1 bg-primary text-primary-foreground text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/55 lg:hidden flex"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="bg-white w-[85%] max-w-sm h-full overflow-y-auto animate-in slide-in-from-left duration-200">
            <div className="px-4 py-3 border-b flex items-center justify-between sticky top-0 bg-white z-10">
              <div className="font-extrabold text-base">Filters</div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="h-8 w-8 rounded-full bg-muted flex items-center justify-center"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <FiltersPanel {...props} />
            <div className="px-4 py-3 border-t sticky bottom-0 bg-white">
              <button
                onClick={() => setOpen(false)}
                className="w-full bg-primary text-primary-foreground font-bold text-sm py-3 rounded-md"
              >
                Show {props.productCount} product
                {props.productCount === 1 ? '' : 's'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
