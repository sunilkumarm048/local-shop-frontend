import type { Metadata } from 'next';

import { Header } from '@/components/layout/header';

export const metadata: Metadata = {
  title: 'Shop local stores & book home services near you',
  description:
    'Order groceries, food, electronics and more from local shops near you in Odisha with fast delivery — or book trusted home services like electricians, plumbers and beauticians. Sarvopakar (ସର୍ବୋପକାର).',
  alternates: { canonical: '/customer' },
};

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <Header />
      {children}
    </div>
  );
}
