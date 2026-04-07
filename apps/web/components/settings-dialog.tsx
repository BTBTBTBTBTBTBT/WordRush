'use client';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { useTheme, Theme } from '@/lib/theme-context';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { theme, setTheme, colorblindMode, setColorblindMode, reducedMotion, setReducedMotion } = useTheme();

  const themes: { value: Theme; label: string; description: string }[] = [
    { value: 'default', label: 'Default', description: 'Classic Wordle colors' },
    { value: 'ocean', label: 'Ocean', description: 'Blue and teal tones' },
    { value: 'forest', label: 'Forest', description: 'Green and earth tones' }
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md border"
        style={{ background: '#13102a', borderColor: 'rgba(255,255,255,0.08)' }}
      >
        <DialogHeader>
          <DialogTitle className="text-white font-black">Settings</DialogTitle>
          <DialogDescription style={{ color: 'rgba(255,255,255,0.4)' }} className="text-xs font-bold">
            Customize your SpellStrike experience
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
                    background: theme === t.value ? 'rgba(167,139,250,0.15)' : 'rgba(255,255,255,0.04)',
                    border: theme === t.value ? '1px solid rgba(167,139,250,0.3)' : '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  <div className="text-white font-extrabold text-xs">{t.label}</div>
                  <div className="text-[10px] font-bold" style={{ color: 'rgba(255,255,255,0.4)' }}>{t.description}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="section-header">ACCESSIBILITY</div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-white text-xs font-extrabold">Colorblind Mode</div>
                <div className="text-[10px] font-bold" style={{ color: 'rgba(255,255,255,0.4)' }}>High contrast colors</div>
              </div>
              <Switch checked={colorblindMode} onCheckedChange={setColorblindMode} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-white text-xs font-extrabold">Reduced Motion</div>
                <div className="text-[10px] font-bold" style={{ color: 'rgba(255,255,255,0.4)' }}>Minimize animations</div>
              </div>
              <Switch checked={reducedMotion} onCheckedChange={setReducedMotion} />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
