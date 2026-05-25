'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Loader2,
  ChevronLeft,
  Wallet,
  IndianRupee,
  Banknote,
  Smartphone,
  Send,
  CheckCircle2,
  XCircle,
  Clock,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/stores/auth';
import { useUser } from '@/hooks/useUser';
import { ApiError } from '@/lib/api';
import {
  fetchDeliveryProfile,
  submitWithdrawal,
  fetchMyWithdrawals,
  type DeliveryProfile,
  type WithdrawRequest,
  type WithdrawStatus,
} from '@/lib/delivery';

const MIN_WITHDRAW = 100;

export default function WalletPage() {
  const router = useRouter();
  const { user } = useUser();
  const token = useAuth((s) => s.token);

  const [hydrated, setHydrated] = useState(false);
  const [profile, setProfile] = useState<DeliveryProfile | null>(null);
  const [requests, setRequests] = useState<WithdrawRequest[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    setHydrated(useAuth.persist.hasHydrated());
    return useAuth.persist.onFinishHydration(() => setHydrated(true));
  }, []);
  useEffect(() => {
    if (hydrated && !token) router.replace('/login?next=/delivery/wallet');
  }, [hydrated, token, router]);
  useEffect(() => {
    if (user && !user.roles.includes('delivery')) router.replace('/customer');
  }, [user, router]);

  const load = useCallback(async () => {
    try {
      const [p, w] = await Promise.all([fetchDeliveryProfile(), fetchMyWithdrawals()]);
      setProfile(p.profile);
      setRequests(w.requests);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Could not load wallet.');
    }
  }, []);

  useEffect(() => {
    if (user?.roles.includes('delivery')) load();
  }, [user, load]);

  if (!hydrated || !token || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Loading…
      </div>
    );
  }
  if (!user.roles.includes('delivery')) return null;

  return (
    <div className="min-h-screen flex flex-col bg-[#f4f4f4]">
      <header className="sticky top-0 z-30 bg-[#1f1f1f] text-white shadow-sm">
        <div className="container flex items-center gap-2 py-3">
          <Link href="/delivery" className="text-white hover:bg-white/10 p-1.5 rounded-md">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <Wallet className="h-5 w-5" />
          <div className="text-sm font-bold">Wallet</div>
        </div>
      </header>

      <main className="flex-1 container py-5 space-y-5">
        {loadError && (
          <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{loadError}</div>
        )}

        {!profile ? (
          <div className="py-12 flex items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Loading balance…
          </div>
        ) : (
          <>
            {/* Balance card */}
            <Card className="bg-brand-green text-white border-none">
              <CardContent className="pt-5 pb-5">
                <div className="text-xs uppercase tracking-wide opacity-80">Available balance</div>
                <div className="text-4xl font-bold flex items-center mt-1">
                  <IndianRupee className="h-7 w-7" />
                  {profile.walletBalance}
                </div>
                <div className="text-xs opacity-80 mt-3 flex gap-4">
                  <span>{profile.totalDeliveries} deliveries</span>
                  <span>Earned ₹{profile.totalEarnings}</span>
                </div>
              </CardContent>
            </Card>

            <WithdrawForm balance={profile.walletBalance} onSubmitted={load} />

            <RequestHistory requests={requests} />
          </>
        )}
      </main>
    </div>
  );
}

// ============================================================

