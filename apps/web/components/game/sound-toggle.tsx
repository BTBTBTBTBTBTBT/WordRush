'use client';

import { useState } from 'react';
import { Icon3D } from '@/components/ui/icon3d';
import { isSoundEnabled, setSoundEnabled } from '@/lib/sounds';
import { HEADER_INK, HEADER_SHADOW } from '@/components/ui/page-header';

interface SoundToggleProps {
  accentColor?: string;
  positionClass?: string;
}

// HEADER_SPEC §4: a right-side header action, the same soft white circle as
// every header button; `accentColor` is kept for callers but no longer tints it.
export function SoundToggle({
  positionClass = 'absolute top-[var(--game-corner-top,0.5rem)] right-2 z-10',
}: SoundToggleProps) {
  const [enabled, setEnabled] = useState(() => isSoundEnabled());

  const toggle = () => {
    const next = !enabled;
    setEnabled(next);
    setSoundEnabled(next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={enabled ? 'Mute sounds' : 'Unmute sounds'}
      className={`${positionClass} w-11 h-11 rounded-full flex items-center justify-center transition-transform active:scale-95`}
      style={{ background: '#ffffff', boxShadow: HEADER_SHADOW }}
    >
      {/* The 3D speaker (docs/ART_SPEC.md §5); muted = grayed with a slash. */}
      <span className="relative flex items-center justify-center" style={{ width: 24, height: 24 }}>
        <Icon3D name="sound" size={24} style={enabled ? undefined : { filter: 'grayscale(1)', opacity: 0.5 }} />
        {!enabled && (
          <span
            aria-hidden="true"
            className="absolute rounded-full"
            style={{ width: 26, height: 2.5, background: HEADER_INK, transform: 'rotate(-45deg)' }}
          />
        )}
      </span>
    </button>
  );
}
