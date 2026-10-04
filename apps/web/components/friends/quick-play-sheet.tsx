'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Radio, Swords } from 'lucide-react';
import { Icon3D } from '@/components/ui/icon3d';
import { HeadingArt } from '@/components/ui/heading-art';
import { COIN_STAKES, FRIENDLY_KINDS, FRIENDLY_TITLES, presenceLine, type FriendlyKind } from '@wordle-duel/core';
import { useAuth } from '@/lib/auth-context';
import { challengeFriend, type FriendProfile } from '@/lib/friends-service';
import { startGame } from '@/lib/friendly-games-client';
import { vsHrefForMode } from '@/lib/invite-service';
import {
  FR, KIND_COLOR, KIND_SHORT, PICKER_GAP, PICK_FRIEND_TITLE_ART, friendOnline, kindRules, lastSeenMs, pickerGrid, pocketTitleArt,
  pickerStatus, rivalryLine, sortForPicker,
} from '@/lib/friends-play';
import { FriendAvatar, GameGlyph, SectionLabel, Sheet } from './friends-ui';
import { GameSquare } from '@/components/ui/game-tile';
import { CandyButton } from '@/components/ui/candy-button';
import { CastButton } from '@/components/ui/cast-button';
import { FR_LOOK, frBar, frSurface } from '@/lib/friends-look';
import { LiveHeadline } from '@/components/ui/live-headline';
import { BrandEmptyState } from '@/components/ui/brand-empty-state';
import { artSrc } from '@/lib/art';
import { avatarRadiusPx } from '@/lib/avatar-render';
import { MOTION } from '@/lib/motion-spec';
import { prefersReducedMotion } from '@/lib/motion';
import { softMix } from '@/lib/soft-surface';

// The quick-play sheet (Friends overhaul §3): pick a pocket game (and a stake
// for Call It) or one of the two Wordocious ways to play, then INVITE. Opened
// from an ON NOW face, a Play pill, a game tile (with a friend picker) or a
// Rematch reaction. Finishing build (C4 / A1 / A8): tinted rows, chips and
// cards, candy Pick / Invite.

interface Props {
  friends: FriendProfile[];
  /** Preselected friend; null shows the picker first. */
  friend: FriendProfile | null;
  kind: FriendlyKind;
  onClose: () => void;
  onNote: (text: string) => void;
}

