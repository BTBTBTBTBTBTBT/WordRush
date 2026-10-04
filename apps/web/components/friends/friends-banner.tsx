'use client';

import { LiveHeadline } from '@/components/ui/live-headline';
import Image from 'next/image';
import { Icon3D } from '@/components/ui/icon3d';
import { CandyButton } from '@/components/ui/candy-button';
import { CastButton } from '@/components/ui/cast-button';
import { SoftNum } from '@/components/ui/soft-number';
import { friendsBannerClockLine, friendsBannerHeadline, type FriendsBannerInput } from '@wordle-duel/core';
import type { FriendProfile } from '@/lib/friends-service';
import type { RaceRow } from '@/lib/todays-race';
import { FR, doingLine } from '@/lib/friends-play';
import { FR_LOOK, raceChipColor } from '@/lib/friends-look';
import { ART_SIZE, artSrc, poseArt } from '@/lib/art';
import { PAGE_HOSTS } from '@/lib/mascots';
import { softMix } from '@/lib/soft-surface';
import { FlameCount, FrCard, FriendAvatar } from './friends-ui';

// The Friends banner (Friends overhaul §2.2; finishing build C4, mockup
// stats-friends-polish.html): a pink-washed card with a pink → gold top bar,
// the Friends host (O1, the cheerleader) cheering on the right — the cheer
// POSE, so the cast header's O1 is never repeated (A7) — the core headline and
// clock line, then ON NOW (letter-tile faces with the green dot, tap → quick
// play) and TODAY'S RACE (medal-colored chips with soft numbers, tap → the
// full race in a sheet). Shimmers when anyone is on.

const HOST_POSE = poseArt(PAGE_HOSTS.friends, 'cheer');
const HOST_H = 66; // BJ7: was 78
/** Room the headline leaves for the host on the right. */
const HOST_CLEARANCE = 72; // BJ7: was 84

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
  const [hw, hh] = ART_SIZE[HOST_POSE];

  return (
    <FrCard accent={FR_LOOK.pink} bar={FR_LOOK.bannerBar} className="shrink-0">
      {shimmer && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
          <div
            className="animate-banner-shimmer absolute"
            style={{ top: '-20%', left: 0, width: '38%', height: '140%', background: 'linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.55), rgba(255,255,255,0))' }}
          />
        </div>
      )}

      {/* O1 cheering (decorative). */}
      <Image
        src={artSrc(HOST_POSE)}
        alt=""
        aria-hidden
        width={hw}
        height={hh}
        priority
        draggable={false}
        className="absolute pointer-events-none select-none"
        style={{ right: 8, top: 8, width: Math.round((HOST_H * hw) / hh), height: HOST_H, filter: 'drop-shadow(0 4px 6px rgba(122,31,85,0.18))' }}
      />

      <div className="relative flex flex-col gap-1" style={{ padding: `10px ${HOST_CLEARANCE}px 2px 12px`, minHeight: 56 }}>
        {/* FINISH_SPEC AR: live lettering (pink → orange; names in the accent, numbers gold). */}
        <LiveHeadline text={headline} palette="friends" names={[input.leaderName, ...input.online, ...chips.map((c) => c.username)]} size={20} align="left" />
        <span className="font-black uppercase" style={{ fontSize: 11, letterSpacing: 0.6, color: FR_LOOK.bannerClock }}>{clockLine}</span>
      </div>

      {none ? (
        <div className="relative" style={{ padding: '8px 12px 12px' }}>
          <CastButton screen="pink" color="pink" size="md" block icon={<Icon3D name="add-friend" size={20} />} onClick={onAddFriend}>
            Add a friend
          </CastButton>
        </div>
      ) : (
        <>
          <div className="relative flex flex-col gap-1.5" style={{ padding: '8px 12px 4px' }}>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black" style={{ letterSpacing: 1.3, color: FR_LOOK.bannerClock }}>ON NOW</span>
              {online.length > 0 && <SoftNum size={13} style={{ color: FR.online }}>{online.length}</SoftNum>}
            </div>
            {online.length > 0 ? (
              <div className="flex" style={{ gap: 10 }}>
                {online.slice(0, 5).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => onFace(f)}
                    aria-label={`Play with ${f.username}`}
                    className="flex flex-col items-center gap-1"
                    style={{ width: 58 }}
                  >
                    <FriendAvatar name={f.username} userId={f.id} url={f.avatar_url} config={f.avatar_config} castId={f.avatar_cast_id} frame={f.avatar_frame} pro={f.is_pro} level={f.level} size={36} online pulse />
                    <span className="w-full text-center text-[10.5px] font-black truncate" style={{ color: FR_LOOK.bannerInk }}>{f.username}</span>
                    <span className="w-full text-center text-[9.5px] font-extrabold truncate -mt-0.5" style={{ color: FR_LOOK.bannerSub }}>{doingLine(f.activity)}</span>
                  </button>
                ))}
              </div>
            ) : (
              <span className="text-[12px] font-extrabold" style={{ color: FR_LOOK.bannerSub }}>{nobodyLine}</span>
            )}
          </div>

          <button type="button" onClick={onRace} className="relative w-full flex flex-col gap-1.5 text-left" style={{ padding: '6px 12px 12px' }} aria-label="Open today's race">
            <span className="w-full flex items-center gap-1.5">
              <span className="text-[11px] font-black" style={{ letterSpacing: 1.3, color: FR_LOOK.bannerClock }}>TODAY&apos;S RACE</span>
              <span className="flex-1" />
              {streak && <FlameCount days={streak.days} label={`${streak.name.toUpperCase()} ${streak.days} DAY${streak.days === 1 ? '' : 'S'}`} />}
            </span>
            <span className="w-full flex flex-wrap" style={{ gap: 6 }}>
              {chips.map((c) => {
                const medal = raceChipColor(c, anyPoints);
                return (
                  <span
                    key={c.id}
                    className="min-w-0 inline-flex items-center gap-1.5"
                    style={{
                      height: 28, padding: '0 10px 0 4px', borderRadius: 999,
                      background: softMix(medal, 0.14),
                      border: `1.5px solid ${softMix(medal, 0.36)}`,
                      boxShadow: c.me ? `0 0 0 2px ${FR_LOOK.lavender}` : '0 2px 5px rgba(122,31,85,0.08)',
                    }}
                  >
                    <span
                      className="shrink-0 flex items-center justify-center rounded-full text-[11px] font-black text-white"
                      style={{ width: 20, height: 20, background: medal, textShadow: '0 1px 1px rgba(59,26,120,0.35)' }}
                    >
                      {c.rank}
                    </span>
                    <span className="min-w-0 text-[12px] font-black truncate uppercase" style={{ color: FR_LOOK.chipInk, maxWidth: 96 }}>
                      {c.me ? 'You' : c.username}
                    </span>
                    <SoftNum size={12.5} className="shrink-0">{c.points.toLocaleString('en-US')}</SoftNum>
                  </span>
                );
              })}
            </span>
          </button>
        </>
      )}
    </FrCard>
  );
}
