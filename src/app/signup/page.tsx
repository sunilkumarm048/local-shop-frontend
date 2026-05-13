'use client';

import { useState } from 'react';
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
import { registerWithEmail } from '@/lib/auth';
import { ApiError } from '@/lib/api';

const schema = z
  .object({
    name: z.string().trim().min(1, 'Name required'),
    email: z.string().email('Enter a valid email'),
    phone: z.string().trim().min(10).optional().or(z.literal('')),
    password: z.string().min(8, 'At least 8 characters'),
    confirmPassword: z.string(),
    role: z.enum(['customer', 'shop', 'delivery']),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

type FormData = z.infer<typeof schema>;

export default function SignupPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
      role: 'customer',
    },
  });

  const role = form.watch('role');

  const onSubmit = form.handleSubmit(async (data) => {
    setServerError(null);
    try {
      const { user } = await registerWithEmail({
        name: data.name,
        email: data.email,
        phone: data.phone || undefined,
        password: data.password,
        role: data.role,
      });

      if (user.roles.includes('shop')) router.push('/shop');
      else if (user.roles.includes('delivery')) router.push('/delivery');
      else router.push('/customer');
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : 'Signup failed');
    }
  });

  const roleOptions: Array<{ value: FormData['role']; label: string; desc: string }> = [
    { value: 'customer', label: 'Customer', desc: 'Order from nearby shops' },
    { value: 'shop', label: 'Shop owner', desc: 'Sell your products' },
    { value: 'delivery', label: 'Delivery partner', desc: 'Deliver orders, earn money' },
  ];

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2">
          <CardTitle>Create an account</CardTitle>
          <CardDescription>Choose how you&apos;ll use Local Shop.</CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            {/* Role picker */}
            <div className="space-y-2">
              <Label>I want to</Label>
              <div className="grid gap-2">
                {roleOptions.map((opt) => (
                  <label
                    key={opt.value}
                    className={`flex items-start gap-3 rounded-md border p-3 cursor-pointer transition-colors ${
                      role === opt.value
                        ? 'border-primary bg-accent'
                        : 'border-input hover:bg-muted/50'
                    }`}
                  >
                    <input
                      type="radio"
                      value={opt.value}
                      {...form.register('role')}
                      className="mt-1 accent-primary"
                    />
                    <div>
                      <div className="text-sm font-medium">{opt.label}</div>
                      <div className="text-xs text-muted-foreground">{opt.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {serverError && (
              <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
                {serverError}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="name">Full name</Label>
              <Input id="name" {...form.register('name')} />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="email" {...form.register('email')} />
              {form.formState.errors.email && (
                <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">
                Phone <span className="text-muted-foreground text-xs">(optional)</span>
              </Label>
              <Input id="phone" type="tel" autoComplete="tel" {...form.register('phone')} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                {...form.register('password')}
              />
              {form.formState.errors.password && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.password.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm password</Label>
              <Input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                {...form.register('confirmPassword')}
              />
              {form.formState.errors.confirmPassword && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.confirmPassword.message}
                </p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create account
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link href="/login" className="text-primary font-medium hover:underline">
                Sign in
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
