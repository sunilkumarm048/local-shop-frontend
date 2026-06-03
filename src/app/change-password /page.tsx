'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { changePassword } from '@/lib/auth';
import { useAuth } from '@/stores/auth';
import { ApiError } from '@/lib/api';

/**
 * Forced/optional password change. Admin-created shop accounts land here on
 * first login (mustChangePassword=true) and can't reach their dashboard until
 * they set their own password. After success we route the user to the right
 * dashboard by role.
 */
export default function ChangePasswordPage() {
  const router = useRouter();
  const user = useAuth((s) => s.user);

  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function dashboardForRoles(roles: string[] = []) {
    if (roles.includes('admin')) return '/admin';
    if (roles.includes('shop')) return '/shop';
    if (roles.includes('delivery')) return '/delivery';
    return '/customer';
  }

  async function submit() {
    setError(null);
    if (pw.length < 6) return setError('Password must be at least 6 characters.');
    if (pw !== confirm) return setError('Passwords do not match.');
    setSaving(true);
    try {
      await changePassword(pw);
      router.push(dashboardForRoles(user?.roles));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update password.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-4">
        <div className="text-center">
          <h1 className="text-xl font-bold">Set your password</h1>
          <p className="text-sm text-muted-foreground mt-1">
            For your security, please choose your own password to continue.
          </p>
        </div>

        <div className="space-y-3">
          <input
            type="password"
            placeholder="New password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            className="w-full border rounded-lg px-3 py-2.5 text-sm"
          />
          <input
            type="password"
            placeholder="Confirm new password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full border rounded-lg px-3 py-2.5 text-sm"
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button onClick={submit} disabled={saving} className="w-full">
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Set password & continue
          </Button>
        </div>
      </div>
    </main>
  );
}
