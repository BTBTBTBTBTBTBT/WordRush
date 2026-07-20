'use client';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { useTheme, Theme } from '@/lib/theme-context';
import { isSoundEnabled, setSoundEnabled } from '@/lib/sounds';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { theme, setTheme, colorblindMode, setColorblindMode, reducedMotion, setReducedMotion } = useTheme();
  const [soundOn, setSoundOn] = useState(() => isSoundEnabled());

  const themes: { value: Theme; label: string; description: string }[] = [
    { value: 'default', label: 'Default', description: 'Classic Wordle colors' },
    { value: 'dark', label: 'Dark', description: 'Easy on the eyes' },
    { value: 'ocean', label: 'Ocean', description: 'Blue and teal tones' },
    { value: 'forest', label: 'Forest', description: 'Green and earth tones' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md border"
        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
      >
        <DialogHeader>
          <DialogTitle className="font-black text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(135deg, #a78bfa, #ec4899)' }}>Settings</DialogTitle>
          <DialogDescription style={{ color: 'var(--color-text-muted)' }} className="text-xs font-bold">
            Customize your Wordocious experience
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-2">
            <div className="section-header">THEME</div>
            <div className="space-y-1.5">
              {themes.map((t) => (
                <button
                  key={t.value}
                  className="w-full text-left p-3 rounded-xl transition-all"
                  onClick={() => setTheme(t.value)}
                  style={{
                    background: theme === t.value ? 'var(--color-surface-hover)' : 'var(--color-bg)',
                    border: theme === t.value ? '1.5px solid #c4b5fd' : '1.5px solid var(--color-border)',
                  }}
                >
                  <div className="font-extrabold text-xs" style={{ color: 'var(--color-text)' }}>{t.label}</div>
                  <div className="text-[10px] font-bold" style={{ color: 'var(--color-text-muted)' }}>{t.description}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="section-header">SOUND & FEEDBACK</div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-extrabold" style={{ color: 'var(--color-text)' }}>Sound Effects</div>
                <div className="text-[10px] font-bold" style={{ color: 'var(--color-text-muted)' }}>Key taps, win/loss jingles</div>
              </div>
              <Switch checked={soundOn} onCheckedChange={(v) => { setSoundOn(v); setSoundEnabled(v); }} />
            </div>
          </div>

          <div className="space-y-2">
            <div className="section-header">SUBSCRIPTION</div>
            {/* The web can't tell which store a Pro sub was bought in, so link
                both stores' manage pages. When Stripe web billing goes live,
                add a portal row here for web-purchased subs. iOS/Android open
                their own native manage surface from this same settings slot. */}
            <div className="space-y-1.5">
              {[
                { label: 'Manage on App Store', description: 'Subscribed on iPhone or iPad', href: 'https://apps.apple.com/account/subscriptions' },
                { label: 'Manage on Google Play', description: 'Subscribed on Android', href: 'https://play.google.com/store/account/subscriptions?package=com.wordocious.app' },
              ].map((s) => (
                <a
                  key={s.href}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full text-left p-3 rounded-xl transition-all"
                  style={{ background: 'var(--color-bg)', border: '1.5px solid var(--color-border)' }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-extrabold text-xs" style={{ color: 'var(--color-text)' }}>{s.label}</div>
                      <div className="text-[10px] font-bold" style={{ color: 'var(--color-text-muted)' }}>{s.description}</div>
                    </div>
                    <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>›</span>
                  </div>
                </a>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="section-header">ACCESSIBILITY</div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-extrabold" style={{ color: 'var(--color-text)' }}>Colorblind Mode</div>
                <div className="text-[10px] font-bold" style={{ color: 'var(--color-text-muted)' }}>High contrast colors</div>
              </div>
              <Switch checked={colorblindMode} onCheckedChange={setColorblindMode} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-extrabold" style={{ color: 'var(--color-text)' }}>Reduced Motion</div>
                <div className="text-[10px] font-bold" style={{ color: 'var(--color-text-muted)' }}>Minimize animations</div>
              </div>
              <Switch checked={reducedMotion} onCheckedChange={setReducedMotion} />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