export function QuickPlaySheet({ friends, friend: initialFriend, kind: initialKind, onClose, onNote }: Props) {
  const router = useRouter();
  const { isProActive } = useAuth();
  const [friend, setFriend] = useState<FriendProfile | null>(initialFriend);
  const [kind, setKind] = useState<FriendlyKind>(initialKind);
  const [stake, setStake] = useState<string>(COIN_STAKES[0]);
  const [busy, setBusy] = useState<'invite' | 'vs' | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** A friend was picked in this sheet: the play state soft-rises in. */
  const [picked, setPicked] = useState(false);
  const now = Date.now();

  // BJ13: no friend yet → the character-select picker. Picking one moves to the
  // play state inside the same sheet with the shared soft rise (MotionSpec).
  if (!friend) {
    return (
      <Sheet onClose={onClose} label="Who are you playing?" tint={PICKER_SHEET}>
        <FriendPicker friends={friends} kind={kind} now={now} onPick={(f) => { setPicked(true); setFriend(f); }} />
      </Sheet>
    );
  }

  const on = friendOnline(friend, now);
  const presence = presenceLine(lastSeenMs(friend), friend.activity ?? null, now);
  const rivalry = rivalryLine(friend);

  const invite = async () => {
    if (busy) return;
    setBusy('invite');
    setError(null);
    const r = await startGame(kind, friend.id, kind === 'coin' ? stake : undefined);
    if ('error' in r) { setError(r.error); setBusy(null); return; }
    router.push(`/friends/games/${r.game.id}`);
  };

  const vsLive = async () => {
    if (busy) return;
    setBusy('vs');
    const r = await challengeFriend(friend.id, 'DUEL');
    if ('error' in r) { setError(r.error); setBusy(null); return; }
    onNote(`Challenge sent to ${friend.username}!`);
    router.push(`${vsHrefForMode('DUEL')}?inviteCode=${r.code}`);
  };

  const raceMyRun = () => router.push(isProActive ? `/vs/friend?friend=${friend.id}` : '/pro');

  return (
    <Sheet onClose={onClose} label={`Play with ${friend.username}`}>
      <SoftRise active={picked}>
      <div className="flex items-center gap-3 mb-4">
        <FriendAvatar name={friend.username} url={friend.avatar_url} emoji={friend.avatar_emoji} size={48} online={on} pulse={on} />
        <div className="flex-1 min-w-0">
          {/* BJ16: the LET'S PLAY! lettering; the friend's @name rides under it. */}
          <HeadingArt slug="letsplay" label={`Play with ${friend.username}`} height={28} maxWidth={170} align="left" />
          <div aria-hidden="true" className="text-[14px] font-black truncate" style={{ color: FR.label }}>@{friend.username}</div>
          {presence && <div className="text-[11.5px] font-extrabold truncate" style={{ color: on ? FR.online : FR.label }}>{presence}</div>}
          {rivalry && <div className="text-[11px] font-bold truncate" style={{ color: FR.label }}>{rivalry}</div>}
        </div>
      </div>

      <SectionLabel>Quick games{on ? ' · live while they’re on' : ''}</SectionLabel>
      <div className="grid grid-cols-3 gap-2 mt-2">
        {FRIENDLY_KINDS.map((k) => {
          const sel = k === kind;
          return (
            // Square game tile (docs/GAME_TILE_STYLE.md), selected = the picked game.
            <GameSquare
              key={k}
              accent={KIND_COLOR[k]}
              tone="light"
              selected={sel}
              glyph={<GameGlyph kind={k} size={16} color={KIND_COLOR[k]} stroke={2.2} />}
              label={KIND_SHORT[k]}
              onClick={() => setKind(k)}
              aria-pressed={sel}
              aria-label={KIND_SHORT[k]}
            />
          );
        })}
      </div>

      {kind === 'coin' && (
        <div className="flex flex-wrap gap-1.5 mt-3" role="group" aria-label="What's on the line">
          {COIN_STAKES.map((s) => {
            const sel = s === stake;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setStake(s)}
                aria-pressed={sel}
                className="px-3 text-[11px] font-black rounded-full"
                style={{
                  height: 30,
                  background: softMix(KIND_COLOR.coin, sel ? 0.24 : 0.12),
                  border: sel ? `2px solid ${KIND_COLOR.coin}` : `1.5px solid ${softMix(KIND_COLOR.coin, 0.32)}`,
                  boxShadow: sel ? `0 0 0 3px ${softMix(KIND_COLOR.coin, 0.22)}` : undefined,
                  color: sel ? '#713f12' : FR_LOOK.ink,
                }}
              >
                {s}
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-4"><SectionLabel>Wordocious</SectionLabel></div>
      <div className="grid grid-cols-2 gap-2 mt-2">
        <button
          type="button"
          onClick={vsLive}
          disabled={busy !== null}
          className="relative overflow-hidden flex flex-col items-start gap-1 text-left disabled:opacity-60"
          style={{ ...frSurface(FR_LOOK.teal, { radius: 16, share: 0.16 }), padding: '16px 12px 12px' }}
        >
          <span aria-hidden="true" className="absolute top-0 left-0 right-0" style={frBar(FR_LOOK.teal, 6)} />
          <span className="flex items-center gap-1.5 text-[12.5px] font-black" style={{ color: FR.teal }}>
            {busy === 'vs' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radio className="w-4 h-4" />} VS Battle, live
          </span>
          <span className="text-[10.5px] font-bold" style={{ color: '#134e4a' }}>A private Classic match. Free for friends.</span>
        </button>
        <button
          type="button"
          onClick={raceMyRun}
          className="relative overflow-hidden flex flex-col items-start gap-1 text-left"
          style={{ ...frSurface(FR_LOOK.lavender, { radius: 16 }), padding: '16px 12px 12px' }}
        >
          <span aria-hidden="true" className="absolute top-0 left-0 right-0" style={frBar(FR_LOOK.lavender, 6)} />
          {!isProActive && <Icon3D name="crown" size={14} className="absolute top-3.5 right-2.5" />}
          <span className="flex items-center gap-1.5 text-[12.5px] font-black" style={{ color: '#6d28d9' }}>
            <Swords className="w-4 h-4" /> Race my run
          </span>
          <span className="text-[10.5px] font-bold" style={{ color: FR_LOOK.ink }}>You play first. They race your run. Pro.</span>
        </button>
      </div>

      {error && <p className="mt-3 text-[12px] font-bold text-center" style={{ color: '#dc2626' }}>{error}</p>}

      <CastButton screen="pink"
        color="pink"
        block
        onClick={invite}
        disabled={busy !== null}
        icon={busy === 'invite' ? <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" /> : 'play'}
        className="mt-4"
      >
        Invite to {FRIENDLY_TITLES[kind]}
      </CastButton>
      <p className="mt-1 text-center text-[11px] font-bold" style={{ color: FR_LOOK.rowSub }}>
        {friend.username} gets a ping. If they&apos;re busy, it waits as your turn.
      </p>
      </SoftRise>
    </Sheet>
  );
}

/**
 * The shared soft rise (FINISH_SPEC BJ9's no-source motion, lib/motion-spec.ts):
 * 0.96 → 1, up 14, fade, on the expo curve; Reduce Motion = a short cross-fade.
 * Plays once on mount when `active` (the picker → play hand-off), transform /
 * opacity only.
 */
function SoftRise({ active, children }: { active: boolean; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!active || !el || typeof el.animate !== 'function') return;
    const calm = prefersReducedMotion();
    el.animate(
      calm
        ? [{ opacity: 0 }, { opacity: 1 }]
        : [{ opacity: 0, transform: `translateY(${MOTION.riseOffset}px) scale(${MOTION.riseScale})` }, { opacity: 1, transform: 'none' }],
      { duration: calm ? MOTION.crossFadeMs : MOTION.riseMs, easing: calm ? 'ease-out' : MOTION.growEase, fill: 'backwards' },
    );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return <div ref={ref} style={{ transformOrigin: '50% 0%' }}>{children}</div>;
}

/**
 * BJ13 (founder 10-03): the pocket-game friend picker as a character-select grid.
 * Header: the game's title art (else its 3D icon + the name in the live title
 * lettering), one rules line, then WHO ARE YOU PLAYING? (its art when it ships).
 * The grid fills the sheet: 3 across on phones, 4 on the wide sheet, avatars
 * ~76% of the cell (pickerGrid); each cell = the avatar (green glow when on),
 * the name and one short status. Online first, then most recent. No chevrons,
 * stripes or bordered card. No friends: I's invite scene.
 */
/** The calm lavender picker sheet (founder mockup option 1). */
const PICKER_SHEET = '#f4f0ff';

function FriendPicker({ friends, kind, now, onPick }: {
  friends: FriendProfile[]; kind: FriendlyKind; now: number; onPick: (f: FriendProfile) => void;
}) {
  const ordered = sortForPicker(friends, now);
  const gridRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(343);
  useLayoutEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    setWidth(el.clientWidth);
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const { cols, avatar } = pickerGrid(width);
  const titleArt = pocketTitleArt(kind);
  return (
    <div>
      <div className="flex flex-col items-center text-center">
        {titleArt ? (
          <h2 className="m-0 w-full flex justify-center" style={{ lineHeight: 0 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={artSrc(`art-titlecast-pocket-${kind}`)}
              alt={FRIENDLY_TITLES[kind]}
              width={titleArt[0]}
              height={titleArt[1]}
              className="art-pop"
              style={{ width: '100%', maxHeight: 84, height: 'auto', objectFit: 'contain', aspectRatio: `${titleArt[0]} / ${titleArt[1]}` }}
            />
          </h2>
        ) : (
          <LiveHeadline text={FRIENDLY_TITLES[kind]} palette="friends" size={32} level={2} className="w-full" />
        )}
        <p className="mt-1.5 text-[15px] font-extrabold" style={{ color: FR_LOOK.ink }}>{kindRules(kind)}</p>
        <div className="mt-3 w-full flex justify-center">
          {PICK_FRIEND_TITLE_ART ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={artSrc('art-titlecast-pick-friend')}
              alt="Who are you playing?"
              role="heading"
              aria-level={3}
              width={PICK_FRIEND_TITLE_ART[0]}
              height={PICK_FRIEND_TITLE_ART[1]}
              style={{ width: '64%', maxWidth: 260, maxHeight: 30, height: 'auto', objectFit: 'contain' }}
            />
          ) : (
            <h3 className="m-0 text-[13px] font-black uppercase" style={{ letterSpacing: '0.12em', color: FR_LOOK.rowSub }}>Who are you playing?</h3>
          )}
        </div>
      </div>

      <div ref={gridRef} className="mt-3">
        {ordered.length === 0 ? (
          <BrandEmptyState scene="i-invite" accent="friends" artHeight={110} title="No friends yet" line="Add a friend first, then pick a game and play." className="py-2" />
        ) : (
          <div className="grid" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, columnGap: PICKER_GAP, rowGap: 12 }}>
            {ordered.map((f) => {
              const st = pickerStatus(f, now);
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => onPick(f)}
                  aria-label={`${f.username}, ${st.text}`}
                  className="flex flex-col items-center min-w-0"
                >
                  {/* The friend's REAL avatar (the shared resolver) as a tile filling the cell; on now = a soft green glow, no outline. */}
                  <span
                    className="inline-flex"
                    style={{ borderRadius: avatarRadiusPx(avatar), boxShadow: st.online ? `0 0 18px 4px ${softMix(FR.online, 0.5)}, 0 0 6px 1px ${softMix(FR.online, 0.4)}` : undefined }}
                  >
                    <FriendAvatar name={f.username} userId={f.id} url={f.avatar_url} config={f.avatar_config} castId={f.avatar_cast_id} frame={f.avatar_frame} pro={f.is_pro} level={f.level} size={avatar} />
                  </span>
                  <span className="mt-1.5 w-full text-[15px] font-black truncate leading-tight" style={{ color: FR_LOOK.ink }}>{f.username}</span>
                  <span className="w-full text-[12px] font-extrabold truncate leading-tight" style={{ color: st.online ? FR.online : FR_LOOK.rowSub }}>{st.text}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
