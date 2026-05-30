import type { Metadata } from 'next';

import ShopDetailClient from './ShopDetailClient';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * Server-side fetch of one shop, used only to build SEO metadata + JSON-LD.
 * Kept separate from the client component's own fetch so a slow/failed call
 * here never blocks the interactive page — we just fall back to generic tags.
 */
async function getShop(id: string) {
  try {
    const res = await fetch(`${API_URL}/shops/${id}`, {
      // Re-fetch periodically so edited shop names/descriptions refresh in
      // search engines without a redeploy.
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.shop || null;
  } catch {
    return null;
  }
}

/**
 * Per-shop SEO metadata. This is what makes the page rank for and display as
 * "<Shop> — <Category> in <City>" instead of the generic "Local Shop" title.
 * Runs on the server, so Google's crawler sees it.
 */
export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const shop = await getShop(id);

  if (!shop) {
    return {
      title: 'Shop — Local Shop',
      description: 'Discover local shops and services near you on Local Shop.',
    };
  }

  const city = shop.address?.city || '';
  const area = shop.address?.line1 || '';
  const locationBit = [area, city].filter(Boolean).join(', ');
  const title = locationBit
    ? `${shop.name} — ${locationBit}`
    : shop.name;
  const description =
    shop.description ||
    `${shop.name}${locationBit ? ` in ${locationBit}` : ''}. View details, photos, ratings and contact on Local Shop.`;

  const image = shop.coverImage || shop.logo || undefined;

  return {
    title,
    description,
    alternates: { canonical: `/customer/shop/${id}` },
    openGraph: {
      title,
      description,
      type: 'website',
      images: image ? [{ url: image }] : undefined,
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function ShopDetailPage({ params }: PageProps) {
  const { id } = await params;
  const shop = await getShop(id);

  // LocalBusiness structured data — helps Google show name, rating, address,
  // and phone directly in results. Only emitted when we have real data.
  const jsonLd = shop
    ? {
        '@context': 'https://schema.org',
        '@type': 'LocalBusiness',
        name: shop.name,
        description: shop.description || undefined,
        image: shop.coverImage || shop.logo || undefined,
        telephone: shop.phone || undefined,
        address: shop.address
          ? {
              '@type': 'PostalAddress',
              streetAddress: shop.address.line1 || undefined,
              addressLocality: shop.address.city || undefined,
              postalCode: shop.address.pincode || undefined,
              addressCountry: 'IN',
            }
          : undefined,
        geo:
          shop.location?.coordinates?.length === 2
            ? {
                '@type': 'GeoCoordinates',
                latitude: shop.location.coordinates[1],
                longitude: shop.location.coordinates[0],
              }
            : undefined,
        aggregateRating:
          shop.ratingCount > 0
            ? {
                '@type': 'AggregateRating',
                ratingValue: shop.rating,
                reviewCount: shop.ratingCount,
              }
            : undefined,
      }
    : null;

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <ShopDetailClient id={id} />
    </>
  );
}
