'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, LogOut, Package, Store, ListOrdered, TrendingUp, PackagePlus, CalendarCheck, User as UserIcon, ChevronDown } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/stores/auth';
import { useUser } from '@/hooks/useUser';
import { logout } from '@/lib/auth';
import { fetchMyShops, updateShop, setShopAvailability } from '@/lib/owner';
import { ApiError } from '@/lib/api';
import type { Shop } from '@/lib/shops';

import { ShopWizard } from '@/components/shop/ShopWizard';
import { StorefrontTab } from '@/components/shop/StorefrontTab';
import { ProductsTab } from '@/components/shop/ProductsTab';
import { OrdersTab } from '@/components/shop/OrdersTab';
import { BookingsTab } from '@/components/shop/BookingsTab';
import { ShopAnalyticsTab } from '@/components/shop/ShopAnalyticsTab';
import { CatalogTab } from '@/components/shop/CatalogTab';

type Section = 'storefront' | 'products' | 'catalog' | 'orders' | 'bookings' | 'analytics';

export default function ShopDashboard() {
  const router = useRouter();
  const { user } = useUser();
  const token = useAuth((s) => s.token);

  const [shops, setShops] = useState<Shop[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [section, setSection] = useState<Section>('storefront');
  const [hydrated, setHydrated] = useState(false);

  // zustand-persist starts with default state (token=null) on first render
  // and hydrates from localStorage on the next tick. Wait for hydration
  // before making any auth decisions, otherwise we redirect signed-in users.
  useEffect(() => {
    setHydrated(useAuth.persist.hasHydrated());
    const unsub = useAuth.persist.onFinishHydration(() => setHydrated(true));
    return unsub;
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!token) router.replace('/login?next=/shop');
  }, [hydrated, token, router]);

  useEffect(() => {
    if (user && !user.roles.includes('shop')) {
      router.replace('/customer');
    }
  }, [user, router]);

  useEffect(() => {
    if (!user || !user.roles.includes('shop')) return;
    fetchMyShops()
      .then((r) => setShops(r.shops))
      .catch((err) =>
        setLoadError(err instanceof ApiError ? err.message : 'Could not load your shop.')
      );
  }, [user]);

  // Pick the most useful landing section once the shop loads. Service providers
  // care about incoming bookings, so they land on Bookings rather than the
  // Storefront/profile. Applied once (guarded) so it doesn't fight manual nav.
  const defaultSectionAppliedRef = useRef(false);
  useEffect(() => {
    if (defaultSectionAppliedRef.current) return;
    if (!shops || shops.length === 0) return;
    if (shops[0].isService) {
      setSection('bookings');
    }
    defaultSectionAppliedRef.current = true;
  }, [shops]);

  // ---- Loading / gating states ----

  if (!hydrated) {
    return <FullPageLoader label="Loading…" />;
  }

  if (!token) {
    return null; // redirect in flight
  }

  if (!user) {
    return <FullPageLoader label="Loading your account…" />;
  }

  if (!user.roles.includes('shop')) {
    return null; // redirecting to /customer
  }

  if (loadError) {
    return (
      <div className="container py-12 max-w-md text-center space-y-4">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="text-sm text-muted-foreground">{loadError}</p>
        <Button onClick={() => location.reload()}>Try again</Button>
      </div>
    );
  }

  if (shops === null) {
    return <FullPageLoader label="Loading your shop…" />;
  }

  // ---- No shop yet → wizard ----

  if (shops.length === 0) {
    return (
      <div className="container py-8">
        <ShopWizard onCreated={(s) => setShops([s])} />
      </div>
    );
  }

  // ---- Has shop → dashboard ----

  const shop = shops[0]; // currently capped at one shop per owner

  return (
    <div className="min-h-screen flex flex-col">
      <ShopHeader
        shop={shop}
        userName={user.name}
        currentSection={section}
        onSelectSection={setSection}
        onShopUpdated={(s) => setShops((prev) => (prev ? [s, ...prev.slice(1)] : [s]))}
        onLogout={async () => {
          await logout();
          router.push('/login');
        }}
      />

      <main className="flex-1 container py-6">
        <SectionNav current={section} onChange={setSection} isService={shop.isService} />

        <div className="mt-6">
          {section === 'storefront' && (
            <StorefrontTab
              shop={shop}
              onUpdated={(s) => setShops((prev) => (prev ? [s, ...prev.slice(1)] : [s]))}
            />
          )}
          {section === 'products' && !shop.isService && <ProductsTab shopId={shop._id} />}
          {section === 'catalog' && !shop.isService && <CatalogTab shopId={shop._id} />}
          {section === 'orders' && <OrdersTab shopId={shop._id} />}
          {section === 'bookings' && <BookingsTab shop={shop} />}
          {section === 'analytics' && <ShopAnalyticsTab />}
        </div>
      </main>
    </div>
  );
}

