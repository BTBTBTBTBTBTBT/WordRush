'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase-client';
import { PUSH_CATEGORIES, type PushCategory } from '@/components/friends/notification-prefs';
import { SETTINGS_ACCENT, SettingsSection, SettingsToggle } from './settings-kit';

// Settings → Notifications (docs/FINISH_SPEC.md C4b): the same per-event
// toggles the Friends bell used (components/friends/notification-prefs.tsx,
// PUSH_CATEGORIES), moved into Settings now that the bell is gone from the
// Friends header. Same storage: profiles.notification_prefs (jsonb; a missing
// key means ON), honored server-side by lib/push/broadcast.ts. Friend requests
// always arrive — they are not a category here.

export function NotificationSettings() {
  const { profile, refreshProfile } = useAuth();
  const [saving, setSaving] = useState<string | null>(null);
  if (!profile) return null;
  const prefs = ((profile as { notification_prefs?: Record<string, boolean> } | null)?.notification_prefs) ?? {};

  const toggle = async (key: PushCategory) => {
    if (saving) return;
    setSaving(key);
    const next = { ...prefs, [key]: prefs[key] === false };
    try {
      await (supabase as any).from('profiles').update({ notification_prefs: next }).eq('id', profile.id);
      await refreshProfile();
    } finally {
      setSaving(null);
    }
  };

  const accent = SETTINGS_ACCENT.notifications;
  return (
    <SettingsSection title="Notifications" accent={accent}>
      <p className="text-[10px] font-bold px-1" style={{ color: 'var(--color-text-muted)' }}>Friends notifications</p>
      <div className="space-y-1.5">
        {PUSH_CATEGORIES.map((c) => (
          <SettingsToggle
            key={c.key}
            label={c.label}
            description={c.hint}
            checked={prefs[c.key] !== false}
            onCheckedChange={() => toggle(c.key)}
            accent={accent}
            disabled={saving !== null}
            dim={saving === c.key}
          />
        ))}
      </div>
      <p className="text-[10px] font-bold px-1" style={{ color: 'var(--color-text-muted)' }}>Friend requests always come through.</p>
    </SettingsSection>
  );
}
