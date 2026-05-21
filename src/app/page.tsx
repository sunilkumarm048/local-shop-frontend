import Link from 'next/link';
import { Button } from '@/components/ui/button';

/**
 * Public landing page. Routes to whichever role surface fits.
 */
export default function LandingPage() {
  return (
    <main className="container py-16">
      <div className="max-w-2xl mx-auto text-center space-y-6">
        <h1 className="text-4xl font-bold tracking-tight">Local Shop</h1>
        <p className="text-lg text-muted-foreground">
          Hyperlocal grocery + transport, end-to-end. Pick a role to get started.
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-8">
          <Button asChild variant="default">
            <Link href="/customer">Shop near you</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/shop">I run a shop</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/delivery">I deliver</Link>
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
