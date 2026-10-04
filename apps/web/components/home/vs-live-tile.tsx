'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { Icon3D } from '@/components/ui/icon3d';
import type { HomeCard } from './mode-chrome';
import { MODE_CARD, ModeCardBand, TitleLineSlot, modeCardSurface } from './mode-card';
import { CandyButton } from '@/components/ui/candy-button';
import { CastButton } from '@/components/ui/cast-button';
import { ART_SIZE, artSrc } from '@/lib/art';
import { botArt, botOfDayPersona } from '@/lib/bot/bot-personas';

// VS Battle on Home (founder + JP, 2026-09-26; FINISH_SPEC O2, 10-02): same
// place, same data, no drastic change — the VS card as a teal-tinted Home game
// card with its top bar (docs/ART_SPEC.md §21.5). Left: the W-vs-S faceoff art
// as a small hero (~40% of the card, the two characters and the bolt). Right:
// "LIVE · N players online" with the pulsing green dot, today's status line
// (the W / L badge on the title line, §21.1), a small "Bot of the day" line
// with that day's cast bot, and two candy buttons — PLAY (teal, primary) and
// INVITE (peach, Pro, as before). The VS BATTLE section title sits above it
// (app/page.tsx, O1).

interface Props {
  card: HomeCard;
  /** null while the presence endpoint has not answered yet. */
  livePlayerCount: number | null;
  /** Today's daily VS result: true won, false lost, null not played (Daily mode only). */
  vsDailyWon: boolean | null;
  playMode: 'daily' | 'unlimited';
  isPro: boolean;
  onOpen: () => void;
  onInvite: () => void;
}

const FACEOFF = 'art-scene-vs-faceoff' as const;

export function VSLiveTile({ card, livePlayerCount, vsDailyWon, playMode, isPro, onOpen, onInvite }: Props) {
  const accent = card.accentColor;
  const done = playMode === 'daily' && vsDailyWon !== null;
  const countText = livePlayerCount === null
    ? 'Players online'
    : `${livePlayerCount.toLocaleString()} ${livePlayerCount === 1 ? 'player' : 'players'} online`;
  const subtitle = done
    ? (vsDailyWon ? 'Battle won!' : "Today's battle lost")
    : playMode === 'daily' ? "Today's shared battle" : card.desc;
  // Today's Bot of the Day (UTC-seeded, D2), read after mount so the server and client agree.
  const [bot, setBot] = useState<{ id: string; name: string } | null>(null);
  useEffect(() => {
    const p = botOfDayPersona(new Date().toISOString().slice(0, 10));
    setBot({ id: p.id, name: p.name });
  }, []);
  const [fw, fh] = ART_SIZE[FACEOFF];

  return (
    // §21.5: the Home game cards' exact treatment (surface, radius, border,
    // shadow, inner padding, 10 px top band) in the VS accent.
    <div
      data-squish="card"
      className="relative w-full shrink-0 overflow-hidden"
      style={modeCardSurface(accent, { done })}
      role="group"
      aria-label="VS Battle"
    >
      <ModeCardBand accent={accent} />
      {/* BJ7: the text column top-aligned beside the faceoff. */}
      <div className="flex items-start gap-2.5" style={{ padding: `${MODE_CARD.padY}px ${MODE_CARD.padX}px` }}>
        <button type="button" onClick={onOpen} className="shrink-0 block" style={{ width: '40%', maxWidth: 170 }} aria-label="Open VS Battle">
          <Image
            src={artSrc(FACEOFF)}
            alt=""
            aria-hidden
            width={fw}
            height={fh}
            sizes="170px"
            draggable={false}
            className="block w-full h-auto pointer-events-none select-none"
            style={{ aspectRatio: `${fw} / ${fh}`, filter: 'drop-shadow(0 4px 6px rgba(15, 118, 110, 0.2))' }}
          />
        </button>
        <div className="flex-1 min-w-0 flex flex-col gap-1">
          <button type="button" onClick={onOpen} className="min-w-0 text-left" aria-label={`VS Battle: ${countText}. ${subtitle}`}>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse shrink-0" aria-hidden="true" />
              <span className="text-[10px] font-black" style={{ color: 'var(--color-text)' }}>LIVE</span>
              <span className="text-[10px] font-bold truncate" style={{ color: 'var(--color-text-muted)' }}>· {countText}</span>
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              <div className="flex-1 min-w-0 truncate text-[13px] font-black leading-tight" style={{ color: 'var(--color-text)' }}>{subtitle}</div>
              {done && (
                <TitleLineSlot line={16}>
                  <Icon3D name={vsDailyWon ? 'badge-w' : 'badge-l'} size={MODE_CARD.badge} label={vsDailyWon ? 'Won' : 'Lost'} />
                </TitleLineSlot>
              )}
            </div>
            {bot && (
              <div className="flex items-center gap-1 mt-0.5 text-[10px] font-bold truncate" style={{ color: 'var(--color-text-muted)' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={botArt(bot.id, 'ready')} alt="" aria-hidden="true" loading="lazy" decoding="async" width={18} height={18} className="shrink-0" style={{ width: 18, height: 18 }} />
                <span className="truncate">Bot of the day: {bot.name}</span>
              </div>
            )}
          </button>
          <div className="flex items-center gap-2 mt-0.5">
            <CastButton screen="blue" size="sm" color="teal" icon="play" onClick={onOpen}>Play</CastButton>
            {isPro && (
              <CandyButton size="sm" color="peach" onClick={onInvite} icon={<Icon3D name="add-friend" size={16} />}>
                Invite
              </CandyButton>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
