'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { loginWithEmail, sendOtp, verifyOtp } from '@/lib/auth';
import { ApiError } from '@/lib/api';
import { fetchAppFlags } from '@/lib/config';
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton';

type Mode = 'email' | 'phone';

const emailSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password required'),
});

const phoneSchema = z.object({
  phone: z.string().min(10, 'Enter your phone number'),
});

const otpSchema = z.object({
  code: z.string().length(6, 'OTP is 6 digits'),
});

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('email');
  // Admin switch (admin → Settings → "Phone / OTP login"). Defaults off so
  // the phone flow never flashes while the flag loads.
  const [phoneLoginEnabled, setPhoneLoginEnabled] = useState(false);
  useEffect(() => {
    fetchAppFlags().then((f) => setPhoneLoginEnabled(f.enablePhoneLogin));
  }, []);
  useEffect(() => {
    if (!phoneLoginEnabled && mode === 'phone') setMode('email');
  }, [phoneLoginEnabled, mode]);
  const [serverError, setServerError] = useState<string | null>(null);
  const [otpSent, setOtpSent] = useState(false);
  const [pendingPhone, setPendingPhone] = useState('');

  const redirectByRole = (roles: string[]) => {
    if (roles.includes('admin')) router.push('/admin');
    else if (roles.includes('shop')) router.push('/shop');
    else if (roles.includes('delivery')) router.push('/delivery');
    else router.push('/customer');
  };

  // After login: admin-created accounts must set their own password first.
  const routeAfterLogin = (user: { roles: string[]; mustChangePassword?: boolean }) => {
    if (user.mustChangePassword) {
      router.push('/change-password');
    } else {
      redirectByRole(user.roles);
    }
  };

  // ---- Email/password ----

  const emailForm = useForm<z.infer<typeof emailSchema>>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: '', password: '' },
  });

  const onEmailSubmit = emailForm.handleSubmit(async (data) => {
    setServerError(null);
    try {
      const { user } = await loginWithEmail(data.email, data.password);
      routeAfterLogin(user);
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : 'Login failed');
    }
  });

  // ---- Phone OTP ----

  const phoneForm = useForm<z.infer<typeof phoneSchema>>({
    resolver: zodResolver(phoneSchema),
    defaultValues: { phone: '' },
  });

  const otpForm = useForm<z.infer<typeof otpSchema>>({
    resolver: zodResolver(otpSchema),
    defaultValues: { code: '' },
  });

  const onSendOtp = phoneForm.handleSubmit(async (data) => {
    setServerError(null);
    try {
      await sendOtp(data.phone);
      setPendingPhone(data.phone);
      setOtpSent(true);
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : 'Could not send OTP');
    }
  });

  const onVerifyOtp = otpForm.handleSubmit(async (data) => {
    setServerError(null);
    try {
      const { user } = await verifyOtp({ phone: pendingPhone, code: data.code });
      routeAfterLogin(user);
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : 'Verification failed');
    }
  });

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2">
          <CardTitle>Welcome back</CardTitle>
          <CardDescription>Sign in to continue ordering.</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Sign in with Google (only when configured) */}
          {process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID && (
            <>
              <GoogleSignInButton />
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground">or</span>
                <div className="h-px flex-1 bg-border" />
              </div>
            </>
          )}

          {/* Mode toggle — shown only when phone login is enabled in admin Settings */}
          {phoneLoginEnabled && (
          <div className="grid grid-cols-2 gap-2 p-1 bg-muted rounded-md">
            <button
              type="button"
              onClick={() => {
                setMode('email');
                setOtpSent(false);
                setServerError(null);
              }}
              className={`text-sm font-medium py-1.5 rounded ${
                mode === 'email' ? 'bg-background shadow-sm' : 'text-muted-foreground'
              }`}
            >
              Email
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('phone');
                setServerError(null);
              }}
              className={`text-sm font-medium py-1.5 rounded ${
                mode === 'phone' ? 'bg-background shadow-sm' : 'text-muted-foreground'
              }`}
            >
              Phone
            </button>
          </div>
          )}

          {serverError && (
            <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
              {serverError}
            </div>
          )}

          {mode === 'email' && (
            <form onSubmit={onEmailSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" autoComplete="email" {...emailForm.register('email')} />
                {emailForm.formState.errors.email && (
                  <p className="text-xs text-destructive">
                    {emailForm.formState.errors.email.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link
                    href="/forgot-password"
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Forgot password?
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  {...emailForm.register('password')}
                />
                {emailForm.formState.errors.password && (
                  <p className="text-xs text-destructive">
                    {emailForm.formState.errors.password.message}
                  </p>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={emailForm.formState.isSubmitting}>
                {emailForm.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sign in
              </Button>
            </form>
          )}

          {mode === 'phone' && !otpSent && (
            <form onSubmit={onSendOtp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone number</Label>
                <Input
                  id="phone"
                  type="tel"
                  autoComplete="tel"
                  placeholder="10-digit mobile"
                  {...phoneForm.register('phone')}
                />
                {phoneForm.formState.errors.phone && (
                  <p className="text-xs text-destructive">
                    {phoneForm.formState.errors.phone.message}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  We&apos;ll send a 6-digit code. (Dev mode — check the backend console.)
                </p>
              </div>

              <Button type="submit" className="w-full" disabled={phoneForm.formState.isSubmitting}>
                {phoneForm.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Send OTP
              </Button>
            </form>
          )}

          {mode === 'phone' && otpSent && (
            <form onSubmit={onVerifyOtp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code">Enter 6-digit OTP</Label>
                <Input
                  id="code"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  autoComplete="one-time-code"
                  {...otpForm.register('code')}
                />
                {otpForm.formState.errors.code && (
                  <p className="text-xs text-destructive">{otpForm.formState.errors.code.message}</p>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setOtpSent(false);
                    otpForm.reset();
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground underline"
                >
                  Change number
                </button>
              </div>

              <Button type="submit" className="w-full" disabled={otpForm.formState.isSubmitting}>
                {otpForm.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Verify &amp; sign in
              </Button>
            </form>
          )}

          <p className="text-center text-sm text-muted-foreground pt-2">
            New to Sarvopakar?{' '}
            <Link href="/signup" className="text-primary font-medium hover:underline">
              Create an account
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
