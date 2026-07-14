import type { MetadataRoute } from 'next';

const SITE =
  process.env.NEXT_PUBLIC_SITE_URL || 'https://www.sarvopakar.com';
const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

/**
 * Dynamic sitemap: static public pages + one entry per shop, so Google can
 * discover and crawl every shop detail page. Regenerated hourly.
 *
 * If the API is down at build/request time, we still return the static pages
 * rather than failing the whole sitemap.
 */
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    { url: `${SITE}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE}/customer`, changeFrequency: 'daily', priority: 0.9 },
  ];

  let shopPages: MetadataRoute.Sitemap = [];
  try {
    // Pull a large page of shops. Adjust limit as the catalog grows.
    const res = await fetch(`${API_URL}/shops?limit=1000`, {
      next: { revalidate: 3600 },
    });
    if (res.ok) {
      const data = await res.json();
      shopPages = (data.shops || []).map((s: { _id: string; updatedAt?: string }) => ({
        url: `${SITE}/customer/shop/${s._id}`,
        lastModified: s.updatedAt ? new Date(s.updatedAt) : undefined,
        changeFrequency: 'weekly' as const,
        priority: 0.7,
      }));
    }
  } catch {
    /* API unreachable — return static pages only */
  }

  return [...staticPages, ...shopPages];
}
