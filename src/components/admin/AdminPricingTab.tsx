'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Save, RotateCcw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ApiError } from '@/lib/api';
import {
  fetchPricingConfig,
  updatePricingConfig,
  type PricingConfig,
} from '@/lib/admin';

/**
 * Pricing config editor.
 *
 * Single source of truth on the server (PricingConfig singleton). Editor
 * loads it once, makes local edits, posts a partial PATCH on save. We don't
 * stream updates per-keystroke — risk of conflict if two admins are editing
 * is too high without a proper concurrency story.
 *
 * Vehicles set is fixed (the server rejects unknown vehicle ids). Each row
 * edits maxKg / perKmRate / minFee. Plus two globals at the top: handling
 * fee + platform fee percent.
 */

const VEHICLE_ORDER = ['bike', '3wheeler', 'tataAce', 'pickup8ft', 'tata407'];

export default function AdminPricingTab() {
  const [config, setConfig] = useState<PricingConfig | null>(null);
  const [draft, setDraft] = useState<PricingConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetchPricingConfig();
      setConfig(r.config);
      setDraft(JSON.parse(JSON.stringify(r.config))); // deep clone for editing
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load pricing config.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function setVehicleField(vehicleId: string, field: 'maxKg' | 'perKmRate' | 'minFee', value: number) {
    if (!draft) return;
    const next = { ...draft, vehicles: { ...draft.vehicles } };
    next.vehicles[vehicleId] = { ...next.vehicles[vehicleId], [field]: value };
    setDraft(next);
  }

  function setGlobal(field: 'handlingFee' | 'platformFeePercent', value: number) {
    if (!draft) return;
    setDraft({ ...draft, [field]: value });
  }

  async function save() {
    if (!draft || !config) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      // Build a partial PATCH — only fields that actually changed.
      const vehicleChanges: Record<string, { maxKg: number; perKmRate: number; minFee: number }> = {};
      for (const id of VEHICLE_ORDER) {
        const a = config.vehicles[id];
        const b = draft.vehicles[id];
        if (!a || !b) continue;
        if (a.maxKg !== b.maxKg || a.perKmRate !== b.perKmRate || a.minFee !== b.minFee) {
          vehicleChanges[id] = { maxKg: b.maxKg, perKmRate: b.perKmRate, minFee: b.minFee };
        }
      }
      const patch: Parameters<typeof updatePricingConfig>[0] = {};
      if (Object.keys(vehicleChanges).length > 0) patch.vehicles = vehicleChanges;
      if (draft.handlingFee !== config.handlingFee) patch.handlingFee = draft.handlingFee;
      if (draft.platformFeePercent !== config.platformFeePercent) {
        patch.platformFeePercent = draft.platformFeePercent;
      }

      if (Object.keys(patch).length === 0) {
        setSuccess('Nothing to save — no changes.');
        setSaving(false);
        return;
      }

      const r = await updatePricingConfig(patch);
      setConfig(r.config);
      setDraft(JSON.parse(JSON.stringify(r.config)));
      setSuccess('Saved. Changes take effect on the next price quote.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save pricing config.');
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    if (!config) return;
    setDraft(JSON.parse(JSON.stringify(config)));
    setSuccess(null);
    setError(null);
  }

  if (loading) {
    return (
      <div className="py-12 flex items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Loading pricing config…
      </div>
    );
  }

  if (!draft || !config) {
    return (
      <div className="py-12 text-center space-y-3">
        <p className="text-sm text-destructive">{error || 'Could not load pricing.'}</p>
        <Button variant="outline" size="sm" onClick={load}>Retry</Button>
      </div>
    );
  }

  const dirty =
    JSON.stringify(draft.vehicles) !== JSON.stringify(config.vehicles) ||
    draft.handlingFee !== config.handlingFee ||
    draft.platformFeePercent !== config.platformFeePercent;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">Pricing configuration</h2>
        <p className="text-xs text-muted-foreground">
          These rates apply to all customer transport quotes and grocery delivery fees.
        </p>
      </div>

      {/* Globals */}
      <Card>
        <CardContent className="pt-4 space-y-3">
          <h3 className="text-sm font-semibold">Platform-wide</h3>
          <div className="grid grid-cols-2 gap-3">
            <FieldNumber
              label="Handling fee (₹)"
              value={draft.handlingFee}
              onChange={(v) => setGlobal('handlingFee', v)}
              min={0}
              step={1}
            />
            <FieldNumber
              label="Platform fee (%)"
              value={draft.platformFeePercent}
              onChange={(v) => setGlobal('platformFeePercent', v)}
              min={0}
              max={50}
              step={0.5}
            />
          </div>
        </CardContent>
      </Card>

      {/* Vehicles */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Vehicles</h3>
        {VEHICLE_ORDER.map((id) => {
          const v = draft.vehicles[id];
          if (!v) return null;
          return (
            <Card key={id}>
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl" aria-hidden>{v.icon || '🚚'}</span>
                  <span className="font-semibold">{v.name || id}</span>
                  <span className="text-xs text-muted-foreground">({id})</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <FieldNumber
                    label="Max load (kg)"
                    value={v.maxKg}
                    onChange={(val) => setVehicleField(id, 'maxKg', val)}
                    min={1}
                    step={1}
                  />
                  <FieldNumber
                    label="Per km rate (₹)"
                    value={v.perKmRate}
                    onChange={(val) => setVehicleField(id, 'perKmRate', val)}
                    min={0}
                    step={0.5}
                  />
                  <FieldNumber
                    label="Minimum fee (₹)"
                    value={v.minFee}
                    onChange={(val) => setVehicleField(id, 'minFee', val)}
                    min={0}
                    step={1}
                  />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{error}</div>
      )}
      {success && (
        <div className="text-sm text-brand-green bg-brand-greenLight/40 rounded-md px-3 py-2">{success}</div>
      )}

      <div className="sticky bottom-0 bg-background border-t flex gap-2 py-3 -mx-4 px-4">
        <Button onClick={save} disabled={!dirty || saving} className="flex-1">
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Save changes
        </Button>
        <Button variant="outline" onClick={reset} disabled={!dirty || saving}>
          <RotateCcw className="h-4 w-4 mr-2" />
          Reset
        </Button>
      </div>
    </div>
  );
}

function FieldNumber({
  label,
  value,
  onChange,
  min,
  max,
  step,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        min={min}
        max={max}
        step={step}
        className="mt-1 w-full px-2.5 py-1.5 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-green/30"
      />
    </label>
  );
}
