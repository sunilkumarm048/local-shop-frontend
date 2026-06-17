'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Loader2,
  LogOut,
  Power,
  MapPin,
  Crosshair,
  Wallet,
  Package,
  TrendingUp,
  Truck,
  Navigation,
  IndianRupee,
  Phone,
  PackageCheck,
  CheckCircle2,
  ChevronDown,
  Check,
  CircleUser,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/stores/auth';
import {
  initNotificationSound,
  playDeliveryJob,
} from '@/lib/notificationSound';
import { PushSetup } from '@/components/notifications/PushSetup';
import { useUser } from '@/hooks/useUser';
import { logout } from '@/lib/auth';
import { getSocket } from '@/lib/socket';
import { ApiError } from '@/lib/api';
import {
  fetchDeliveryProfile,
  updateDeliveryProfile,
  fetchJobs,
  fetchMyJobs,
  type DeliveryProfile,
  type AvailableJob,
  type MyJob,
} from '@/lib/delivery';
import {
  fetchTransportJobs,
  fetchMyTransportJobs,
  acceptTransportJob,
  transportPickup,
  transportStart,
  transportDeliver,
  type AvailableTransportJob,
  type TransportOrder,
  type TransportStatus,
} from '@/lib/transport';
import { JobFeed } from '@/components/delivery/JobFeed';
import { MyJobsList } from '@/components/delivery/MyJobsList';
import { useLiveLocation } from '@/lib/useLiveLocation';

// =============================================================================
// NOTE: TransportJobFeed, MyTransportJobsList, and VehicleTypeSelector are
// DEFINED INLINE in this file (further down) rather than imported from
// @/components/delivery/. The Vercel build environment was repeatedly failing
// to resolve those module paths even when the files were present in the repo.
// Inlining sidesteps the resolution issue entirely.
// =============================================================================

const DeliveryMap = dynamic(() => import('@/components/delivery/DeliveryMap'), {
  ssr: false,
  loading: () => (
    <div className="h-[220px] rounded-lg border bg-muted/40 flex items-center justify-center text-sm text-muted-foreground">
      Loading map…
    </div>
  ),
});

// =============================================================================
// MAIN DELIVERY DASHBOARD PAGE
// =============================================================================

type Coords = { lat: number; lng: number };

export default function DeliveryDashboard() {
  const router = useRouter();
  const { user } = useUser();
  const token = useAuth((s) => s.token);

  const [hydrated, setHydrated] = useState(false);
  const [profile, setProfile] = useState<DeliveryProfile | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    setHydrated(useAuth.persist.hasHydrated());
    return useAuth.persist.onFinishHydration(() => setHydrated(true));
  }, []);

  // Prime the audio + install autoplay-unlock listener so job:assigned chimes
  // even when the page has been idle in the background.
  useEffect(() => {
    initNotificationSound();
  }, []);

  useEffect(() => {
    if (hydrated && !token) router.replace('/login?next=/delivery');
  }, [hydrated, token, router]);

  useEffect(() => {
    if (user && !user.roles.includes('delivery')) router.replace('/customer');
  }, [user, router]);

  useEffect(() => {
    if (!user || !user.roles.includes('delivery')) return;
    fetchDeliveryProfile()
      .then((r) => setProfile(r.profile))
      .catch((err) =>
        setLoadError(err instanceof ApiError ? err.message : 'Could not load your profile.')
      );
  }, [user]);

  if (!hydrated) return <FullPageLoader label="Loading…" />;
  if (!token) return null;
  if (!user) return <FullPageLoader label="Loading your account…" />;
  if (!user.roles.includes('delivery')) return null;

  if (loadError) {
    return (
      <div className="container py-12 max-w-md text-center space-y-4">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="text-sm text-muted-foreground">{loadError}</p>
        <Button onClick={() => location.reload()}>Try again</Button>
      </div>
    );
  }
  if (!profile) return <FullPageLoader label="Loading your dashboard…" />;

  return (
    <DeliveryDashboardInner
      profile={profile}
      setProfile={setProfile}
      userName={user.name}
      onLogout={async () => {
        await logout();
        router.push('/login');
      }}
    />
  );
}

// =============================================================================

interface InnerProps {
  profile: DeliveryProfile;
  setProfile: (p: DeliveryProfile) => void;
  userName?: string;
  onLogout: () => void;
}

