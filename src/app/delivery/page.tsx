'use client';

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
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/stores/auth';
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
import { JobFeed } from '@/components/delivery/JobFeed';
import { MyJobsList } from '@/components/delivery/MyJobsList';

type Coords = { lat: number; lng: number };

export default function DeliveryDashboard() {
  const router = useRouter();
  const { user } = useUser();
  const token = useAuth((s) => s.token);

  const [hydrated, setHydrated] = useState(false);
  const [profile, setProfile] = useState<DeliveryProfile | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // ---- auth gate (same hydration pattern as the shop dashboard) ----
  useEffect(() => {
    setHydrated(useAuth.persist.hasHydrated());
    return useAuth.persist.onFinishHydration(() => setHydrated(true));
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

  // ---- one-shot GPS fix on mount ----
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

  // ---- load my active jobs (independent of GPS) ----
  const loadMyJobs = useCallback(async () => {
    try {
      const r = await fetchMyJobs();
      setMyJobs(r.jobs);
    } catch {
      setMyJobs([]);
    }
  }, []);

  useEffect(() => {
    loadMyJobs();
  }, [loadMyJobs]);

  // ---- load the available-jobs feed (needs GPS + online) ----
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

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  // ---- socket: a job got taken by someone else → drop it from the feed ----
  useEffect(() => {
    const socket = getSocket(token);
    if (!socket) return;

    function onJobTaken(payload: { orderId: string }) {
      setJobs((prev) => (prev ? prev.filter((j) => j.orderId !== payload.orderId) : prev));
    }
    // When a shop marks something ready, a fresh pickup may now be in range.
    function onStatusUpdate() {
      loadJobs();
    }

    socket.on('job:taken', onJobTaken);
    socket.on('order:status_update', onStatusUpdate);
    return () => {
      socket.off('job:taken', onJobTaken);
      socket.off('order:status_update', onStatusUpdate);
    };
  }, [token, loadJobs]);

  // ---- online toggle ----
  // Flips DeliveryProfile.available over HTTP (durable) AND emits the socket
  // event so the server joins/leaves the `delivery:available` room — that's
  // what makes `job:taken` broadcasts reach this partner.
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
      {/* Header */}
      <header className="sticky top-0 z-30 bg-[#1f1f1f] text-white shadow-sm">
        <div className="container flex items-center gap-3 py-3">
          <Link
            href="/"
            className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center text-lg shrink-0"
          >
            🛵
          </Link>
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
              <span
                className={`h-2 w-2 rounded-full ${online ? 'bg-white' : 'bg-white/50'}`}
              />
            )}
            {online ? 'ONLINE' : 'OFFLINE'}
          </button>

          <Button
            variant="ghost"
            size="icon"
            aria-label="Logout"
            onClick={onLogout}
            className="text-white hover:bg-white/10"
          >
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <main className="flex-1 container py-5 space-y-5">
        {/* Stat strip */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            icon={Wallet}
            label="Wallet"
            value={`₹${profile.walletBalance}`}
          />
          <StatCard
            icon={Package}
            label="Deliveries"
            value={String(profile.totalDeliveries)}
          />
          <StatCard
            icon={TrendingUp}
            label="Earned"
            value={`₹${profile.totalEarnings}`}
          />
        </div>

        {/* Offline notice */}
        {!online && (
          <div className="rounded-lg border border-dashed bg-white p-6 text-center space-y-2">
            <Power className="h-8 w-8 text-muted-foreground mx-auto" />
            <p className="font-medium">You&apos;re offline</p>
            <p className="text-sm text-muted-foreground">
              Go online to start seeing pickup jobs near you.
            </p>
            <Button onClick={toggleOnline} disabled={togglingOnline} className="mt-1">
              {togglingOnline && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Go online
            </Button>
          </div>
        )}

        {/* My active jobs — always shown if any exist */}
        <MyJobsList jobs={myJobs} onChanged={loadMyJobs} />

        {/* Available job feed — online only */}
        {online && (
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <h2 className="text-lg font-semibold">Available pickups</h2>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  {coords ? (
                    <>
                      <MapPin className="h-3 w-3" />
                      within {radiusKm} km of you
                    </>
                  ) : (
                    'waiting for your location…'
                  )}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={refreshLocation}>
                <Crosshair className="h-4 w-4 mr-2" />
                Update location
              </Button>
            </div>

            {/* Radius slider */}
            <div className="bg-white rounded-lg border px-4 py-3">
              <div className="flex items-center justify-between text-sm mb-1.5">
                <span className="font-medium">Search radius</span>
                <span className="text-muted-foreground">{radiusKm} km</span>
              </div>
              <input
                type="range"
                min={1}
                max={25}
                step={1}
                value={radiusKm}
                onChange={(e) => setRadiusKm(Number(e.target.value))}
                className="w-full accent-brand-green"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                <span>1 km</span>
                <span>25 km</span>
              </div>
            </div>

            {geoError && (
              <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
                {geoError} — pickups can&apos;t be shown without your location.
              </div>
            )}
            {feedError && (
              <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
                {feedError}
              </div>
            )}

            <JobFeed
              jobs={jobs}
              hasLocation={!!coords}
              onRefresh={loadJobs}
              onAccepted={async () => {
                await Promise.all([loadJobs(), loadMyJobs()]);
              }}
            />
          </section>
        )}
      </main>
    </div>
  );
}

// =============================================================================

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Wallet;
  label: string;
  value: string;
}) {
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
