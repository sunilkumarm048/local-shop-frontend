'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Minus, Plus, Search, ShoppingCart, Zap, ImageIcon, Star, Store, Wrench } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { getCurrentPosition } from '@/lib/geo';
import { fetchAppFlags } from '@/lib/config';
import { VoiceAssistant } from '@/components/voice/VoiceAssistant';
import {
  fetchNearbyShops,
  fetchShopProducts,
  fetchCategoryTree,
  normalizeSearch,
  type Shop,
  type Product,
  type CategoryNode,
} from '@/lib/shops';
import { DeliveryLocationBar } from '@/components/customer/DeliveryLocationBar';
import { ServiceShopsList } from '@/components/customer/ServiceShopsList';
import { ServiceCategoryPicker } from '@/components/customer/ServiceCategoryPicker';
import { useDeliveryLocation } from '@/stores/deliveryLocation';
import { useCart } from '@/stores/cart';
import {
  ClothingFiltersSidebar,
  ClothingFiltersMobile,
  EMPTY_FILTERS,
  type FiltersState,
  type SortKey,
} from '@/components/customer/ClothingFiltersSidebar';

/* ----------------------------------------------------------------------- */
/* Helpers                                                                  */
/* ----------------------------------------------------------------------- */

function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function fetchProductsForShops(
  shopIds: string[]
): Promise<Map<string, Product[]>> {
  const map = new Map<string, Product[]>();
  await Promise.all(
    shopIds.map(async (id) => {
      try {
        const r = await fetchShopProducts(id);
        map.set(id, r.products);
      } catch {
        map.set(id, []);
      }
    })
  );
  return map;
}

const MAX_SHOPS_FOR_PRODUCTS = 6;

/**
 * Is this top-level group the Clothing & Fashion one?
 *
 * Backend assigns _ids dynamically so we can't hardcode; the safest stable
 * key is a name match. Tolerates variants like "Clothing", "Clothing & Fashion",
 * "Fashion & Clothing".
 */
function isClothingGroup(node: CategoryNode | null | undefined): boolean {
  if (!node) return false;
  const n = node.name.toLowerCase();
  return n.includes('clothing') || n.includes('fashion');
}

/**
 * Is this top-level group the Services one?
 *
 * Same name-match approach as isClothingGroup (backend _ids are dynamic).
 * Services shops don't sell SKU products, so when this group is active we
 * swap the product grid for a Google-"near me"-style service shop list.
 */
function isServicesGroup(node: CategoryNode | null | undefined): boolean {
  if (!node) return false;
  return node.name.toLowerCase().includes('service');
}

/** Radius (km) used when browsing services — wider than the default 5 km. */
const SERVICE_RADIUS_KM = 25;

/**
 * Distance slider for "Shops near you" — lets the customer widen or narrow
 * how far the search reaches (1–25 km). Mirrors the delivery page's control.
 * Only meaningful once we have the customer's location; otherwise it's hidden
 * because distance filtering needs coordinates.
 */
function RadiusSlider({
  radiusKm,
  setRadiusKm,
  hasLocation,
}: {
  radiusKm: number;
  setRadiusKm: (v: number) => void;
  hasLocation: boolean;
}) {
  if (!hasLocation) return null;
  return (
    <div className="rounded-xl border border-border bg-card p-3 space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">Search radius</span>
        <span className="text-muted-foreground">{radiusKm} km</span>
      </div>
      <input
        type="range"
        min={1}
        max={25}
        step={1}
        value={radiusKm}
        onChange={(e) => setRadiusKm(Number(e.target.value))}
        className="w-full accent-brand-green"
        aria-label="Search radius in kilometres"
      />
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>1 km</span>
        <span>25 km</span>
      </div>
    </div>
  );
}

