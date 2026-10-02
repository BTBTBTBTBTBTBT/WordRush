'use client';

import { Icon3D } from '@/components/ui/icon3d';
import { friendsBannerClockLine, friendsBannerHeadline, type FriendsBannerInput } from '@wordle-duel/core';
import type { FriendProfile } from '@/lib/friends-service';
import type { RaceRow } from '@/lib/todays-race';
import { FR, doingLine } from '@/lib/friends-play';
import { FlameCount, FriendAvatar } from './friends-ui';
import { BannerHost, BANNER_HOST_CLEARANCE } from '@/components/ui/mascot';
import { PAGE_HOSTS } from '@/lib/mascots';

// The Friends banner (Friends overhaul §2.2): the home banner's one-window shape
// in the Friends pink. A frosted strip with the core headline and the clock
// line, then ON NOW (up to five faces, tap → quick play) and TODAY'S RACE (the
// top three chips, tap → the full race in a sheet). Shimmers when anyone is on.

const MEDAL = ['#f59e0b', '#9ca3af', '#b45309'];

interface Props {
  input: FriendsBannerInput;
  clock: string;
  online: FriendProfile[];
  nobodyLine: string;
  chips: RaceRow[];
  streak: { name: string; days: number } | null;
  onFace: (f: FriendProfile) => void;
  onRace: () => void;
  onAddFriend: () => void;
}

export function FriendsBanner({ input, clock, online, nobodyLine, chips, streak, onFace, onRace, onAddFriend }: Props) {
  const headline = friendsBannerHeadline(input);
  const clockLine = friendsBannerClockLine(input, clock);
  const shimmer = online.length > 0;
  const none = input.friendCount === 0;
  const anyPoints = chips.some((c) => c.points > 0);

  return (
    // The Friends host (O1, the cheerleader) stands at the strip's right end.
    <BannerHost id={PAGE_HOSTS.friends}>
    <div
      className="relative shrink-0 overflow-hidden"
      style={{
        borderRadius: 16,
        background: 'linear-gradient(135deg, rgba(255,255,255,0.35), rgba(255,255,255,0) 55%), linear-gradient(180deg, #fce7f3, #ede9fe)',
        boxShadow: '0 4px 14px rgba(131,24,67,0.10)',
      }}
    >
      {shimmer && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
          <div
            className="animate-banner-shimmer absolute"
            style={{ top: '-20%', left: 0, width: '38%', height: '140%', background: 'linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.55), rgba(255,255,255,0))' }}
          />
        </div>
      )}

      <div className="relative flex flex-col gap-1" style={{ padding: `12px ${BANNER_HOST_CLEARANCE}px 10px 12px`, background: 'rgba(255,255,255,0.5)' }}>
        <span className="font-black" style={{ fontSize: 22, letterSpacing: 0.4, lineHeight: 1.15, color: FR.ink, textShadow: '0 0 12px rgba(219,39,119,0.55)' }}>{headline}</span>
        <span className="font-extrabold" style={{ fontSize: 10.5, letterSpacing: 0.4, color: FR.mid }}>{clockLine}</span>
      </div>

      {none ? (
        <div className="relative" style={{ padding: '12px' }}>
          <button
            type="button"
            onClick={onAddFriend}
            className="w-full flex items-center justify-center gap-1.5 py-2.5 text-[13px] font-black text-white rounded-xl transition-transform active:scale-[0.98]"
            style={{ background: FR.solid, letterSpacing: 0.5 }}
          >
            <Icon3D name="add-friend" size={20} /> ADD A FRIEND
          </button>
        </div>
      ) : (
        <>
          <div className="relative flex flex-col gap-2" style={{ padding: '10px 12px 6px' }}>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-black" style={{ letterSpacing: 1, color: FR.mid }}>ON NOW</span>
              {online.length > 0 && <span className="text-[10px] font-black" style={{ color: FR.online }}>{online.length}</span>}
            </div>
            {online.length > 0 ? (
              <div className="flex" style={{ gap: 10 }}>
                {online.slice(0, 5).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => onFace(f)}
                    aria-label={`Play with ${f.username}`}
                    className="flex flex-col items-center gap-1 transition-transform active:scale-95"
                    style={{ width: 58 }}
                  >
                    <FriendAvatar name={f.username} url={f.avatar_url} emoji={f.avatar_emoji} size={40} online pulse />
                    <span className="w-full text-center text-[10.5px] font-black truncate" style={{ color: FR.ink }}>{f.username}</span>
                    <span className="w-full text-center text-[9.5px] font-extrabold truncate -mt-0.5" style={{ color: FR.online }}>{doingLine(f.activity)}</span>
                  </button>
                ))}
              </div>
            ) : (
              <span className="text-[11px] font-bold" style={{ color: FR.mid, opacity: 0.8 }}>{nobodyLine}</span>
            )}
          </div>

          <button type="button" onClick={onRace} className="relative w-full flex flex-col gap-2 text-left" style={{ padding: '8px 12px 12px' }} aria-label="Open today's race">
            <span className="w-full flex items-center gap-1.5">
              <span className="text-[10px] font-black" style={{ letterSpacing: 1, color: FR.mid }}>TODAY&apos;S RACE</span>
              <span className="flex-1" />
              {streak && <FlameCount days={streak.days} label={`${streak.name.toUpperCase()} ${streak.days} DAY${streak.days === 1 ? '' : 'S'}`} />}
            </span>
            <span className="w-full flex" style={{ gap: 6 }}>
              {chips.map((c) => (
                <span
                  key={c.id}
                  className="flex-1 min-w-0 flex items-center gap-1.5"
                  style={{
                    height: 32, padding: '0 8px 0 5px', borderRadius: 999, background: 'rgba(255,255,255,0.85)',
                    boxShadow: c.me ? `0 0 0 2px ${FR.solid}` : '0 1px 3px rgba(131,24,67,0.08)',
                  }}
                >
                  <span
                    className="shrink-0 flex items-center justify-center rounded-full text-[10px] font-black text-white"
                    style={{ width: 20, height: 20, background: anyPoints && c.rank <= 3 && c.points > 0 ? MEDAL[c.rank - 1] : '#cbd5e1' }}
                  >
                    {c.rank}
                  </span>
                  <span className="flex-1 min-w-0 text-[10.5px] font-black truncate uppercase" style={{ color: FR.ink, letterSpacing: 0.3 }}>
                    {c.me ? 'You' : c.username}
                  </span>
                  <span className="shrink-0 text-[10.5px] font-extrabold" style={{ color: FR.mid }}>{c.points.toLocaleString('en-US')}</span>
                </span>
              ))}
            </span>
          </button>
        </>
      )}
    </div>
    </BannerHost>
  );
}
