'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2, MapPin } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Header } from '@/components/layout/header';

import { useCart } from '@/stores/cart';
import { useAuth } from '@/stores/auth';
import { getCurrentPosition } from '@/lib/geo';
import { fetchQuote, checkout, verifyPayment } from '@/lib/orders';
import { openRazorpayCheckout } from '@/lib/razorpay';
import { ApiError } from '@/lib/api';

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

  // Try to get drop location
  useEffect(() => {
    getCurrentPosition().then((c) => {
      if (c) setCoords({ lng: c.longitude, lat: c.latitude });
    });
  }, []);

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
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {coords
                ? `Drop pin: ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`
                : 'Waiting for location...'}
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
