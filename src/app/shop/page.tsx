'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, LogOut, Package, Store, ListOrdered, TrendingUp, PackagePlus } from 'lucide-react';

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
import { ShopAnalyticsTab } from '@/components/shop/ShopAnalyticsTab';
import { CatalogTab } from '@/components/shop/CatalogTab';

type Section = 'storefront' | 'products' | 'catalog' | 'orders' | 'analytics';

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
  onShopUpdated: (s: Shop) => void;
  onLogout: () => void;
}

function ShopHeader({ shop, userName, onShopUpdated, onLogout }: HeaderProps) {
  const [toggling, setToggling] = useState(false);
  const [toggleError, setToggleError] = useState<string | null>(null);

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
      <div className="container flex items-center gap-3 py-3">
        <Link href="/" className="h-11 w-11 rounded-full bg-white flex items-center justify-center text-xl shadow-sm shrink-0">
          {shop.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shop.logo} alt="" className="h-full w-full rounded-full object-cover" />
          ) : (
            '🏪'
          )}
        </Link>

        <div className="flex-1 min-w-0 leading-tight">
          {userName && <div className="text-xs text-black/70 font-medium">Hi, {userName}</div>}
          <div className="text-base font-bold text-black truncate">{shop.name}</div>
        </div>

        <button
          type="button"
          onClick={toggleOpen}
          disabled={toggling}
          aria-label={shop.isOpen ? 'Close shop' : 'Open shop'}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold shrink-0 transition-colors ${
            shop.isOpen
              ? 'bg-white/60 hover:bg-white/80 text-black'
              : 'bg-white/90 hover:bg-white text-[#c41818]'
          } ${toggling ? 'opacity-60 cursor-wait' : ''}`}
        >
          {toggling ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <span
              className={`h-2 w-2 rounded-full ${shop.isOpen ? 'bg-brand-green' : 'bg-[#d23030]'}`}
            />
          )}
          {shop.isOpen ? 'OPEN' : 'CLOSED'}
        </button>

        {shop.isService && (
          <button
            type="button"
            onClick={toggleAvailable}
            disabled={togglingAvail}
            aria-label={shop.availableNow ? 'Go offline' : 'Go available'}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold shrink-0 transition-colors ${
              shop.availableNow
                ? 'bg-brand-green text-white hover:bg-brand-green/90'
                : 'bg-white/70 hover:bg-white text-black'
            } ${togglingAvail ? 'opacity-60 cursor-wait' : ''}`}
          >
            {togglingAvail ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <span
                className={`h-2 w-2 rounded-full ${
                  shop.availableNow ? 'bg-white' : 'bg-muted-foreground'
                }`}
              />
            )}
            {shop.availableNow ? 'AVAILABLE' : 'UNAVAILABLE'}
          </button>
        )}

        <Button
          variant="ghost"
          size="icon"
          aria-label="Logout"
          onClick={onLogout}
          className="text-black hover:bg-black/10"
        >
          <LogOut className="h-5 w-5" />
        </Button>
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
    { id: 'storefront', label: 'Storefront', icon: Store },
    { id: 'products', label: 'Products', icon: Package },
    { id: 'catalog', label: 'Catalog', icon: PackagePlus },
    { id: 'orders', label: 'Orders', icon: ListOrdered },
    { id: 'analytics', label: 'Analytics', icon: TrendingUp },
  ];
  // Service providers (plumber, electrician, etc.) don't sell SKU products,
  // so hide the Products and Catalog tabs for them.
  const items = allItems.filter(
    (it) => !(isService && (it.id === 'products' || it.id === 'catalog'))
  );
  return (
    <nav className="flex gap-1 border-b">
      {items.map(({ id, label, icon: Icon }) => {
        const active = current === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
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
