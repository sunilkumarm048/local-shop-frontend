'use client';

import { use, useEffect, useState } from 'react';
import { Minus, Plus, ArrowLeft, ImageIcon, Zap } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { fetchShop, fetchShopProducts, type Shop, type Product } from '@/lib/shops';
import { useCart } from '@/stores/cart';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ShopDetailPage({ params }: PageProps) {
  const { id } = use(params);

  const [shop, setShop] = useState<Shop | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cart = useCart();

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchShop(id), fetchShopProducts(id)])
      .then(([s, p]) => {
        setShop(s.shop);
        setProducts(p.products);
      })
      .catch((e) => setError(e.message || 'Could not load shop'))
      .finally(() => setLoading(false));
  }, [id]);

  const cartItemsByProduct = Object.fromEntries(cart.items.map((i) => [i.productId, i]));

  if (loading) {
    return (
      <main className="container py-6 space-y-4">
        <div className="h-8 w-48 bg-muted rounded animate-pulse" />
        <div className="grid sm:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      </main>
    );
  }

  if (error || !shop) {
    return (
      <main className="container py-12 text-center">
        <p className="text-destructive">{error || 'Shop not found'}</p>
        <Button asChild variant="link">
          <Link href="/customer">Back to shops</Link>
        </Button>
      </main>
    );
  }

  return (
    <main className="container py-6 space-y-6">
      <Link
        href="/customer"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      <div>
        <h1 className="text-2xl font-bold">{shop.name}</h1>
        {shop.description && (
          <p className="text-sm text-muted-foreground mt-1">{shop.description}</p>
        )}
        <div className="text-xs text-muted-foreground mt-2">
          {shop.address?.city}
          {shop.address?.pincode && ` · ${shop.address.pincode}`}
          {' · '}
          <span className={shop.isOpen ? 'text-primary' : ''}>
            {shop.isOpen ? 'Open now' : 'Closed'}
          </span>
        </div>
      </div>

      {products.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          This shop has not listed any products yet.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {products.map((p) => {
            const inCart = cartItemsByProduct[p._id];
            const isOut = !p.inStock || p.stock === 0;
            const discountPct =
              p.mrp && p.mrp > p.price
                ? Math.round(((p.mrp - p.price) / p.mrp) * 100)
                : 0;

            return (
              <Card key={p._id} className="overflow-hidden flex flex-col">
                {/* Square product image — full card width, like Blinkit/Zepto */}
                <div className="relative aspect-square bg-muted">
                  {discountPct > 0 && (
                    <div className="absolute top-0 left-2 z-10 bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-b">
                      {discountPct}% OFF
                    </div>
                  )}
                  {p.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.image}
                      alt={p.name}
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="h-8 w-8 text-muted-foreground/40" />
                    </div>
                  )}
                </div>

                {/* Card body */}
                <div className="p-2 flex-1 flex flex-col gap-1">
                  {/* Delivery badge */}
                  <div className="inline-flex items-center gap-1 text-[10px] font-semibold text-muted-foreground bg-muted px-1.5 py-0.5 rounded w-fit">
                    <Zap className="h-2.5 w-2.5 fill-current" /> 15 MINS
                  </div>

                  {/* Name */}
                  <div className="text-sm font-medium leading-tight line-clamp-2 min-h-[2.5rem]">
                    {p.name}
                  </div>

                  {/* Weight */}
                  <div className="text-xs text-muted-foreground">
                    {p.weight || '1 unit'}
                  </div>

                  {/* Price + Add row, pinned to bottom */}
                  <div className="flex items-center justify-between gap-2 mt-auto pt-1">
                    <div className="flex flex-col leading-tight">
                      <span className="font-semibold text-sm">₹{p.price}</span>
                      {p.mrp && p.mrp > p.price && (
                        <span className="text-[10px] text-muted-foreground line-through">
                          ₹{p.mrp}
                        </span>
                      )}
                    </div>

                    {isOut ? (
                      <span className="text-[10px] text-muted-foreground font-medium">
                        Out
                      </span>
                    ) : inCart ? (
                      <div className="flex items-center bg-primary text-primary-foreground rounded overflow-hidden">
                        <button
                          aria-label="Decrease quantity"
                          className="w-7 h-7 flex items-center justify-center hover:bg-primary/85 transition"
                          onClick={() => cart.setQty(p._id, inCart.qty - 1)}
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="text-xs font-bold w-5 text-center">
                          {inCart.qty}
                        </span>
                        <button
                          aria-label="Increase quantity"
                          className="w-7 h-7 flex items-center justify-center hover:bg-primary/85 transition"
                          onClick={() => cart.setQty(p._id, inCart.qty + 1)}
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-3 text-xs font-bold tracking-wider border-primary text-primary hover:bg-primary/10 hover:text-primary"
                        onClick={() =>
                          cart.add({
                            productId: p._id,
                            shopId: shop._id,
                            name: p.name,
                            price: p.price,
                            weight: p.weight,
                            image: p.image,
                          })
                        }
                      >
                        ADD
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </main>
  );
}
