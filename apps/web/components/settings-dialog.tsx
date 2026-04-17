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
        style={{ background: '#ffffff', borderColor: '#ede9f6' }}
      >
        <DialogHeader>
          <DialogTitle className="font-black" style={{ color: '#1a1a2e' }}>Settings</DialogTitle>
          <DialogDescription style={{ color: '#9ca3af' }} className="text-xs font-bold">
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
                    background: theme === t.value ? '#f3f0ff' : '#f8f7ff',
                    border: theme === t.value ? '1.5px solid #c4b5fd' : '1.5px solid #ede9f6',
                  }}
                >
                  <div className="font-extrabold text-xs" style={{ color: '#1a1a2e' }}>{t.label}</div>
                  <div className="text-[10px] font-bold" style={{ color: '#9ca3af' }}>{t.description}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="section-header">ACCESSIBILITY</div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-extrabold" style={{ color: '#1a1a2e' }}>Colorblind Mode</div>
                <div className="text-[10px] font-bold" style={{ color: '#9ca3af' }}>High contrast colors</div>
              </div>
              <Switch checked={colorblindMode} onCheckedChange={setColorblindMode} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-extrabold" style={{ color: '#1a1a2e' }}>Reduced Motion</div>
                <div className="text-[10px] font-bold" style={{ color: '#9ca3af' }}>Minimize animations</div>
              </div>
              <Switch checked={reducedMotion} onCheckedChange={setReducedMotion} />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
