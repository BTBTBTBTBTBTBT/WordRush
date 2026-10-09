'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { FIRST_PLAY_FLAG, shouldAutoShowTutorial } from '@wordle-duel/core';
import { useFlags } from '@/hooks/use-flags';
import { useTutorialsSeen } from '@/lib/tutorials-seen';
import { Icon3D } from '@/components/ui/icon3d';
import { GAME_HEADER_GLYPH } from '@/components/ui/page-header';
import { GameHelpCard } from '@/components/help/game-help-card';
import { getGuide } from '@/lib/guide-content';
import { setGuidePaused } from '@/hooks/use-active-play-timer';

interface Props {
  /** Guide slug (matches lib/guide-content.ts): classic, six, quadword, … */
  slug: string;
  accentColor?: string;
  /** Override positioning — defaults to top-right, mirroring GameHomeButton. */
  positionClass?: string;
}

/**
 * In-game "?" button (top-right, mirroring GameHomeButton at top-left). Opens
 * the game's help card (components/help/game-help-card.tsx, FINISH_SPEC AF):
 * 3–4 short steps with tiny tile examples, "Got it", and the
 * full rules / scoring / strategy under a disclosure. Reading it pauses the
 * game clock (setGuidePaused); it closes via Got it, the X, Escape or a
 * backdrop tap.
 */
export function GameGuideButton({
  slug,
  accentColor = '#7c3aed',
  positionClass = 'absolute top-[var(--game-corner-top,0.5rem)] right-2 z-10',
}: Props) {
  const [open, setOpen] = useState(false);
  const guide = getGuide(slug);
  // 2.8 item 12: the first time a player opens this game, the same card opens by itself once
  // ("Let's play!"); closing it records the game as seen (synced). The "?" reopens it any time.
  const { isLive } = useFlags();
  const { seen, mark } = useTutorialsSeen();
  const [firstPlay, setFirstPlay] = useState(false);
  const autoDone = useRef(false);
  useEffect(() => {
    if (autoDone.current || !guide) return;
    if (shouldAutoShowTutorial({ live: isLive(FIRST_PLAY_FLAG), seen, key: slug })) {
      autoDone.current = true;
      setFirstPlay(true);
      setOpen(true);
    }
  }, [seen, isLive, slug, guide]);
  const close = useCallback(() => {
    setOpen(false);
    if (firstPlay) { mark(slug); setFirstPlay(false); }
  }, [firstPlay, mark, slug]);

  // Pause the clock while the guide is open.
  useEffect(() => {
    setGuidePaused(open);
    return () => setGuidePaused(false);
  }, [open]);

  if (!guide) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="How to play"
        aria-haspopup="dialog"
        className={`${positionClass} hdr-glyph w-11 h-11 flex items-center justify-center`}
      >
        <Icon3D name="help" size={GAME_HEADER_GLYPH} priority />
      </button>

      {open && <GameHelpCard slug={slug} accent={accentColor} onClose={close} firstPlay={firstPlay} />}
    </>
  );
}
