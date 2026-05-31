import Link from 'next/link';
import { Button } from '@/components/ui/button';

/**
 * 404 page — shown for unknown routes or when notFound() is called (e.g. a
 * shop id that doesn't exist).
 */
export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-6 gap-4">
      <div className="text-5xl">🔍</div>
      <h1 className="text-xl font-bold">Page not found</h1>
      <p className="text-sm text-muted-foreground max-w-sm">
        The page you’re looking for doesn’t exist or may have moved.
      </p>
      <Button asChild className="mt-2">
        <Link href="/">Back to home</Link>
      </Button>
    </div>
  );
}
