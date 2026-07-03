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

/** Draw a rounded-rectangle path (broad canvas support without ctx.roundRect). */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Draw a GPS-style location marker (outer ring + solid center) at (cx, cy). */
function drawPin(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string) {
  // Classic teardrop map pin: round head + pointed base, white center hole.
  const r = 10;
  const headCy = cy - 6;
  ctx.fillStyle = color;
  ctx.beginPath();
  // head arc (top ~270°) then taper to a point at the bottom
  ctx.arc(cx, headCy, r, Math.PI * 0.8, Math.PI * 0.2, false);
  ctx.lineTo(cx, cy + 12);
  ctx.closePath();
  ctx.fill();
  // full round head to smooth the top
  ctx.beginPath();
  ctx.arc(cx, headCy, r, 0, Math.PI * 2);
  ctx.fill();
  // white center hole
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(cx, headCy, 4, 0, Math.PI * 2);
  ctx.fill();
}

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
  const [qrRow, setQrRow] = useState<QrCodeRow | null>(null);
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

  // Compose a print-ready marketing flyer PNG: brand header, shop name, the QR,
  // a scan cue, and the URL. Falls back to code number if not linked to a shop.
  function downloadFlyer() {
    const srcCanvas = qrCanvasRef.current?.querySelector('canvas');
    if (!srcCanvas || !qrRow) return;

    const W = 900;
    const H = 1400;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const ctx = c.getContext('2d');
    if (!ctx) return;

    const center = W / 2;

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);

    // Yellow header band
    ctx.fillStyle = '#F8CD46';
    ctx.fillRect(0, 0, W, 200);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#7a5c00';
    ctx.font = '500 24px sans-serif';
    ctx.fillText('SARVOPAKAR', center, 60);

    ctx.fillStyle = '#1a1a1a';
    ctx.font = '500 58px sans-serif';
    ctx.fillText('सर्वोपकार', center, 122);

    // Tagline pill — neutral so it fits both shops and service providers.
    const pillText = 'Shop  ·  Services  ·  Nearby';
    ctx.font = '500 20px sans-serif';
    const pillW = ctx.measureText(pillText).width + 60;
    const pillX = center - pillW / 2;
    ctx.fillStyle = '#0C831F';
    roundRect(ctx, pillX, 150, pillW, 38, 19);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillText(pillText, center, 175);

    // "Now on Sarvopakar" — extra gap below the yellow header for breathing room.
    ctx.fillStyle = '#9a9a90';
    ctx.font = '500 20px sans-serif';
    ctx.fillText('NOW ON SARVOPAKAR', center, 296);

    // Shop / provider name (or code fallback)
    ctx.fillStyle = '#1a1a1a';
    ctx.font = '500 44px sans-serif';
    const shopName = qrRow.shopName || `Code ${qrRow.code}`;
    ctx.fillText(shopName, center, 352);

    // Location line (e.g. "Narendrapur, Nemalo") with a map-pin marker.
    let qrTop = 448;
    if (qrRow.shopLocation) {
      ctx.font = '400 24px sans-serif';
      const textW = ctx.measureText(qrRow.shopLocation).width;
      const pinGap = 20; // pin width + spacing
      const groupW = textW + pinGap;
      const startX = center - groupW / 2;
      // Pin sits at the left of the group.
      drawPin(ctx, startX + 8, 386, '#0C831F');
      // Text starts after the pin (left-aligned within the group).
      ctx.fillStyle = '#6a6a62';
      ctx.textAlign = 'left';
      ctx.fillText(qrRow.shopLocation, startX + pinGap, 394);
      ctx.textAlign = 'center'; // restore for the rest of the flyer
      qrTop = 448;
    }

    // QR — large and borderless. Sized to leave clear room for the caption
    // lines below so nothing overlaps.
    const sideMargin = 60;
    const bottomTextH = 180;
    const qrSize = Math.min(W - sideMargin * 2, H - qrTop - bottomTextH);
    const qrX = center - qrSize / 2;
    const qrY = qrTop;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(srcCanvas, qrX, qrY, qrSize, qrSize);

    const belowQr = qrY + qrSize;

    // Scan cue
    ctx.fillStyle = '#0C831F';
    ctx.font = '500 34px sans-serif';
    ctx.fillText('Scan to order or book', center, belowQr + 52);

    // URL chip
    ctx.fillStyle = '#8a8a80';
    ctx.font = '400 24px monospace';
    ctx.fillText(`${SITE.replace(/^https?:\/\//, '')}/q/${qrRow.code}`, center, belowQr + 96);

    // Trust line
    ctx.fillStyle = '#6a6a62';
    ctx.font = '400 22px sans-serif';
    ctx.fillText('Trusted local  ·  Pay your way  ·  Book or order', center, belowQr + 140);

    const link = document.createElement('a');
    link.download = `sarvopakar-flyer-${qrRow.code}.png`;
    link.href = c.toDataURL('image/png');
    link.click();
  }

  // Plain QR-only download (no flyer chrome).
  function downloadQrOnly() {
    const canvas = qrCanvasRef.current?.querySelector('canvas');
    if (!canvas || !qrRow) return;
    const link = document.createElement('a');
    link.download = `sarvopakar-qr-${qrRow.code}.png`;
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
                onClick={() => setQrRow(r)}
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
      {qrRow && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setQrRow(null)}
        >
          <div
            className="bg-white rounded-2xl p-6 w-full max-w-xs text-center relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setQrRow(null)}
              className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
            <h3 className="font-bold text-lg mb-1">Code {qrRow.code}</h3>
            <p className="text-xs text-muted-foreground mb-4 break-all">
              {SITE}/q/{qrRow.code}
            </p>
            <div ref={qrCanvasRef} className="flex justify-center mb-4">
              <QRCodeCanvas
                value={`${SITE}/q/${qrRow.code}`}
                size={900}
                level="M"
                includeMargin
                style={{ width: 220, height: 220 }}
              />
            </div>
            <Button onClick={downloadFlyer} className="w-full">
              <Download className="h-4 w-4 mr-1.5" /> Download flyer
            </Button>
            <button
              onClick={downloadQrOnly}
              className="w-full mt-2 text-xs text-muted-foreground hover:text-foreground underline"
            >
              or download just the QR
            </button>
            <p className="text-[11px] text-muted-foreground mt-3">
              The flyer includes the shop name and branding — print and display it.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
