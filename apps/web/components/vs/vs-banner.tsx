'use client';

import { LiveHeadline } from '@/components/ui/live-headline';
import { Swords } from 'lucide-react';
import { Icon3D } from '@/components/ui/icon3d';
import { SoftNum } from '@/components/ui/soft-number';
import {
  LADDER_BOTS, vsBannerClockLine, vsBannerHeadline, vsRecordLine, vsSweep, vsTodayStatus,
  type VsDayResult, type WinLoss,
} from '@wordle-duel/core';
import { VS, todayTileLine } from '@/lib/vs-lobby';
import { botArt, botPersona } from '@/lib/bot/bot-personas';
import { alphaHex } from '@/lib/soft-surface';
import Image from 'next/image';
import { ART_SIZE, artSrc } from '@/lib/art';
import { BotAvatar, VS_ACCENT } from './vs-ui';

// The VS banner (VS overhaul §1): the home banner's one-window shape in teal.
// A frosted headline strip over TODAY (the Daily Battle and the Bot of the
// Day) and RECORD (people, bots, the ladder). The words come from the shared
// core, so iOS and Android print the same thing; the RECORD sums are the Stats
// page's VS sums, drawn as soft numbers (FINISH_SPEC A2). A VS sweep turns the
// card gold. The Bot of the Day tile shows today's bot character (D2); the
// whole cast faces off across the top (art-scene-vs-faceoff).

interface Props {
  name: string;
  battle: { result: VsDayResult; opponent: string | null };
  botOfDay: { result: VsDayResult; bot: string; botId?: string };
  /** The newest open incoming challenge, if any. */
  incoming: { from: string; hoursLeft: number } | null;
  streak: number;
  people: WinLoss;
  bots: WinLoss;
  /** Ladder rungs cleared; null for free players (hidden). */
  ladder: number | null;
  free: boolean;
  /** HH:MM:SS to the next UTC midnight. */
  clock: string;
  onBattle: () => void;
  onBotOfDay: () => void;
}

function TodayTile({ label, icon, result, line, onOpen }: {
  label: string; icon: React.ReactNode; result: VsDayResult; line: string; onOpen: () => void;
}) {
  const open = result === 'open';
  const won = result === 'won';
  // A1: the open tile takes the VS teal wash (never plain white); won = solid teal, else slate.
  const style: React.CSSProperties = open
    // BJ7: no outline — the wash + top bar carry it.
    ? { background: `linear-gradient(${alphaHex(VS_ACCENT, 0.16)}, ${alphaHex(VS_ACCENT, 0.16)}), #ffffff`, boxShadow: `inset 0 4px 0 ${VS_ACCENT}` }
    : won
    ? { background: VS.ink, boxShadow: '0 0 10px rgba(15,118,110,0.55)' }
    : { background: '#94a3b8' };
  const ink = open ? VS.deep : '#ffffff';
  return (
    <button
      type="button"
      onClick={open ? onOpen : undefined}
      aria-disabled={!open}
      // BJ7: icon + label top-aligned, the line 4 under the label.
      className={`flex-1 min-w-0 flex items-start gap-2 text-left ${open ? '' : 'cursor-default'}`}
      style={{ borderRadius: 12, padding: '9px 9px 7px', ...style }}
    >
      {icon}
      <span className="min-w-0">
        <span className="block text-[10px] font-black" style={{ letterSpacing: 0.8, color: ink }}>{label}</span>
        <span className="block text-[11px] font-extrabold truncate mt-1" style={{ color: open ? VS.ink : '#ffffff' }}>{line}</span>
      </span>
    </button>
  );
}

/** One RECORD figure: a caps label over a soft number (A2). */
function RecordFigure({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <span className="flex flex-col items-center min-w-0">
      <SoftNum size={18}>{value}</SoftNum>
      <span className="text-[9.5px] font-black" style={{ letterSpacing: 0.9, color: VS.ink }}>{label}</span>
    </span>
  );
}

