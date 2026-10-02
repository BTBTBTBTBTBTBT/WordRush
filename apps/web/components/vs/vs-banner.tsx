'use client';

import { Bot, Swords } from 'lucide-react';
import { Icon3D } from '@/components/ui/icon3d';
import {
  vsBannerClockLine, vsBannerHeadline, vsRecordLine, vsSweep, vsTodayStatus,
  type VsDayResult, type WinLoss,
} from '@wordle-duel/core';
import { VS, todayTileLine } from '@/lib/vs-lobby';
import { BannerHost, BANNER_HOST_CLEARANCE } from '@/components/ui/mascot';
import { PAGE_HOSTS } from '@/lib/mascots';

// The VS banner (VS overhaul §1): the home banner's one-window shape in teal.
// A frosted headline strip over TODAY (the Daily Battle and the Bot of the
// Day) and RECORD (people, bots, the ladder). The words come from the shared
// core, so iOS and Android print the same thing; the RECORD sums are the Stats
// page's VS sums. A VS sweep turns the card gold.

interface Props {
  name: string;
  battle: { result: VsDayResult; opponent: string | null };
  botOfDay: { result: VsDayResult; bot: string };
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

function TodayTile({ label, icon: Icon, result, line, onOpen }: {
  label: string; icon: typeof Swords; result: VsDayResult; line: string; onOpen: () => void;
}) {
  const open = result === 'open';
  const won = result === 'won';
  const style: React.CSSProperties = open
    ? { background: 'rgba(255,255,255,0.85)', border: '1.5px dashed rgba(15,118,110,0.45)' }
    : won
    ? { background: VS.ink, boxShadow: '0 0 10px rgba(15,118,110,0.55)' }
    : { background: '#9ca3af' };
  const ink = open ? VS.deep : '#ffffff';
  return (
    <button
      type="button"
      onClick={open ? onOpen : undefined}
      aria-disabled={!open}
      className={`flex-1 min-w-0 flex items-center gap-2 text-left transition-transform ${open ? 'active:scale-[0.97]' : 'cursor-default'}`}
      style={{ borderRadius: 11, padding: '8px 9px', ...style }}
    >
      <span className="flex items-center justify-center shrink-0" style={{ width: 28, height: 28, borderRadius: 8, background: open ? VS.soft : 'rgba(255,255,255,0.22)' }}>
        <Icon style={{ width: 15, height: 15, color: open ? VS.ink : '#ffffff' }} />
      </span>
      <span className="min-w-0">
        <span className="block text-[10px] font-black" style={{ letterSpacing: 0.8, color: ink }}>{label}</span>
        <span className="block text-[11px] font-extrabold truncate" style={{ color: open ? VS.ink : '#ffffff' }}>{line}</span>
      </span>
    </button>
  );
}

export function VsBanner({ name, battle, botOfDay, incoming, streak, people, bots, ladder, free, clock, onBattle, onBotOfDay }: Props) {
  const input = { name, battle: battle.result, botOfDay: botOfDay.result, incomingFrom: incoming?.from ?? null, streak };
  const gold = vsSweep(input);
  const headline = vsBannerHeadline(input);
  const clockLine = vsBannerClockLine(input, clock, { free, challengeLeft: incoming ? `${incoming.hoursLeft}H` : undefined });
  const shimmer = battle.result === 'won' || botOfDay.result === 'won';
  const sheen = 'linear-gradient(135deg, rgba(255,255,255,0.35), rgba(255,255,255,0) 55%)';
  const headInk = gold ? '#78350f' : VS.deep;
  const subInk = gold ? '#92400e' : VS.ink;

  return (
    // The VS host (S) stands at the strip's right end.
    <BannerHost id={PAGE_HOSTS.vs}>
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

      <div className="relative flex flex-col gap-1" style={{ padding: `12px ${BANNER_HOST_CLEARANCE}px 10px 12px`, background: 'rgba(255,255,255,0.5)' }}>
        <div className="flex items-center gap-1.5" style={{ minHeight: 24 }}>
          {gold && <Icon3D name="trophy" size={18} className="shrink-0" />}
          <span className="font-black" style={{ fontSize: 16, letterSpacing: 0.4, lineHeight: 1.2, color: headInk }}>{headline}</span>
        </div>
        <div className="font-extrabold" style={{ fontSize: 10.5, letterSpacing: 0.4, color: subInk }}>{clockLine}</div>
      </div>

      <div className="relative flex flex-col gap-2" style={{ padding: '10px 12px 6px' }}>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-black" style={{ letterSpacing: 1, color: subInk }}>TODAY</span>
          <span className="text-[10px] font-black" style={{ letterSpacing: 0.5, color: subInk }}>{vsTodayStatus(input)}</span>
        </div>
        <div className="flex gap-2">
          <TodayTile
            label="DAILY BATTLE"
            icon={Swords}
            result={battle.result}
            line={todayTileLine(battle.result, battle.opponent, 'Classic', free)}
            onOpen={onBattle}
          />
          <TodayTile
            label="BOT OF THE DAY"
            icon={Bot}
            result={botOfDay.result}
            line={todayTileLine(botOfDay.result, botOfDay.bot, botOfDay.bot, free)}
            onOpen={onBotOfDay}
          />
        </div>
      </div>

      <div className="relative flex items-center gap-1.5" style={{ padding: '6px 12px 12px' }}>
        <span className="text-[10px] font-black shrink-0" style={{ letterSpacing: 1, color: subInk }}>RECORD</span>
        <span className="flex-1 min-w-0 text-[10px] font-black truncate" style={{ letterSpacing: 0.5, color: subInk }}>
          {vsRecordLine(people, bots, ladder)}
        </span>
        {streak > 0 && (
          <span className="flex items-center gap-0.5 text-[12px] font-black shrink-0" style={{ color: '#c2410c' }} aria-label={`${streak} bot wins in a row`}>
            <Icon3D name="flame" size={14} />
            {streak}
          </span>
        )}
      </div>
    </div>
    </BannerHost>
  );
}
