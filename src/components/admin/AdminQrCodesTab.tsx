'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Loader2, QrCode as QrIcon, Link2, X, RefreshCw, Download } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ApiError } from '@/lib/api';
import {
  fetchQrCodes,
  generateQrCodes,
  linkQrCode,
  unlinkQrCode,
  fetchAdminShops,
  type QrCodeRow,
  type AdminShop,
} from '@/lib/admin';

const SITE =
  process.env.NEXT_PUBLIC_SITE_URL || 'https://www.sarvopakar.com';

/**
 * Admin tab: QR-flyer management.
 *
 * Flow:
 *   1. Generate a batch of blank codes (printed on identical flyers, each with
 *      its code number + QR encoding <SITE>/q/<code>).
 *   2. After a shop is approved, find a blank code and link it to that shop.
 *   3. Scanning that flyer then opens the shop's page.
 */
export default function AdminQrCodesTab() {
  const [rows, setRows] = useState<QrCodeRow[]>([]);
  const [counts, setCounts] = useState({ total: 0, linked: 0, blank: 0 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'linked' | 'blank'>('all');
  const [error, setError] = useState<string | null>(null);

  const [genCount, setGenCount] = useState('50');
  const [generating, setGenerating] = useState(false);

  // Approved shops, for the link dropdown.
  const [shops, setShops] = useState<AdminShop[]>([]);

  // Which code's QR is being previewed (for the show/download modal).
  const [qrCode, setQrCode] = useState<string | null>(null);
  const qrCanvasRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchQrCodes(filter);
      setRows(data.codes);
      setCounts({ total: data.total, linked: data.linked, blank: data.blank });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load codes');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    fetchAdminShops('approved')
      .then((d) => setShops(d.shops))
      .catch(() => setShops([]));
  }, []);

  async function handleGenerate() {
    const n = parseInt(genCount, 10);
    if (Number.isNaN(n) || n < 1) {
      setError('Enter a valid number of codes to generate');
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const res = await generateQrCodes(n);
      await load();
      setError(null);
      alert(`Created ${res.created} codes: ${res.from} → ${res.to}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not generate codes');
    } finally {
      setGenerating(false);
    }
  }

  async function handleLink(code: string, shopId: string) {
    if (!shopId) return;
    try {
      await linkQrCode(code, shopId);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not link code');
    }
  }

  async function handleUnlink(code: string) {
    if (!confirm(`Unlink code ${code}? It will become blank again.`)) return;
    try {
      await unlinkQrCode(code);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not unlink code');
    }
  }

  // Download the currently-previewed QR as a PNG (finds the rendered <canvas>).
  function downloadQr() {
    const canvas = qrCanvasRef.current?.querySelector('canvas');
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `sarvopakar-qr-${qrCode}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <QrIcon className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-bold">QR Flyer Codes</h2>
      </div>

      <p className="text-sm text-muted-foreground">
        Generate codes, print the flyers (each QR opens{' '}
        <code className="text-xs bg-muted px-1 py-0.5 rounded">{SITE}/q/CODE</code>
        ), then link a code to a shop after approval. Scanning a linked flyer
        opens that shop&apos;s page.
      </p>

      {/* Generate */}
      <div className="rounded-xl border p-4 space-y-3">
        <h3 className="font-semibold text-sm">Generate new blank codes</h3>
        <div className="flex items-end gap-2">
          <div className="w-32">
            <label className="text-xs text-muted-foreground">How many?</label>
            <Input
              type="number"
              min={1}
              max={2000}
              value={genCount}
              onChange={(e) => setGenCount(e.target.value)}
            />
          </div>
          <Button onClick={handleGenerate} disabled={generating}>
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
            ) : (
              <QrIcon className="h-4 w-4 mr-1.5" />
            )}
            Generate
          </Button>
        </div>
      </div>

      {/* Summary + filter */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm">
          <b>{counts.total}</b> total · <b>{counts.linked}</b> linked ·{' '}
          <b>{counts.blank}</b> blank
        </span>
        <div className="flex gap-1 ml-auto">
          {(['all', 'blank', 'linked'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs px-3 py-1.5 rounded-full border ${
                filter === f
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border'
              }`}
            >
              {f[0].toUpperCase() + f.slice(1)}
            </button>
          ))}
          <button
            onClick={load}
            className="text-xs px-2 py-1.5 rounded-full border border-border"
            aria-label="Refresh"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 rounded-lg p-3">
          {error}
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="py-10 text-center">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
        </div>
      ) : rows.length === 0 ? (
        <div className="py-10 text-center text-sm text-muted-foreground">
          No codes here yet. Generate a batch above.
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div
              key={r.code}
              className="flex flex-wrap items-center gap-3 rounded-xl border p-3"
            >
              <span className="font-mono font-bold text-sm w-16">{r.code}</span>

              <button
                onClick={() => setQrCode(r.code)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-primary border border-primary/30 rounded px-2 py-1 hover:bg-primary/10"
              >
                <QrIcon className="h-3.5 w-3.5" /> QR
              </button>

              {r.shopId ? (
                <>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary bg-primary/10 px-2 py-1 rounded">
                    <Link2 className="h-3 w-3" /> {r.shopName}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {r.scans} scans
                  </span>
                  <button
                    onClick={() => handleUnlink(r.code)}
                    className="ml-auto text-xs text-destructive inline-flex items-center gap-1"
                  >
                    <X className="h-3 w-3" /> Unlink
                  </button>
                </>
              ) : (
                <div className="ml-auto flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Blank —</span>
                  <select
                    defaultValue=""
                    onChange={(e) => handleLink(r.code, e.target.value)}
                    className="text-sm border rounded-lg px-2 py-1.5 max-w-[200px]"
                  >
                    <option value="" disabled>
                      Link to shop…
                    </option>
                    {shops.map((s) => (
                      <option key={s._id} value={s._id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* QR preview + download modal */}
      {qrCode && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setQrCode(null)}
        >
          <div
            className="bg-white rounded-2xl p-6 w-full max-w-xs text-center relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setQrCode(null)}
              className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
            <h3 className="font-bold text-lg mb-1">Code {qrCode}</h3>
            <p className="text-xs text-muted-foreground mb-4 break-all">
              {SITE}/q/{qrCode}
            </p>
            <div ref={qrCanvasRef} className="flex justify-center mb-4">
              <QRCodeCanvas
                value={`${SITE}/q/${qrCode}`}
                size={220}
                level="M"
                includeMargin
              />
            </div>
            <Button onClick={downloadQr} className="w-full">
              <Download className="h-4 w-4 mr-1.5" /> Download PNG
            </Button>
            <p className="text-[11px] text-muted-foreground mt-2">
              Print this on the flyer. Scanning opens the linked shop.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
