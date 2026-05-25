'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Loader2,
  ChevronLeft,
  Save,
  ShieldCheck,
  ShieldAlert,
  CircleUser,
  Truck,
  FileText,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/stores/auth';
import { useUser } from '@/hooks/useUser';
import { ApiError } from '@/lib/api';
import {
  fetchDeliveryProfile,
  updateDeliveryProfile,
  updateMyDocuments,
  type DeliveryProfile,
} from '@/lib/delivery';

const VEHICLE_OPTIONS: Array<{ id: NonNullable<DeliveryProfile['vehicleType']>; name: string; icon: string }> = [
  { id: 'bike', name: '2-Wheeler', icon: '🛵' },
  { id: '3wheeler', name: '3-Wheeler', icon: '🛺' },
  { id: 'tataAce', name: 'Tata Ace', icon: '🚐' },
  { id: 'pickup8ft', name: 'Pickup 8ft', icon: '🚛' },
  { id: 'tata407', name: 'Tata 407', icon: '🚚' },
];

export default function ProfilePage() {
  const router = useRouter();
  const { user } = useUser();
  const token = useAuth((s) => s.token);

  const [hydrated, setHydrated] = useState(false);
  const [profile, setProfile] = useState<DeliveryProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setHydrated(useAuth.persist.hasHydrated());
    return useAuth.persist.onFinishHydration(() => setHydrated(true));
  }, []);
  useEffect(() => {
    if (hydrated && !token) router.replace('/login?next=/delivery/profile');
  }, [hydrated, token, router]);
  useEffect(() => {
    if (user && !user.roles.includes('delivery')) router.replace('/customer');
  }, [user, router]);

  const load = useCallback(async () => {
    try {
      const r = await fetchDeliveryProfile();
      setProfile(r.profile);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load profile.');
    }
  }, []);

  useEffect(() => {
    if (user?.roles.includes('delivery')) load();
  }, [user, load]);

  if (!hydrated || !token || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Loading…
      </div>
    );
  }
  if (!user.roles.includes('delivery')) return null;

  return (
    <div className="min-h-screen flex flex-col bg-[#f4f4f4]">
      <header className="sticky top-0 z-30 bg-[#1f1f1f] text-white shadow-sm">
        <div className="container flex items-center gap-2 py-3">
          <Link href="/delivery" className="text-white hover:bg-white/10 p-1.5 rounded-md">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <CircleUser className="h-5 w-5" />
          <div className="text-sm font-bold">My profile</div>
        </div>
      </header>

      <main className="flex-1 container py-5 space-y-4">
        {error && (
          <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{error}</div>
        )}

        {!profile && (
          <div className="py-12 flex items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Loading…
          </div>
        )}

        {profile && (
          <>
            <VerificationStatus profile={profile} />
            <BasicInfo userName={user.name} userPhone={user.phone} />
            <VehicleInfo profile={profile} onSaved={setProfile} />
            <Documents profile={profile} onSaved={setProfile} />
          </>
        )}
      </main>
    </div>
  );
}

// ============================================================

function VerificationStatus({ profile }: { profile: DeliveryProfile }) {
  const verified = profile.documents?.verified === true;
  const hasDocs =
    !!profile.documents?.drivingLicenseUrl ||
    !!profile.documents?.aadhaarUrl ||
    !!profile.documents?.vehicleRcUrl;

  return (
    <Card className={verified ? 'border-brand-green/40' : ''}>
      <CardContent className="pt-4 flex items-center gap-3">
        {verified ? (
          <ShieldCheck className="h-8 w-8 text-brand-green" />
        ) : (
          <ShieldAlert className="h-8 w-8 text-orange-500" />
        )}
        <div className="flex-1">
          <div className="font-semibold text-sm">
            {verified ? 'Account verified' : hasDocs ? 'Documents under review' : 'Verification needed'}
          </div>
          <div className="text-xs text-muted-foreground">
            {verified
              ? 'Your documents are approved.'
              : hasDocs
                ? 'Admin will review your documents and verify within 24 hours.'
                : 'Upload your documents below to start accepting jobs.'}
          </div>
        </div>
        <Badge variant={verified ? 'success' : 'warning'}>{verified ? 'Verified' : 'Pending'}</Badge>
      </CardContent>
    </Card>
  );
}

// ============================================================

function BasicInfo({ userName, userPhone }: { userName?: string; userPhone?: string }) {
  return (
    <Card>
      <CardContent className="pt-4 space-y-2">
        <h2 className="text-sm font-semibold flex items-center gap-1.5">
          <CircleUser className="h-4 w-4" />
          Basic info
        </h2>
        <div className="text-sm space-y-1">
          <Row label="Name" value={userName || '—'} />
          <Row label="Phone" value={userPhone || '—'} />
        </div>
        <p className="text-[11px] text-muted-foreground">
          Name and phone are set at signup. Contact support to change them.
        </p>
      </CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 py-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-medium truncate">{value}</span>
    </div>
  );
}

// ============================================================

