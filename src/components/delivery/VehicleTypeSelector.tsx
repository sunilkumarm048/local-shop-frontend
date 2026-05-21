'use client';

import { useState } from 'react';
import { Loader2, ChevronDown, Check } from 'lucide-react';

import { ApiError } from '@/lib/api';
import { updateDeliveryProfile, type DeliveryProfile } from '@/lib/delivery';

const VEHICLE_OPTIONS: Array<{ id: NonNullable<DeliveryProfile['vehicleType']>; name: string; icon: string }> = [
  { id: 'bike', name: '2-Wheeler', icon: '🛵' },
  { id: '3wheeler', name: '3-Wheeler', icon: '🛺' },
  { id: 'tataAce', name: 'Tata Ace', icon: '🚐' },
  { id: 'pickup8ft', name: 'Pickup 8ft', icon: '🚛' },
  { id: 'tata407', name: 'Tata 407', icon: '🚚' },
];

interface Props {
  current: DeliveryProfile['vehicleType'];
  onChanged: (next: DeliveryProfile) => void;
}

export function VehicleTypeSelector({ current, onChanged }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const currentOption = VEHICLE_OPTIONS.find((o) => o.id === current);

  async function pick(id: NonNullable<DeliveryProfile['vehicleType']>) {
    if (id === current) {
      setOpen(false);
      return;
    }
    setBusy(id);
    try {
      const r = await updateDeliveryProfile({ vehicleType: id });
      onChanged(r.profile);
      setOpen(false);
    } catch (err) {
      console.error(err instanceof ApiError ? err.message : err);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-white/15 hover:bg-white/25 text-white text-xs font-medium transition-colors"
      >
        {currentOption ? (
          <>
            <span aria-hidden>{currentOption.icon}</span>
            <span>{currentOption.name}</span>
          </>
        ) : (
          <span>Set vehicle</span>
        )}
        <ChevronDown className="h-3 w-3 opacity-60" />
      </button>

      {open && (
        <>
          {/* click-out catcher */}
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full mt-1 w-48 bg-white text-foreground rounded-md shadow-lg border z-50 py-1">
            {VEHICLE_OPTIONS.map((opt) => {
              const selected = opt.id === current;
              const loading = busy === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  disabled={busy !== null}
                  onClick={() => pick(opt.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-muted/60 ${
                    selected ? 'font-medium' : ''
                  }`}
                >
                  <span aria-hidden className="w-5">
                    {opt.icon}
                  </span>
                  <span className="flex-1">{opt.name}</span>
                  {loading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                  ) : selected ? (
                    <Check className="h-3.5 w-3.5 text-brand-green" />
                  ) : null}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