function WithdrawForm({ balance, onSubmitted }: { balance: number; onSubmitted: () => void | Promise<void> }) {
  const [method, setMethod] = useState<'upi' | 'bank'>('upi');
  const [amount, setAmount] = useState<string>('');
  const [upiId, setUpiId] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const amountN = Number(amount);
  const canSubmit =
    !busy &&
    Number.isFinite(amountN) &&
    amountN >= MIN_WITHDRAW &&
    amountN <= balance &&
    (method === 'upi'
      ? upiId.trim().length >= 3
      : accountName.trim().length > 0 &&
        accountNumber.trim().length >= 6 &&
        /^[A-Za-z]{4}0[A-Za-z0-9]{6}$/.test(ifsc.trim()));

  async function submit() {
    setError(null);
    setSuccess(null);
    setBusy(true);
    try {
      await submitWithdrawal({
        amount: amountN,
        method,
        upiId: method === 'upi' ? upiId.trim() : undefined,
        bankDetails:
          method === 'bank'
            ? { accountName: accountName.trim(), accountNumber: accountNumber.trim(), ifsc: ifsc.trim().toUpperCase() }
            : undefined,
      });
      setSuccess('Withdrawal submitted. Admin will process within 24 hours on business days.');
      setAmount('');
      await onSubmitted();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not submit withdrawal.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        <h2 className="text-base font-semibold">Withdraw to your account</h2>
        <p className="text-xs text-muted-foreground">
          Minimum ₹{MIN_WITHDRAW}. Funds are released within 24 hours on business days.
        </p>

        {/* Method toggle */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setMethod('upi')}
            className={`p-3 rounded-md border-2 flex items-center justify-center gap-2 text-sm font-medium transition-colors ${
              method === 'upi' ? 'border-brand-green bg-brand-greenLight/40' : 'border-transparent bg-muted/40'
            }`}
          >
            <Smartphone className="h-4 w-4" />
            UPI
          </button>
          <button
            type="button"
            onClick={() => setMethod('bank')}
            className={`p-3 rounded-md border-2 flex items-center justify-center gap-2 text-sm font-medium transition-colors ${
              method === 'bank' ? 'border-brand-green bg-brand-greenLight/40' : 'border-transparent bg-muted/40'
            }`}
          >
            <Banknote className="h-4 w-4" />
            Bank
          </button>
        </div>

        {/* Amount */}
        <label className="block">
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Amount (₹)</span>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={`Min ${MIN_WITHDRAW}`}
            min={MIN_WITHDRAW}
            max={balance}
            step={1}
            className="mt-1 w-full px-3 py-2 border rounded-md text-base"
          />
          <span className="text-[11px] text-muted-foreground">Max ₹{balance}</span>
        </label>

        {/* Method-specific fields */}
        {method === 'upi' ? (
          <label className="block">
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">UPI ID</span>
            <input
              type="text"
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
              placeholder="yourname@upi"
              className="mt-1 w-full px-3 py-2 border rounded-md text-sm"
            />
          </label>
        ) : (
          <div className="space-y-2">
            <label className="block">
              <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Account holder name</span>
              <input
                type="text"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                className="mt-1 w-full px-3 py-2 border rounded-md text-sm"
              />
            </label>
            <label className="block">
              <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Account number</span>
              <input
                type="text"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                inputMode="numeric"
                className="mt-1 w-full px-3 py-2 border rounded-md text-sm font-mono"
              />
            </label>
            <label className="block">
              <span className="text-[11px] uppercase tracking-wide text-muted-foreground">IFSC</span>
              <input
                type="text"
                value={ifsc}
                onChange={(e) => setIfsc(e.target.value.toUpperCase())}
                placeholder="ABCD0123456"
                className="mt-1 w-full px-3 py-2 border rounded-md text-sm font-mono uppercase"
              />
            </label>
          </div>
        )}

        {error && (
          <div className="text-xs text-destructive bg-destructive/10 rounded px-2 py-1.5">{error}</div>
        )}
        {success && (
          <div className="text-xs text-brand-green bg-brand-greenLight/40 rounded px-2 py-1.5">{success}</div>
        )}

        <Button onClick={submit} disabled={!canSubmit} className="w-full">
          {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
          Submit withdrawal
        </Button>
      </CardContent>
    </Card>
  );
}

// ============================================================

function statusVariant(s: WithdrawStatus): 'default' | 'success' | 'warning' | 'destructive' {
  if (s === 'pending') return 'warning';
  if (s === 'approved') return 'default';
  if (s === 'paid') return 'success';
  return 'destructive';
}

function statusIcon(s: WithdrawStatus) {
  if (s === 'pending') return Clock;
  if (s === 'paid') return CheckCircle2;
  if (s === 'rejected') return XCircle;
  return CheckCircle2;
}

function RequestHistory({ requests }: { requests: WithdrawRequest[] | null }) {
  if (requests === null) {
    return (
      <div className="py-4 flex items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        Loading history…
      </div>
    );
  }
  if (requests.length === 0) return null;

  return (
    <section className="space-y-2">
      <h2 className="text-base font-semibold">Recent requests</h2>
      {requests.map((r) => {
        const Icon = statusIcon(r.status);
        return (
          <Card key={r._id}>
            <CardContent className="pt-3 pb-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold flex items-center">
                    <IndianRupee className="h-4 w-4" />
                    {r.amount}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {r.method === 'upi' ? r.upiId : `A/C ••${r.bankDetails?.accountNumber?.slice(-4)}`}
                  </span>
                </div>
                <Badge variant={statusVariant(r.status)}>{r.status}</Badge>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {new Date(r.createdAt).toLocaleString()}
                {r.transactionRef && ` · Ref: ${r.transactionRef}`}
              </div>
              {r.rejectionReason && (
                <div className="text-xs text-destructive mt-1">{r.rejectionReason}</div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </section>
  );
}
