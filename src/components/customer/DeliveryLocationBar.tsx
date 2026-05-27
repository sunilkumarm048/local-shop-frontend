'use client';

import { useState } from 'react';
import { MapPin, ChevronDown, Gift } from 'lucide-react';

import { useDeliveryLocation } from '@/stores/deliveryLocation';
import { DeliveryLocationModal } from './DeliveryLocationModal';

/**
 * Customer-page delivery bar:
 *   - Top row: "Delivery in 15 mins" + location chip that opens the modal.
 *   - When mode === 'other', also shows a green "Sending to someone else"
 *     banner with the full address (matches legacy `#giftContext`).
 */
export function DeliveryLocationBar() {
  const [open, setOpen] = useState(false);
  const mode = useDeliveryLocation((s) => s.mode);
  const areaName = useDeliveryLocation((s) => s.areaName);
  const address = useDeliveryLocation((s) => s.address);
  const lat = useDeliveryLocation((s) => s.lat);
  const lng = useDeliveryLocation((s) => s.lng);

  const hasLocation = lat != null && lng != null;

  return (
    <div className="space-y-2">
      {/* Delivery + chip row */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="text-sm font-extrabold leading-tight">Delivery in 15 mins</div>

        {mode === 'other' && hasLocation ? (
          <button
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1.5 text-[12px] font-bold text-primary bg-white border border-[#b3e5bf] rounded-full px-2.5 py-1 shadow-sm hover:bg-[#f0fbf2]"
          >
            <Gift className="h-3.5 w-3.5" />
            <span className="max-w-[160px] truncate">{areaName || 'Recipient location'}</span>
            <span className="ml-1 text-[9px] tracking-wider uppercase font-extrabold bg-[#dcf3e1] text-primary px-1.5 py-0.5 rounded">
              Change
            </span>
          </button>
        ) : (
          <button
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <MapPin className="h-3.5 w-3.5 text-primary" />
            <span className="font-medium">{areaName || 'Set location'}</span>
            <ChevronDown className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Gift banner */}
      {mode === 'other' && hasLocation && (
        <div className="rounded-xl border border-primary bg-gradient-to-r from-[#dcf3e1] to-[#b3e5bf] px-3.5 py-2.5 flex items-center gap-2.5">
          <Gift className="h-5 w-5 text-primary shrink-0" />
          <div className="flex-1 min-w-0 leading-tight">
            <div className="text-[12px] font-extrabold text-primary">
              Sending to someone else
            </div>
            <div className="text-[11px] text-primary/80 truncate">{address}</div>
          </div>
          <button
            onClick={() => setOpen(true)}
            className="shrink-0 bg-white text-primary text-[11px] font-bold border border-primary rounded-md px-3 py-1.5 hover:bg-[#f0fbf2]"
          >
            Change
          </button>
        </div>
      )}

      <DeliveryLocationModal open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