function DeliveryDashboardInner({ profile, setProfile, userName, onLogout }: InnerProps) {
  const token = useAuth((s) => s.token);

  const [coords, setCoords] = useState<Coords | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [radiusKm, setRadiusKm] = useState(5);
  const [togglingOnline, setTogglingOnline] = useState(false);

  const [jobs, setJobs] = useState<AvailableJob[] | null>(null);
  const [myJobs, setMyJobs] = useState<MyJob[] | null>(null);
  const [feedError, setFeedError] = useState<string | null>(null);

  const [transportJobs, setTransportJobs] = useState<AvailableTransportJob[] | null>(null);
  const [myTransportJobs, setMyTransportJobs] = useState<TransportOrder[] | null>(null);
  const [feedTab, setFeedTab] = useState<'grocery' | 'transport'>('grocery');

  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoError('Geolocation not supported by this browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoError(null);
      },
      (err) => setGeoError(err.message || 'Could not get your location.'),
      { enableHighAccuracy: true, timeout: 10_000 }
    );
  }, []);

  function refreshLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoError(null);
      },
      (err) => setGeoError(err.message || 'Could not get your location.'),
      { enableHighAccuracy: true, timeout: 10_000 }
    );
  }

  const loadMyJobs = useCallback(async () => {
    try {
      const r = await fetchMyJobs();
      setMyJobs(r.jobs);
    } catch {
      setMyJobs([]);
    }
  }, []);
  useEffect(() => { loadMyJobs(); }, [loadMyJobs]);

  const loadMyTransportJobs = useCallback(async () => {
    try {
      const r = await fetchMyTransportJobs();
      setMyTransportJobs(r.jobs);
    } catch {
      setMyTransportJobs([]);
    }
  }, []);
  useEffect(() => { loadMyTransportJobs(); }, [loadMyTransportJobs]);

  const loadJobs = useCallback(async () => {
    if (!coords || !profile.available) {
      setJobs(null);
      return;
    }
    try {
      const r = await fetchJobs(coords.lng, coords.lat, radiusKm);
      setJobs(r.jobs);
      setFeedError(null);
    } catch (err) {
      setFeedError(err instanceof ApiError ? err.message : 'Could not load jobs.');
    }
  }, [coords, profile.available, radiusKm]);
  useEffect(() => { loadJobs(); }, [loadJobs]);

  const loadTransportJobs = useCallback(async () => {
    if (!coords || !profile.available || !profile.vehicleType) {
      setTransportJobs(null);
      return;
    }
    try {
      const r = await fetchTransportJobs(coords.lng, coords.lat, radiusKm);
      setTransportJobs(r.jobs);
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        setTransportJobs(null);
        return;
      }
      setFeedError(err instanceof ApiError ? err.message : 'Could not load transport jobs.');
    }
  }, [coords, profile.available, profile.vehicleType, radiusKm]);
  useEffect(() => { loadTransportJobs(); }, [loadTransportJobs]);

  useEffect(() => {
    const socket = getSocket(token);
    if (!socket) return;

    function onJobTaken(payload: { orderId: string; kind?: 'transport' }) {
      if (payload.kind === 'transport') {
        setTransportJobs((prev) => prev ? prev.filter((j) => j._id !== payload.orderId) : prev);
      } else {
        setJobs((prev) => prev ? prev.filter((j) => j.orderId !== payload.orderId) : prev);
      }
    }
    function onStatusUpdate() {
      loadJobs();
      loadTransportJobs();
    }
    function onJobAssigned(payload: { kind?: 'transport' }) {
      playDeliveryJob();
      if (payload?.kind === 'transport') loadMyTransportJobs();
      else loadMyJobs();
    }
    socket.on('job:taken', onJobTaken);
    socket.on('order:status_update', onStatusUpdate);
    socket.on('job:assigned', onJobAssigned);
    return () => {
      socket.off('job:taken', onJobTaken);
      socket.off('order:status_update', onStatusUpdate);
      socket.off('job:assigned', onJobAssigned);
    };
  }, [token, loadJobs, loadMyJobs, loadTransportJobs, loadMyTransportJobs]);

  const activeOrderIds = [
    ...(myJobs || []).map((j) => j._id),
    ...(myTransportJobs || []).map((j) => j._id),
  ];
  const { position: partnerPosition } = useLiveLocation({
    enabled: profile.available,
    orderIds: activeOrderIds,
  });

  useEffect(() => {
    if (partnerPosition) setCoords(partnerPosition);
  }, [partnerPosition]);

  async function toggleOnline() {
    setTogglingOnline(true);
    const next = !profile.available;
    try {
      const r = await updateDeliveryProfile({ available: next });
      setProfile(r.profile);
      const socket = getSocket(token);
      socket?.emit('delivery:online', { online: next });
    } catch (err) {
      setFeedError(err instanceof ApiError ? err.message : 'Could not update status.');
    } finally {
      setTogglingOnline(false);
    }
  }

  const online = profile.available;

  return (
    <div className="min-h-screen flex flex-col bg-[#f4f4f4]">
      <header className="sticky top-0 z-30 bg-[#1f1f1f] text-white shadow-sm">
        <div className="container flex items-center gap-3 py-3">
          <Link href="/" className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center text-lg shrink-0">🛵</Link>
          <div className="flex-1 min-w-0 leading-tight">
            {userName && <div className="text-xs text-white/60">Hi, {userName}</div>}
            <div className="text-sm font-bold truncate">Delivery Partner</div>
          </div>

          <button
            type="button"
            onClick={toggleOnline}
            disabled={togglingOnline}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold shrink-0 transition-colors ${
              online ? 'bg-brand-green text-white' : 'bg-white/15 text-white/70'
            } ${togglingOnline ? 'opacity-60 cursor-wait' : ''}`}
          >
            {togglingOnline ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <span className={`h-2 w-2 rounded-full ${online ? 'bg-white' : 'bg-white/50'}`} />
            )}
            {online ? 'ONLINE' : 'OFFLINE'}
          </button>

          <VehicleTypeSelector current={profile.vehicleType} onChanged={(p) => setProfile(p)} />

          <Link
            href="/delivery/analytics"
            aria-label="Analytics"
            className="text-white hover:bg-white/10 p-2 rounded-md"
          >
            <TrendingUp className="h-5 w-5" />
          </Link>

          <Link
            href="/delivery/profile"
            aria-label="Profile"
            className="text-white hover:bg-white/10 p-2 rounded-md"
          >
            <CircleUser className="h-5 w-5" />
          </Link>

          <Button variant="ghost" size="icon" aria-label="Logout" onClick={onLogout} className="text-white hover:bg-white/10">
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <main className="flex-1 container py-5 space-y-5">
        <PushSetup
          headline="Get alerts for new jobs"
          subline="Even when the app is closed or your phone is locked. Don\u2019t miss a delivery."
        />

        <div className="grid grid-cols-3 gap-3">
          <Link href="/delivery/wallet" className="block">
            <StatCard icon={Wallet} label="Wallet →" value={`₹${profile.walletBalance}`} />
          </Link>
          <StatCard icon={Package} label="Deliveries" value={String(profile.totalDeliveries)} />
          <StatCard icon={TrendingUp} label="Earned" value={`₹${profile.totalEarnings}`} />
        </div>

        {!online && (
          <div className="rounded-lg border border-dashed bg-white p-6 text-center space-y-2">
            <Power className="h-8 w-8 text-muted-foreground mx-auto" />
            <p className="font-medium">You&apos;re offline</p>
            <p className="text-sm text-muted-foreground">Go online to start seeing pickup jobs near you.</p>
            <Button onClick={toggleOnline} disabled={togglingOnline} className="mt-1">
              {togglingOnline && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Go online
            </Button>
          </div>
        )}

        <MyJobsList jobs={myJobs} partnerPosition={partnerPosition} onChanged={loadMyJobs} />
        <MyTransportJobsList jobs={myTransportJobs} partnerPosition={partnerPosition} onChanged={loadMyTransportJobs} />

        {online && (
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <h2 className="text-lg font-semibold">Available work</h2>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  {coords ? (<><MapPin className="h-3 w-3" />within {radiusKm} km of you</>) : ('waiting for your location…')}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={refreshLocation}>
                <Crosshair className="h-4 w-4 mr-2" />
                Update location
              </Button>
            </div>

            <div className="bg-white rounded-lg border px-4 py-3">
              <div className="flex items-center justify-between text-sm mb-1.5">
                <span className="font-medium">Search radius</span>
                <span className="text-muted-foreground">{radiusKm} km</span>
              </div>
              <input type="range" min={1} max={25} step={1} value={radiusKm} onChange={(e) => setRadiusKm(Number(e.target.value))} className="w-full accent-brand-green" />
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                <span>1 km</span>
                <span>25 km</span>
              </div>
            </div>

            <div className="flex gap-1 border-b">
              <button
                type="button"
                onClick={() => setFeedTab('grocery')}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  feedTab === 'grocery' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Package className="h-3.5 w-3.5" />
                Grocery pickups
                {jobs && jobs.length > 0 && (
                  <span className="ml-1 text-[10px] bg-brand-green text-white rounded-full px-1.5 py-0.5 font-bold">{jobs.length}</span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setFeedTab('transport')}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  feedTab === 'transport' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Truck className="h-3.5 w-3.5" />
                Transport
                {transportJobs && transportJobs.length > 0 && (
                  <span className="ml-1 text-[10px] bg-orange-600 text-white rounded-full px-1.5 py-0.5 font-bold">{transportJobs.length}</span>
                )}
              </button>
            </div>

            {geoError && (
              <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
                {geoError} — jobs can&apos;t be shown without your location.
              </div>
            )}
            {feedError && (
              <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{feedError}</div>
            )}

            {feedTab === 'grocery' && (
              <JobFeed
                jobs={jobs}
                hasLocation={!!coords}
                onRefresh={loadJobs}
                onAccepted={async () => { await Promise.all([loadJobs(), loadMyJobs()]); }}
              />
            )}
            {feedTab === 'transport' && (
              <TransportJobFeed
                jobs={transportJobs}
                hasLocation={!!coords}
                hasVehicleType={!!profile.vehicleType}
                onRefresh={loadTransportJobs}
                onAccepted={async () => { await Promise.all([loadTransportJobs(), loadMyTransportJobs()]); }}
              />
            )}
          </section>
        )}
      </main>
    </div>
  );
}

// =============================================================================
// HELPERS
// =============================================================================

function StatCard({ icon: Icon, label, value }: { icon: typeof Wallet; label: string; value: string }) {
  return (
    <div className="bg-white rounded-lg border p-3 text-center">
      <Icon className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
      <div className="text-lg font-bold leading-none">{value}</div>
      <div className="text-[11px] text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

function FullPageLoader({ label }: { label: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin mr-2" />
      {label}
    </div>
  );
}

// =============================================================================
// INLINED: VehicleTypeSelector
// Originally at src/components/delivery/VehicleTypeSelector.tsx
// =============================================================================

const VEHICLE_OPTIONS: Array<{ id: NonNullable<DeliveryProfile['vehicleType']>; name: string; icon: string }> = [
  { id: 'bike', name: '2-Wheeler', icon: '🛵' },
  { id: '3wheeler', name: '3-Wheeler', icon: '🛺' },
  { id: 'tataAce', name: 'Tata Ace', icon: '🚐' },
  { id: 'pickup8ft', name: 'Pickup 8ft', icon: '🚛' },
  { id: 'tata407', name: 'Tata 407', icon: '🚚' },
];

interface VehicleTypeSelectorProps {
  current: DeliveryProfile['vehicleType'];
  onChanged: (next: DeliveryProfile) => void;
}

function VehicleTypeSelector({ current, onChanged }: VehicleTypeSelectorProps) {
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
                  <span aria-hidden className="w-5">{opt.icon}</span>
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

// =============================================================================
// INLINED: TransportJobFeed
// Originally at src/components/delivery/TransportJobFeed.tsx
// =============================================================================

interface TransportJobFeedProps {
  jobs: AvailableTransportJob[] | null;
  hasLocation: boolean;
  hasVehicleType: boolean;
  onRefresh: () => void | Promise<void>;
  onAccepted: () => void | Promise<void>;
}

function TransportJobFeed({ jobs, hasLocation, hasVehicleType, onRefresh, onAccepted }: TransportJobFeedProps) {
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  }

  if (!hasVehicleType) {
    return (
      <Card>
        <CardContent className="py-8 flex flex-col items-center gap-2 text-center">
          <Truck className="h-9 w-9 text-muted-foreground" />
          <p className="font-medium">Pick your vehicle</p>
          <p className="text-sm text-muted-foreground max-w-xs">
            Transport jobs are filtered by vehicle type. Use the vehicle picker in the header to set yours.
          </p>
        </CardContent>
      </Card>
    );
  }
  if (!hasLocation) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Waiting for your GPS location to find nearby transport jobs…
        </CardContent>
      </Card>
    );
  }
  if (jobs === null) {
    return (
      <div className="py-8 flex items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Finding transport jobs near you…
      </div>
    );
  }
  if (jobs.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 flex flex-col items-center gap-2 text-center">
          <Package className="h-9 w-9 text-muted-foreground" />
          <p className="font-medium">No transport jobs in range</p>
          <p className="text-sm text-muted-foreground max-w-xs">
            Nothing matching your vehicle within your radius right now.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            className="mt-1"
          >
            {refreshing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Refreshing…
              </>
            ) : (
              'Refresh'
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="space-y-3">
      {jobs.map((job) => (
        <TransportJobCard key={job._id} job={job} onAccepted={onAccepted} />
      ))}
    </div>
  );
}

function TransportJobCard({ job, onAccepted }: { job: AvailableTransportJob; onAccepted: () => void | Promise<void> }) {
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [taken, setTaken] = useState(false);

  async function accept() {
    setAccepting(true);
    setError(null);
    try {
      await acceptTransportJob(job._id);
      await onAccepted();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setTaken(true);
        setError(err.message);
      } else {
        setError(err instanceof ApiError ? err.message : 'Could not accept this job.');
      }
    } finally {
      setAccepting(false);
    }
  }

  const shortId = job._id.slice(-6).toUpperCase();

  return (
    <Card className={taken ? 'opacity-50' : ''}>
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold">#{shortId}</span>
            <span className="text-xs px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 font-medium uppercase tracking-wide">
              Transport
            </span>
          </div>
          {job.distanceToPickupKm != null && (
            <span className="text-xs font-medium text-brand-green flex items-center gap-1 shrink-0">
              <Navigation className="h-3 w-3" />
              {job.distanceToPickupKm} km to pickup
            </span>
          )}
        </div>

        <div className="flex items-start gap-2 text-sm">
          <div className="h-7 w-7 rounded-full bg-brand-greenLight flex items-center justify-center text-xs shrink-0">📦</div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Pickup</div>
            <div className="font-medium truncate">{job.pickup.name || 'Sender'}</div>
            {job.pickup.address && (
              <div className="text-xs text-muted-foreground flex items-start gap-1">
                <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                {job.pickup.address}
              </div>
            )}
            {job.pickup.phone && (
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {job.pickup.phone}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-start gap-2 text-sm">
          <div className="h-7 w-7 rounded-full bg-orange-100 flex items-center justify-center text-xs shrink-0">🎯</div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Drop</div>
            <div className="font-medium truncate">{job.drop.name || 'Recipient'}</div>
            {job.drop.address && (
              <div className="text-xs text-muted-foreground flex items-start gap-1">
                <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                {job.drop.address}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between text-sm bg-muted/40 rounded-md px-2.5 py-2">
          <span className="text-muted-foreground">
            {job.distanceKm ? `${job.distanceKm} km trip` : 'distance unknown'}
            {job.estimatedWeightKg ? ` · ~${job.estimatedWeightKg} kg` : ''}
          </span>
          <span className="font-semibold flex items-center gap-0.5">
            <IndianRupee className="h-3.5 w-3.5" />
            {job.fee} fee
          </span>
        </div>

        {job.notes && (
          <div className="text-xs text-muted-foreground bg-muted/30 rounded px-2 py-1.5">Note: {job.notes}</div>
        )}

        {error && (
          <div className="text-xs text-destructive bg-destructive/10 rounded px-2 py-1.5">{error}</div>
        )}

        {!taken && (
          <Button className="w-full" onClick={accept} disabled={accepting}>
            {accepting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Truck className="h-4 w-4 mr-2" />}
            Accept transport
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// =============================================================================
// INLINED: MyTransportJobsList
// Originally at src/components/delivery/MyTransportJobsList.tsx
// =============================================================================

interface PartnerPos { lat: number; lng: number; }
interface MyTransportJobsListProps {
  jobs: TransportOrder[] | null;
  partnerPosition: PartnerPos | null;
  onChanged: () => void | Promise<void>;
}

const TRANSPORT_STATUS_LABEL: Partial<Record<TransportStatus, string>> = {
  accepted: 'Heading to pickup',
  picked_up: 'Cargo collected',
  in_transit: 'In transit',
};

function transportStatusVariant(s: TransportStatus): 'default' | 'success' | 'warning' {
  if (s === 'accepted') return 'warning';
  if (s === 'in_transit') return 'default';
  return 'success';
}

function MyTransportJobsList({ jobs, partnerPosition, onChanged }: MyTransportJobsListProps) {
  if (jobs === null) {
    return (
      <div className="py-4 flex items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        Loading your transport jobs…
      </div>
    );
  }
  if (jobs.length === 0) return null;
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">
        Active transport {jobs.length === 1 ? 'job' : 'jobs'}
      </h2>
      {jobs.map((job) => (
        <MyTransportJobCard key={job._id} job={job} partnerPosition={partnerPosition} onChanged={onChanged} />
      ))}
    </section>
  );
}

function MyTransportJobCard({ job, partnerPosition, onChanged }: { job: TransportOrder; partnerPosition: PartnerPos | null; onChanged: () => void | Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Action failed.');
    } finally {
      setBusy(false);
    }
  }

  const shortId = job._id.slice(-6).toUpperCase();
  const pickupLL = { lng: job.pickup.location.coordinates[0], lat: job.pickup.location.coordinates[1] };
  const dropLL = { lng: job.drop.location.coordinates[0], lat: job.drop.location.coordinates[1] };
  const activeLeg: 'to_shop' | 'to_customer' | null =
    job.status === 'accepted' || job.status === 'picked_up' ? 'to_shop' :
    job.status === 'in_transit' ? 'to_customer' : null;

  return (
    <Card className="border-orange-400/40 overflow-hidden">
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold">#{shortId}</span>
            <Badge variant={transportStatusVariant(job.status)}>
              {TRANSPORT_STATUS_LABEL[job.status] || job.status}
            </Badge>
            <span className="text-xs px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 font-medium uppercase tracking-wide">
              Transport
            </span>
          </div>
        </div>

        <DeliveryMap partner={partnerPosition} shop={pickupLL} customer={dropLL} activeLeg={activeLeg} height={220} />

        <div className="flex items-start gap-2 text-sm">
          <div className="h-7 w-7 rounded-full bg-brand-greenLight flex items-center justify-center shrink-0">📦</div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Pickup</div>
            <div className="font-medium truncate">{job.pickup.name}</div>
            {job.pickup.address && (
              <div className="text-xs text-muted-foreground">
                <MapPin className="h-3 w-3 inline mr-0.5" />
                {job.pickup.address}
              </div>
            )}
            {job.pickup.phone && (
              <a href={`tel:${job.pickup.phone}`} className="text-xs text-primary flex items-center gap-1 mt-0.5">
                <Phone className="h-3 w-3" />
                {job.pickup.phone}
              </a>
            )}
          </div>
        </div>

        <div className="flex items-start gap-2 text-sm">
          <div className="h-7 w-7 rounded-full bg-orange-100 flex items-center justify-center shrink-0">🎯</div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Drop</div>
            <div className="font-medium truncate">{job.drop.name}</div>
            {job.drop.address && (
              <div className="text-xs text-muted-foreground">
                <MapPin className="h-3 w-3 inline mr-0.5" />
                {job.drop.address}
              </div>
            )}
            {job.drop.phone && (
              <a href={`tel:${job.drop.phone}`} className="text-xs text-primary flex items-center gap-1 mt-0.5">
                <Phone className="h-3 w-3" />
                {job.drop.phone}
              </a>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between text-sm bg-muted/40 rounded-md px-2.5 py-2">
          <span className="text-muted-foreground flex items-center gap-1.5">
            <Navigation className="h-3.5 w-3.5" />
            {job.distanceKm ? `${job.distanceKm} km` : 'distance unknown'}
            {job.estimatedWeightKg ? ` · ${job.estimatedWeightKg} kg` : ''}
          </span>
          <span className="font-semibold">₹{job.fee} fee</span>
        </div>

        {job.notes && (
          <div className="text-xs text-muted-foreground bg-muted/30 rounded px-2 py-1.5">Note: {job.notes}</div>
        )}

        {error && (
          <div className="text-xs text-destructive bg-destructive/10 rounded px-2 py-1.5">{error}</div>
        )}

        {job.status === 'accepted' && (
          <Button className="w-full" disabled={busy} onClick={() => run(() => transportPickup(job._id))}>
            {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <PackageCheck className="h-4 w-4 mr-2" />}
            Confirm cargo collected
          </Button>
        )}
        {job.status === 'picked_up' && (
          <Button className="w-full" disabled={busy} onClick={() => run(() => transportStart(job._id))}>
            {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Truck className="h-4 w-4 mr-2" />}
            Start to drop-off
          </Button>
        )}
        {job.status === 'in_transit' && (
          <Button className="w-full" disabled={busy} onClick={() => run(() => transportDeliver(job._id))}>
            {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
            Mark delivered
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
