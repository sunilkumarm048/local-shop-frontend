import type { MetadataRoute } from 'next';

const SITE =
  process.env.NEXT_PUBLIC_SITE_URL || 'https://local-shop-frontend.vercel.app';

/**
 * robots.txt — allow crawling of public pages, block private dashboards and
 * the cart/checkout flow (no SEO value, and we don't want them indexed).
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/shop', '/delivery', '/admin', '/cart', '/checkout', '/orders'],
    },
    sitemap: `${SITE}/sitemap.xml`,
  };
}