export function VsBanner({ name, battle, botOfDay, incoming, streak, people, bots, ladder, free, clock, onBattle, onBotOfDay }: Props) {
  const input = { name, battle: battle.result, botOfDay: botOfDay.result, incomingFrom: incoming?.from ?? null, streak };
  const gold = vsSweep(input);
  const headline = vsBannerHeadline(input);
  const clockLine = vsBannerClockLine(input, clock, { free, challengeLeft: incoming ? `${incoming.hoursLeft}H` : undefined });
  const shimmer = battle.result === 'won' || botOfDay.result === 'won';
  const sheen = 'linear-gradient(135deg, rgba(255,255,255,0.35), rgba(255,255,255,0) 55%)';
  const subInk = gold ? '#92400e' : VS.ink;

  const [heroW, heroH] = ART_SIZE['art-scene-vs-faceoff'];
  return (
    <div
      className="relative shrink-0 overflow-hidden"
      style={{
        borderRadius: 16,
        background: gold ? `${sheen}, linear-gradient(180deg, #fde68a, #fcd979)` : `${sheen}, linear-gradient(180deg, #d5f5ee, #e0f2fe)`,
        boxShadow: gold ? '0 0 26px rgba(245,158,11,0.8)' : '0 4px 14px rgba(15,118,110,0.10)',
      }}
    >
      {shimmer && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
          <div
            className="absolute"
            style={{
              top: '-20%', left: 0, width: '38%', height: '140%',
              background: 'linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.55), rgba(255,255,255,0))',
              animation: 'banner-shimmer 2.6s ease-in-out 1 both',
            }}
          />
        </div>
      )}

      {/* The VS hero: the cast face off across the top of the card (decorative; it
          replaces the S host that used to stand at the strip's end). */}
      <Image
        src={artSrc('art-scene-vs-faceoff')}
        alt=""
        aria-hidden="true"
        width={heroW}
        height={heroH}
        priority
        draggable={false}
        sizes="(max-width: 448px) 100vw, 448px"
        // BJ7: the faceoff capped at ~120 tall (was the full-width aspect, ~190).
        className="relative block mx-auto h-auto select-none"
        style={{ aspectRatio: `${heroW} / ${heroH}`, width: '100%', maxWidth: Math.round((120 * heroW) / heroH), marginTop: 8 }}
      />
      <div className="relative flex flex-col gap-1" style={{ padding: '10px 12px 10px 12px', background: 'rgba(255,255,255,0.5)' }}>
        <div className="flex items-center gap-1.5" style={{ minHeight: 24 }}>
          {gold && <Icon3D name="trophy" size={18} className="shrink-0" />}
          {/* FINISH_SPEC AR: live lettering (teal → blue; gold on a sweep day). */}
          <LiveHeadline text={headline} palette={gold ? 'celebrate' : 'vs'} names={[name, incoming?.from ?? ''].filter(Boolean)} size={17} align="left" className="flex-1 min-w-0" />
        </div>
        <div className="font-extrabold" style={{ fontSize: 10.5, letterSpacing: 0.4, color: subInk }}>{clockLine}</div>
      </div>

      <div className="relative flex flex-col gap-1.5" style={{ padding: '8px 12px 6px' }}>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-black" style={{ letterSpacing: 1, color: subInk }}>TODAY</span>
          <span className="text-[10px] font-black" style={{ letterSpacing: 0.5, color: subInk }}>{vsTodayStatus(input)}</span>
        </div>
        <div className="flex gap-2">
          <TodayTile
            label="DAILY BATTLE"
            icon={(
              <span className="flex items-center justify-center shrink-0" style={{ width: 30, height: 30, borderRadius: 9, background: battle.result === 'open' ? VS.soft : 'rgba(255,255,255,0.22)' }}>
                <Swords style={{ width: 15, height: 15, color: battle.result === 'open' ? VS.ink : '#ffffff' }} />
              </span>
            )}
            result={battle.result}
            line={todayTileLine(battle.result, battle.opponent, 'Classic', free)}
            onOpen={onBattle}
          />
          <TodayTile
            label="BOT OF THE DAY"
            // Today's bot in character (its own color around it).
            icon={botOfDay.botId ? (
              <BotAvatar src={botArt(botOfDay.botId, 'ready')} accent={botPersona(botOfDay.botId).color} size={32} />
            ) : null}
            result={botOfDay.result}
            line={todayTileLine(botOfDay.result, botOfDay.bot, botOfDay.bot, free)}
            onOpen={onBotOfDay}
          />
        </div>
      </div>

      {/* RECORD — the core words (vsRecordLine, read aloud) as soft numbers. */}
      <div className="relative flex items-center gap-2" style={{ padding: '4px 12px 10px' }} role="group" aria-label={`Record: ${vsRecordLine(people, bots, ladder)}${streak > 0 ? `, ${streak} bot wins in a row` : ''}`}>
        <span className="text-[10px] font-black shrink-0" style={{ letterSpacing: 1, color: subInk }} aria-hidden="true">RECORD</span>
        <span className="flex-1 min-w-0 flex items-center justify-around" aria-hidden="true">
          <RecordFigure label="PEOPLE" value={`${people.wins}–${people.losses}`} />
          <RecordFigure label="BOTS" value={`${bots.wins}–${bots.losses}`} />
          {ladder !== null && (
            <RecordFigure label="LADDER" value={ladder >= LADDER_BOTS.length ? '✓' : `${ladder}/${LADDER_BOTS.length}`} />
          )}
        </span>
        {streak > 0 && (
          <span className="flex items-center gap-0.5 shrink-0" aria-hidden="true">
            <Icon3D name="flame" size={18} />
            <SoftNum size={18}>{streak}</SoftNum>
          </span>
        )}
      </div>
    </div>
  );
}