function VehicleInfo({ profile, onSaved }: { profile: DeliveryProfile; onSaved: (p: DeliveryProfile) => void }) {
  const [vehicleType, setVehicleType] = useState(profile.vehicleType || 'bike');
  const [vehicleNumber, setVehicleNumber] = useState(profile.vehicleNumber || '');
  const [licenseNumber, setLicenseNumber] = useState(profile.licenseNumber || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const dirty =
    vehicleType !== (profile.vehicleType || 'bike') ||
    vehicleNumber.trim() !== (profile.vehicleNumber || '') ||
    licenseNumber.trim() !== (profile.licenseNumber || '');

  async function save() {
    setBusy(true);
    setError(null);
    setSuccess(false);
    try {
      const r = await updateDeliveryProfile({
        vehicleType,
        vehicleNumber: vehicleNumber.trim(),
        licenseNumber: licenseNumber.trim(),
      });
      onSaved(r.profile);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Save failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        <h2 className="text-sm font-semibold flex items-center gap-1.5">
          <Truck className="h-4 w-4" />
          Vehicle info
        </h2>

        <div>
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Vehicle type</span>
          <div className="grid grid-cols-3 gap-2 mt-1">
            {VEHICLE_OPTIONS.map((opt) => {
              const selected = opt.id === vehicleType;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setVehicleType(opt.id)}
                  className={`p-2 rounded-md border-2 text-xs font-medium flex flex-col items-center gap-0.5 ${
                    selected ? 'border-brand-green bg-brand-greenLight/30' : 'border-transparent bg-muted/40'
                  }`}
                >
                  <span className="text-lg" aria-hidden>{opt.icon}</span>
                  {opt.name}
                </button>
              );
            })}
          </div>
        </div>

        <Field
          label="Vehicle number"
          value={vehicleNumber}
          onChange={(v) => setVehicleNumber(v.toUpperCase())}
          placeholder="e.g. OD05AB1234"
        />
        <Field
          label="Driving license number"
          value={licenseNumber}
          onChange={(v) => setLicenseNumber(v.toUpperCase())}
          placeholder="As printed on the license"
        />

        {error && (
          <div className="text-xs text-destructive bg-destructive/10 rounded px-2 py-1.5">{error}</div>
        )}
        <div className="flex gap-2 items-center">
          <Button onClick={save} disabled={!dirty || busy} size="sm" className="flex-1">
            {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save
          </Button>
          {success && <span className="text-xs text-brand-green">Saved</span>}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================

function Documents({ profile, onSaved }: { profile: DeliveryProfile; onSaved: (p: DeliveryProfile) => void }) {
  const [dl, setDl] = useState(profile.documents?.drivingLicenseUrl || '');
  const [aadhaar, setAadhaar] = useState(profile.documents?.aadhaarUrl || '');
  const [rc, setRc] = useState(profile.documents?.vehicleRcUrl || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const dirty =
    dl.trim() !== (profile.documents?.drivingLicenseUrl || '') ||
    aadhaar.trim() !== (profile.documents?.aadhaarUrl || '') ||
    rc.trim() !== (profile.documents?.vehicleRcUrl || '');

  async function save() {
    setBusy(true);
    setError(null);
    setSuccess(false);
    try {
      const r = await updateMyDocuments({
        drivingLicenseUrl: dl.trim(),
        aadhaarUrl: aadhaar.trim(),
        vehicleRcUrl: rc.trim(),
      });
      onSaved(r.profile);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Save failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        <h2 className="text-sm font-semibold flex items-center gap-1.5">
          <FileText className="h-4 w-4" />
          Documents
        </h2>
        <p className="text-xs text-muted-foreground">
          Paste image URLs (e.g. uploaded to Google Drive, Imgur, or any public hosting).
          Direct file uploads coming in a future update.
        </p>

        <Field
          label="Driving license photo URL"
          value={dl}
          onChange={setDl}
          placeholder="https://…"
          type="url"
        />
        <Field
          label="Aadhaar card URL (optional)"
          value={aadhaar}
          onChange={setAadhaar}
          placeholder="https://…"
          type="url"
        />
        <Field
          label="Vehicle RC URL"
          value={rc}
          onChange={setRc}
          placeholder="https://…"
          type="url"
        />

        {profile.documents?.verified && dirty && (
          <div className="text-xs text-orange-700 bg-orange-50 rounded px-2 py-1.5">
            ⚠ Saving will reset your verified status until admin re-reviews.
          </div>
        )}

        {error && (
          <div className="text-xs text-destructive bg-destructive/10 rounded px-2 py-1.5">{error}</div>
        )}

        <div className="flex gap-2 items-center">
          <Button onClick={save} disabled={!dirty || busy} size="sm" className="flex-1">
            {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save documents
          </Button>
          {success && <span className="text-xs text-brand-green">Saved</span>}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: 'text' | 'tel' | 'url' | 'email';
}) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full px-3 py-2 border rounded-md text-sm"
      />
    </label>
  );
}
