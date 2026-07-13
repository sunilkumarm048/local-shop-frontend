'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Eye, EyeOff } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ApiError } from '@/lib/api';
import { fetchAdminAppConfig, updateAppFlags } from '@/lib/admin';
import type { AppFlags } from '@/lib/config';

/**
 * Platform settings — feature flags that change the customer-facing app
 * instantly (customers pick the flag up on their next page load).
 *
 * Currently just one flag: show/hide the "All Products" feed on the
 * customer home page. The shops strip and individual shop pages are
 * unaffected.
 */

export default function AdminSettingsTab() {
  const [flags, setFlags] = useState<AppFlags | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await fetchAdminAppConfig();
      setFlags(r.flags);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Could not load settings.'
      );
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleAllProducts() {
    if (!flags || saving) return;
    setSaving(true);
    setError(null);
    try {
      const r = await updateAppFlags({ showAllProducts: !flags.showAllProducts });
      setFlags(r.flags);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Could not save. Try again.'
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <h2 className="text-lg font-semibold">Settings</h2>
        <p className="text-xs text-muted-foreground">
          Platform-wide switches. Changes apply to customers on their next
          page load.
        </p>
      </div>

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {!flags ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading settings…
        </div>
      ) : (
        <Card>
          <CardContent className="p-4 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">
                  All Products feed
                </span>
                {flags.showAllProducts ? (
                  <Badge className="bg-[#e6f6ea] text-[#0c831f] hover:bg-[#e6f6ea]">
                    Visible
                  </Badge>
                ) : (
                  <Badge variant="secondary">Hidden</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                The product grid on the customer home page. Hiding it keeps
                the “Shops near you” strip and individual shop pages working
                as normal.
              </p>
            </div>

            <Button
              onClick={toggleAllProducts}
              disabled={saving}
              variant={flags.showAllProducts ? 'outline' : 'default'}
              className="shrink-0"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : flags.showAllProducts ? (
                <>
                  <EyeOff className="h-4 w-4 mr-1.5" /> Hide products
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4 mr-1.5" /> Show products
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
