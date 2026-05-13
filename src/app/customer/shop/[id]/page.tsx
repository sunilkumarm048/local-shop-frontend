'use client';

import { use, useEffect, useState } from 'react';
import { Minus, Plus, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
        <div className="grid sm:grid-cols-2 gap-3">
          {products.map((p) => {
            const inCart = cartItemsByProduct[p._id];
            return (
              <Card key={p._id}>
                <CardContent className="p-4 flex gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{p.name}</div>
                    {p.weight && (
                      <div className="text-xs text-muted-foreground">{p.weight}</div>
                    )}
                    <div className="mt-2 flex items-center gap-2">
                      <span className="font-semibold">₹{p.price}</span>
                      {p.mrp && p.mrp > p.price && (
                        <span className="text-xs text-muted-foreground line-through">
                          ₹{p.mrp}
                        </span>
                      )}
                    </div>
                  </div>

                  {!p.inStock || p.stock === 0 ? (
                    <span className="text-xs text-muted-foreground self-center">
                      Out of stock
                    </span>
                  ) : inCart ? (
                    <div className="flex items-center gap-2 self-center">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => cart.setQty(p._id, inCart.qty - 1)}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="font-medium w-6 text-center">{inCart.qty}</span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => cart.setQty(p._id, inCart.qty + 1)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      className="self-center"
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
                      Add
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </main>
  );
}
