'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ShoppingCart,
  User as UserIcon,
  LogOut,
  MapPin,
  ScrollText,
  CalendarCheck,
  Compass,
  Store,
  Truck,
  MessageCircle,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/stores/auth';
import { useCart } from '@/stores/cart';
import { logout } from '@/lib/auth';

/**
 * Customer-facing header.
 *
 * Right side has cart, profile-menu trigger (👤), and quick logout.
 * The profile dropdown ports the rich menu from the legacy local-shop site:
 * Shopping → Partner with us → Help. Static items, doesn't change with auth
 * state — matches legacy behavior 1:1.
 */
export function Header() {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const items = useCart((s) => s.items);
  const cartCount = items.reduce((sum, i) => sum + i.qty, 0);

  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close on outside click + Esc
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // "Track Live Order" — port of legacy localStorage.getItem('lastOrderId').
  // If no last-order id, fall back to the orders list.
  const handleTrackLive = () => {
    setOpen(false);
    const id =
      typeof window !== 'undefined' ? localStorage.getItem('lastOrderId') : null;
    router.push(id ? `/orders/${id}` : '/orders');
  };

  return (
    <header className="sticky top-0 z-30 bg-gradient-to-r from-brand-yellow to-brand-yellowDark border-b border-black/10">
      <div className="container flex items-center justify-between h-14">
        <Link
          href="/customer"
          className="group relative inline-grid font-bold text-lg text-black leading-none"
          aria-label="Sarvopakar"
        >
          {/* English — visible by default, fades/lifts out on hover */}
          <span className="col-start-1 row-start-1 transition-all duration-300 ease-out group-hover:opacity-0 group-hover:-translate-y-1">
            Sarvopakar
          </span>
          {/* Hindi — hidden by default, fades/settles in on hover */}
          <span
            className="col-start-1 row-start-1 opacity-0 translate-y-1 transition-all duration-300 ease-out group-hover:opacity-100 group-hover:translate-y-0"
            aria-hidden="true"
          >
            सर्वोपकार
          </span>
        </Link>

        <div className="flex items-center gap-2">
          {/* Cart */}
          <Link href="/checkout" className="relative">
            <Button variant="ghost" size="icon" aria-label="Cart">
              <ShoppingCart className="h-5 w-5" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[10px] font-semibold rounded-full h-4 min-w-4 px-1 flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </Button>
          </Link>

          {/* Profile button + dropdown */}
          <div className="relative" ref={wrapRef}>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Account menu"
              aria-expanded={open}
              aria-haspopup="menu"
              onClick={() => setOpen((v) => !v)}
              className={open ? 'bg-white/60 hover:bg-white/70' : ''}
            >
              <UserIcon className="h-5 w-5" />
            </Button>

            <div
              role="menu"
              aria-hidden={!open}
              className={`absolute top-12 right-0 w-72 max-w-[90vw] bg-white rounded-2xl shadow-[0_8px_28px_rgba(0,0,0,0.18)] overflow-hidden origin-top-right transition-all duration-200 ${
                open
                  ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto'
                  : 'opacity-0 scale-95 -translate-y-2 pointer-events-none'
              }`}
            >
              {/* Header strip */}
              <div className="px-4 py-3.5 bg-gradient-to-br from-brand-yellow to-brand-yellowDark text-black">
                <div className="text-sm font-extrabold">Welcome to Sarvopakar 👋</div>
                <div className="text-[11px] font-medium opacity-80">
                  Choose what you&apos;d like to do
                </div>
              </div>

              {/* Shopping */}
              <div className="py-1.5 border-b border-[#f0f0f0]">
                <div className="px-4 pt-2 pb-1 text-[10px] font-bold text-muted-foreground tracking-wider uppercase">
                  Shopping
                </div>
                {user && (
                  <DropdownItem
                    href="/customer/profile"
                    onClose={() => setOpen(false)}
                    iconBg="bg-[#e8d6f7]"
                    icon={<UserIcon className="h-[18px] w-[18px] text-[#6b3aa0]" />}
                    title="My Profile"
                    subtitle="Name, photo & addresses"
                  />
                )}
                <DropdownItem
                  href="/checkout"
                  onClose={() => setOpen(false)}
                  iconBg="bg-[#dbe9ff]"
                  icon={<ShoppingCart className="h-[18px] w-[18px] text-[#1857c1]" />}
                  title="My Cart"
                  subtitle="View items in your cart"
                />
                <DropdownItem
                  onClick={handleTrackLive}
                  iconBg="bg-[#e8d6f7]"
                  icon={<MapPin className="h-[18px] w-[18px] text-[#6b3aa0]" />}
                  title="Track Live Order"
                  subtitle="See your last order on the map"
                />
                <DropdownItem
                  href="/orders"
                  onClose={() => setOpen(false)}
                  iconBg="bg-[#ffe8d1]"
                  icon={<ScrollText className="h-[18px] w-[18px] text-[#a05a00]" />}
                  title="Order History"
                  subtitle="All your past orders"
                />
                {user && (
                  <DropdownItem
                    href="/customer/bookings"
                    onClose={() => setOpen(false)}
                    iconBg="bg-[#dcf3e1]"
                    icon={<CalendarCheck className="h-[18px] w-[18px] text-[#0C831F]" />}
                    title="My Bookings"
                    subtitle="Track your service bookings"
                  />
                )}
                <DropdownItem
                  href="/customer"
                  onClose={() => setOpen(false)}
                  iconBg="bg-[#d6f0ff]"
                  icon={<Compass className="h-[18px] w-[18px] text-[#1857c1]" />}
                  title="Nearby Shops"
                  subtitle="Discover stores around you"
                />
              </div>

              {/* Partner with us */}
              <div className="py-1.5 border-b border-[#f0f0f0]">
                <div className="px-4 pt-2 pb-1 text-[10px] font-bold text-muted-foreground tracking-wider uppercase">
                  Partner with us
                </div>
                <DropdownItem
                  href="/login"
                  onClose={() => setOpen(false)}
                  iconBg="bg-[#fff5d6]"
                  icon={<Store className="h-[18px] w-[18px] text-[#8a6500]" />}
                  title="Shop Owner Login"
                  subtitle="Manage your store & orders"
                />
                <DropdownItem
                  href="/login"
                  onClose={() => setOpen(false)}
                  iconBg="bg-[#dcf3e1]"
                  icon={<Truck className="h-[18px] w-[18px] text-[#0C831F]" />}
                  title="Delivery Partner Login"
                  subtitle="Start earning by delivering"
                />
              </div>

              {/* Help */}
              <div className="py-1.5">
                <DropdownItem
                  href="mailto:support@localshop.com"
                  onClose={() => setOpen(false)}
                  iconBg="bg-[#ffe0e0]"
                  icon={<MessageCircle className="h-[18px] w-[18px] text-[#c1183e]" />}
                  title="Help & Support"
                  subtitle="Get assistance"
                />
              </div>
            </div>
          </div>

          {/* Logout / Sign-in (kept from previous header) */}
          {user ? (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Logout"
              onClick={async () => {
                await logout();
                router.push('/login');
              }}
            >
              <LogOut className="h-5 w-5" />
            </Button>
          ) : (
            <Button asChild variant="default" size="sm">
              <Link href="/login">Sign in</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/*  Helper: single dropdown row with colored icon, title, subtitle, ›  */
/* ------------------------------------------------------------------ */

interface DropdownItemProps {
  href?: string;
  onClick?: () => void;
  onClose?: () => void;
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  subtitle: string;
}

function DropdownItem({
  href,
  onClick,
  onClose,
  icon,
  iconBg,
  title,
  subtitle,
}: DropdownItemProps) {
  const baseCls =
    'flex items-center gap-3 px-4 py-[11px] hover:bg-muted/60 active:bg-muted transition cursor-pointer w-full text-left';

  const inner = (
    <>
      <div
        className={`w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 ${iconBg}`}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0 leading-tight">
        <div className="text-[13px] font-bold text-foreground">{title}</div>
        <div className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</div>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />
    </>
  );

  if (href) {
    return (
      <Link href={href} className={baseCls} onClick={onClose} role="menuitem">
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" className={baseCls} onClick={onClick} role="menuitem">
      {inner}
    </button>
  );
}
