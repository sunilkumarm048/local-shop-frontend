'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  IndianRupee,
  Eye,
  EyeOff,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ApiError } from '@/lib/api';
import {
  fetchAdminTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  type ProductTemplate,
  type TemplatePayload,
} from '@/lib/templates';

/**
 * Admin template management.
 *
 * Lists all templates grouped by their `group` field. Each row supports
 * inline isActive toggle + edit dialog + delete.
 *
 * Adding a brand-new template uses the same dialog. The `group` field is a
 * free-text string — admin can type a new group name to start a new section.
 */
export default function AdminTemplatesTab() {
  const [templates, setTemplates] = useState<ProductTemplate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ProductTemplate | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await fetchAdminTemplates();
      setTemplates(r.templates);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load templates.');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(tpl: ProductTemplate) {
    setEditing(tpl);
    setDialogOpen(true);
  }

  async function toggleActive(tpl: ProductTemplate) {
    try {
      await updateTemplate(tpl._id, { isActive: !tpl.isActive });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Toggle failed.');
    }
  }

  async function remove(tpl: ProductTemplate) {
    if (!confirm(`Permanently delete template "${tpl.name}"?`)) return;
    try {
      await deleteTemplate(tpl._id);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Delete failed.');
    }
  }

  // Group by `group` field, preserve sortOrder within
  const grouped: Record<string, ProductTemplate[]> = {};
  for (const t of templates || []) {
    if (!grouped[t.group]) grouped[t.group] = [];
    grouped[t.group].push(t);
  }
  const groups = Object.keys(grouped).sort();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold">Product catalog templates</h2>
          <p className="text-xs text-muted-foreground">
            Global library that shop owners can clone from. Edit suggested prices, toggle visibility, or remove.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          New template
        </Button>
      </div>

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{error}</div>
      )}

      {templates === null && (
        <div className="py-12 flex items-center justify-center text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          Loading…
        </div>
      )}

      {templates && templates.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No templates yet. Run the seed script or add manually.
          </CardContent>
        </Card>
      )}

      {groups.map((g) => (
        <section key={g} className="space-y-2">
          <h3 className="text-sm font-semibold pl-1">
            {g} <span className="text-xs text-muted-foreground">({grouped[g].length})</span>
          </h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 pl-2">
            {grouped[g].map((tpl) => (
              <Card key={tpl._id} className={tpl.isActive === false ? 'opacity-60' : ''}>
                <CardContent className="pt-3 pb-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">{tpl.name}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                        {tpl.weight && <span>{tpl.weight}</span>}
                        <Badge variant="default" className="text-[10px] flex items-center">
                          <IndianRupee className="h-2.5 w-2.5" />
                          {tpl.suggestedPrice}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" onClick={() => openEdit(tpl)} className="flex-1 h-7 text-xs">
                      <Pencil className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleActive(tpl)}
                      className="h-7 w-7 p-0"
                      title={tpl.isActive === false ? 'Show' : 'Hide'}
                    >
                      {tpl.isActive === false ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => remove(tpl)}
                      className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                      title="Delete"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ))}

      <TemplateDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        template={editing}
        onSaved={async () => {
          setDialogOpen(false);
          await load();
        }}
      />
    </div>
  );
}

// ============================================================

interface DialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  template: ProductTemplate | null;
  onSaved: () => void | Promise<void>;
}

function TemplateDialog({ open, onOpenChange, template, onSaved }: DialogProps) {
  const [name, setName] = useState('');
  const [weight, setWeight] = useState('');
  const [suggestedPrice, setSuggestedPrice] = useState(0);
  const [group, setGroup] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (template) {
      setName(template.name);
      setWeight(template.weight || '');
      setSuggestedPrice(template.suggestedPrice);
      setGroup(template.group);
    } else {
      setName('');
      setWeight('');
      setSuggestedPrice(0);
      setGroup('');
    }
    setError(null);
  }, [open, template]);

  async function save() {
    setError(null);
    if (!name.trim() || !group.trim() || suggestedPrice < 0) {
      setError('Name, group, and a non-negative price are required.');
      return;
    }
    setBusy(true);
    try {
      const payload: TemplatePayload = {
        name: name.trim(),
        weight: weight.trim() || undefined,
        suggestedPrice,
        group: group.trim(),
      };
      if (template) {
        await updateTemplate(template._id, payload);
      } else {
        await createTemplate(payload);
      }
      await onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Save failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{template ? 'Edit template' : 'New template'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label htmlFor="t-name">Name</Label>
            <Input id="t-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Toor Dal" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="t-weight">Weight / unit</Label>
              <Input id="t-weight" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="e.g. 1 kg" />
            </div>
            <div>
              <Label htmlFor="t-price">Suggested ₹</Label>
              <Input
                id="t-price"
                type="number"
                min={0}
                value={suggestedPrice}
                onChange={(e) => setSuggestedPrice(Number(e.target.value))}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="t-group">Group</Label>
            <Input
              id="t-group"
              value={group}
              onChange={(e) => setGroup(e.target.value)}
              placeholder="e.g. Grains, Pulses, Spices…"
            />
          </div>
          {error && (
            <div className="text-xs text-destructive bg-destructive/10 rounded px-2 py-1.5">{error}</div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