// =============================================================================
// Sticky header with shop avatar, name, and Open/Closed live toggle
// (port of the legacy shop/dashboard.html header).
// =============================================================================

interface HeaderProps {
  shop: Shop;
  userName?: string;
  currentSection: Section;
  onSelectSection: (s: Section) => void;
  onShopUpdated: (s: Shop) => void;
  onLogout: () => void;
}

function ShopHeader({ shop, userName, currentSection, onSelectSection, onShopUpdated, onLogout }: HeaderProps) {
  const [toggling, setToggling] = useState(false);
  const [toggleError, setToggleError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close the profile dropdown on outside-click / Escape.
  useEffect(() => {
    if (!menuOpen) return;
    function onDoc(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  async function toggleOpen() {
    setToggling(true);
    setToggleError(null);
    try {
      const { shop: updated } = await updateShop(shop._id, { isOpen: !shop.isOpen });
      onShopUpdated(updated);
    } catch (err) {
      setToggleError(err instanceof ApiError ? err.message : 'Could not update.');
    } finally {
      setToggling(false);
    }
  }

  const [togglingAvail, setTogglingAvail] = useState(false);
  async function toggleAvailable() {
    setTogglingAvail(true);
    setToggleError(null);
    try {
      const r = await setShopAvailability(shop._id, !shop.availableNow);
      onShopUpdated({ ...shop, availableNow: r.availableNow });
    } catch (err) {
      setToggleError(err instanceof ApiError ? err.message : 'Could not update.');
    } finally {
      setTogglingAvail(false);
    }
  }

  return (
    <header className="sticky top-0 z-30 bg-gradient-to-b from-brand-yellow to-brand-yellowDark border-b border-black/10 shadow-sm">
      <div className="container flex items-center gap-2 py-2.5">
        {/* Brand name (compact) */}
        <div className="flex-1 min-w-0 leading-tight">
          <div className="text-base sm:text-lg font-extrabold text-black truncate">
            Sarvopakar
          </div>
        </div>

        {/* Open/Closed toggle — icon-compact on mobile, labelled on sm+ */}
        <button
          type="button"
          onClick={toggleOpen}
          disabled={toggling}
          aria-label={shop.isOpen ? 'Close shop' : 'Open shop'}
          className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-bold shrink-0 transition-colors ${
            shop.isOpen
              ? 'bg-white/60 hover:bg-white/80 text-black'
              : 'bg-white/90 hover:bg-white text-[#c41818]'
          } ${toggling ? 'opacity-60 cursor-wait' : ''}`}
        >
          {toggling ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <span className={`h-2 w-2 rounded-full ${shop.isOpen ? 'bg-brand-green' : 'bg-[#d23030]'}`} />
          )}
          {shop.isOpen ? 'OPEN' : 'CLOSED'}
        </button>

        {/* Available toggle (service providers only). Availability requires the
            shop to be open — a closed shop can't take jobs, so the toggle is
            disabled and reads UNAVAILABLE until reopened. */}
        {shop.isService && (
          <button
            type="button"
            onClick={toggleAvailable}
            disabled={togglingAvail || !shop.isOpen}
            title={!shop.isOpen ? 'Open your shop first to become available' : undefined}
            aria-label={shop.availableNow ? 'Go offline' : 'Go available'}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-bold shrink-0 transition-colors ${
              !shop.isOpen
                ? 'bg-white/40 text-black/40 cursor-not-allowed'
                : shop.availableNow
                  ? 'bg-brand-green text-white hover:bg-brand-green/90'
                  : 'bg-white/70 hover:bg-white text-black'
            } ${togglingAvail ? 'opacity-60 cursor-wait' : ''}`}
          >
            {togglingAvail ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <span
                className={`h-2 w-2 rounded-full ${
                  shop.isOpen && shop.availableNow ? 'bg-white' : 'bg-muted-foreground'
                }`}
              />
            )}
            {shop.isOpen && shop.availableNow ? 'AVAILABLE' : 'UNAVAILABLE'}
          </button>
        )}

        {/* Profile dropdown — avatar button opens Storefront/Profile + Logout */}
        <div className="relative shrink-0" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Profile menu"
            aria-expanded={menuOpen}
            className="flex items-center gap-1 rounded-full bg-white/70 hover:bg-white h-9 pl-1 pr-1.5 transition-colors"
          >
            <span className="h-7 w-7 rounded-full bg-white flex items-center justify-center overflow-hidden shrink-0">
              {shop.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={shop.logo} alt="" className="h-full w-full rounded-full object-cover" />
              ) : (
                <UserIcon className="h-4 w-4 text-black/70" />
              )}
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-black/70" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-2 w-56 rounded-xl bg-white shadow-lg border border-black/10 overflow-hidden z-[400]">
              <div className="px-3 py-2.5 border-b bg-muted/40">
                {userName && (
                  <div className="text-[11px] text-muted-foreground">Hi, {userName}</div>
                )}
                <div className="text-sm font-bold truncate">{shop.name}</div>
              </div>
              <button
                type="button"
                onClick={() => {
                  onSelectSection('storefront');
                  setMenuOpen(false);
                }}
                className={`w-full text-left px-3 py-2.5 text-sm flex items-center gap-2 hover:bg-muted ${
                  currentSection === 'storefront' ? 'text-primary font-semibold' : ''
                }`}
              >
                <Store className="h-4 w-4" />
                Storefront / Profile
              </button>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onLogout();
                }}
                className="w-full text-left px-3 py-2.5 text-sm flex items-center gap-2 hover:bg-muted text-destructive border-t"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Banner when closed — same intent as the legacy closedBanner */}
      {!shop.isOpen && (
        <div className="bg-[#fde0e0] border-t border-[#f8b4b4] text-[#8a1a1a]">
          <div className="container py-2 text-xs">
            <b className="font-bold">Your shop is closed.</b> Customers can&apos;t see you in
            search until you reopen.
          </div>
        </div>
      )}
      {toggleError && (
        <div className="bg-destructive/10 border-t border-destructive/30 text-destructive">
          <div className="container py-2 text-xs">{toggleError}</div>
        </div>
      )}
    </header>
  );
}

