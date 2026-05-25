'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Loader2,
  CheckCircle2,
  ShieldCheck,
  ShieldOff,
  ExternalLink,
  AlertCircle,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ApiError } from '@/lib/api';
import {
  fetchAdminDeliveryPartners,
  setDeliveryPartnerVerified,
  type AdminDeliveryPartner,
} from '@/lib/admin';

/**
 * Document verification queue.
 *
 * Three lists: Pending (has uploaded docs but not yet verified), Verified
 * (admin has approved), All (everyone with a profile, including no-docs).
 *
 * Each row links to the document URLs (open in new tab to review images);
 * Approve / Revoke flips the verified flag.
 */

type FilterKey = 'pending' | 'true' | 'false' | 'all';
const FILTER_TABS: Array<{ key: FilterKey; label: string }> = [
  { key: 'pending', label: 'Pending' },
  { key: 'true', label: 'Verified' },
  { key: 'false', label: 'Unverified' },
  { key: 'all', label: 'All' },
];

export default function AdminDocVerificationTab() {
  const [filter, setFilter] = useState<FilterKey>('pending');
  const [partners, setPartners] = useState<AdminDeliveryPartner[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await fetchAdminDeliveryPartners(filter);
      setPartners(r.partners);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load partners.');
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Delivery partner verification</h2>
        <p className="text-xs text-muted-foreground">
          Review documents submitted by delivery partners. Click each URL to inspect.
        </p>
      </div>

      <div className="flex gap-1 border-b overflow-x-auto">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setFilter(tab.key)}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${
              filter === tab.key
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{error}</div>
      )}

      {partners === null && (
        <div className="py-8 flex items-center justify-center text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          Loading…
        </div>
      )}

      {partners && partners.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No partners in this list.
          </CardContent>
        </Card>
      )}

      {partners && partners.length > 0 && (
        <div className="space-y-3">
          {partners.map((p) => (
            <PartnerCard key={p._id} partner={p} onChanged={load} />
          ))}
        </div>
      )}
    </div>
  );
}

function PartnerCard({ partner, onChanged }: { partner: AdminDeliveryPartner; onChanged: () => void | Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const verified = partner.documents?.verified === true;
  const userId = partner.user?._id;

  async function toggle() {
    if (!userId) return;
    setBusy(true);
    setError(null);
    try {
      await setDeliveryPartnerVerified(userId, !verified);
      await onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Action failed.');
    } finally {
      setBusy(false);
    }
  }

  const hasAnyDoc =
    !!partner.documents?.drivingLicenseUrl ||
    !!partner.documents?.aadhaarUrl ||
    !!partner.documents?.vehicleRcUrl;

  return (
    <Card className={verified ? 'border-brand-green/40' : ''}>
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="min-w-0">
            <div className="font-semibold">{partner.user?.name || 'Unknown partner'}</div>
            <div className="text-xs text-muted-foreground">
              {partner.user?.email} {partner.user?.phone && `· ${partner.user.phone}`}
            </div>
            <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
              {partner.vehicleType && <span>{partner.vehicleType}</span>}
              {partner.vehicleNumber && <span>· {partner.vehicleNumber}</span>}
              {partner.licenseNumber && <span>· DL {partner.licenseNumber}</span>}
            </div>
          </div>
          <Badge variant={verified ? 'success' : 'warning'}>
            {verified ? 'Verified' : 'Not verified'}
          </Badge>
        </div>

        {!hasAnyDoc ? (
          <div className="text-xs text-muted-foreground bg-muted/40 rounded-md px-3 py-2 flex items-center gap-2">
            <AlertCircle className="h-3.5 w-3.5" />
            No documents submitted yet.
          </div>
        ) : (
          <div className="space-y-1.5 bg-muted/30 rounded-md p-3">
            <DocLink label="Driving license" url={partner.documents?.drivingLicenseUrl} />
            <DocLink label="Aadhaar" url={partner.documents?.aadhaarUrl} />
            <DocLink label="Vehicle RC" url={partner.documents?.vehicleRcUrl} />
          </div>
        )}

        {error && (
          <div className="text-xs text-destructive bg-destructive/10 rounded px-2 py-1.5">{error}</div>
        )}

        {hasAnyDoc && (
          <Button
            onClick={toggle}
            disabled={busy}
            variant={verified ? 'outline' : 'default'}
            className="w-full"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : verified ? (
              <ShieldOff className="h-4 w-4 mr-2" />
            ) : (
              <ShieldCheck className="h-4 w-4 mr-2" />
            )}
            {verified ? 'Revoke verification' : 'Mark verified'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function DocLink({ label, url }: { label: string; url?: string }) {
  if (!url) {
    return (
      <div className="text-xs text-muted-foreground flex items-center gap-2">
        <span className="text-[11px] uppercase tracking-wide w-32">{label}</span>
        <span className="opacity-50">Not submitted</span>
      </div>
    );
  }
  return (
    <div className="text-xs flex items-center gap-2">
      <span className="text-[11px] uppercase tracking-wide w-32 text-muted-foreground">{label}</span>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary hover:underline flex items-center gap-1 truncate flex-1"
      >
        <CheckCircle2 className="h-3 w-3 text-brand-green shrink-0" />
        <span className="truncate">{url}</span>
        <ExternalLink className="h-3 w-3 shrink-0" />
      </a>
    </div>
  );
}
