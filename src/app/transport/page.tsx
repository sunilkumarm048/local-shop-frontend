'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';  
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Loader2,
  MapPin,
  Package,
  Truck,
  Phone,
  User,
  IndianRupee,
} from 'lucide-react';

import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/stores/auth';
import { useUser } from '@/hooks/useUser';
import { ApiError } from '@/lib/api';
import {
  bookTransport,
  type LatLng,
  type VehicleId,
  type VehicleQuote,
} from '@/lib/transport';
import { VehicleSelector } from '@/components/transport/VehicleSelector';

// Leaflet — dynamic only.
const TransportPinPicker = dynamic(
  () => import('@/components/transport/TransportPinPicker').then((m) => m.TransportPinPicker),
  {
    ssr: false,
    loading: () => (
      <div className="h-[320px] rounded-lg border bg-muted/40 flex items-center justify-center text-sm text-muted-foreground">
        Loading map…
      </div>
    ),
  }
);

type Step = 'pickup' | 'drop' | 'vehicle' | 'contacts' | 'review';
const STEP_ORDER: Step[] = ['pickup', 'drop', 'vehicle', 'contacts', 'review'];

interface Party {
  name: string;
  phone: string;
  address: string;
}

const EMPTY_PARTY: Party = { name: '', phone: '', address: '' };

