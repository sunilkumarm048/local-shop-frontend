'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Loader2,
  LogOut,
  LayoutDashboard,
  Store,
  Users,
  ListOrdered,
  Tags,
  Shield,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/stores/auth';
import { useUser } from '@/hooks/useUser';
import { logout } from '@/lib/auth';

import { AdminOverviewTab } from '@/components/admin/AdminOverviewTab';
import { AdminShopsTab } from '@/components/admin/AdminShopsTab';
import { AdminUsersTab } from '@/components/admin/AdminUsersTab';
import { AdminOrdersTab } from '@/components/admin/AdminOrdersTab';
import { AdminCategoriesTab } from '@/components/admin/AdminCategoriesTab';

type Section = 'overview' | 'shops' | 'users' | 'orders' | 'categories';

export default function AdminDashboard() {
  const router = useRouter();
  const { user } = useUser();
  const token = useAuth((s) => s.token);

  const [hydrated, setHydrated] = useState(false);
  const [section, setSection] = useState<Section>('overview');

  // Standard hydration gate
  useEffect(() => {
    setHydrated(useAuth.persist.hasHydrated());
    return useAuth.persist.onFinishHydration(() => setHydrated(true));
  }, []);

  useEffect(() => {
    if (hydrated && !token) router.replace('/login?next=/admin');
  }, [hydrated, token, router]);

  useEffect(() => {
    if (user && !user.roles.includes('admin')) router.replace('/customer');
  }, [user, router]);

  if (!hydrated) return <FullPageLoader label="Loading…" />;
  if (!token) return null;
  if (!user) return <FullPageLoader label="Loading your account…" />;
  if (!user.roles.includes('admin')) return null;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-30 bg-[#1f1f1f] text-white shadow-sm">
        <div className="container flex items-center gap-3 py-3">
          <Link
            href="/"
            className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center shrink-0"
          >
            <Shield className="h-5 w-5" />
          </Link>
          <div className="flex-1 min-w-0 leading-tight">
            {user.name && <div className="text-xs text-white/60">Hi, {user.name}</div>}
            <div className="text-sm font-bold truncate">Admin</div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Logout"
            onClick={async () => {
              await logout();
              router.push('/login');
            }}
            className="text-white hover:bg-white/10"
          >
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <main className="flex-1 container py-6">
        <SectionNav current={section} onChange={setSection} />

        <div className="mt-6">
          {section === 'overview' && (
            <AdminOverviewTab goToTab={(tab) => setSection(tab as Section)} />
          )}
          {section === 'shops' && <AdminShopsTab />}
          {section === 'users' && <AdminUsersTab currentUserId={user.id} />}
          {section === 'orders' && <AdminOrdersTab />}
          {section === 'categories' && <AdminCategoriesTab />}
        </div>
      </main>
    </div>
  );
}

interface NavProps {
  current: Section;
  onChange: (s: Section) => void;
}

function SectionNav({ current, onChange }: NavProps) {
  const items: Array<{ id: Section; label: string; icon: typeof Store }> = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'shops', label: 'Shops', icon: Store },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'orders', label: 'Orders', icon: ListOrdered },
    { id: 'categories', label: 'Categories', icon: Tags },
  ];
  return (
    <nav className="flex gap-1 border-b overflow-x-auto">
      {items.map(({ id, label, icon: Icon }) => {
        const active = current === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${
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

function FullPageLoader({ label }: { label: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin mr-2" />
      {label}
    </div>
  );
}
