'use client';

import { useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { isSoundEnabled, setSoundEnabled } from '@/lib/sounds';

interface SoundToggleProps {
  accentColor?: string;
  positionClass?: string;
}

export function SoundToggle({
  accentColor = '#7c3aed',
  positionClass = 'absolute top-2 right-2 z-10',
}: SoundToggleProps) {
  const [enabled, setEnabled] = useState(() => isSoundEnabled());

  const toggle = () => {
    const next = !enabled;
    setEnabled(next);
    setSoundEnabled(next);
  };

  const Icon = enabled ? Volume2 : VolumeX;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={enabled ? 'Mute sounds' : 'Unmute sounds'}
      className={`${positionClass} w-11 h-11 rounded-full flex items-center justify-center transition-transform active:scale-95`}
      style={{
        background: 'var(--color-surface)',
        border: `2px solid ${accentColor}`,
        boxShadow: `0 2px 0 ${accentColor}33, 0 4px 12px rgba(0,0,0,0.08)`,
      }}
    >
      <Icon className="w-5 h-5" style={{ color: accentColor }} />
    </button>
  );
}
