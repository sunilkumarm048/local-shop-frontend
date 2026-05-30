'use client';

import { Scissors } from 'lucide-react';

import type { Category } from '@/lib/shops';

interface ServiceCategoryPickerProps {
  categories: Category[];
  onPick: (categoryId: string) => void;
}

/**
 * Landing grid shown when the customer enters the Services group but hasn't
 * picked a specific service yet. Each tile is one subcategory (Barber,
 * Parlour, Laundry, ...). Tapping a tile sets the active category, which
 * filters the shop list to just that service type.
 *
 * This is the "pick a service first" step — services are too varied to list
 * all shops together, so we make the customer choose a category before
 * showing any shops.
 */
export function ServiceCategoryPicker({
  categories,
  onPick,
}: ServiceCategoryPickerProps) {
  if (categories.length === 0) {
    return (
      <div className="text-center py-12 text-sm text-muted-foreground">
        No services available yet.
      </div>
    );
  }

  return (
    <section className="space-y-3">
      <h2 className="text-base font-bold tracking-tight px-1">
        What do you need?
      </h2>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {categories.map((c) => (
          <button
            key={c._id}
            onClick={() => onPick(c._id)}
            className="flex flex-col items-center justify-center gap-2 rounded-xl border border-border bg-card p-4 hover:border-primary/50 hover:bg-[#f0fbf2] transition aspect-square text-center"
          >
            <span className="text-3xl leading-none">
              {c.icon || <Scissors className="h-7 w-7 text-primary" />}
            </span>
            <span className="text-[13px] font-semibold leading-tight line-clamp-2">
              {c.name}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
