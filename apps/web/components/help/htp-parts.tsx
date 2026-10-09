'use client';

import { useState } from 'react';
import Image from 'next/image';
import type { FriendlyKind } from '@wordle-duel/core';
import { ArtTitle } from '@/components/ui/art-title';
import { BubbleText } from '@/components/ui/bubble-text';
import { QuietButton } from '@/components/ui/family-button';
import { CandyLink } from '@/components/ui/candy-button';
import { GameHelpCard } from '@/components/help/game-help-card';
import { PocketHelpCard } from '@/components/friends/pocket-help-card';
import type { HTPGame } from '@/lib/how-to-play-content';
import { accentInk, alphaHex } from '@/lib/soft-surface';
import { ART_SIZE, artSrc, gameArtSrc, gameTitleArt, gameTitleArtLabel, type ArtName } from '@/lib/art';
import { MODE_BY_ID } from '@/lib/modes.generated';
import { helpSteps } from '@/lib/help-steps';

// How to Play (item 36): a numbered section head in bubble lettering, and one entry per game —
// icon, title art, a few plain lines, then "Full guide" (the game's guide page) and "Watch how"
// (the same walk-through card its first play opens).

export function HtpSectionHead({ n, title, accent }: { n: number; title: string; accent: string }) {
  return (
    <div className="flex items-center gap-3">
      <span
        aria-hidden="true"
        className="soft-num shrink-0 inline-flex items-center justify-center"
        style={{ width: 42, height: 42, borderRadius: '50%', background: alphaHex(accent, 0.16), color: accent, fontSize: 28, textShadow: 'none' }}
      >
        {n}
      </span>
      <BubbleText text={title.toUpperCase()} accent={accent} maxSize={24} minSize={16} align="left" level={2} className="min-w-0 flex-1" />
    </div>
  );
}

const POCKET_PREFIX = 'pocket-';

export function HtpGameEntry({ game }: { game: HTPGame }) {
  const [watch, setWatch] = useState(false);
  const pocket = game.id.startsWith(POCKET_PREFIX) ? (game.id.slice(POCKET_PREFIX.length) as FriendlyKind) : null;
  const mode = pocket ? null : MODE_BY_ID[game.id];
  const slug = mode?.guideSlug ?? null;
  const icon = pocket ? artSrc(`game-pocket-${pocket}`) : gameArtSrc(game.id);
  const titleArt: ArtName | null = pocket
    ? (ART_SIZE[`art-titlecast-pocket-${pocket}` as ArtName] ? (`art-titlecast-pocket-${pocket}` as ArtName) : null)
    : gameTitleArt(game.id);
  const ink = accentInk(game.accent, game.accent);
  // "Watch how" exists where the game has a walk-through card.
  const canWatch = pocket ? true : !!slug && !!helpSteps(slug);

  return (
    <div className="flex gap-3 items-start">
      {icon && (
        <Image src={icon} alt="" aria-hidden width={256} height={256} sizes="40px" loading="lazy" draggable={false} className="shrink-0" style={{ width: 40, height: 40 }} />
      )}
      <div className="min-w-0 flex-1">
        {titleArt ? (
          <ArtTitle
            name={titleArt}
            label={titleArt.startsWith('art-game-') ? gameTitleArtLabel(titleArt as Parameters<typeof gameTitleArtLabel>[0]) : game.title}
            maxHeight={30} maxWidth={220} align="left" as="h2" priority={false}
          />
        ) : (
          <h3 className={`m-0 font-black leading-snug ${ink.className}`} style={{ ...ink.style, fontSize: 15 }}>{game.title}</h3>
        )}
        <div className="mt-1 flex flex-col gap-1">
          {game.lines.map((l, i) => (
            <p key={i} className="m-0" style={{ fontSize: 14, lineHeight: 1.45, color: 'var(--color-text-secondary)' }}>{l}</p>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {slug && (
            <CandyLink href={`/guides/${slug}`} color="peach" size="sm" aria-label={`Full guide: ${game.title}`}>Full guide</CandyLink>
          )}
          {canWatch && (
            <QuietButton size="sm" icon="play" onClick={() => setWatch(true)} aria-label={`Watch how to play ${game.title}`}>Watch how</QuietButton>
          )}
          {game.id === 'vs' && (
            <CandyLink href="/vs" color="peach" size="sm" aria-label="Open VS Battle">Open VS</CandyLink>
          )}
        </div>
      </div>
      {watch && (pocket
        ? <PocketHelpCard kind={pocket} onClose={() => setWatch(false)} />
        : slug ? <GameHelpCard slug={slug} accent={game.accent} onClose={() => setWatch(false)} /> : null)}
    </div>
  );
}
