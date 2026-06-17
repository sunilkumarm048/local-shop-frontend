'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, MapPin, Phone, User, CheckCircle2, XCircle, Ban, ShieldOff } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ApiError } from '@/lib/api';
import {
  fetchAdminShops,
  approveShop,
  rejectShop,
  blockShop,
  type AdminShop,
} from '@/lib/admin';

type Status = 'pending' | 'approved' | 'blocked' | 'all';

export function AdminShopsTab() {
  const [status, setStatus] = useState<Status>('pending');
  const [shops, setShops] = useState<AdminShop[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const r = await fetchAdminShops(status);
      setShops(r.shops);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Could not load shops.');
    } finally {
      setRefreshing(false);
    }
  }, [status]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold">Shops</h2>
          <p className="text-sm text-muted-foreground">
            {shops ? `${shops.length} shop${shops.length === 1 ? '' : 's'}` : 'Loading…'}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refresh} disabled={refreshing}>
          {refreshing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Refreshing…
            </>
          ) : (
            'Refresh'
          )}
        </Button>
      </div>

      <div className="flex gap-1 border-b">
        {(
          [
            ['pending', 'Pending'],
            ['approved', 'Approved'],
            ['blocked', 'Blocked'],
            ['all', 'All'],
          ] as Array<[Status, string]>
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setStatus(id)}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              status === id
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loadError && (
        <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
          {loadError}
        </div>
      )}

      {shops === null ? (
        <div className="py-10 flex items-center justify-center text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          Loading…
        </div>
      ) : shops.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No shops in this view.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {shops.map((shop) => (
            <ShopCard key={shop._id} shop={shop} onChanged={refresh} />
          ))}
        </div>
      )}
    </div>
  );
}

function ShopCard({ shop, onChanged }: { shop: AdminShop; onChanged: () => void | Promise<void> }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(label: string, fn: () => Promise<unknown>) {
    setBusy(label);
    setError(null);
    try {
      await fn();
      await onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Action failed.');
    } finally {
      setBusy(null);
    }
  }

  const anyBusy = busy !== null;
  const addr = shop.address || {};

  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-start gap-3">
          {shop.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={shop.logo}
              alt=""
              className="h-12 w-12 rounded-md object-cover border bg-muted shrink-0"
            />
          ) : (
            <div className="h-12 w-12 rounded-md border bg-muted flex items-center justify-center shrink-0">
              🏪
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold">{shop.name}</h3>
              {shop.isBlocked ? (
                <Badge variant="destructive">Blocked</Badge>
              ) : shop.isApproved ? (
                <Badge variant="success">Approved</Badge>
              ) : (
                <Badge variant="warning">Pending</Badge>
              )}
            </div>
            {shop.description && (
              <p className="text-sm text-muted-foreground line-clamp-2">{shop.description}</p>
            )}
          </div>
        </div>

        <div className="text-xs text-muted-foreground space-y-1">
          {shop.owner && (
            <div className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {shop.owner.name || 'Unnamed'} — {shop.owner.email || shop.owner.phone || ''}
            </div>
          )}
          {(addr.line1 || addr.city) && (
            <div className="flex items-start gap-1">
              <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
              {[addr.line1, addr.city, addr.state, addr.pincode].filter(Boolean).join(', ')}
            </div>
          )}
          {shop.phone && (
            <div className="flex items-center gap-1">
              <Phone className="h-3 w-3" />
              {shop.phone}
            </div>
          )}
        </div>

        {error && (
          <div className="text-xs text-destructive bg-destructive/10 rounded px-2 py-1.5">
            {error}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {!shop.isApproved && !shop.isBlocked && (
            <>
              <Button
                size="sm"
                disabled={anyBusy}
                onClick={() => run('approve', () => approveShop(shop._id))}
              >
                {busy === 'approve' ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                )}
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={anyBusy}
                onClick={() => run('reject', () => rejectShop(shop._id, { block: true }))}
              >
                {busy === 'reject' ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <XCircle className="h-3.5 w-3.5 mr-1.5" />
                )}
                Reject &amp; block
              </Button>
            </>
          )}
          {shop.isApproved && !shop.isBlocked && (
            <Button
              size="sm"
              variant="outline"
              className="text-destructive hover:text-destructive"
              disabled={anyBusy}
              onClick={() => run('block', () => blockShop(shop._id, true))}
            >
              {busy === 'block' ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <Ban className="h-3.5 w-3.5 mr-1.5" />
              )}
              Block shop
            </Button>
          )}
          {shop.isBlocked && (
            <Button
              size="sm"
              disabled={anyBusy}
              onClick={() => run('unblock', () => blockShop(shop._id, false))}
            >
              {busy === 'unblock' ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <ShieldOff className="h-3.5 w-3.5 mr-1.5" />
              )}
              Unblock
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
