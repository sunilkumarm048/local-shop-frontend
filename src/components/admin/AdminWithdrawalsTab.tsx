'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, IndianRupee, Phone, Mail, CheckCircle2, XCircle, Banknote } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ApiError } from '@/lib/api';
import {
  fetchAdminWithdrawals,
  processWithdrawal,
  type AdminWithdrawRequest,
  type WithdrawStatus,
} from '@/lib/admin';

/**
 * Withdrawals admin tab.
 *
 * Lifecycle: pending → approved (intent to pay) → paid (with transactionRef).
 * Or pending → rejected (with a reason; wallet refunded server-side).
 *
 * Status tabs across the top to switch lists. "Pending" is default.
 */

const STATUS_TABS: Array<{ key: WithdrawStatus | 'all'; label: string }> = [
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'paid', label: 'Paid' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'all', label: 'All' },
];

export default function AdminWithdrawalsTab() {
  const [status, setStatus] = useState<WithdrawStatus | 'all'>('pending');
  const [items, setItems] = useState<AdminWithdrawRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await fetchAdminWithdrawals(status);
      setItems(r.requests);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load withdrawals.');
    }
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Withdrawal requests</h2>
        <p className="text-xs text-muted-foreground">
          Approve to lock in intent. Mark paid once you&apos;ve sent funds — partner gets notified.
        </p>
      </div>

      <div className="flex gap-1 border-b overflow-x-auto">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setStatus(tab.key)}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
              status === tab.key
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{error}</div>
      )}

      {items === null && (
        <div className="py-8 flex items-center justify-center text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          Loading…
        </div>
      )}

      {items && items.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No {status === 'all' ? '' : status} withdrawal requests.
          </CardContent>
        </Card>
      )}

      {items && items.length > 0 && (
        <div className="space-y-3">
          {items.map((req) => (
            <WithdrawCard key={req._id} req={req} onChanged={load} />
          ))}
        </div>
      )}
    </div>
  );
}

function statusVariant(s: WithdrawStatus): 'default' | 'success' | 'warning' | 'destructive' {
  if (s === 'pending') return 'warning';
  if (s === 'approved') return 'default';
  if (s === 'paid') return 'success';
  return 'destructive';
}

function WithdrawCard({ req, onChanged }: { req: AdminWithdrawRequest; onChanged: () => void | Promise<void> }) {
  const [busy, setBusy] = useState<'approve' | 'paid' | 'reject' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [txnRef, setTxnRef] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [showPayForm, setShowPayForm] = useState(false);
  const [showRejectForm, setShowRejectForm] = useState(false);

  const partner = typeof req.deliveryPartner === 'object' ? req.deliveryPartner : null;
  const partnerName = partner?.name || 'Unknown partner';

  async function act(action: 'approve' | 'paid' | 'reject') {
    setError(null);
    if (action === 'paid' && !txnRef.trim()) {
      setError('Enter a transaction reference (UTR / UPI ref / etc).');
      return;
    }
    if (action === 'reject' && !rejectReason.trim()) {
      setError('Provide a rejection reason.');
      return;
    }
    setBusy(action);
    try {
      await processWithdrawal(req._id, {
        action,
        transactionRef: action === 'paid' ? txnRef.trim() : undefined,
        rejectionReason: action === 'reject' ? rejectReason.trim() : undefined,
      });
      await onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Action failed.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <div className="font-semibold">{partnerName}</div>
            {partner?.email && (
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Mail className="h-3 w-3" />
                {partner.email}
              </div>
            )}
            {partner?.phone && (
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {partner.phone}
              </div>
            )}
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold flex items-center justify-end">
              <IndianRupee className="h-5 w-5" />
              {req.amount}
            </div>
            <Badge variant={statusVariant(req.status)} className="mt-1">
              {req.status}
            </Badge>
          </div>
        </div>

        <div className="bg-muted/40 rounded-md p-3 text-sm space-y-1">
          {req.method === 'upi' ? (
            <>
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">UPI</div>
              <div className="font-mono">{req.upiId}</div>
            </>
          ) : (
            <>
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Bank</div>
              <div className="font-medium">{req.bankDetails?.accountName}</div>
              <div className="font-mono text-xs">A/C {req.bankDetails?.accountNumber}</div>
              <div className="font-mono text-xs">IFSC {req.bankDetails?.ifsc}</div>
            </>
          )}
        </div>

        <div className="text-xs text-muted-foreground">
          Requested {new Date(req.createdAt).toLocaleString()}
          {req.processedAt && ` · processed ${new Date(req.processedAt).toLocaleString()}`}
        </div>

        {req.transactionRef && (
          <div className="text-xs">
            <span className="text-muted-foreground">Txn ref: </span>
            <span className="font-mono">{req.transactionRef}</span>
          </div>
        )}
        {req.rejectionReason && (
          <div className="text-xs text-destructive">
            <span className="text-muted-foreground">Rejected: </span>
            {req.rejectionReason}
          </div>
        )}

        {error && (
          <div className="text-xs text-destructive bg-destructive/10 rounded px-2 py-1.5">{error}</div>
        )}

        {/* Actions */}
        {req.status === 'pending' && !showRejectForm && (
          <div className="flex gap-2">
            <Button onClick={() => act('approve')} disabled={busy !== null} className="flex-1">
              {busy === 'approve' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
              Approve
            </Button>
            <Button variant="outline" onClick={() => setShowRejectForm(true)} disabled={busy !== null}>
              <XCircle className="h-4 w-4 mr-2" />
              Reject
            </Button>
          </div>
        )}
        {req.status === 'approved' && !showPayForm && (
          <Button onClick={() => setShowPayForm(true)} className="w-full">
            <Banknote className="h-4 w-4 mr-2" />
            Mark paid
          </Button>
        )}

        {showPayForm && req.status === 'approved' && (
          <div className="space-y-2 bg-muted/30 rounded-md p-3">
            <label className="block text-xs font-medium">Transaction reference</label>
            <input
              type="text"
              value={txnRef}
              onChange={(e) => setTxnRef(e.target.value)}
              placeholder="UTR / UPI ref / cheque #"
              className="w-full px-2.5 py-1.5 border rounded-md text-sm"
            />
            <div className="flex gap-2">
              <Button onClick={() => act('paid')} disabled={busy !== null} size="sm" className="flex-1">
                {busy === 'paid' && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Confirm paid
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowPayForm(false)} disabled={busy !== null}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {showRejectForm && req.status === 'pending' && (
          <div className="space-y-2 bg-muted/30 rounded-md p-3">
            <label className="block text-xs font-medium">Reason for rejection (visible to partner)</label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Bank account mismatch — please update"
              rows={2}
              className="w-full px-2.5 py-1.5 border rounded-md text-sm"
            />
            <div className="flex gap-2">
              <Button onClick={() => act('reject')} disabled={busy !== null} size="sm" variant="destructive" className="flex-1">
                {busy === 'reject' && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Confirm reject (refunds wallet)
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowRejectForm(false)} disabled={busy !== null}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
