'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShoppingCart, User as UserIcon, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/stores/auth';
import { useCart } from '@/stores/cart';
import { logout } from '@/lib/auth';

export function Header() {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const items = useCart((s) => s.items);
  const cartCount = items.reduce((sum, i) => sum + i.qty, 0);

  return (
    <header className="sticky top-0 z-30 bg-gradient-to-r from-brand-yellow to-brand-yellowDark border-b border-black/10">
      <div className="container flex items-center justify-between h-14">
        <Link href="/customer" className="font-bold text-lg text-black">
          Local Shop
        </Link>

        <div className="flex items-center gap-2">
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

          {user ? (
            <>
              <Button variant="ghost" size="icon" aria-label="Account">
                <UserIcon className="h-5 w-5" />
              </Button>
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
            </>
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
