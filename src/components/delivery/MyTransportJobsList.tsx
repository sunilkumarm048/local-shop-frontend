'use client';
import dynamic from 'next/dynamic';
import { useState } from 'react';
import {
  Loader2,
  MapPin,
  Phone,
  PackageCheck,
  Truck,
  CheckCircle2,
  Navigation,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ApiError } from '@/lib/api';
import {
  transportPickup,
  transportStart,
  transportDeliver,
  type TransportOrder,
  type TransportStatus,
} from '@/lib/transport';

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
  jobs: TransportOrder[] | null;
  partnerPosition: PartnerPos | null;
  onChanged: () => void | Promise<void>;
}

const STATUS_LABEL: Partial<Record<TransportStatus, string>> = {
  accepted: 'Heading to pickup',
  picked_up: 'Cargo collected',
  in_transit: 'In transit',
};

function statusVariant(s: TransportStatus): 'default' | 'success' | 'warning' {
  if (s === 'accepted') return 'warning';
  if (s === 'in_transit') return 'default';
  return 'success'; // picked_up
}

export function MyTransportJobsList({ jobs, partnerPosition, onChanged }: Props) {
  if (jobs === null) {
    return (
      <div className="py-4 flex items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        Loading your transport jobs…
      </div>
    );
  }
  if (jobs.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">
        Active transport {jobs.length === 1 ? 'job' : 'jobs'}
      </h2>
      {jobs.map((job) => (
        <TransportJobCard
          key={job._id}
          job={job}
          partnerPosition={partnerPosition}
          onChanged={onChanged}
        />
      ))}
    </section>
  );
}

function TransportJobCard({
  job,
  partnerPosition,
  onChanged,
}: {
  job: TransportOrder;
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
  const pickupLL = {
    lng: job.pickup.location.coordinates[0],
    lat: job.pickup.location.coordinates[1],
  };
  const dropLL = {
    lng: job.drop.location.coordinates[0],
    lat: job.drop.location.coordinates[1],
  };

  // Reuse DeliveryMap (pickup → shop slot, drop → customer slot).
  const activeLeg: 'to_shop' | 'to_customer' | null =
    job.status === 'accepted' || job.status === 'picked_up'
      ? 'to_shop'
      : job.status === 'in_transit'
        ? 'to_customer'
        : null;

  return (
    <Card className="border-orange-400/40 overflow-hidden">
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold">#{shortId}</span>
            <Badge variant={statusVariant(job.status)}>
              {STATUS_LABEL[job.status] || job.status}
            </Badge>
            <span className="text-xs px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 font-medium uppercase tracking-wide">
              Transport
            </span>
          </div>
        </div>

        <DeliveryMap
          partner={partnerPosition}
          shop={pickupLL}
          customer={dropLL}
          activeLeg={activeLeg}
          height={220}
        />

        {/* Pickup */}
        <div className="flex items-start gap-2 text-sm">
          <div className="h-7 w-7 rounded-full bg-brand-greenLight flex items-center justify-center shrink-0">
            📦
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Pickup</div>
            <div className="font-medium truncate">{job.pickup.name}</div>
            {job.pickup.address && (
              <div className="text-xs text-muted-foreground">
                <MapPin className="h-3 w-3 inline mr-0.5" />
                {job.pickup.address}
              </div>
            )}
            {job.pickup.phone && (
              <a
                href={`tel:${job.pickup.phone}`}
                className="text-xs text-primary flex items-center gap-1 mt-0.5"
              >
                <Phone className="h-3 w-3" />
                {job.pickup.phone}
              </a>
            )}
          </div>
        </div>

        {/* Drop */}
        <div className="flex items-start gap-2 text-sm">
          <div className="h-7 w-7 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
            🎯
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Drop</div>
            <div className="font-medium truncate">{job.drop.name}</div>
            {job.drop.address && (
              <div className="text-xs text-muted-foreground">
                <MapPin className="h-3 w-3 inline mr-0.5" />
                {job.drop.address}
              </div>
            )}
            {job.drop.phone && (
              <a
                href={`tel:${job.drop.phone}`}
                className="text-xs text-primary flex items-center gap-1 mt-0.5"
              >
                <Phone className="h-3 w-3" />
                {job.drop.phone}
              </a>
            )}
          </div>
        </div>

        {/* Summary */}
        <div className="flex items-center justify-between text-sm bg-muted/40 rounded-md px-2.5 py-2">
          <span className="text-muted-foreground flex items-center gap-1.5">
            <Navigation className="h-3.5 w-3.5" />
            {job.distanceKm ? `${job.distanceKm} km` : 'distance unknown'}
            {job.estimatedWeightKg ? ` · ${job.estimatedWeightKg} kg` : ''}
          </span>
          <span className="font-semibold">₹{job.fee} fee</span>
        </div>

        {job.notes && (
          <div className="text-xs text-muted-foreground bg-muted/30 rounded px-2 py-1.5">
            Note: {job.notes}
          </div>
        )}

        {error && (
          <div className="text-xs text-destructive bg-destructive/10 rounded px-2 py-1.5">
            {error}
          </div>
        )}

        {/* Lifecycle action — one button per state */}
        {job.status === 'accepted' && (
          <Button
            className="w-full"
            disabled={busy}
            onClick={() => run(() => transportPickup(job._id))}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <PackageCheck className="h-4 w-4 mr-2" />
            )}
            Confirm cargo collected
          </Button>
        )}
        {job.status === 'picked_up' && (
          <Button
            className="w-full"
            disabled={busy}
            onClick={() => run(() => transportStart(job._id))}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Truck className="h-4 w-4 mr-2" />
            )}
            Start to drop-off
          </Button>
        )}
        {job.status === 'in_transit' && (
          <Button
            className="w-full"
            disabled={busy}
            onClick={() => run(() => transportDeliver(job._id))}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4 mr-2" />
            )}
            Mark delivered
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
