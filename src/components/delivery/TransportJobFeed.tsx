'use client';
import { useState } from 'react';
import { Loader2, MapPin, Package, Navigation, IndianRupee, Phone, Truck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ApiError } from '@/lib/api';
import {
  acceptTransportJob,
  type AvailableTransportJob,
} from '@/lib/transport';

interface Props {
  jobs: AvailableTransportJob[] | null;
  hasLocation: boolean;
  hasVehicleType: boolean;
  onRefresh: () => void | Promise<void>;
  onAccepted: () => void | Promise<void>;
}

export function TransportJobFeed({
  jobs,
  hasLocation,
  hasVehicleType,
  onRefresh,
  onAccepted,
}: Props) {
  if (!hasVehicleType) {
    return (
      <Card>
        <CardContent className="py-8 flex flex-col items-center gap-2 text-center">
          <Truck className="h-9 w-9 text-muted-foreground" />
          <p className="font-medium">Pick your vehicle</p>
          <p className="text-sm text-muted-foreground max-w-xs">
            Transport jobs are filtered by vehicle type. Use the vehicle picker in the header
            to set yours.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!hasLocation) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Waiting for your GPS location to find nearby transport jobs…
        </CardContent>
      </Card>
    );
  }

  if (jobs === null) {
    return (
      <div className="py-8 flex items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Finding transport jobs near you…
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 flex flex-col items-center gap-2 text-center">
          <Package className="h-9 w-9 text-muted-foreground" />
          <p className="font-medium">No transport jobs in range</p>
          <p className="text-sm text-muted-foreground max-w-xs">
            Nothing matching your vehicle within your radius right now.
          </p>
          <Button variant="outline" size="sm" onClick={onRefresh} className="mt-1">
            Refresh
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {jobs.map((job) => (
        <TransportJobCard key={job._id} job={job} onAccepted={onAccepted} />
      ))}
    </div>
  );
}

function TransportJobCard({
  job,
  onAccepted,
}: {
  job: AvailableTransportJob;
  onAccepted: () => void | Promise<void>;
}) {
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [taken, setTaken] = useState(false);

  async function accept() {
    setAccepting(true);
    setError(null);
    try {
      await acceptTransportJob(job._id);
      await onAccepted();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setTaken(true);
        setError(err.message);
      } else {
        setError(err instanceof ApiError ? err.message : 'Could not accept this job.');
      }
    } finally {
      setAccepting(false);
    }
  }

  const shortId = job._id.slice(-6).toUpperCase();

  return (
    <Card className={taken ? 'opacity-50' : ''}>
      <CardContent className="pt-4 space-y-3">
        {/* header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold">#{shortId}</span>
            <span className="text-xs px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 font-medium uppercase tracking-wide">
              Transport
            </span>
          </div>
          {job.distanceToPickupKm != null && (
            <span className="text-xs font-medium text-brand-green flex items-center gap-1 shrink-0">
              <Navigation className="h-3 w-3" />
              {job.distanceToPickupKm} km to pickup
            </span>
          )}
        </div>

        {/* pickup */}
        <div className="flex items-start gap-2 text-sm">
          <div className="h-7 w-7 rounded-full bg-brand-greenLight flex items-center justify-center text-xs shrink-0">
            📦
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Pickup</div>
            <div className="font-medium truncate">{job.pickup.name || 'Sender'}</div>
            {job.pickup.address && (
              <div className="text-xs text-muted-foreground flex items-start gap-1">
                <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                {job.pickup.address}
              </div>
            )}
            {job.pickup.phone && (
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {job.pickup.phone}
              </div>
            )}
          </div>
        </div>

        {/* drop */}
        <div className="flex items-start gap-2 text-sm">
          <div className="h-7 w-7 rounded-full bg-orange-100 flex items-center justify-center text-xs shrink-0">
            🎯
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Drop</div>
            <div className="font-medium truncate">{job.drop.name || 'Recipient'}</div>
            {job.drop.address && (
              <div className="text-xs text-muted-foreground flex items-start gap-1">
                <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                {job.drop.address}
              </div>
            )}
          </div>
        </div>

        {/* summary */}
        <div className="flex items-center justify-between text-sm bg-muted/40 rounded-md px-2.5 py-2">
          <span className="text-muted-foreground">
            {job.distanceKm ? `${job.distanceKm} km trip` : 'distance unknown'}
            {job.estimatedWeightKg ? ` · ~${job.estimatedWeightKg} kg` : ''}
          </span>
          <span className="font-semibold flex items-center gap-0.5">
            <IndianRupee className="h-3.5 w-3.5" />
            {job.fee} fee
          </span>
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

        {!taken && (
          <Button className="w-full" onClick={accept} disabled={accepting}>
            {accepting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Truck className="h-4 w-4 mr-2" />
            )}
            Accept transport
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
