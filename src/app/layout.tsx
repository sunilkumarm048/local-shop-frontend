import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  weight: ['400', '500', '600', '700', '800'],
});

export const metadata: Metadata = {
  title: 'Local Shop',
  description: 'Local groceries delivered in 15 minutes',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    title: 'LocalShop',
    statusBarStyle: 'default',
  },
};

export const viewport: Viewport = {
  themeColor: '#0C831F',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans min-h-screen">{children}</body>
    </html>
  );
}
