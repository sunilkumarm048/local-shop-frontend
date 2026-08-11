'use client';

/**
 * /agent — field-onboarding page for marketing agents.
 *
 * Share this link with your marketing person. First visit asks for the agent
 * access code (set as AGENT_ACCESS_CODE on the server) and their name — both
 * remembered on the device. After that they get the exact same battle-tested
 * Quick Add Shop form the admin panel uses, minus everything else admin.
 * Every shop they create records their name (onboardedBy) for accountability.
 */

import { useEffect, useMemo, useState } from 'react';
import { Store, LogOut, KeyRound, Loader2 } from 'lucide-react';

import AdminQuickAddShopTab from '@/components/admin/AdminQuickAddShopTab';
import {
  getAgentSession,
  saveAgentSession,
  clearAgentSession,
  makeAgentQuickCreate,
  makeAgentSendEmailOtp,
} from '@/lib/agent';
import { ApiError } from '@/lib/api';

export default function AgentPage() {
  const [ready, setReady] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [session, setSession] = useState<{ code: string; name: string } | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const s = getAgentSession();
    if (s.code && s.name) setSession(s);
    setReady(true);
  }, []);

  const submitFn = useMemo(
    () => (session ? makeAgentQuickCreate(session.code, session.name) : undefined),
    [session]
  );
  const sendEmailOtp = useMemo(
    () => (session ? makeAgentSendEmailOtp(session.code) : undefined),
    [session]
  );

  async function enter() {
    const c = code.trim();
    const n = name.trim();
    if (c.length < 4) return setError('Enter the agent code you were given.');
    if (n.length < 2) return setError('Enter your name.');
    setChecking(true);
    setError(null);
    try {
      // Verify the code with a deliberately-invalid create: a 401 means wrong
      // code; a validation (400) error means the code was ACCEPTED.
      await makeAgentQuickCreate(c, n)({
        name: '',
        category: '',
        phone: '',
        ownerEmail: 'invalid',
        ownerPassword: '',
        lat: 0,
        lng: 0,
      });
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setChecking(false);
        return setError('Wrong agent code. Check with the Sarvopakar team.');
      }
      if (e instanceof ApiError && e.status === 503) {
        setChecking(false);
        return setError('Agent onboarding is not enabled yet. Contact the admin.');
      }
      if (!(e instanceof ApiError && e.status === 400)) {
        // Anything other than a validation error (e.g. 404 route missing,
        // network down) means the server side isn't ready — don't let the
        // agent in to hit a wall at save time.
        setChecking(false);
        return setError('Cannot reach the onboarding service. Try again later or contact the admin.');
      }
      // 400 validation error = the code was accepted
    }
    saveAgentSession(c, n);
    setSession({ code: c, name: n });
    setChecking(false);
  }

  if (!ready) return null;

  /* ---------------- gate ---------------- */
  if (!session) {
    return (
      <main className="min-h-screen bg-[#fafafa] flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-6 space-y-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-brand-greenLight text-brand-green flex items-center justify-center">
              <Store className="h-5 w-5" />
            </div>
            <div>
              <div className="font-bold">Sarvopakar Agent</div>
              <div className="text-xs text-muted-foreground">
                Register shops &amp; service providers on the spot
              </div>
            </div>
          </div>

          <label className="block text-xs font-bold">
            Agent code
            <div className="mt-1 flex items-center gap-2 rounded-lg border border-border bg-background px-3">
              <KeyRound className="h-4 w-4 text-muted-foreground" />
              <input
                type="password"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Given by the Sarvopakar team"
                className="w-full py-2.5 bg-transparent outline-none text-sm font-normal"
              />
            </div>
          </label>

          <label className="block text-xs font-bold">
            Your name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Ramesh"
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm font-normal outline-none"
            />
          </label>

          {error && <div className="text-xs text-red-600 font-medium">{error}</div>}

          <button
            type="button"
            onClick={enter}
            disabled={checking}
            className="w-full inline-flex items-center justify-center gap-2 bg-brand-green text-white font-bold text-sm py-2.5 rounded-lg disabled:opacity-50"
          >
            {checking && <Loader2 className="h-4 w-4 animate-spin" />}
            Start onboarding
          </button>
        </div>
      </main>
    );
  }

  /* ---------------- onboarding form ---------------- */
  return (
    <main className="min-h-screen bg-[#fafafa]">
      <header className="bg-[#161200] text-white">
        <div className="container py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 rounded-full bg-white/10 flex items-center justify-center shrink-0">
              <Store className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] text-white/70 truncate">Agent: {session.name}</div>
              <div className="font-bold text-sm">Sarvopakar Onboarding</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              clearAgentSession();
              setSession(null);
              setCode('');
              setName('');
            }}
            className="inline-flex items-center gap-1.5 text-xs text-white/80 hover:text-white"
          >
            <LogOut className="h-3.5 w-3.5" />
            Change agent
          </button>
        </div>
      </header>

      <div className="container py-6 max-w-2xl">
        <AdminQuickAddShopTab submitFn={submitFn} sendEmailOtp={sendEmailOtp} />
      </div>
    </main>
  );
}
