'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Search, Ban, ShieldOff, Mail, Phone } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ApiError } from '@/lib/api';
import { fetchAdminUsers, blockUser, type AdminUser } from '@/lib/admin';

type RoleFilter = '' | 'customer' | 'shop' | 'delivery' | 'admin';

export function AdminUsersTab({ currentUserId }: { currentUserId: string }) {
  const [role, setRole] = useState<RoleFilter>('');
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Debounce search input — avoids hitting the API on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  const refresh = useCallback(async () => {
    try {
      const r = await fetchAdminUsers({
        role: role || undefined,
        q: debouncedQ || undefined,
      });
      setUsers(r.users);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Could not load users.');
    }
  }, [role, debouncedQ]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Users</h2>
        <p className="text-sm text-muted-foreground">
          {users ? `${users.length} user${users.length === 1 ? '' : 's'}` : 'Loading…'}
        </p>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or phone…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as RoleFilter)}
          className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">All roles</option>
          <option value="customer">Customer</option>
          <option value="shop">Shop owner</option>
          <option value="delivery">Delivery partner</option>
          <option value="admin">Admin</option>
        </select>
      </div>

      {loadError && (
        <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
          {loadError}
        </div>
      )}

      {users === null ? (
        <div className="py-10 flex items-center justify-center text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          Loading…
        </div>
      ) : users.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No users match.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {users.map((u) => (
            <UserRow
              key={u._id}
              user={u}
              isSelf={u._id === currentUserId}
              onChanged={refresh}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function UserRow({
  user,
  isSelf,
  onChanged,
}: {
  user: AdminUser;
  isSelf: boolean;
  onChanged: () => void | Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggleBlock() {
    setBusy(true);
    setError(null);
    try {
      await blockUser(user._id, !user.isBlocked);
      await onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Action failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardContent className="py-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium">{user.name || 'Unnamed'}</span>
              {isSelf && <Badge variant="outline">You</Badge>}
              {user.isBlocked && <Badge variant="destructive">Blocked</Badge>}
              {user.roles.map((r) => (
                <Badge
                  key={r}
                  variant={r === 'admin' ? 'default' : r === 'shop' ? 'warning' : 'secondary'}
                >
                  {r}
                </Badge>
              ))}
            </div>
            <div className="text-xs text-muted-foreground mt-1 flex flex-wrap items-center gap-3">
              {user.email && (
                <span className="flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  {user.email}
                </span>
              )}
              {user.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {user.phone}
                </span>
              )}
              <span>Joined {new Date(user.createdAt).toLocaleDateString()}</span>
            </div>
            {error && <p className="text-xs text-destructive mt-1">{error}</p>}
          </div>
          {!isSelf && (
            <Button
              size="sm"
              variant={user.isBlocked ? 'default' : 'outline'}
              className={user.isBlocked ? '' : 'text-destructive hover:text-destructive'}
              onClick={toggleBlock}
              disabled={busy}
            >
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : user.isBlocked ? (
                <ShieldOff className="h-3.5 w-3.5 mr-1.5" />
              ) : (
                <Ban className="h-3.5 w-3.5 mr-1.5" />
              )}
              {user.isBlocked ? 'Unblock' : 'Block'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
