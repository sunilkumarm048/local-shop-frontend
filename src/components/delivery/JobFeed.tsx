'use client';

import { useState } from 'react';
import { Loader2, MapPin, Phone, Package, Scissors, Navigation, IndianRupee } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ApiError } from '@/lib/api';
import { acceptJob, type AvailableJob } from '@/lib/delivery';

interface Props {
  jobs: AvailableJob[] | null;
  hasLocation: boolean;
  onRefresh: () => void | Promise<void>;
  onAccepted: () => void | Promise<void>;
}

export function JobFeed({ jobs, hasLocation, onRefresh, onAccepted }: Props) {
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  }

  if (!hasLocation) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Waiting for your GPS location to find nearby pickups…
        </CardContent>
      </Card>
    );
  }

  if (jobs === null) {
    return (
      <div className="py-8 flex items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Finding pickups near you…
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 flex flex-col items-center gap-2 text-center">
          <Package className="h-9 w-9 text-muted-foreground" />
          <p className="font-medium">No pickups in range</p>
          <p className="text-sm text-muted-foreground max-w-xs">
            Nothing ready for pickup within your radius right now. Widen the radius or check
            back in a bit.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            className="mt-1"
          >
            {refreshing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Refreshing…
              </>
            ) : (
              'Refresh'
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {jobs.map((job) => (
        <JobCard key={job.orderId} job={job} onAccepted={onAccepted} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------

function JobCard({
  job,
  onAccepted,
}: {
  job: AvailableJob;
  onAccepted: () => void | Promise<void>;
}) {
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [taken, setTaken] = useState(false);

  async function accept() {
    setAccepting(true);
    setError(null);
    try {
      await acceptJob(job.orderId);
      await onAccepted();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        // Someone else grabbed it, or we're offline.
        setTaken(true);
        setError(err.message);
      } else {
        setError(err instanceof ApiError ? err.message : 'Could not accept this job.');
      }
    } finally {
      setAccepting(false);
    }
  }

  const itemCount = job.items.reduce((s, i) => s + i.qty, 0);
  const shortId = job.orderId.slice(-6).toUpperCase();

  return (
    <Card className={taken ? 'opacity-50' : ''}>
      <CardContent className="pt-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold">#{shortId}</span>
            {job.isSplit && (
              <Badge variant="warning" className="gap-1">
                <Scissors className="h-3 w-3" />
                Split
              </Badge>
            )}
          </div>
          {job.distanceToShopKm != null && (
            <span className="text-xs font-medium text-brand-green flex items-center gap-1 shrink-0">
              <Navigation className="h-3 w-3" />
              {job.distanceToShopKm} km to shop
            </span>
          )}
        </div>

        {/* Pickup */}
        <div className="flex items-start gap-2 text-sm">
          <div className="h-7 w-7 rounded-full bg-brand-greenLight flex items-center justify-center text-xs shrink-0">
            🏪
          </div>
          <div className="min-w-0">
            <div className="font-medium">{job.shop?.name || 'Shop'}</div>
            {job.shop?.address && (
              <div className="text-xs text-muted-foreground truncate">
                {[job.shop.address.line1, job.shop.address.city].filter(Boolean).join(', ')}
              </div>
            )}
          </div>
        </div>

        {/* Drop */}
        {job.recipient && (
          <div className="flex items-start gap-2 text-sm">
            <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-xs shrink-0">
              📍
            </div>
            <div className="min-w-0">
              <div className="font-medium">{job.recipient.name || 'Customer'}</div>
              {job.recipient.address && (
                <div className="text-xs text-muted-foreground flex items-start gap-1">
                  <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                  {job.recipient.address}
                </div>
              )}
              {job.recipient.phone && (
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {job.recipient.phone}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Summary row */}
        <div className="flex items-center justify-between text-sm bg-muted/40 rounded-md px-2.5 py-2">
          <span className="text-muted-foreground">
            {itemCount} item{itemCount !== 1 ? 's' : ''}
            {job.distanceKm ? ` · ${job.distanceKm} km trip` : ''}
          </span>
          <span className="font-semibold flex items-center gap-0.5">
            <IndianRupee className="h-3.5 w-3.5" />
            {job.deliveryFee ?? 0} fee
          </span>
        </div>

        {error && (
          <div className="text-xs text-destructive bg-destructive/10 rounded px-2 py-1.5">
            {error}
          </div>
        )}

        {!taken && (
          <Button className="w-full" onClick={accept} disabled={accepting}>
            {accepting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Package className="h-4 w-4 mr-2" />
            )}
            Accept pickup
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
