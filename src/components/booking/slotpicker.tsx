'use client';

/**
 * SlotPicker — date strip + time-slot grid driven by the provider's REAL
 * availability (GET /bookings/slots/:providerId). Booked slots are disabled
 * and labeled, past slots are hidden for today, day-off days say so.
 *
 * Used in three places: the customer booking page, the customer's
 * "Change slot" dialog, and the provider's "Change slot" dialog — so all
 * three always agree on what's free.
 */

import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';

import { fetchProviderSlots, type SlotInfo } from '@/lib/booking';

function nextDays(n: number) {
  const out: { iso: string; label: string; sub: string }[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate()
    ).padStart(2, '0')}`;
    const label =
      i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString(undefined, { weekday: 'short' });
    const sub = d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
    out.push({ iso, label, sub });
  }
  return out;
}

export function SlotPicker({
  providerId,
  dateIso,
  slot,
  onChange,
}: {
  providerId: string;
  dateIso: string;
  slot: string;
  onChange: (dateIso: string, slot: string) => void;
}) {
  const [slots, setSlots] = useState<SlotInfo[] | null>(null);
  const [dayOff, setDayOff] = useState(false);
  const [loading, setLoading] = useState(false);
  const [maxDays, setMaxDays] = useState(7);

  const days = useMemo(() => nextDays(maxDays), [maxDays]);

  useEffect(() => {
    if (!dateIso && days[0]) onChange(days[0].iso, '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  useEffect(() => {
    if (!providerId || !dateIso) return;
    let cancelled = false;
    setLoading(true);
    fetchProviderSlots(providerId, dateIso)
      .then((res) => {
        if (cancelled) return;
        setSlots(res.slots);
        setDayOff(res.dayOff);
        if (res.config?.maxDaysAhead) setMaxDays(Math.min(res.config.maxDaysAhead, 30));
      })
      .catch(() => {
        if (!cancelled) {
          setSlots([]);
          setDayOff(false);
        }
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [providerId, dateIso]);

  const visibleSlots = (slots || []).filter((s) => !s.past);

  return (
    <div className="space-y-3">
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {days.map((d) => (
          <button
            key={d.iso}
            type="button"
            onClick={() => onChange(d.iso, '')}
            className={`shrink-0 w-16 py-2 rounded-lg border text-center transition-colors ${
              dateIso === d.iso
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-card border-border hover:bg-muted'
            }`}
          >
            <div className="text-xs font-bold">{d.label}</div>
            <div className="text-[10px] opacity-80">{d.sub}</div>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-6 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin mr-2" /> Checking availability…
        </div>
      ) : dayOff ? (
        <div className="text-center text-sm text-muted-foreground py-5">
          Provider is off on this day — pick another date.
        </div>
      ) : visibleSlots.length === 0 ? (
        <div className="text-center text-sm text-muted-foreground py-5">
          No slots left on this day — pick another date.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {visibleSlots.map((s) => (
            <button
              key={s.slot}
              type="button"
              disabled={!s.free}
              onClick={() => onChange(dateIso, s.slot)}
              className={`py-2 px-1 rounded-lg border text-xs font-medium transition-colors ${
                slot === s.slot
                  ? 'bg-primary text-primary-foreground border-primary'
                  : s.free
                    ? 'bg-card border-border hover:bg-muted'
                    : 'bg-muted/60 border-border text-muted-foreground line-through cursor-not-allowed'
              }`}
            >
              {s.slot}
              {!s.free && <span className="block text-[10px] no-underline font-bold">Booked</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