function applySort<T extends { product: Product }>(items: T[], sortBy: SortKey): T[] {
  if (sortBy === 'relevance') return items;
  const copy = [...items];
  if (sortBy === 'price-asc') copy.sort((a, b) => a.product.price - b.product.price);
  if (sortBy === 'price-desc') copy.sort((a, b) => b.product.price - a.product.price);
  return copy;
}

/* ----------------------------------------------------------------------- */
/* Page                                                                     */
/* ----------------------------------------------------------------------- */

export default function CustomerHome() {
  const [shops, setShops] = useState<Shop[]>([]);
  const [tree, setTree] = useState<CategoryNode[]>([]);
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [selectedShopId, setSelectedShopId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  // `query` is what the user is typing; `searchTerm` is the committed search
  // (set on Enter, after AI correction). Shops + products filter on searchTerm.
  const [searchTerm, setSearchTerm] = useState('');
  const [searchNote, setSearchNote] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [radiusKm, setRadiusKm] = useState(5);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [productsByShop, setProductsByShop] = useState<Map<string, Product[]>>(
    new Map()
  );
  const [productsLoading, setProductsLoading] = useState(false);
  // Admin kill switch for the All Products feed (see admin → Settings).
  // Defaults true so a slow/failed config fetch never hides the storefront.
  const [showAllProducts, setShowAllProducts] = useState(true);

  // 8g: Meesho-style multi-filter state for the Clothing & Fashion group.
  // Lives at page level (not inside the sidebar) so changing groups can
  // reset it cleanly.
  const [filters, setFilters] = useState<FiltersState>(EMPTY_FILTERS);

  const lat = useDeliveryLocation((s) => s.lat);
  const lng = useDeliveryLocation((s) => s.lng);
  const setLocation = useDeliveryLocation((s) => s.setLocation);

  /* ---------- Identify active group + clothing mode ---------- */
  const activeGroupNode = activeGroup
    ? tree.find((g) => g._id === activeGroup) || null
    : null;
  const clothingMode = isClothingGroup(activeGroupNode);
  const serviceMode = isServicesGroup(activeGroupNode);

  // The "Repairs & Services" group node, used by the Shop/Services toggle.
  const servicesGroupNode = tree.find((g) => isServicesGroup(g)) || null;

  // Top-level mode: 'shop' (products) vs 'services' (providers). Driven by the
  // toggle. Services mode locks the active group to the services group.
  const mode: 'shop' | 'services' = serviceMode ? 'services' : 'shop';

  function switchMode(next: 'shop' | 'services') {
    if (next === 'services') {
      if (servicesGroupNode) {
        setActiveGroup(servicesGroupNode._id);
        setActiveCategory(null);
      }
    } else {
      setActiveGroup(null);
      setActiveCategory(null);
    }
    // Clear any active search when switching context.
    setQuery('');
    setSearchTerm('');
    setSearchNote(null);
  }

  // Services are sparser than grocery shops, so when the customer switches
  // into the Services group, widen the default search radius. Leaving services
  // resets it. The slider can still override either way.
  useEffect(() => {
    setRadiusKm(serviceMode ? SERVICE_RADIUS_KM : 5);
  }, [serviceMode]);

  // Deep-link support: /customer?mode=services opens the Services tab directly
  // (e.g. from the landing-page "Book a service" card). Fires once, after the
  // category tree has loaded so servicesGroupNode is available.
  const appliedModeParamRef = useRef(false);
  useEffect(() => {
    if (appliedModeParamRef.current) return;
    if (!servicesGroupNode) return;
    if (typeof window === 'undefined') return;
    const wanted = new URLSearchParams(window.location.search).get('mode');
    if (wanted === 'services') {
      switchMode('services');
    }
    appliedModeParamRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [servicesGroupNode]);

  /* ---------- First-load silent GPS + reverse-geocode ---------- */
  useEffect(() => {
    if (lat != null && lng != null) return;
    getCurrentPosition().then(async (c) => {
      if (!c) return;
      let areaName = '';
      let address = '';
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${c.latitude}&lon=${c.longitude}&format=json&zoom=18&addressdetails=1`,
          { headers: { 'Accept-Language': 'en' } }
        );
        const data = await res.json();
        const a = data.address || {};
        areaName =
          a.suburb ||
          a.neighbourhood ||
          a.village ||
          a.town ||
          a.city_district ||
          a.city ||
          a.county ||
          a.state ||
          'Your area';
        address = data.display_name || '';
      } catch {
        areaName = 'Your area';
      }
      setLocation({
        mode: 'self',
        lat: c.latitude,
        lng: c.longitude,
        address,
        areaName,
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- Category tree (once) ---------- */
  useEffect(() => {
    fetchCategoryTree()
      .then((r) => setTree(r.categories))
      .catch(() => {});
  }, []);

  /* ---------- Commit a search (on Enter) ----------
   *
   * Sends the typed query to the backend AI normalizer, then commits the
   * corrected term so the shop query + product filter run on it. An empty
   * box clears the search.
   */
  const runSearch = useCallback(async () => {
    const typed = query.trim();
    if (!typed) {
      setSearchTerm('');
      setSearchNote(null);
      return;
    }
    setSearching(true);
    try {
      const r = await normalizeSearch(typed);
      setSearchTerm(r.query || typed);
      setSearchNote(r.corrected ? `Showing results for "${r.query}"` : null);
    } finally {
      setSearching(false);
    }
  }, [query]);

  /* ---------- Shops query ----------
   *
   * Single category param works for every group now — even in clothing mode,
   * because the horizontal subcategory pill strip uses single-select.
   */
  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchNearbyShops({
      lng: lng ?? undefined,
      lat: lat ?? undefined,
      radiusKm,
      category: activeCategory || undefined,
      q: searchTerm || undefined,
    })
      .then((r) => setShops(r.shops))
      .catch((e) => setError(e.message || 'Could not load shops'))
      .finally(() => setLoading(false));
  }, [lat, lng, activeCategory, searchTerm, serviceMode, radiusKm]);

  /* ---------- Live refresh in Services mode ----------
     Providers toggle "Available now" from their dashboard; poll quietly so the
     badge updates on its own. No spinner — just swap in fresh data. Only runs
     in services mode and when the tab is visible (saves the free-tier backend). */
  useEffect(() => {
    if (!serviceMode) return;
    const interval = setInterval(() => {
      if (document.hidden) return;
      fetchNearbyShops({
        lng: lng ?? undefined,
        lat: lat ?? undefined,
        radiusKm,
        category: activeCategory || undefined,
        q: searchTerm || undefined,
      })
        .then((r) => setShops(r.shops))
        .catch(() => {});
    }, 20000);
    return () => clearInterval(interval);
  }, [serviceMode, lat, lng, activeCategory, searchTerm, radiusKm]);

  /* ---------- Reset filters when group changes ---------- */
  useEffect(() => {
    setFilters(EMPTY_FILTERS);
    setSelectedShopId(null);
  }, [activeGroup]);

  /* ---------- Distance + sort by nearest ---------- */
  const shopsWithDistance = useMemo(() => {
    // Backend already substitutes a service provider's live position into
    // `location` when available, so we just use `location.coordinates` here.
    const withDist =
      lat == null || lng == null
        ? shops.map((s) => ({ shop: s, km: null as number | null }))
        : shops.map((s) => {
            const [slng, slat] = s.location.coordinates;
            return { shop: s, km: haversineKm(lat, lng, slat, slng) };
          });

    return withDist.sort((a, b) => {
      if (a.km == null && b.km == null) return 0;
      if (a.km == null) return 1;
      if (b.km == null) return -1;
      return a.km - b.km;
    });
  }, [shops, lat, lng]);

  /* ---------- Feature flags ---------- */
  useEffect(() => {
    fetchAppFlags().then((f) => setShowAllProducts(f.showAllProducts));
  }, []);

  /* ---------- All Products feed ---------- */
  useEffect(() => {
    if (serviceMode || !showAllProducts) {
      setProductsByShop(new Map());
      return;
    }
    const ids = shopsWithDistance.slice(0, MAX_SHOPS_FOR_PRODUCTS).map((x) => x.shop._id);
    if (ids.length === 0) {
      setProductsByShop(new Map());
      return;
    }
    setProductsLoading(true);
    fetchProductsForShops(ids)
      .then(setProductsByShop)
      .finally(() => setProductsLoading(false));
  }, [shopsWithDistance, serviceMode, showAllProducts]);

  /* ---------- Flattened, filtered, sorted product list ---------- */
  // Voice assistant gets the unfiltered catalog (before search/shop filters).
  const voiceCatalog = useMemo(() => {
    const list: Array<{ product: Product; shop: Shop }> = [];
    for (const { shop } of shopsWithDistance) {
      const ps = productsByShop.get(shop._id) || [];
      for (const p of ps) list.push({ product: p, shop });
    }
    return list;
  }, [shopsWithDistance, productsByShop]);

  const allProducts = useMemo(() => {
    let list: Array<{ product: Product; shop: Shop }> = [];
    for (const { shop } of shopsWithDistance) {
      const ps = productsByShop.get(shop._id) || [];
      for (const p of ps) list.push({ product: p, shop });
    }
    if (selectedShopId) {
      list = list.filter((x) => x.shop._id === selectedShopId);
    }
    if (searchTerm.trim()) {
      const needle = searchTerm.toLowerCase();
      list = list.filter((x) => x.product.name.toLowerCase().includes(needle));
    }
    if (clothingMode) {
      // Price range
      if (filters.priceMin) {
        const min = Number(filters.priceMin);
        list = list.filter((x) => x.product.price >= min);
      }
      if (filters.priceMax) {
        const max = Number(filters.priceMax);
        list = list.filter((x) => x.product.price <= max);
      }
      // Minimum discount %
      if (filters.minDiscount != null) {
        list = list.filter((x) => {
          const { price, mrp } = x.product;
          if (!mrp || mrp <= price) return false;
          const pct = Math.round(((mrp - price) / mrp) * 100);
          return pct >= (filters.minDiscount as number);
        });
      }
      // In-stock only
      if (filters.inStockOnly) {
        list = list.filter(
          (x) => x.product.inStock !== false && x.product.stock !== 0
        );
      }
      list = applySort(list, filters.sortBy);
    }
    return list;
  }, [
    shopsWithDistance,
    productsByShop,
    selectedShopId,
    searchTerm,
    clothingMode,
    filters.priceMin,
    filters.priceMax,
    filters.minDiscount,
    filters.inStockOnly,
    filters.sortBy,
  ]);

  const selectedShop = selectedShopId
    ? shopsWithDistance.find((x) => x.shop._id === selectedShopId)?.shop
    : null;

  /* ---------- Render ---------- */
  return (
    <main className="container py-5 space-y-5">
      <DeliveryLocationBar />

      {/* Shop / Services toggle — split the two intents clearly. */}
      {servicesGroupNode && (
        <div className="flex gap-1 bg-muted p-1 rounded-xl">
          <button
            onClick={() => switchMode('shop')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors ${
              mode === 'shop'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Store className="h-4 w-4" />
            Shop
          </button>
          <button
            onClick={() => switchMode('services')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors ${
              mode === 'services'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Wrench className="h-4 w-4" />
            Services
          </button>
        </div>
      )}

      {/* Search — shops + products, AI-corrected on Enter */}
      <div className="space-y-1.5">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={mode === 'services' ? 'Search a service…' : 'Search shops or products…'}
              value={query}
              onChange={(e) => {
                const v = e.target.value;
                setQuery(v);
                // Clearing the box immediately clears the active search.
                if (v.trim() === '') {
                  setSearchTerm('');
                  setSearchNote(null);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') runSearch();
              }}
              className="pl-9"
            />
          </div>
          <Button onClick={runSearch} disabled={searching}>
            {searching ? 'Searching…' : 'Search'}
          </Button>
        </div>
        {searchNote && (
          <p className="text-xs text-muted-foreground px-1">{searchNote}</p>
        )}
      </div>

      {/* Top-level group strip — only in Shop mode. Services has its own toggle
          + category picker, so the group chips are hidden there. The Services
          group itself is excluded from the chips since the toggle handles it. */}
      {mode === 'shop' && tree.length > 0 && (
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
          {tree
            .filter((g) => !isServicesGroup(g))
            .map((g) => (
              <button
                key={g._id}
                onClick={() => {
                  setActiveGroup(activeGroup === g._id ? null : g._id);
                  setActiveCategory(null);
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
      )}

      {/* Horizontal subcategory pill strip — always shown when a group is selected */}
      {activeGroup &&
        (() => {
          const group = tree.find((g) => g._id === activeGroup);
          if (!group || group.children.length === 0) return null;
          return (
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-none border-t pt-2">
              <button
                onClick={() => setActiveCategory(null)}
                className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium border ${
                  activeCategory === null
                    ? 'bg-primary text-primary-foreground border-primary'
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
                      ? 'bg-primary text-primary-foreground border-primary'
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

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {/* Distance slider — shown wherever shops are listed by distance.
          Hidden on the service category-picker step (no shops shown yet). */}
      {!(serviceMode && activeGroupNode && !activeCategory) && (
        <RadiusSlider
          radiusKm={radiusKm}
          setRadiusKm={setRadiusKm}
          hasLocation={lat != null && lng != null}
        />
      )}

      {/* ============================================================ */}
      {/* SERVICES MODE — Google "near me" list, no product grid        */}
      {/* ============================================================ */}
      {serviceMode && activeGroupNode ? (
        activeCategory ? (
          <ServiceShopsList
            loading={loading}
            shopsWithDistance={shopsWithDistance}
            maxKm={radiusKm}
            categoryName={
              activeGroupNode.children.find((c) => c._id === activeCategory)?.name
            }
            onBack={() => setActiveCategory(null)}
          />
        ) : (
          <ServiceCategoryPicker
            categories={activeGroupNode.children}
            onPick={(id) => setActiveCategory(id)}
          />
        )
      ) : clothingMode && activeGroupNode ? (
        <div className="flex gap-5">
          <ClothingFiltersSidebar
            filters={filters}
            onChange={setFilters}
            productCount={allProducts.length}
          />

          {/* Right-side main column */}
          <div className="flex-1 min-w-0 space-y-5">
            {/* Mobile filters button + title */}
            <div className="flex items-center justify-between gap-3 lg:hidden">
              <h2 className="text-base font-bold tracking-tight">
                {activeGroupNode.name}
              </h2>
              <ClothingFiltersMobile
                filters={filters}
                onChange={setFilters}
                productCount={allProducts.length}
              />
            </div>

            {/* Shops strip */}
            <ShopsStrip
              loading={loading}
              shopsWithDistance={shopsWithDistance}
              selectedShopId={selectedShopId}
            />

            {/* Products grid */}
            {showAllProducts && (
              <ProductsGrid
                productsLoading={productsLoading}
                allProducts={allProducts}
                selectedShop={selectedShop}
                setSelectedShopId={setSelectedShopId}
                query={searchTerm}
                showShopBadge
              />
            )}
          </div>
        </div>
      ) : (
        /* ============================================================ */
        /* DEFAULT (non-clothing) layout                                 */
        /* ============================================================ */
        <>
          <ShopsStrip
            loading={loading}
            shopsWithDistance={shopsWithDistance}
            selectedShopId={selectedShopId}
          />
          {showAllProducts && (
            <ProductsGrid
              productsLoading={productsLoading}
              allProducts={allProducts}
              selectedShop={selectedShop}
              setSelectedShopId={setSelectedShopId}
              query={searchTerm}
              showShopBadge={false}
            />
          )}
        </>
      )}

      {/* AI voice assistant — full catalog (unfiltered) as its context */}
      <VoiceAssistant
        catalog={voiceCatalog}
        shops={shopsWithDistance}
        onSearch={(q) => {
          setSelectedShopId(null);
          setSearchTerm(q);
        }}
        onSelectShop={(id) => setSelectedShopId(id)}
        onSelectCategory={(c) => setActiveCategory(c)}
        onSetMode={(m) => {
          if (m === 'services') {
            if (servicesGroupNode) setActiveGroup(servicesGroupNode._id);
          } else {
            setActiveGroup(null);
          }
          setSelectedShopId(null);
          setSearchTerm('');
        }}
      />
    </main>
  );
}

/* ----------------------------------------------------------------------- */
/* Subcomponents — same JSX as before, factored out so both layouts use it. */
/* ----------------------------------------------------------------------- */

interface ShopsStripProps {
  loading: boolean;
  shopsWithDistance: Array<{ shop: Shop; km: number | null }>;
  selectedShopId: string | null;
}

function ShopsStrip({
  loading,
  shopsWithDistance,
  selectedShopId,
}: ShopsStripProps) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-base font-bold tracking-tight">Shops near you</h2>
      </div>

      {loading ? (
        <div className="flex gap-2.5 overflow-x-auto pb-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="shrink-0 w-28 h-32 rounded-xl bg-muted animate-pulse"
            />
          ))}
        </div>
      ) : shopsWithDistance.length === 0 ? (
        <div className="text-sm text-muted-foreground px-1 py-4">
          No shops open here right now.
        </div>
      ) : (
        <div className="flex gap-2.5 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-none">
          {shopsWithDistance.map(({ shop, km }) => {
            const isActive = selectedShopId === shop._id;
            return (
              <Link
                key={shop._id}
                href={`/customer/shop/${shop._id}`}
                className={`shrink-0 w-28 rounded-xl border p-2 text-center transition block ${
                  isActive
                    ? 'border-primary bg-[#f0fbf2] shadow-[0_2px_8px_rgba(12,131,31,0.12)]'
                    : 'border-border bg-card hover:border-primary/50'
                }`}
              >
                <div className="w-12 h-12 mx-auto rounded-full bg-[#fff5d6] overflow-hidden flex items-center justify-center mb-1.5">
                  {shop.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={shop.logo}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <ShoppingCart className="h-5 w-5 text-[#8a6500]" />
                  )}
                </div>
                <div className="text-[12px] font-semibold leading-tight line-clamp-2 min-h-[2.2rem]">
                  {shop.name}
                </div>
                <div className="text-[10px] text-muted-foreground truncate mt-0.5">
                  {shop.description || 'Sarvopakar'}
                </div>
                {shop.ratingCount > 0 ? (
                  <div className="flex items-center justify-center gap-0.5 mt-1 text-[10px] font-semibold text-[#8a6500]">
                    <Star className="h-3 w-3 fill-[#f5b301] text-[#f5b301]" />
                    {shop.rating.toFixed(1)}
                    <span className="text-muted-foreground font-normal">
                      ({shop.ratingCount})
                    </span>
                  </div>
                ) : (
                  <div className="mt-1 text-[10px] text-muted-foreground">New</div>
                )}
                {km != null && (
                  <div className="inline-block mt-1.5 text-[9px] font-extrabold tracking-wide text-[#1857c1] bg-[#dbe9ff] px-1.5 py-0.5 rounded">
                    📏 {km.toFixed(1)} km
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}

interface ProductsGridProps {
  productsLoading: boolean;
  allProducts: Array<{ product: Product; shop: Shop }>;
  selectedShop: Shop | null | undefined;
  setSelectedShopId: (id: string | null) => void;
  query: string;
  showShopBadge: boolean;
}

function ProductsGrid({
  productsLoading,
  allProducts,
  selectedShop,
  setSelectedShopId,
  query,
  showShopBadge,
}: ProductsGridProps) {
  const cart = useCart();
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-base font-bold tracking-tight">
          {query.trim()
            ? `Results for "${query}"`
            : selectedShop
              ? selectedShop.name
              : 'All Products'}
        </h2>
        {selectedShop && (
          <button
            onClick={() => setSelectedShopId(null)}
            className="text-xs text-primary font-bold"
          >
            Clear filter
          </button>
        )}
      </div>

      {productsLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="aspect-[3/4] rounded-xl bg-muted animate-pulse"
            />
          ))}
        </div>
      ) : allProducts.length === 0 ? (
        <div className="text-center py-12 text-sm text-muted-foreground">
          🛒 No products found.
          <br />
          Try a different category or search.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {allProducts.map(({ product: p, shop }) => {
            const inCart = cart.items.find((i) => i.productId === p._id);
            const isOut = !p.inStock || p.stock === 0;
            const discountPct =
              p.mrp && p.mrp > p.price
                ? Math.round(((p.mrp - p.price) / p.mrp) * 100)
                : 0;

            return (
              <Card key={p._id} className="overflow-hidden flex flex-col">
                <Link
                  href={`/customer/shop/${shop._id}`}
                  className="relative aspect-square bg-muted block"
                >
                  {discountPct > 0 && (
                    <div className="absolute top-0 left-2 z-10 bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-b">
                      {discountPct}% OFF
                    </div>
                  )}
                  {p.image && !p.image.includes('via.placeholder.com') ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.image}
                      alt={p.name}
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="h-8 w-8 text-muted-foreground/40" />
                    </div>
                  )}
                </Link>

                <div className="p-2 flex-1 flex flex-col gap-1">
                  <div className="inline-flex items-center gap-1 text-[10px] font-semibold text-muted-foreground bg-muted px-1.5 py-0.5 rounded w-fit">
                    <Zap className="h-2.5 w-2.5 fill-current" /> 15 MINS
                  </div>

                  <div className="text-sm font-medium leading-tight line-clamp-2 min-h-[2.5rem]">
                    {p.name}
                  </div>

                  <div className="text-[11px] text-muted-foreground truncate">
                    {p.weight || '1 unit'}
                    {(showShopBadge || !selectedShop) && (
                      <>
                        {' · '}
                        <span className="text-muted-foreground/80">{shop.name}</span>
                      </>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2 mt-auto pt-1">
                    <div className="flex flex-col leading-tight">
                      <span className="font-semibold text-sm">₹{p.price}</span>
                      {p.mrp && p.mrp > p.price && (
                        <span className="text-[10px] text-muted-foreground line-through">
                          ₹{p.mrp}
                        </span>
                      )}
                    </div>

                    {isOut ? (
                      <span className="text-[10px] text-muted-foreground font-medium">
                        Out
                      </span>
                    ) : inCart ? (
                      <div className="flex items-center bg-primary text-primary-foreground rounded overflow-hidden">
                        <button
                          aria-label="Decrease quantity"
                          className="w-7 h-7 flex items-center justify-center hover:bg-primary/85 transition"
                          onClick={() => cart.setQty(p._id, inCart.qty - 1)}
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="text-xs font-bold w-5 text-center">
                          {inCart.qty}
                        </span>
                        <button
                          aria-label="Increase quantity"
                          className="w-7 h-7 flex items-center justify-center hover:bg-primary/85 transition"
                          onClick={() => cart.setQty(p._id, inCart.qty + 1)}
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-3 text-xs font-bold tracking-wider border-primary text-primary hover:bg-primary/10 hover:text-primary"
                        onClick={() =>
                          cart.add({
                            productId: p._id,
                            shopId: shop._id,
                            name: p.name,
                            price: p.price,
                            weight: p.weight,
                            image: p.image,
                          })
                        }
                      >
                        ADD
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}
