'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import {
  Loader2,
  MapPin,
  Phone,
  Scissors,
  PackageCheck,
  Truck,
  CheckCircle2,
  Store,
  Navigation,
  Camera,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ApiError } from '@/lib/api';
import { markPickedUp, markOnWay, markDelivered, type MyJob } from '@/lib/delivery';
import type { OrderStatus } from '@/lib/owner-orders';
import { ImageUploader } from '@/components/uploads/ImageUploader';

// Leaflet touches window at import time — dynamic with ssr:false.
const DeliveryMap = dynamic(() => import('./DeliveryMap'), {
  ssr: false,
  loading: () => (
    <div className="h-[220px] rounded-lg border bg-muted/40 flex items-center justify-center text-sm text-muted-foreground">
      Loading map…
    </div>
  ),
});

interface PartnerPos {
  lat: number;
  lng: number;
}

interface Props {
  jobs: MyJob[] | null;
  partnerPosition: PartnerPos | null;
  onChanged: () => void | Promise<void>;
}

const STATUS_LABEL: Partial<Record<OrderStatus, string>> = {
  ready_for_pickup: 'Assigned — go collect',
  picked_up: 'Picked up',
  out_for_delivery: 'Out for delivery',
};

function statusVariant(s: OrderStatus): 'default' | 'success' | 'warning' {
  if (s === 'ready_for_pickup') return 'warning';
  if (s === 'out_for_delivery') return 'default';
  return 'success'; // picked_up
}

export function MyJobsList({ jobs, partnerPosition, onChanged }: Props) {
  if (jobs === null) {
    return (
      <div className="py-4 flex items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        Loading your jobs…
      </div>
    );
  }

  if (jobs.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">
        Your active {jobs.length === 1 ? 'job' : 'jobs'}
      </h2>
      {jobs.map((job) => (
        <MyJobCard
          key={job._id}
          job={job}
          partnerPosition={partnerPosition}
          onChanged={onChanged}
        />
      ))}
    </section>
  );
}

// ---------------------------------------------------------------------------

