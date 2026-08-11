'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { MailCheck, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { verifySignupEmail, resendVerification } from '@/lib/auth';
import { ApiError } from '@/lib/api';
import type { User } from '@/types';

function routeByRole(user: User, router: ReturnType<typeof useRouter>) {
  if (user.roles.includes('shop')) router.push('/shop');
  else if (user.roles.includes('delivery')) router.push('/delivery');
  else router.push('/customer');
}

function VerifyEmailInner() {
  const router = useRouter();
  const params = useSearchParams();
  const email = params.get('email') || '';

  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function submit() {
    if (code.trim().length !== 6) {
      setError('Enter the 6-digit code from your email.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { user } = await verifySignupEmail(email, code.trim());
      routeByRole(user, router);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Verification failed. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setResent(false);
    setError(null);
    setCooldown(45);
    try {
      await resendVerification(email);
      setResent(true);
    } catch {
      setError('Could not resend right now. Try again in a minute.');
    }
  }

  if (!email) {
    return (
      <div className="container max-w-md py-16 text-center space-y-3">
        <p className="text-sm text-muted-foreground">Missing email. Please sign up again.</p>
        <Button onClick={() => router.push('/signup')}>Go to signup</Button>
      </div>
    );
  }

  return (
    <div className="container max-w-md py-12 space-y-5">
      <div className="text-center space-y-2">
        <div className="w-16 h-16 rounded-full bg-brand-greenLight mx-auto flex items-center justify-center">
          <MailCheck className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-xl font-bold">Check your email</h1>
        <p className="text-sm text-muted-foreground">
          We sent a 6-digit code to <span className="font-semibold text-foreground">{email}</span>.
          Enter it below to activate your account.
        </p>
      </div>

      <Input
        ref={inputRef}
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        inputMode="numeric"
        placeholder="6-digit code"
        className="text-center text-2xl tracking-[0.5em] font-bold h-14"
      />

      {error && <p className="text-sm text-red-600 text-center">{error}</p>}
      {resent && <p className="text-sm text-brand-green text-center">New code sent ✓</p>}

      <Button className="w-full" size="lg" onClick={submit} disabled={busy}>
        {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        Verify &amp; continue
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Didn&apos;t get it? Check spam, or{' '}
        <button
          onClick={resend}
          disabled={cooldown > 0}
          className="font-semibold text-primary disabled:opacity-50 hover:underline"
        >
          {cooldown > 0 ? `resend in ${cooldown}s` : 'resend code'}
        </button>
      </p>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailInner />
    </Suspense>
  );
}