export default function TransportBookingPage() {
  const router = useRouter();
  const { user } = useUser();
  const token = useAuth((s) => s.token);

  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(useAuth.persist.hasHydrated());
    return useAuth.persist.onFinishHydration(() => setHydrated(true));
  }, []);
  useEffect(() => {
    if (hydrated && !token) router.replace('/login?next=/transport');
  }, [hydrated, token, router]);

  // ---- form state ----
  const [step, setStep] = useState<Step>('pickup');

  const [pickupPin, setPickupPin] = useState<LatLng | null>(null);
  const [dropPin, setDropPin] = useState<LatLng | null>(null);
  const [pickup, setPickup] = useState<Party>(EMPTY_PARTY);
  const [drop, setDrop] = useState<Party>(EMPTY_PARTY);

  const [vehicleId, setVehicleId] = useState<VehicleId | null>(null);
  const [vehicleQuote, setVehicleQuote] = useState<VehicleQuote | null>(null);

  const [weight, setWeight] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'razorpay'>('cod');

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Prefill pickup name/phone with the customer's own profile — most common
  // case is "I'm shipping this myself."
  useEffect(() => {
    if (!user) return;
    setPickup((p) => ({
      ...p,
      name: p.name || user.name || '',
      phone: p.phone || user.phone || '',
    }));
  }, [user]);

  if (!hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Loading…
      </div>
    );
  }
  if (!token) return null;

  // ---- navigation helpers ----
  const stepIndex = STEP_ORDER.indexOf(step);
  function goNext() {
    if (stepIndex < STEP_ORDER.length - 1) setStep(STEP_ORDER[stepIndex + 1]);
  }
  function goBack() {
    if (stepIndex > 0) setStep(STEP_ORDER[stepIndex - 1]);
  }

  // ---- canProceed per step ----
  function canProceed(): boolean {
    if (step === 'pickup') return !!pickupPin;
    if (step === 'drop') return !!dropPin;
    if (step === 'vehicle') return !!vehicleId;
    if (step === 'contacts') {
      return (
        pickup.name.trim().length > 0 &&
        pickup.phone.trim().length >= 10 &&
        pickup.address.trim().length > 0 &&
        drop.name.trim().length > 0 &&
        drop.phone.trim().length >= 10 &&
        drop.address.trim().length > 0
      );
    }
    return true;
  }

  // ---- submit ----
  async function handleBook() {
    if (!vehicleId || !pickupPin || !dropPin) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const w = weight.trim() ? Number(weight) : undefined;
      const r = await bookTransport({
        vehicleId,
        pickup: { ...pickup, location: pickupPin },
        drop: { ...drop, location: dropPin },
        estimatedWeightKg: Number.isFinite(w) ? w : undefined,
        notes: notes.trim() || undefined,
        paymentMethod,
      });
      router.push(`/transport/${r.order._id}`);
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : 'Could not book.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Header />
      <main className="container py-5 space-y-4 max-w-2xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Truck className="h-5 w-5 text-brand-green" />
              Book transport
            </h1>
            <p className="text-sm text-muted-foreground">
              Move anything from A to B — pick the vehicle that fits.
            </p>
          </div>
          <Link
            href="/transport/my-bookings"
            className="text-sm text-primary hover:underline whitespace-nowrap"
          >
            My bookings
          </Link>
        </div>

        <StepStrip step={step} pickupPin={pickupPin} dropPin={dropPin} vehicleId={vehicleId} />

        {/* ---- STEP: pickup ---- */}
        {step === 'pickup' && (
          <Card>
            <CardContent className="pt-4 space-y-3">
              <SectionLabel n={1} title="Where are we picking up?" />
              <TransportPinPicker
                role="pickup"
                value={pickupPin}
                onChange={(ll, hint) => {
                  setPickupPin(ll);
                  if (hint && !pickup.address) {
                    setPickup((p) => ({ ...p, address: hint }));
                  }
                }}
              />
            </CardContent>
          </Card>
        )}

        {/* ---- STEP: drop ---- */}
        {step === 'drop' && (
          <Card>
            <CardContent className="pt-4 space-y-3">
              <SectionLabel n={2} title="Where are we dropping off?" />
              <TransportPinPicker
                role="drop"
                value={dropPin}
                initialCenter={pickupPin || undefined}
                onChange={(ll, hint) => {
                  setDropPin(ll);
                  if (hint && !drop.address) {
                    setDrop((p) => ({ ...p, address: hint }));
                  }
                }}
              />
            </CardContent>
          </Card>
        )}

        {/* ---- STEP: vehicle ---- */}
        {step === 'vehicle' && (
          <Card>
            <CardContent className="pt-4 space-y-3">
              <SectionLabel n={3} title="Pick a vehicle" />
              <VehicleSelector
                pickup={pickupPin}
                drop={dropPin}
                value={vehicleId}
                onChange={(id, q) => {
                  setVehicleId(id);
                  setVehicleQuote(q);
                }}
              />
            </CardContent>
          </Card>
        )}

        {/* ---- STEP: contacts ---- */}
        {step === 'contacts' && (
          <Card>
            <CardContent className="pt-4 space-y-5">
              <SectionLabel n={4} title="Pickup & drop contacts" />

              <PartyForm
                title="Pickup contact"
                emoji="📦"
                value={pickup}
                onChange={setPickup}
              />
              <PartyForm
                title="Drop contact"
                emoji="🎯"
                value={drop}
                onChange={setDrop}
              />

              <div className="space-y-2">
                <Label htmlFor="weight">Estimated weight (kg, optional)</Label>
                <Input
                  id="weight"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.1"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="e.g. 50"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes for the driver (optional)</Label>
                <Textarea
                  id="notes"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Anything they should know? Fragile items, building access, etc."
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* ---- STEP: review ---- */}
        {step === 'review' && (
          <Card>
            <CardContent className="pt-4 space-y-4">
              <SectionLabel n={5} title="Review & confirm" />

              <ReviewLine
                icon="📦"
                label="Pickup"
                title={pickup.name}
                lines={[pickup.address, pickup.phone]}
              />
              <ReviewLine
                icon="🎯"
                label="Drop"
                title={drop.name}
                lines={[drop.address, drop.phone]}
              />
              {vehicleQuote && (
                <ReviewLine
                  icon={vehicleQuote.icon || '🚚'}
                  label="Vehicle"
                  title={vehicleQuote.vehicleName}
                  lines={[
                    `${vehicleQuote.distanceKm} km · up to ${vehicleQuote.maxKg.toLocaleString()} kg`,
                  ]}
                />
              )}
              {weight && <div className="text-xs text-muted-foreground">Est. weight: {weight} kg</div>}
              {notes && <div className="text-xs text-muted-foreground">Notes: {notes}</div>}

              {/* Fare breakdown */}
              {vehicleQuote && (
                <div className="border rounded-md p-3 text-sm space-y-1.5 bg-muted/40">
                  <Row label="Fare" value={`₹${vehicleQuote.fee}`} muted />
                  <Row label="Platform fee" value={`₹${vehicleQuote.platformFee}`} muted />
                  <div className="border-t pt-1.5">
                    <Row label="Total" value={`₹${vehicleQuote.total}`} bold />
                  </div>
                </div>
              )}

              {/* Payment method */}
              <div className="space-y-2">
                <Label>Payment</Label>
                <div className="grid grid-cols-2 gap-2">
                  <PaymentOption
                    selected={paymentMethod === 'cod'}
                    onClick={() => setPaymentMethod('cod')}
                    title="Cash"
                    subtitle="Pay driver on arrival"
                  />
                  <PaymentOption
                    selected={paymentMethod === 'razorpay'}
                    onClick={() => setPaymentMethod('razorpay')}
                    title="Online"
                    subtitle="UPI / card (test)"
                  />
                </div>
              </div>

              {submitError && (
                <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
                  {submitError}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ---- nav buttons ---- */}
        <div className="flex items-center gap-2 pt-1">
          <Button variant="outline" onClick={goBack} disabled={stepIndex === 0 || submitting}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div className="flex-1" />
          {step !== 'review' ? (
            <Button onClick={goNext} disabled={!canProceed()}>
              Next
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button onClick={handleBook} disabled={submitting || !vehicleId}>
              {submitting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              {paymentMethod === 'cod' ? 'Confirm booking' : 'Pay & book'}
            </Button>
          )}
        </div>
      </main>
    </>
  );
}

// =============================================================================

function StepStrip({
  step,
  pickupPin,
  dropPin,
  vehicleId,
}: {
  step: Step;
  pickupPin: LatLng | null;
  dropPin: LatLng | null;
  vehicleId: VehicleId | null;
}) {
  const items: Array<{ id: Step; label: string; icon: typeof MapPin; done: boolean }> = useMemo(
    () => [
      { id: 'pickup', label: 'Pickup', icon: MapPin, done: !!pickupPin },
      { id: 'drop', label: 'Drop', icon: MapPin, done: !!dropPin },
      { id: 'vehicle', label: 'Vehicle', icon: Truck, done: !!vehicleId },
      { id: 'contacts', label: 'Contacts', icon: User, done: false },
      { id: 'review', label: 'Review', icon: IndianRupee, done: false },
    ],
    [pickupPin, dropPin, vehicleId]
  );

  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1">
      {items.map(({ id, label, done }, i) => {
        const active = id === step;
        const past = i < items.findIndex((it) => it.id === step);
        return (
          <div key={id} className="flex items-center shrink-0">
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                active
                  ? 'bg-brand-green text-white'
                  : past || done
                    ? 'bg-brand-greenLight text-brand-green'
                    : 'bg-muted text-muted-foreground'
              }`}
            >
              <span className="h-4 w-4 rounded-full bg-white/30 flex items-center justify-center text-[10px] font-bold">
                {i + 1}
              </span>
              {label}
            </div>
            {i < items.length - 1 && <div className="w-3 h-px bg-muted-foreground/40 mx-0.5" />}
          </div>
        );
      })}
    </div>
  );
}

function SectionLabel({ n, title }: { n: number; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <Badge variant="outline">{n}</Badge>
      <h2 className="text-base font-semibold">{title}</h2>
    </div>
  );
}

function PartyForm({
  title,
  emoji,
  value,
  onChange,
}: {
  title: string;
  emoji: string;
  value: Party;
  onChange: (p: Party) => void;
}) {
  return (
    <div className="space-y-2 border rounded-md p-3 bg-muted/20">
      <div className="text-sm font-medium flex items-center gap-1.5">
        <span aria-hidden>{emoji}</span>
        {title}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Name</Label>
          <Input
            value={value.name}
            onChange={(e) => onChange({ ...value, name: e.target.value })}
            placeholder="Full name"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs flex items-center gap-1">
            <Phone className="h-3 w-3" />
            Phone
          </Label>
          <Input
            type="tel"
            inputMode="tel"
            value={value.phone}
            onChange={(e) => onChange({ ...value, phone: e.target.value })}
            placeholder="10-digit number"
          />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Address</Label>
        <Textarea
          rows={2}
          value={value.address}
          onChange={(e) => onChange({ ...value, address: e.target.value })}
          placeholder="Building, street, landmark"
        />
      </div>
    </div>
  );
}

function ReviewLine({
  icon,
  label,
  title,
  lines,
}: {
  icon: string;
  label: string;
  title: string;
  lines: string[];
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="h-9 w-9 rounded-md bg-muted flex items-center justify-center text-base shrink-0">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="font-medium">{title}</div>
        {lines.filter(Boolean).map((l, i) => (
          <div key={i} className="text-xs text-muted-foreground">
            {l}
          </div>
        ))}
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  muted,
  bold,
}: {
  label: string;
  value: string;
  muted?: boolean;
  bold?: boolean;
}) {
  return (
    <div
      className={`flex justify-between ${muted ? 'text-muted-foreground' : ''} ${
        bold ? 'font-semibold' : ''
      }`}
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function PaymentOption({
  selected,
  onClick,
  title,
  subtitle,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  subtitle: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left border rounded-md p-2.5 transition-all ${
        selected
          ? 'border-brand-green bg-brand-greenLight ring-2 ring-brand-green/40'
          : 'border-input bg-white hover:border-brand-green/60'
      }`}
    >
      <div className="font-medium text-sm flex items-center gap-1.5">
        <Package className="h-3.5 w-3.5" />
        {title}
      </div>
      <div className="text-xs text-muted-foreground">{subtitle}</div>
    </button>
  );
}
