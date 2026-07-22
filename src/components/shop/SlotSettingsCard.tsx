'use client';

/**
 * SlotSettingsCard — the provider edits their bookable slots right where they
 * manage bookings: slot length, working hours, and weekly days off. Customers
 * immediately see the result on the booking page (free/booked grid).
 */

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Loader2, Check, CalendarCog } from 'lucide-react';

import { updateShop } from '@/lib/owner';
import type { SlotConfig } from '@/lib/booking';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DURATIONS = [30, 45, 60, 90, 120];

export function SlotSettingsCard({
  shopId,
  initial,
}: {
  shopId: string;
  initial?: SlotConfig;
}) {
  const [open, setOpen] = useState(false);
  const [slotMinutes, setSlotMinutes] = useState(60);
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('18:00');
  const [daysOff, setDaysOff] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!initial) return;
    if (initial.slotMinutes) setSlotMinutes(initial.slotMinutes);
    if (initial.start) setStart(initial.start);
    if (initial.end) setEnd(initial.end);
    if (initial.daysOff) setDaysOff(initial.daysOff);
  }, [initial]);

  function toggleDay(d: number) {
    setDaysOff((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  }

  async function save() {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await updateShop(shopId, {
        slotConfig: { slotMinutes, start, end, daysOff },
      } as Parameters<typeof updateShop>[1]);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setError('Could not save. Check the times and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3"
      >
        <span className="flex items-center gap-2 text-sm font-bold">
          <CalendarCog className="h-4 w-4 text-primary" /> My time slots
        </span>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4">
          <p className="text-xs text-muted-foreground -mt-1">
            Customers can only book the free slots inside these hours. Booked
            slots show as unavailable automatically.
          </p>

          <div>
            <div className="text-xs font-bold mb-1.5">Slot length</div>
            <div className="flex gap-2 flex-wrap">
              {DURATIONS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setSlotMinutes(d)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium ${
                    slotMinutes === d
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-card border-border hover:bg-muted'
                  }`}
                >
                  {d >= 60 ? `${d / 60} hr${d > 60 ? 's' : ''}` : `${d} min`}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <label className="flex-1 text-xs font-bold">
              Day starts
              <input
                type="time"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm font-normal"
              />
            </label>
            <label className="flex-1 text-xs font-bold">
              Day ends
              <input
                type="time"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm font-normal"
              />
            </label>
          </div>

          <div>
            <div className="text-xs font-bold mb-1.5">Weekly days off</div>
            <div className="flex gap-1.5 flex-wrap">
              {DAY_LABELS.map((label, d) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => toggleDay(d)}
                  className={`w-11 py-1.5 rounded-lg border text-xs font-medium ${
                    daysOff.includes(d)
                      ? 'bg-red-50 text-red-600 border-red-200'
                      : 'bg-card border-border hover:bg-muted'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {error && <div className="text-xs text-red-600 font-medium">{error}</div>}

          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-bold text-xs px-4 py-2 rounded-lg disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : saved ? <Check className="h-3.5 w-3.5" /> : null}
            {saved ? 'Saved' : 'Save slots'}
          </button>
        </div>
      )}
    </div>
  );
}
