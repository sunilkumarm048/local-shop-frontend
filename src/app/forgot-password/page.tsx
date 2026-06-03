'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, ArrowLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { forgotPassword, resetPassword } from '@/lib/auth';
import { ApiError } from '@/lib/api';

/**
 * Two-step password reset:
 *   1. Enter email → we email a 6-digit code.
 *   2. Enter code + new password → password updated, go to login.
 * Works for any account (shop owners with admin-created logins, customers, etc.).
 */
export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function requestCode() {
    setError(null);
    if (!/\S+@\S+\.\S+/.test(email)) return setError('Enter a valid email.');
    setLoading(true);
    try {
      const res = await forgotPassword(email.trim());
      setInfo(res.message || 'If that email is registered, a code has been sent.');
      setStep(2);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Could not send the reset code.'
      );
    } finally {
      setLoading(false);
    }
  }

  async function submitReset() {
    setError(null);
    if (code.trim().length < 4) return setError('Enter the code from your email.');
    if (newPassword.length < 6) return setError('Password must be at least 6 characters.');
    setLoading(true);
    try {
      await resetPassword({ email: email.trim(), code: code.trim(), newPassword });
      router.push('/login?reset=1');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reset password.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm space-y-5">
        <Link
          href="/login"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to login
        </Link>

        <div>
          <h1 className="text-xl font-bold">Reset your password</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {step === 1
              ? "Enter your account email and we'll send a reset code."
              : 'Enter the code from your email and choose a new password.'}
          </p>
        </div>

        {step === 1 ? (
          <div className="space-y-3">
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-11 rounded-lg border px-3"
              autoComplete="email"
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button className="w-full" onClick={requestCode} disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Send reset code
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {info && (
              <p className="text-sm text-muted-foreground bg-muted rounded-md p-2">
                {info}
              </p>
            )}
            <input
              type="text"
              inputMode="numeric"
              placeholder="6-digit code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full h-11 rounded-lg border px-3 tracking-widest"
            />
            <input
              type="password"
              placeholder="New password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full h-11 rounded-lg border px-3"
              autoComplete="new-password"
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button className="w-full" onClick={submitReset} disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Update password
            </Button>
            <button
              onClick={() => setStep(1)}
              className="text-sm text-muted-foreground hover:text-foreground w-full text-center"
            >
              Use a different email
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
  
