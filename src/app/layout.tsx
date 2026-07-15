import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { PWARegistration } from '@/components/pwa/PWARegistration';
import { VoiceButton } from '@/components/voice/VoiceButton';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  weight: ['400', '500', '600', '700', '800'],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || 'https://www.sarvopakar.com'
  ),
  title: {
    default: 'Sarvopakar — shops & services near you',
    template: '%s · Sarvopakar',
  },
  description:
    'Hyperlocal grocery + transport — order from shops nearby or book a vehicle to move anything.',
  manifest: '/manifest.json',
  openGraph: {
    siteName: 'Sarvopakar',
    type: 'website',
    locale: 'en_IN',
    images: [{ url: '/icons/icon-512.png', width: 512, height: 512, alt: 'Sarvopakar' }],
  },
  verification: {
    google: 'sfZjDyNTptzTiJq1iVSs7_2d9DiQIsAxVaxo_vYSc48',
  },
  appleWebApp: {
    capable: true,
    title: 'सर्वोपकार',
    statusBarStyle: 'default',
  },
};

export const viewport: Viewport = {
  themeColor: '#0C831F',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

const SITE =
  process.env.NEXT_PUBLIC_SITE_URL || 'https://www.sarvopakar.com';

// Organization + WebSite structured data: establishes "Sarvopakar" as a
// business entity for Google (vs. the dictionary word "sarvopakari"), which
// powers the brand knowledge panel and sitelinks over time.
const orgJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${SITE}/#org`,
      name: 'Sarvopakar',
      alternateName: ['सर्वोपकार', 'ସର୍ବୋପକାର'],
      url: SITE,
      logo: `${SITE}/icons/icon-512.png`,
      description:
        'Sarvopakar is a hyperlocal app in Odisha, India — order from nearby local shops with fast delivery, and book home-service providers like electricians and plumbers.',
      areaServed: { '@type': 'State', name: 'Odisha' },
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE}/#website`,
      url: SITE,
      name: 'Sarvopakar',
      publisher: { '@id': `${SITE}/#org` },
    },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans min-h-screen">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
        />
        {children}
        <PWARegistration />
        <VoiceButton />
      </body>
    </html>
  );
}
