'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2, Truck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Header } from '@/components/layout/header';

import { useCart } from '@/stores/cart';
import { useAuth } from '@/stores/auth';
import { useDeliveryLocation } from '@/stores/deliveryLocation';
import { getCurrentPosition } from '@/lib/geo';
import { fetchQuote, checkout, verifyPayment } from '@/lib/orders';
import { openRazorpayCheckout } from '@/lib/razorpay';
import { ApiError } from '@/lib/api';
import { getCartWeightKg, getRecommendedVehicle, VEHICLE_DISPLAY } from '@/lib/weight';

/**
 * Leaflet touches `window` at import time — dynamic-import with ssr:false.
 * Same pattern as shop/LocationPicker and the front-page modal.
 */
const CheckoutLocationPicker = dynamic(
  () =>
    import('@/components/customer/CheckoutLocationPicker').then((m) => ({
      default: m.CheckoutLocationPicker,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="h-72 rounded-lg border bg-muted flex items-center justify-center text-sm text-muted-foreground">
        Loading map…
      </div>
    ),
  }
);

type Quote = Awaited<ReturnType<typeof fetchQuote>>;

export default function CheckoutPage() {
  const router = useRouter();
  const cart = useCart();
  const user = useAuth((s) => s.user);

  const [recipient, setRecipient] = useState({
    name: '',
    phone: '',
    address: '',
  });
  const [coords, setCoords] = useState<{ lng: number; lat: number } | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [vehicleId, setVehicleId] = useState<'bike' | '3wheeler' | 'tataAce' | 'pickup8ft' | 'tata407'>('bike');
  const [paymentMethod, setPaymentMethod] = useState<'razorpay' | 'cod'>('razorpay');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prefill from user
  useEffect(() => {
    if (user) {
      setRecipient((r) => ({
        ...r,
        name: r.name || user.name || '',
        phone: r.phone || user.phone || '',
      }));
    }
  }, [user]);

  // 8f: Location bootstrap.
  //
  // Priority:
  //   1. Front-page delivery store (For Me / For Someone Else picker)
  //      — most accurate, customer already confirmed it.
  //   2. Fall back to silent browser GPS if the store is empty
  //      — for users who landed straight on /checkout without using the picker.
  //
  // We also pre-fill the recipient's "Flat / building, area" field with the
  // reverse-geocoded address from the store, so customer can just append a
  // flat number rather than typing the whole line.
  const dl = useDeliveryLocation();
  useEffect(() => {
    if (dl.lat != null && dl.lng != null) {
      setCoords({ lat: dl.lat, lng: dl.lng });
      // Only prefill address if customer hasn't typed anything yet
      if (dl.address) {
        setRecipient((r) => ({ ...r, address: r.address || dl.address }));
      }
      return;
    }
    getCurrentPosition().then((c) => {
      if (c) setCoords({ lng: c.longitude, lat: c.latitude });
    });
    // Run once on mount — we don't want to clobber user edits if dl changes later.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 7a: Compute total cart weight and auto-recommend a vehicle.
  // Re-runs whenever items or quantities change. The setter (setVehicleId)
  // is called from inside a useEffect so it doesn't fire on every render.
  const cartWeightKg = getCartWeightKg(
    cart.items.map((i) => ({ qty: i.qty, weight: i.weight }))
  );
  useEffect(() => {
    const recommended = getRecommendedVehicle(cartWeightKg);
    setVehicleId(recommended);
  }, [cartWeightKg]);

  // Re-quote whenever cart, vehicle, or drop changes
  useEffect(() => {
    if (cart.items.length === 0) {
      setQuote(null);
      return;
    }
    fetchQuote({
      items: cart.items.map((i) => ({ productId: i.productId, qty: i.qty })),
      dropLocation: coords || undefined,
      vehicleId,
    })
      .then(setQuote)
      .catch(() => {});
  }, [cart.items, coords, vehicleId]);

  if (cart.items.length === 0) {
    return (
      <>
        <Header />
        <main className="container py-16 text-center space-y-4">
          <h1 className="text-xl font-semibold">Your cart is empty</h1>
          <p className="text-sm text-muted-foreground">Add items from a shop to check out.</p>
          <Button asChild>
            <Link href="/customer">Browse shops</Link>
          </Button>
        </main>
      </>
    );
  }

  const handlePlaceOrder = async () => {
    setError(null);

    if (!user) {
      router.push('/login');
      return;
    }

    if (!coords) {
      setError('Please allow location access so we can calculate delivery.');
      return;
    }
    if (!recipient.name || !recipient.phone || !recipient.address) {
      setError('Please fill in name, phone, and address.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await checkout({
        items: cart.items.map((i) => ({ productId: i.productId, qty: i.qty })),
        recipient: { ...recipient, location: coords },
        vehicleId,
        paymentMethod,
      });

      if (result.payment.method === 'cod') {
        // COD — orders are already placed
        cart.clear();
        router.push(`/orders/${result.orders[0].id}`);
        return;
      }

      // Razorpay flow
      await openRazorpayCheckout({
        key: result.payment.razorpayKeyId,
        amount: result.payment.amount,
        currency: result.payment.currency,
        name: 'Local Shop',
        description: `${result.orders.length} order(s)`,
        order_id: result.payment.razorpayOrderId,
        prefill: {
          name: recipient.name,
          email: user.email,
          contact: recipient.phone,
        },
        theme: { color: '#0C831F' },
        handler: async (response) => {
          try {
            await verifyPayment({
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });
            cart.clear();
            router.push(`/orders/${result.orders[0].id}`);
          } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Payment verification failed');
            setSubmitting(false);
          }
        },
        modal: {
          ondismiss: () => setSubmitting(false),
        },
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not place order');
      setSubmitting(false);
    }
  };

  return (
    <>
      <Header />
      <main className="container py-6 space-y-6 max-w-3xl">
        <Link
          href="/customer"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Continue shopping
        </Link>

        {/* Cart items */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Your cart ({cart.totalItems()} items)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {cart.items.map((item) => (
              <div key={item.productId} className="flex items-center justify-between text-sm">
                <div>
                  <div className="font-medium">{item.name}</div>
                  <div className="text-xs text-muted-foreground">
                    ₹{item.price} × {item.qty}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => cart.setQty(item.productId, item.qty - 1)}
                  >
                    −
                  </Button>
                  <span className="w-6 text-center">{item.qty}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => cart.setQty(item.productId, item.qty + 1)}
                  >
                    +
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Delivery details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Delivery details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="r-name">Recipient name</Label>
              <Input
                id="r-name"
                value={recipient.name}
                onChange={(e) => setRecipient({ ...recipient, name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="r-phone">Phone</Label>
              <Input
                id="r-phone"
                type="tel"
                value={recipient.phone}
                onChange={(e) => setRecipient({ ...recipient, phone: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="r-address">Address</Label>
              <Input
                id="r-address"
                value={recipient.address}
                onChange={(e) => setRecipient({ ...recipient, address: e.target.value })}
                placeholder="Flat / building, area"
              />
            </div>

            {/* Embedded map picker — pre-populated from front-page delivery store */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Delivery location</Label>
                {dl.mode === 'other' && (
                  <span className="text-[10px] font-bold text-primary bg-[#dcf3e1] px-2 py-0.5 rounded-full">
                    🎁 Gift order
                  </span>
                )}
              </div>
              <CheckoutLocationPicker
                lat={coords?.lat ?? null}
                lng={coords?.lng ?? null}
                giftMode={dl.mode === 'other'}
                onChange={({ lat, lng, address }) => {
                  setCoords({ lat, lng });
                  // Only overwrite address if it's still empty (or matches what
                  // we previously auto-filled). Don't clobber a manual edit.
                  if (address && !recipient.address) {
                    setRecipient((r) => ({ ...r, address }));
                  }
                }}
              />
              <p className="text-[11px] text-muted-foreground leading-snug">
                {dl.mode === 'other'
                  ? 'Drag the pin to the recipient\u2019s exact gate or building entrance.'
                  : 'Drag the pin if it isn\u2019t exactly where you want delivery.'}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 7a: Vehicle auto-suggestion banner */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-full bg-brand-greenLight flex items-center justify-center text-xl shrink-0">
                {VEHICLE_DISPLAY[vehicleId]?.icon || '🚚'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  Delivery vehicle
                </div>
                <div className="font-semibold text-sm">{VEHICLE_DISPLAY[vehicleId]?.name || vehicleId}</div>
                <div className="text-xs text-muted-foreground">
                  Auto-selected based on cart weight (~{cartWeightKg.toFixed(2)} kg).
                  {vehicleId !== 'bike' && ' Larger vehicle assigned for heavier loads.'}
                </div>
              </div>
              <Truck className="h-5 w-5 text-muted-foreground shrink-0" />
            </div>
          </CardContent>
        </Card>

        {/* Payment method */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Payment method</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <label className="flex items-center gap-3 p-3 border rounded-md cursor-pointer hover:bg-muted/50">
              <input
                type="radio"
                checked={paymentMethod === 'razorpay'}
                onChange={() => setPaymentMethod('razorpay')}
                className="accent-primary"
              />
              <div>
                <div className="text-sm font-medium">Pay online (Razorpay)</div>
                <div className="text-xs text-muted-foreground">UPI, cards, net banking, wallets</div>
              </div>
            </label>
            <label className="flex items-center gap-3 p-3 border rounded-md cursor-pointer hover:bg-muted/50">
              <input
                type="radio"
                checked={paymentMethod === 'cod'}
                onChange={() => setPaymentMethod('cod')}
                className="accent-primary"
              />
              <div>
                <div className="text-sm font-medium">Cash on delivery</div>
                <div className="text-xs text-muted-foreground">Pay when your order arrives</div>
              </div>
            </label>
          </CardContent>
        </Card>

        {/* Quote breakdown */}
        {quote && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Bill summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {quote.quotes.map((q) => (
                <div key={q.shopId} className="space-y-1 pb-3 border-b last:border-0 last:pb-0">
                  <div className="font-medium">{q.shopName}</div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal</span>
                    <span>₹{q.subtotal}</span>
                  </div>
                  {q.discount.amount > 0 && (
                    <div className="flex justify-between text-primary">
                      <span>Discount ({q.discount.label || 'applied'})</span>
                      <span>−₹{q.discount.amount}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-muted-foreground">
                    <span>
                      Delivery
                      {q.distanceKm != null && (
                        <span className="text-xs"> ({q.distanceKm} km)</span>
                      )}
                    </span>
                    <span>₹{q.deliveryFee}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Handling + platform fee</span>
                    <span>₹{q.handlingFee + q.platformFee}</span>
                  </div>
                  <div className="flex justify-between font-medium pt-1">
                    <span>Subtotal for {q.shopName}</span>
                    <span>₹{q.total}</span>
                  </div>
                </div>
              ))}
              <div className="flex justify-between text-base font-semibold pt-2">
                <span>Grand total</span>
                <span>₹{quote.grandTotal}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {error && (
          <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
            {error}
          </div>
        )}

        <Button onClick={handlePlaceOrder} disabled={submitting} className="w-full" size="lg">
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {paymentMethod === 'cod'
            ? `Place order · ₹${quote?.grandTotal ?? cart.totalAmount()}`
            : `Pay ₹${quote?.grandTotal ?? cart.totalAmount()}`}
        </Button>
      </main>
    </>
  );
}
