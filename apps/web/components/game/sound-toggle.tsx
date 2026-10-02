'use client';

import { useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { isSoundEnabled, setSoundEnabled } from '@/lib/sounds';
import { HEADER_INK, HEADER_SHADOW } from '@/components/ui/page-header';

interface SoundToggleProps {
  accentColor?: string;
  positionClass?: string;
}

// HEADER_SPEC §4: a right-side header action, the same soft white circle as
// every header button; `accentColor` is kept for callers but no longer tints it.
export function SoundToggle({
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
      style={{ background: '#ffffff', boxShadow: HEADER_SHADOW }}
    >
      <Icon className="w-5 h-5" style={{ color: HEADER_INK }} strokeWidth={2.4} />
    </button>
  );
}