function MyJobCard({
  job,
  partnerPosition,
  onChanged,
}: {
  job: MyJob;
  partnerPosition: PartnerPos | null;
  onChanged: () => void | Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Action failed.');
    } finally {
      setBusy(false);
    }
  }

  const shortId = job._id.slice(-6).toUpperCase();
  const itemCount = job.items.reduce((s, i) => s + i.qty, 0);

  // Extract coordinates for the map. Mongo stores [lng, lat]; the map wants {lat, lng}.
  const shopCoords = job.shop?.location?.coordinates;
  const shopLL = shopCoords ? { lng: shopCoords[0], lat: shopCoords[1] } : null;
  const custCoords = job.recipient?.location?.coordinates;
  const custLL = custCoords ? { lng: custCoords[0], lat: custCoords[1] } : null;

  // Which leg is currently "active"?
  // ready_for_pickup or picked_up → heading to the shop (well, picked_up means
  // *just* left the shop, but visually the active leg flips when they tap
  // "Start delivery" which moves status to out_for_delivery).
  const activeLeg: 'to_shop' | 'to_customer' | null =
    job.status === 'ready_for_pickup'
      ? 'to_shop'
      : job.status === 'out_for_delivery'
        ? 'to_customer'
        : null;

  return (
    <Card className="border-brand-green/40 overflow-hidden">
      <CardContent className="pt-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold">#{shortId}</span>
            <Badge variant={statusVariant(job.status)}>
              {STATUS_LABEL[job.status] || job.status}
            </Badge>
            {job.isSplit && (
              <Badge variant="warning" className="gap-1">
                <Scissors className="h-3 w-3" />
                Split
              </Badge>
            )}
          </div>
        </div>

        {/* Map — only if we have at least the shop's coords */}
        {shopLL && (
          <DeliveryMap
            partner={partnerPosition}
            shop={shopLL}
            customer={custLL}
            activeLeg={activeLeg}
            height={220}
          />
        )}

        {/* Route legend */}
        <div className="space-y-2">
          <div className="flex items-start gap-2 text-sm">
            <div className="h-7 w-7 rounded-full bg-brand-greenLight flex items-center justify-center shrink-0">
              <Store className="h-3.5 w-3.5 text-brand-green" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Pickup
              </div>
              <div className="font-medium">{job.shop?.name || 'Shop'}</div>
              {job.shop?.address && (
                <div className="text-xs text-muted-foreground truncate">
                  {[job.shop.address.line1, job.shop.address.city]
                    .filter(Boolean)
                    .join(', ')}
                </div>
              )}
            </div>
          </div>

          {job.recipient && (
            <div className="flex items-start gap-2 text-sm">
              <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                <MapPin className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Drop
                </div>
                <div className="font-medium">{job.recipient.name || 'Customer'}</div>
                {job.recipient.address && (
                  <div className="text-xs text-muted-foreground">
                    {job.recipient.address}
                  </div>
                )}
                {job.recipient.phone && (
                  <a
                    href={`tel:${job.recipient.phone}`}
                    className="text-xs text-primary flex items-center gap-1 mt-0.5"
                  >
                    <Phone className="h-3 w-3" />
                    {job.recipient.phone}
                  </a>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Summary */}
        <div className="flex items-center justify-between text-sm bg-muted/40 rounded-md px-2.5 py-2">
          <span className="text-muted-foreground flex items-center gap-1.5">
            <Navigation className="h-3.5 w-3.5" />
            {itemCount} item{itemCount !== 1 ? 's' : ''}
            {job.distanceKm ? ` · ${job.distanceKm} km` : ''}
          </span>
          <span className="font-semibold">₹{job.deliveryFee ?? 0} fee</span>
        </div>

        {error && (
          <div className="text-xs text-destructive bg-destructive/10 rounded px-2 py-1.5">
            {error}
          </div>
        )}

        {/* Lifecycle action */}
        {job.status === 'ready_for_pickup' && (
          <Button className="w-full" disabled={busy} onClick={() => run(() => markPickedUp(job._id))}>
            {busy ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <PackageCheck className="h-4 w-4 mr-2" />
            )}
            Confirm pickup from shop
          </Button>
        )}
        {job.status === 'picked_up' && (
          <Button className="w-full" disabled={busy} onClick={() => run(() => markOnWay(job._id))}>
            {busy ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Truck className="h-4 w-4 mr-2" />
            )}
            Start delivery
          </Button>
        )}
        {job.status === 'out_for_delivery' && (
          <DeliverWithProof
            jobId={job._id}
            busy={busy}
            onDelivered={(proofImageUrl) =>
              run(() => markDelivered(job._id, { proofImageUrl: proofImageUrl || undefined }))
            }
          />
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------

/**
 * Expandable proof-of-delivery flow.
 *
 * Default: shows "Mark delivered" button as before. Tapping "Add photo"
 * reveals an inline ImageUploader. After upload completes, the customer can
 * tap "Confirm with photo". Skip is always allowed — proof is optional.
 */
function DeliverWithProof({
  jobId,
  busy,
  onDelivered,
}: {
  jobId: string;
  busy: boolean;
  onDelivered: (proofImageUrl: string) => void;
}) {
  const [proofUrl, setProofUrl] = useState('');
  const [showUploader, setShowUploader] = useState(false);

  if (!showUploader && !proofUrl) {
    return (
      <div className="space-y-2">
        <Button className="w-full" disabled={busy} onClick={() => onDelivered('')}>
          {busy ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <CheckCircle2 className="h-4 w-4 mr-2" />
          )}
          Mark delivered
        </Button>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          size="sm"
          onClick={() => setShowUploader(true)}
          disabled={busy}
        >
          <Camera className="h-4 w-4 mr-2" />
          Add proof photo (optional)
        </Button>
        <p className="text-[10px] text-muted-foreground text-center">
          A photo of the delivered package helps resolve disputes later.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2 bg-muted/30 rounded-md p-3">
      <ImageUploader
        value={proofUrl}
        onChange={setProofUrl}
        kind="proof"
        label={`Proof of delivery for #${jobId.slice(-6).toUpperCase()}`}
        variant="banner"
      />
      <div className="flex gap-2">
        <Button
          className="flex-1"
          disabled={busy || !proofUrl}
          onClick={() => onDelivered(proofUrl)}
        >
          {busy ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <CheckCircle2 className="h-4 w-4 mr-2" />
          )}
          Confirm with photo
        </Button>
        <Button variant="outline" size="sm" onClick={() => onDelivered('')} disabled={busy}>
          Skip photo
        </Button>
      </div>
    </div>
  );
}
