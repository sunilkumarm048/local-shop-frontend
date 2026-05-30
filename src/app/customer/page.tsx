'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Minus, Plus, Search, ShoppingCart, Zap, ImageIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { getCurrentPosition } from '@/lib/geo';
import {
  fetchNearbyShops,
  fetchShopProducts,
  fetchCategoryTree,
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
  const [radiusKm, setRadiusKm] = useState(5);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [productsByShop, setProductsByShop] = useState<Map<string, Product[]>>(
    new Map()
  );
  const [productsLoading, setProductsLoading] = useState(false);

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

  // Services are sparser than grocery shops, so when the customer switches
  // into the Services group, widen the default search radius. Leaving services
  // resets it. The slider can still override either way.
  useEffect(() => {
    setRadiusKm(serviceMode ? SERVICE_RADIUS_KM : 5);
  }, [serviceMode]);

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
      q: query || undefined,
    })
      .then((r) => setShops(r.shops))
      .catch((e) => setError(e.message || 'Could not load shops'))
      .finally(() => setLoading(false));
  }, [lat, lng, activeCategory, query, serviceMode, radiusKm]);

  /* ---------- Reset filters when group changes ---------- */
  useEffect(() => {
    setFilters(EMPTY_FILTERS);
    setSelectedShopId(null);
  }, [activeGroup]);

  /* ---------- Distance + sort by nearest ---------- */
  const shopsWithDistance = useMemo(() => {
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

  /* ---------- All Products feed ---------- */
  useEffect(() => {
    if (serviceMode) {
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
  }, [shopsWithDistance, serviceMode]);

  /* ---------- Flattened, filtered, sorted product list ---------- */
  const allProducts = useMemo(() => {
    let list: Array<{ product: Product; shop: Shop }> = [];
    for (const { shop } of shopsWithDistance) {
      const ps = productsByShop.get(shop._id) || [];
      for (const p of ps) list.push({ product: p, shop });
    }
    if (selectedShopId) {
      list = list.filter((x) => x.shop._id === selectedShopId);
    }
    if (query.trim()) {
      const needle = query.toLowerCase();
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
    query,
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

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search for atta, milk, snacks..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Top-level group strip */}
      {tree.length > 0 && (
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
              setSelectedShopId={setSelectedShopId}
            />

            {/* Products grid */}
            <ProductsGrid
              productsLoading={productsLoading}
              allProducts={allProducts}
              selectedShop={selectedShop}
              setSelectedShopId={setSelectedShopId}
              query={query}
              showShopBadge
            />
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
            setSelectedShopId={setSelectedShopId}
          />
          <ProductsGrid
            productsLoading={productsLoading}
            allProducts={allProducts}
            selectedShop={selectedShop}
            setSelectedShopId={setSelectedShopId}
            query={query}
            showShopBadge={false}
          />
        </>
      )}
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
  setSelectedShopId: (id: string | null) => void;
}

function ShopsStrip({
  loading,
  shopsWithDistance,
  selectedShopId,
  setSelectedShopId,
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
              <button
                key={shop._id}
                onClick={() => setSelectedShopId(isActive ? null : shop._id)}
                className={`shrink-0 w-28 rounded-xl border p-2 text-center transition ${
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
                  {shop.description || 'Local Shop'}
                </div>
                {km != null && (
                  <div className="inline-block mt-1.5 text-[9px] font-extrabold tracking-wide text-[#1857c1] bg-[#dbe9ff] px-1.5 py-0.5 rounded">
                    📏 {km.toFixed(1)} km
                  </div>
                )}
              </button>
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
                  {p.image ? (
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
