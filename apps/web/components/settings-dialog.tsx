'use client';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Customize your SpellStrike experience</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-3">
            <Label className="text-base font-semibold">Theme</Label>
            <div className="space-y-2">
              {themes.map((t) => (
                <Button
                  key={t.value}
                  variant={theme === t.value ? 'default' : 'outline'}
                  className="w-full justify-start"
                  onClick={() => setTheme(t.value)}
                >
                  <div className="text-left">
                    <div className="font-semibold">{t.label}</div>
                    <div className="text-sm text-muted-foreground">{t.description}</div>
                  </div>
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <Label className="text-base font-semibold">Accessibility</Label>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Colorblind Mode</Label>
                <div className="text-sm text-muted-foreground">High contrast colors</div>
              </div>
              <Switch checked={colorblindMode} onCheckedChange={setColorblindMode} />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Reduced Motion</Label>
                <div className="text-sm text-muted-foreground">Minimize animations</div>
              </div>
              <Switch checked={reducedMotion} onCheckedChange={setReducedMotion} />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