// =============================================================================
// Section navigation
// =============================================================================

interface NavProps {
  current: Section;
  onChange: (s: Section) => void;
  isService?: boolean;
}

function SectionNav({ current, onChange, isService }: NavProps) {
  const allItems: Array<{ id: Section; label: string; icon: typeof Store }> = [
    { id: 'products', label: 'Products', icon: Package },
    { id: 'catalog', label: 'Catalog', icon: PackagePlus },
    { id: 'bookings', label: 'Bookings', icon: CalendarCheck },
    { id: 'orders', label: 'Orders', icon: ListOrdered },
    { id: 'analytics', label: 'Analytics', icon: TrendingUp },
  ];
  // Service providers (plumber, electrician, etc.) don't sell SKU products, so
  // hide Products/Catalog AND the product Orders tab — they get Bookings instead.
  // Product shops get Orders but not Bookings.
  const items = allItems.filter((it) => {
    if (isService) return it.id !== 'products' && it.id !== 'catalog' && it.id !== 'orders';
    return it.id !== 'bookings';
  });
  return (
    <nav className="flex gap-1 border-b overflow-x-auto">
      {items.map(({ id, label, icon: Icon }) => {
        const active = current === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap shrink-0 ${
              active
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        );
      })}
    </nav>
  );
}

// =============================================================================
// Loader
// =============================================================================

function FullPageLoader({ label }: { label: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin mr-2" />
      {label}
    </div>
  );
}
