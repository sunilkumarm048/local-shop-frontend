'use client';

/**
 * AdminDataTab — raw-but-safe database manager.
 *
 * Browse whitelisted collections → search → open a record → edit its JSON →
 * Save, or Delete with a typed confirmation (the server independently
 * verifies the typed text and cascades related data). Sensitive fields never
 * reach this screen.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  Database,
  Search,
  Loader2,
  Trash2,
  Save,
  X,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/stores/auth';

interface CollectionInfo {
  id: string;
  label: string;
  count: number;
}
interface Row {
  _id: string;
  title: string;
  createdAt?: string;
  doc: Record<string, unknown>;
}

const token = () => useAuth.getState().token || undefined;

export function AdminDataTab() {
  const [collections, setCollections] = useState<CollectionInfo[]>([]);
  const [active, setActive] = useState<string>('');
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // editor state
  const [editing, setEditing] = useState<Row | null>(null);
  const [jsonText, setJsonText] = useState('');
  const [saveBusy, setSaveBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    api<{ collections: CollectionInfo[] }>('/admin/data/collections', { token: token() })
      .then((r) => {
        setCollections(r.collections);
        if (r.collections[0]) setActive(r.collections[0].id);
      })
      .catch(() => setError('Could not load collections.'));
  }, []);

  const load = useCallback(
    async (col = active, p = page, q = search) => {
      if (!col) return;
      setLoading(true);
      setError(null);
      try {
        const r = await api<{ rows: Row[]; total: number; pages: number; page: number }>(
          `/admin/data/${col}?page=${p}&search=${encodeURIComponent(q)}`,
          { token: token() }
        );
        setRows(r.rows);
        setTotal(r.total);
        setPages(r.pages || 1);
        setPage(r.page);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Failed to load.');
      } finally {
        setLoading(false);
      }
    },
    [active, page, search]
  );

  useEffect(() => {
    if (active) {
      setPage(1);
      setSearch('');
      load(active, 1, '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  function openEditor(row: Row) {
    setEditing(row);
    setNotice(null);
    setConfirmDelete(false);
    setConfirmText('');
    // Show everything except housekeeping fields; edits are sent as-is.
    const { _id, createdAt, updatedAt, ...editable } = row.doc as Record<string, unknown> & {
      _id?: unknown;
      createdAt?: unknown;
      updatedAt?: unknown;
    };
    void _id;
    void createdAt;
    void updatedAt;
    setJsonText(JSON.stringify(editable, null, 2));
  }

  async function saveEdits() {
    if (!editing) return;
    setSaveBusy(true);
    setNotice(null);
    try {
      const parsed = JSON.parse(jsonText) as Record<string, unknown>;
      await api(`/admin/data/${active}/${editing._id}`, {
        method: 'PATCH',
        token: token(),
        body: { set: parsed },
      });
      setNotice('Saved ✓');
      load();
    } catch (e) {
      if (e instanceof SyntaxError) setNotice('Invalid JSON — check commas and quotes.');
      else setNotice(e instanceof ApiError ? e.message : 'Save failed.');
    } finally {
      setSaveBusy(false);
    }
  }

  async function doDelete() {
    if (!editing) return;
    setSaveBusy(true);
    setNotice(null);
    try {
      await api(`/admin/data/${active}/${editing._id}`, {
        method: 'DELETE',
        token: token(),
        body: { confirmText },
      });
      setEditing(null);
      load();
    } catch (e) {
      setNotice(e instanceof ApiError ? e.message : 'Delete failed.');
    } finally {
      setSaveBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Database className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-bold">Data Manager</h2>
        <span className="text-xs text-muted-foreground">
          Direct database access — edits and deletes are permanent.
        </span>
      </div>

      {/* collection chips */}
      <div className="flex gap-2 flex-wrap">
        {collections.map((c) => (
          <button
            key={c.id}
            onClick={() => setActive(c.id)}
            className={`px-3 py-1.5 rounded-full border text-xs font-semibold ${
              active === c.id
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-card border-border hover:bg-muted'
            }`}
          >
            {c.label} <span className="opacity-70">({c.count})</span>
          </button>
        ))}
      </div>

      {/* search */}
      <div className="flex gap-2 max-w-md">
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load(active, 1, search)}
            placeholder="Search name / email / phone / paste an ID…"
            className="pl-8"
          />
        </div>
        <Button variant="outline" onClick={() => load(active, 1, search)}>
          Search
        </Button>
      </div>

      {error && <div className="text-sm text-red-600">{error}</div>}

      {/* rows */}
      <div className="rounded-xl border border-border divide-y divide-border bg-card">
        {loading ? (
          <div className="p-6 text-center text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Loading…
          </div>
        ) : rows.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">No records.</div>
        ) : (
          rows.map((r) => (
            <button
              key={r._id}
              onClick={() => openEditor(r)}
              className="w-full text-left px-4 py-2.5 hover:bg-muted flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate">{r.title}</div>
                <div className="text-[11px] text-muted-foreground font-mono truncate">{r._id}</div>
              </div>
              <div className="text-[11px] text-muted-foreground shrink-0">
                {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : ''}
              </div>
            </button>
          ))
        )}
      </div>

      {/* pagination */}
      {pages > 1 && (
        <div className="flex items-center gap-3 text-sm">
          <Button
            size="sm"
            variant="outline"
            disabled={page <= 1}
            onClick={() => load(active, page - 1, search)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          Page {page} / {pages} · {total} records
          <Button
            size="sm"
            variant="outline"
            disabled={page >= pages}
            onClick={() => load(active, page + 1, search)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* editor drawer */}
      {editing && (
        <div
          className="fixed inset-0 z-[70] bg-black/50 flex items-end sm:items-center justify-center p-3"
          onClick={() => setEditing(null)}
        >
          <div
            className="bg-card rounded-2xl shadow-xl w-full max-w-2xl p-5 space-y-3 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-bold truncate">{editing.title}</div>
                <div className="text-[11px] font-mono text-muted-foreground">{editing._id}</div>
              </div>
              <button
                onClick={() => setEditing(null)}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <textarea
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              spellCheck={false}
              className="w-full h-72 rounded-lg border border-border bg-background font-mono text-xs p-3 outline-none focus:ring-1 focus:ring-primary"
            />

            {notice && (
              <div
                className={`text-xs font-medium ${notice.startsWith('Saved') ? 'text-brand-green' : 'text-red-600'}`}
              >
                {notice}
              </div>
            )}

            {!confirmDelete ? (
              <div className="flex items-center justify-between gap-2">
                <Button
                  variant="outline"
                  className="text-red-600 border-red-200 hover:bg-red-50"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="h-4 w-4 mr-1.5" /> Delete record…
                </Button>
                <Button onClick={saveEdits} disabled={saveBusy}>
                  {saveBusy ? (
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-1.5" />
                  )}
                  Save changes
                </Button>
              </div>
            ) : (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-2">
                <div className="flex items-center gap-2 text-red-700 font-bold text-sm">
                  <AlertTriangle className="h-4 w-4" /> Permanent delete — step 2 of 2
                </div>
                <p className="text-xs text-red-700">
                  Related data is removed too (a shop&apos;s products, bookings, orders,
                  reviews; a user&apos;s shops and history). Type{' '}
                  <b>{editing.title}</b> to confirm:
                </p>
                <Input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="Type the exact name shown above"
                />
                <div className="flex gap-2 justify-end">
                  <Button size="sm" variant="outline" onClick={() => setConfirmDelete(false)}>
                    Keep it
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={saveBusy || !confirmText.trim()}
                    onClick={doDelete}
                  >
                    {saveBusy && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                    Delete forever
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
