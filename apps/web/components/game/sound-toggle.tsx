'use client';

import { useState } from 'react';
import { Icon3D } from '@/components/ui/icon3d';
import { isSoundEnabled, setSoundEnabled } from '@/lib/sounds';
import { HEADER_GLYPH, HEADER_INK } from '@/components/ui/page-header';

interface SoundToggleProps {
  accentColor?: string;
  positionClass?: string;
}

// FINISH_SPEC A3 / B4: a right-side game control, the soft 3D speaker drawn
// bare (no circle) at 23 px with the icon squish; `accentColor` is kept for
// callers but no longer tints it.
// B4: sound sits just left of help (home left; sound + help right) — it used
// to share help's corner and cover it.
export function SoundToggle({
  positionClass = 'absolute top-[var(--game-corner-top,0.5rem)] right-[52px] z-10',
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
      className={`${positionClass} hdr-glyph w-11 h-11 flex items-center justify-center`}
    >
      {/* The 3D speaker (docs/ART_SPEC.md §5); muted = grayed with a slash. */}
      <span className="relative flex items-center justify-center" style={{ width: HEADER_GLYPH, height: HEADER_GLYPH }}>
        <Icon3D name="sound" size={HEADER_GLYPH} priority style={enabled ? undefined : { filter: 'grayscale(1)', opacity: 0.5 }} />
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
