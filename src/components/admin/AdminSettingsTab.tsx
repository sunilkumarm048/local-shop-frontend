'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Eye, EyeOff, Smartphone, Mic, MicOff } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ApiError } from '@/lib/api';
import { fetchAdminAppConfig, updateAppFlags } from '@/lib/admin';
import type { AppFlags } from '@/lib/config';

/**
 * Platform settings — feature flags that change the customer-facing app
 * instantly (customers pick the flag up on their next page load).
 */

function FlagRow({
  title,
  description,
  on,
  onLabel,
  offLabel,
  turnOnText,
  turnOffText,
  saving,
  onToggle,
  offIcon,
  onIcon,
}: {
  title: string;
  description: string;
  on: boolean;
  onLabel: string;
  offLabel: string;
  turnOnText: string;
  turnOffText: string;
  saving: boolean;
  onToggle: () => void;
  offIcon: React.ReactNode;
  onIcon: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="p-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">{title}</span>
            {on ? (
              <Badge className="bg-[#e6f6ea] text-[#0c831f] hover:bg-[#e6f6ea]">
                {onLabel}
              </Badge>
            ) : (
              <Badge variant="secondary">{offLabel}</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        </div>

        <Button
          onClick={onToggle}
          disabled={saving}
          variant={on ? 'outline' : 'default'}
          className="shrink-0"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : on ? (
            <>{offIcon} {turnOffText}</>
          ) : (
            <>{onIcon} {turnOnText}</>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

export default function AdminSettingsTab() {
  const [flags, setFlags] = useState<AppFlags | null>(null);
  const [savingKey, setSavingKey] = useState<keyof AppFlags | null>(null);
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

  async function toggle(key: keyof AppFlags) {
    if (!flags || savingKey) return;
    setSavingKey(key);
    setError(null);
    try {
      const r = await updateAppFlags({ [key]: !flags[key] });
      setFlags(r.flags);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Could not save. Try again.'
      );
    } finally {
      setSavingKey(null);
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
        <div className="space-y-3">
          <FlagRow
            title="All Products feed"
            description="The product grid on the customer home page. Hiding it keeps the “Shops near you” strip and individual shop pages working as normal."
            on={flags.showAllProducts}
            onLabel="Visible"
            offLabel="Hidden"
            turnOffText="Hide products"
            turnOnText="Show products"
            saving={savingKey === 'showAllProducts'}
            onToggle={() => toggle('showAllProducts')}
            offIcon={<EyeOff className="h-4 w-4 mr-1.5" />}
            onIcon={<Eye className="h-4 w-4 mr-1.5" />}
          />

          <FlagRow
            title="Phone / OTP login"
            description="The Email/Phone toggle on the sign-in page. Keep this off until a real SMS provider is connected — Google and email login are unaffected."
            on={flags.enablePhoneLogin}
            onLabel="Enabled"
            offLabel="Disabled"
            turnOffText="Disable"
            turnOnText="Enable"
            saving={savingKey === 'enablePhoneLogin'}
            onToggle={() => toggle('enablePhoneLogin')}
            offIcon={<Smartphone className="h-4 w-4 mr-1.5" />}
            onIcon={<Smartphone className="h-4 w-4 mr-1.5" />}
          />

          <FlagRow
            title="AI voice assistant"
            description="The mic button on the customer page — voice shopping and service booking in Odia/Hindi/English. Turn on when you're ready to launch it."
            on={flags.enableVoiceAssistant}
            onLabel="Enabled"
            offLabel="Disabled"
            turnOffText="Disable"
            turnOnText="Enable"
            saving={savingKey === 'enableVoiceAssistant'}
            onToggle={() => toggle('enableVoiceAssistant')}
            offIcon={<MicOff className="h-4 w-4 mr-1.5" />}
            onIcon={<Mic className="h-4 w-4 mr-1.5" />}
          />
        </div>
      )}
    </div>
  );
}
