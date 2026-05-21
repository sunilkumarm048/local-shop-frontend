'use client';

import { useEffect, useState } from 'react';
import { Loader2, Package } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { ApiError } from '@/lib/api';
import { quoteAll, type LatLng, type VehicleId, type VehicleQuote } from '@/lib/transport';

interface Props {
  pickup: LatLng | null;
  drop: LatLng | null;
  value: VehicleId | null;
  onChange: (id: VehicleId, quote: VehicleQuote) => void;
}

export function VehicleSelector({ pickup, drop, value, onChange }: Props) {
  const [quotes, setQuotes] = useState<VehicleQuote[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!pickup || !drop) {
      setQuotes(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    quoteAll(pickup, drop)
      .then((r) => {
        if (cancelled) return;
        setQuotes(r.quotes);
        // If the currently-selected vehicle isn't in the response (shouldn't
        // happen, but be defensive), clear.
        if (value && !r.quotes.find((q) => q.vehicleId === value)) {
          // no-op — parent decides
        }
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof ApiError ? e.message : 'Could not load fares.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [pickup?.lat, pickup?.lng, drop?.lat, drop?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!pickup || !drop) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-sm text-muted-foreground">
          Pick a pickup and drop location to see fares.
        </CardContent>
      </Card>
    );
  }

  if (loading && !quotes) {
    return (
      <div className="py-6 flex items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        Calculating fares…
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
        {error}
      </div>
    );
  }

  if (!quotes || quotes.length === 0) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-sm text-muted-foreground">
          No vehicles available right now.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {quotes.map((q) => (
        <VehicleCard
          key={q.vehicleId}
          quote={q}
          selected={value === q.vehicleId}
          onSelect={() => onChange(q.vehicleId, q)}
        />
      ))}
    </div>
  );
}

function VehicleCard({
  quote,
  selected,
  onSelect,
}: {
  quote: VehicleQuote;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`text-left border rounded-lg p-3 transition-all hover:border-brand-green/60 ${
        selected
          ? 'border-brand-green bg-brand-greenLight ring-2 ring-brand-green/40'
          : 'border-input bg-white'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-2xl shrink-0" aria-hidden>
            {quote.icon || '🚚'}
          </span>
          <div className="min-w-0">
            <div className="font-semibold text-sm truncate">{quote.vehicleName}</div>
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Package className="h-3 w-3" />
              up to {quote.maxKg.toLocaleString()} kg
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="font-bold">₹{quote.total}</div>
          <div className="text-[10px] text-muted-foreground">{quote.distanceKm} km</div>
        </div>
      </div>
    </button>
  );
}
