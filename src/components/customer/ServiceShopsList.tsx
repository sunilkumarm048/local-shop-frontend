'use client';

import Link from 'next/link';
import { MapPin, Star, Clock, Phone, Navigation, Store } from 'lucide-react';

import { Card } from '@/components/ui/card';
import { formatDistance } from '@/lib/geo';
import type { Shop } from '@/lib/shops';

interface ServiceShopsListProps {
  loading: boolean;
  shopsWithDistance: Array<{ shop: Shop; km: number | null }>;
  /** Shops farther than this (km) are hidden in service mode. */
  maxKm?: number;
}

/**
 * Google-"near me"-style vertical list of service shops.
 *
 * Shown instead of the product grid when the customer is browsing the
 * Services group (services don't sell SKUs, so a product grid makes no
 * sense for them). Each card surfaces distance, rating, open status, and
 * two actions: Call (tel: dialer) and Directions (Google Maps).
 *
 * Distance + nearest-first sort are already computed by the parent page;
 * we just render and apply the service-mode radius cap here.
 */
export function ServiceShopsList({
  loading,
  shopsWithDistance,
  maxKm = 25,
}: ServiceShopsListProps) {
  // Cap to the service radius. Shops with unknown distance (no GPS) are kept
  // so the list isn't empty when location permission was denied.
  const visible = shopsWithDistance.filter(
    ({ km }) => km == null || km <= maxKm
  );

  if (loading) {
    return (
      <section className="space-y-3">
        <h2 className="text-base font-bold tracking-tight px-1">
          Services near you
        </h2>
        <div className="space-y-2.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      </section>
    );
  }

  if (visible.length === 0) {
    return (
      <section className="space-y-3">
        <h2 className="text-base font-bold tracking-tight px-1">
          Services near you
        </h2>
        <div className="text-center py-12 text-sm text-muted-foreground">
          📍 No services found within {maxKm} km.
          <br />
          Try a different category.
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-base font-bold tracking-tight">Services near you</h2>
        <span className="text-xs text-muted-foreground">
          {visible.length} found
        </span>
      </div>

      <div className="space-y-2.5">
        {visible.map(({ shop, km }) => (
          <ServiceCard key={shop._id} shop={shop} km={km} />
        ))}
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------------- */

function ServiceCard({ shop, km }: { shop: Shop; km: number | null }) {
  const [lng, lat] = shop.location?.coordinates ?? [];
  const hasCoords = typeof lat === 'number' && typeof lng === 'number';

  // Directions → Google Maps. Prefer exact coordinates; fall back to the
  // shop name + address so the pin still lands somewhere sensible.
  const directionsUrl = hasCoords
    ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        [shop.name, shop.address?.line1, shop.address?.city]
          .filter(Boolean)
          .join(' ')
      )}`;

  const addressLine = [shop.address?.line1, shop.address?.city]
    .filter(Boolean)
    .join(', ');

  return (
    <Card className="p-3.5 flex gap-3 items-start">
      {/* Logo / avatar */}
      <Link
        href={`/customer/shop/${shop._id}`}
        className="shrink-0 w-14 h-14 rounded-full bg-[#fff5d6] overflow-hidden flex items-center justify-center"
      >
        {shop.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shop.logo} alt="" className="w-full h-full object-cover" />
        ) : (
          <Store className="h-6 w-6 text-[#8a6500]" />
        )}
      </Link>

      {/* Body */}
      <div className="flex-1 min-w-0">
        {/* Distance pill */}
        {km != null && (
          <div className="inline-flex items-center gap-1 text-[11px] font-bold text-[#1857c1] bg-[#dbe9ff] px-1.5 py-0.5 rounded mb-1">
            <MapPin className="h-3 w-3" />
            {formatDistance(km)} away
          </div>
        )}

        <Link href={`/customer/shop/${shop._id}`} className="block">
          <h3 className="text-sm font-bold leading-tight truncate">
            {shop.name}
          </h3>
        </Link>

        {/* Rating + open status */}
        <div className="flex items-center gap-3 mt-1 text-[12px]">
          {shop.ratingCount > 0 ? (
            <span className="inline-flex items-center gap-0.5 font-semibold text-[#b97400]">
              <Star className="h-3 w-3 fill-current" />
              {shop.rating.toFixed(1)}
              <span className="text-muted-foreground font-normal ml-0.5">
                ({shop.ratingCount})
              </span>
            </span>
          ) : (
            <span className="text-muted-foreground">New</span>
          )}

          <span
            className={`inline-flex items-center gap-0.5 font-semibold ${
              shop.isOpen ? 'text-[#0c831f]' : 'text-destructive'
            }`}
          >
            <Clock className="h-3 w-3" />
            {shop.isOpen ? 'Open Now' : 'Closed'}
          </span>
        </div>

        {addressLine && (
          <p className="text-[11px] text-muted-foreground truncate mt-0.5">
            {addressLine}
          </p>
        )}

        {/* Actions */}
        <div className="flex gap-2 mt-2.5">
          {shop.phone ? (
            <a
              href={`tel:${shop.phone}`}
              className="inline-flex items-center justify-center gap-1.5 flex-1 h-8 rounded-md border border-primary text-primary text-xs font-bold hover:bg-primary/10 transition-colors"
            >
              <Phone className="h-3.5 w-3.5" />
              Call
            </a>
          ) : (
            <span className="inline-flex items-center justify-center gap-1.5 flex-1 h-8 rounded-md border border-border text-muted-foreground text-xs font-bold cursor-not-allowed">
              <Phone className="h-3.5 w-3.5" />
              No phone
            </span>
          )}

          <a
            href={directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1.5 flex-1 h-8 rounded-md bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-colors"
          >
            <Navigation className="h-3.5 w-3.5" />
            Directions
          </a>
        </div>
      </div>
    </Card>
  );
}
