'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { MapPin, Search, Star } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { getCurrentPosition } from '@/lib/geo';
import { fetchNearbyShops, fetchCategoryTree, type Shop, type CategoryNode } from '@/lib/shops';

export default function CustomerHome() {
  const [shops, setShops] = useState<Shop[]>([]);
  const [tree, setTree] = useState<CategoryNode[]>([]);
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [coords, setCoords] = useState<{ lng: number; lat: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get user location on mount
  useEffect(() => {
    getCurrentPosition().then((c) => {
      if (c) setCoords({ lng: c.longitude, lat: c.latitude });
    });
  }, []);

  // Load category tree once
  useEffect(() => {
    fetchCategoryTree()
      .then((r) => setTree(r.categories))
      .catch(() => {});
  }, []);

  // Load shops whenever filters change
  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchNearbyShops({
      lng: coords?.lng,
      lat: coords?.lat,
      radiusKm: 5,
      category: activeCategory || undefined,
      q: query || undefined,
    })
      .then((r) => setShops(r.shops))
      .catch((e) => setError(e.message || 'Could not load shops'))
      .finally(() => setLoading(false));
  }, [coords, activeCategory, query]);

  return (
    <main className="container py-6 space-y-6">
      {/* Location + search */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4 text-primary" />
          {coords ? (
            <span>
              Showing shops near {coords.lat.toFixed(3)}, {coords.lng.toFixed(3)}
            </span>
          ) : (
            <span>Location unavailable — showing all shops</span>
          )}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search shops, products..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Category groups — top-level strip */}
      {tree.length > 0 && (
        <div className="space-y-2">
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-none">
            <button
              onClick={() => {
                setActiveGroup(null);
                setActiveCategory(null);
              }}
              className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium border ${
                activeGroup === null
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card border-border hover:bg-muted'
              }`}
            >
              All
            </button>
            {tree.map((g) => (
              <button
                key={g._id}
                onClick={() => {
                  setActiveGroup(activeGroup === g._id ? null : g._id);
                  setActiveCategory(null); // reset subcategory when switching groups
                }}
                className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium border ${
                  activeGroup === g._id
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-card border-border hover:bg-muted'
                }`}
              >
                {g.icon && <span className="mr-1">{g.icon}</span>}
                {g.name}
              </button>
            ))}
          </div>

          {/* Subcategory strip — appears only when a group is selected */}
          {activeGroup && (() => {
            const group = tree.find((g) => g._id === activeGroup);
            if (!group || group.children.length === 0) return null;
            return (
              <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-none border-t pt-2">
                <button
                  onClick={() => setActiveCategory(null)}
                  className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium border ${
                    activeCategory === null
                      ? 'bg-brand-green text-white border-brand-green'
                      : 'bg-card border-border hover:bg-muted'
                  }`}
                >
                  All {group.name}
                </button>
                {group.children.map((c) => (
                  <button
                    key={c._id}
                    onClick={() => setActiveCategory(c._id)}
                    className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium border ${
                      activeCategory === c._id
                        ? 'bg-brand-green text-white border-brand-green'
                        : 'bg-card border-border hover:bg-muted'
                    }`}
                  >
                    {c.icon && <span className="mr-1">{c.icon}</span>}
                    {c.name}
                  </button>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      {/* Shop grid */}
      {error && (
        <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-32 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : shops.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          No shops found nearby. Try widening your search.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {shops.map((shop) => (
            <Link key={shop._id} href={`/customer/shop/${shop._id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="font-semibold">{shop.name}</div>
                      {shop.description && (
                        <div className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                          {shop.description}
                        </div>
                      )}
                    </div>
                    {shop.rating > 0 && (
                      <div className="flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                        <Star className="h-3 w-3 fill-current" />
                        {shop.rating.toFixed(1)}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    {shop.address?.city && (
                      <span className="text-muted-foreground">
                        {shop.address.city}
                        {shop.address.pincode && ` · ${shop.address.pincode}`}
                      </span>
                    )}
                    <span
                      className={
                        shop.isOpen
                          ? 'text-primary font-medium'
                          : 'text-muted-foreground'
                      }
                    >
                      {shop.isOpen ? 'Open' : 'Closed'}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
