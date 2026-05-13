import Link from 'next/link';
import { Button } from '@/components/ui/button';

/**
 * Public landing page. In Phase 3 this becomes the customer home (nearby shops),
 * but for now it's a routing index so all 4 dashboards are reachable.
 */
export default function LandingPage() {
  return (
    <main className="container py-16">
      <div className="max-w-2xl mx-auto text-center space-y-6">
        <h1 className="text-4xl font-bold tracking-tight">Local Shop</h1>
        <p className="text-lg text-muted-foreground">
          Phase 1 scaffold. All four role surfaces are routed but unimplemented.
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-8">
          <Button asChild variant="default">
            <Link href="/customer">Customer</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/shop">Shop owner</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/delivery">Delivery</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin">Admin</Link>
          </Button>
        </div>

        <p className="text-sm text-muted-foreground pt-6">
          Health check:{' '}
          <code className="text-xs bg-muted px-2 py-1 rounded">
            {process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api'}/health
          </code>
        </p>
      </div>
    </main>
  );
}
