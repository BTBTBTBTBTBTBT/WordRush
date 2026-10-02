'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Copy, Gift } from 'lucide-react';
import { CandyButton, CandyLink } from '@/components/ui/candy-button';
import { HeaderBack } from '@/components/ui/page-header';
import { LetterTile } from '@/components/game/letter-tile';
import { LetterTileAvatar } from '@/components/ui/letter-tile-avatar';
import { SoftNum } from '@/components/ui/soft-number';
import { PoseArt, POPUP_DIM, POPUP_SHADOW, PopupBar, popupCard } from '@/components/ui/soft-popup';
import { CANDY_CONFETTI, Confetti } from '@/components/effects/confetti';
import { ART_SIZE, artSrc, type PoseArtName, type SceneArtName } from '@/lib/art';
import { prefersReducedMotion } from '@/lib/motion';
import { SOFT_INK, alphaHex, darken, softMix, softPill } from '@/lib/soft-surface';
import { GIFT_DAYS, GIFT_SLOTS, codeTiles } from '@/lib/invite-screens';

// The friend-invite + gift-a-week-of-Pro screens (docs/FINISH_SPEC.md T1–T4),
// shared by the invite sheet, the Friends tab, the join landing, the referral
// redeemer and the Pro page: tinted cards with their top bar (A1), the new
// scene art (invite-sent, friends-match, gift-pro, pro-crown), lettering-style
// headlines in the soft-numbers ink (A2), glossy pills, glossy letter tiles for
// codes and candy buttons (A8). Inks are the theme vars (SOFT_INK), so the same
// pieces read on the light-only Friends page and on the dark theme elsewhere.
// Motion (art spring, hearts, confetti) is off / a plain fade with Reduce Motion.

/** The Friends accent (T1–T3 cards). */
export const INVITE_ACCENT = '#ec4899';
/** The invite cards' pink → gold top bar. */
export const INVITE_BAR = 'linear-gradient(90deg, #ec4899, #f59e0b)';
/** The gold Pro family (T4). */
export const GIFT_GOLD = '#f5a524';
export const GIFT_BAR = 'linear-gradient(90deg, #ffd166, #f5a524 55%, #f97316)';

/** A green candy (Accept): no green candy color exists, so the candy look is recolored inline. */
export const GREEN_CANDY = {
  ['--candy-1' as string]: '#6ee7a8',
  ['--candy-2' as string]: '#16a34a',
  ['--candy-lip' as string]: '#0e6b30',
} as React.CSSProperties;

/** A scene's art at a height (or full width), decorative. `spring` = springs in (a fade with Reduce Motion). */
export function SceneArt({ name, height, fullWidth = false, spring = false, priority = false, className = '', style }: {
  name: SceneArtName;
  height?: number;
  fullWidth?: boolean;
  spring?: boolean;
  priority?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [w, h] = ART_SIZE[name];
  const px = height ?? 140;
  return (
    <Image
      src={artSrc(name)}
      alt=""
      aria-hidden="true"
      width={w}
      height={h}
      priority={priority}
      loading={priority ? undefined : 'lazy'}
      draggable={false}
      sizes={fullWidth ? '(max-width: 420px) 100vw, 400px' : `${Math.round((px * w) / h)}px`}
      className={`block select-none pointer-events-none ${fullWidth ? '' : 'mx-auto'} ${spring ? 'celebrate-spring' : ''} ${className}`}
      style={fullWidth ? { width: '100%', height: 'auto', ...style } : { height: px, width: 'auto', ...style }}
    />
  );
}

/** A lettering-style headline ("INVITE SENT!") in the soft-numbers ink (A2): Nunito Black caps with the soft shadow. */
export function Lettering({ children, size = 30, as: Tag = 'h2', id, className = '' }: {
  children: React.ReactNode;
  size?: number;
  as?: 'h1' | 'h2' | 'h3' | 'p';
  id?: string;
  className?: string;
}) {
  return (
    <Tag id={id} className={`soft-num m-0 uppercase ${className}`} style={{ fontSize: size, letterSpacing: '0.03em', lineHeight: 1.05 }}>
      {children}
    </Tag>
  );
}

/**
 * A glossy pill (not a button): the accent's candy gradient, the thin gold
 * outline, a darker lip, the white top gloss and a white Nunito Black label
 * with the dark-purple outline. `sm` = the small "Pending" tag.
 */
export function GlossyPill({ children, accent = INVITE_ACCENT, size = 'md', className = '' }: {
  children: React.ReactNode;
  accent?: string;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const h = size === 'sm' ? 20 : 32;
  return (
    <span
      className={`relative inline-flex items-center justify-center max-w-full ${className}`}
      style={{
        height: h,
        padding: `0 ${size === 'sm' ? 8 : 14}px`,
        marginBottom: size === 'sm' ? 2 : 3,
        borderRadius: 999,
        background: `linear-gradient(${softMix(accent, 0.6)}, ${accent})`,
        boxShadow: `inset 0 0 0 ${size === 'sm' ? 1 : 1.5}px #f5c542, 0 ${size === 'sm' ? 2 : 3}px 0 ${darken(accent, 0.35)}, 0 ${size === 'sm' ? 3 : 5}px 10px ${alphaHex(accent, 0.25)}`,
        color: '#ffffff',
        fontWeight: 900,
        fontSize: size === 'sm' ? 10 : 15,
        letterSpacing: size === 'sm' ? '0.06em' : '0.02em',
        textTransform: size === 'sm' ? 'uppercase' : undefined,
        lineHeight: 1,
        whiteSpace: 'nowrap',
        textShadow: '1px 0 0 #3b1a78, -1px 0 0 #3b1a78, 0 1px 0 #3b1a78, 0 -1px 0 #3b1a78, 0 2px 3px rgba(40, 10, 80, 0.3)',
      }}
    >
      <span aria-hidden="true" className="absolute pointer-events-none" style={{ left: '8%', right: '8%', top: '8%', height: '46%', borderRadius: 999, background: 'linear-gradient(rgba(255,255,255,0.5), rgba(255,255,255,0))' }} />
      <span className="relative truncate" style={{ padding: '1px 0' }}>{children}</span>
    </span>
  );
}

/** The small "Pending" glossy pill on request-pending rows (T1). */
export function PendingPill({ accent = '#f59e0b' }: { accent?: string }) {
  return <GlossyPill size="sm" accent={accent}>Pending</GlossyPill>;
}

/** An invite code on glossy B-kit letter tiles with a copy candy button (T1). */
export function InviteCodeTiles({ code, copied = false, onCopy, tile = 30, copyLabel = 'Copy invite code' }: {
  code: string;
  copied?: boolean;
  onCopy?: () => void;
  tile?: number;
  copyLabel?: string;
}) {
  const tiles = codeTiles(code);
  if (tiles.length === 0) return null;
  return (
    <div className="flex items-center justify-center gap-2">
      <div className="flex items-center" style={{ gap: 3 }} role="img" aria-label={`Invite code ${tiles.join(' ')}`}>
        {tiles.map((ch, i) => (
          <LetterTile
            key={`${i}-${ch}`}
            letter={ch}
            look="correct"
            pop={false}
            aria-hidden
            style={{ width: tile, ['--gt-font' as string]: `${Math.round(tile * 0.56)}px` } as React.CSSProperties}
          />
        ))}
      </div>
      {onCopy && (
        <CandyButton
          size="sm"
          color={copied ? 'teal' : 'purple'}
          icon={copied ? 'check' : <span className="candy-icon"><Copy className="w-3.5 h-3.5" color="#fff" strokeWidth={3} aria-hidden="true" /></span>}
          onClick={onCopy}
          aria-label={copied ? 'Copied' : copyLabel}
          className="shrink-0"
          style={{ width: 32, padding: 0 }}
        />
      )}
    </div>
  );
}

/** A tinted invite card: the accent's wash, its border and top bar. */
export function InviteCard({ accent = INVITE_ACCENT, bar = INVITE_BAR, children, className = '', role, style }: {
  accent?: string;
  bar?: string;
  children: React.ReactNode;
  className?: string;
  role?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className={className} role={role} style={{ ...popupCard(accent, { radius: 20, share: 0.12 }), boxShadow: `0 10px 26px ${alphaHex(accent, 0.16)}`, ...style }}>
      <PopupBar accent={accent} gradient={bar} />
      {children}
    </div>
  );
}

/**
 * T1 — invite sent: I tossing the gold star envelope springs in, "INVITE
 * SENT!", the friend's name (or the code) on a glossy pill, candy "Send
 * another" + "Done". Announced politely (role=status).
 */
export function InviteSentCard({ name, code, note, onSendAnother, sendAnotherDisabled = false, onDone, title = 'Invite sent!', framed = true }: {
  /** "@username", shown on the pill. */
  name?: string | null;
  /** The invite code (gift links), on glossy tiles under the pill. */
  code?: string | null;
  note?: React.ReactNode;
  onSendAnother?: () => void;
  sendAnotherDisabled?: boolean;
  onDone: () => void;
  title?: string;
  /** Inside its own tinted card (false = the host sheet is already the card). */
  framed?: boolean;
}) {
  const body = (
    <div className="flex flex-col items-center text-center gap-2.5 px-4 pt-3 pb-4" role="status">
      <SceneArt name="art-scene-invite-sent" height={118} spring />
      <Lettering size={28}>{title}</Lettering>
      {name && <GlossyPill accent={INVITE_ACCENT}>{name}</GlossyPill>}
      {code && <InviteCodeTiles code={code} tile={26} />}
      {note && <p className="m-0 text-[11.5px] font-bold" style={{ color: SOFT_INK.label }}>{note}</p>}
      <div className="flex w-full gap-2.5 pt-1">
        {onSendAnother && (
          <CandyButton size="md" color="pink" block icon="plus" onClick={onSendAnother} disabled={sendAnotherDisabled}>
            Send another
          </CandyButton>
        )}
        <CandyButton size="md" color="peach" block onClick={onDone}>Done</CandyButton>
      </div>
    </div>
  );
  return framed ? <InviteCard>{body}</InviteCard> : body;
}

/** One player for the avatars on the invite cards. */
export interface InvitePerson {
  name: string;
  url?: string | null;
  emoji?: string | null;
  accent?: string | null;
}

/** A player's avatar: their photo (circle) or their letter tile. */
export function PersonAvatar({ person, size }: { person: InvitePerson; size: number }) {
  if (person.url) {
    return (
      <span className="relative inline-flex shrink-0 rounded-full overflow-hidden" style={{ width: size, height: size, boxShadow: `0 0 0 3px #ffffff, 0 4px 10px ${alphaHex(INVITE_ACCENT, 0.25)}` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={person.url} alt="" width={size} height={size} decoding="async" className="w-full h-full object-cover" />
      </span>
    );
  }
  return <LetterTileAvatar name={person.name} emoji={person.emoji} accent={person.accent} size={size} shadow={`0 4px 10px ${alphaHex(INVITE_ACCENT, 0.25)}`} />;
}

/**
 * T2 — invite received: the inviter's avatar over the invite-sent art, the
 * headline, a line, green candy Accept + soft peach Decline.
 */
export function InviteReceivedBody({ inviter, headline, children, acceptLabel = 'Accept', declineLabel = 'Decline', onAccept, onDecline, busy = false, acceptIcon }: {
  inviter: InvitePerson;
  headline: React.ReactNode;
  children?: React.ReactNode;
  acceptLabel?: React.ReactNode;
  declineLabel?: React.ReactNode;
  onAccept: () => void;
  onDecline?: () => void;
  busy?: boolean;
  acceptIcon?: React.ComponentProps<typeof CandyButton>['icon'];
}) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="relative inline-block mb-2">
        <SceneArt name="art-scene-invite-sent" height={124} spring priority />
        <span className="absolute" style={{ left: -6, bottom: 2 }}>
          <PersonAvatar person={inviter} size={52} />
        </span>
      </div>
      <h1 className="m-0 text-[19px] font-black leading-snug" style={{ color: 'var(--soft-ink, #3b1a78)' }}>{headline}</h1>
      {children && <div className="mt-1.5 text-xs font-bold" style={{ color: SOFT_INK.label }}>{children}</div>}
      <div className="flex w-full gap-2.5 mt-4">
        {onDecline && (
          <CandyButton size="lg" color="peach" block onClick={onDecline} disabled={busy} style={{ flex: '0 0 38%' }}>{declineLabel}</CandyButton>
        )}
        <CandyButton size="lg" block icon={acceptIcon ?? 'check'} onClick={onAccept} disabled={busy} style={GREEN_CANDY}>{acceptLabel}</CandyButton>
      </div>
    </div>
  );
}

/**
 * T2 — a state of the join landing (loading, not found, expired, already used,
 * not eligible): a cast pose (or scene), a headline, a line and a candy "Go to
 * Wordocious" — never a bare text line.
 */
export function InviteStateBody({ pose, scene, title, children, action, busy = false }: {
  pose?: PoseArtName;
  scene?: SceneArtName;
  title: React.ReactNode;
  children?: React.ReactNode;
  /** Replaces the default "Go to Wordocious" candy. */
  action?: React.ReactNode;
  /** Loading: announced politely. */
  busy?: boolean;
}) {
  return (
    <div className="flex flex-col items-center text-center" role={busy ? 'status' : undefined} aria-live={busy ? 'polite' : undefined}>
      {scene ? <SceneArt name={scene} height={120} className="mb-2" /> : pose ? <PoseArt pose={pose} size={110} className="mx-auto mb-1" /> : null}
      <h1 className="m-0 text-lg font-black" style={{ color: 'var(--soft-ink, #3b1a78)' }}>{title}</h1>
      {children && <p className="m-0 mt-1 text-xs font-bold" style={{ color: SOFT_INK.label }}>{children}</p>}
      <div className="w-full mt-4">
        {action ?? <CandyLink href="/" color="purple" size="lg" block icon="play">Go to Wordocious</CandyLink>}
      </div>
    </div>
  );
}

/** Hearts bursting out from the middle of their (relative) box, once. Nothing with Reduce Motion. */
export function HeartBurst({ count = 9 }: { count?: number }) {
  const [on, setOn] = useState(false);
  const box = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (prefersReducedMotion()) return;
    setOn(true);
  }, []);
  useEffect(() => {
    if (!on || !box.current) return;
    const hearts = Array.from(box.current.children) as HTMLElement[];
    const anims = hearts.map((el, i) => {
      const angle = (-90 + (i - (count - 1) / 2) * (150 / Math.max(1, count - 1))) * (Math.PI / 180);
      const dist = 70 + (i % 3) * 22;
      const dx = Math.cos(angle) * dist;
      const dy = Math.sin(angle) * dist;
      return el.animate(
        [
          { transform: 'translate(-50%, -50%) scale(0.2)', opacity: 0 },
          { transform: `translate(calc(-50% + ${dx * 0.6}px), calc(-50% + ${dy * 0.6}px)) scale(1.15)`, opacity: 1, offset: 0.45 },
          { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy - 24}px)) scale(0.9)`, opacity: 0 },
        ],
        { duration: 1300, delay: 260 + i * 45, easing: 'cubic-bezier(0.2, 0.8, 0.3, 1)', fill: 'both' },
      );
    });
    return () => anims.forEach((a) => a.cancel());
  }, [on, count]);
  if (!on) return null;
  const colors = ['#ec4899', '#f472b6', '#f5a524', '#a66bff'];
  return (
    <div ref={box} className="absolute inset-0 pointer-events-none" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <svg
          key={i}
          width={16 + (i % 3) * 5}
          height={16 + (i % 3) * 5}
          viewBox="0 0 24 24"
          className="absolute"
          style={{ left: '50%', top: '50%', opacity: 0, filter: 'drop-shadow(0 2px 2px rgba(120, 20, 70, 0.3))' }}
        >
          <path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.5 3 4.5 6.8 4.5c2.2 0 3.6 1.2 5.2 3.1 1.6-1.9 3-3.1 5.2-3.1 3.8 0 5.9 4 4.4 7.3C19.5 16.4 12 21 12 21z" fill={colors[i % colors.length]} stroke="#ffffff" strokeWidth="1.4" />
        </svg>
      ))}
    </div>
  );
}

/** Closes on Escape and locks the page scroll while a window is open. */
function useWindow(onClose: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);
}

/** The window frame: the soft purple dim, a centered tinted card with its top bar and a close control. */
function WindowFrame({ accent, bar, labelledBy, onClose, children }: {
  accent: string;
  bar: string;
  labelledBy: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useWindow(onClose);
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-4" style={{ background: POPUP_DIM }} onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className="relative w-full max-w-sm"
        style={{ ...popupCard(accent, { radius: 24, share: 0.12 }), boxShadow: POPUP_SHADOW }}
        onClick={(e) => e.stopPropagation()}
      >
        <PopupBar accent={accent} gradient={bar} />
        <HeaderBack kind="close" onClick={onClose} size={32} className="absolute top-4 right-3 z-10" />
        {children}
      </div>
    </div>
  );
}

/**
 * T3 — "NEW FRIENDS!": I and the pink O high-five full card width with one
 * confetti + heart burst (none with Reduce Motion), both avatars side by side,
 * candy "Challenge them" (the VS race) and "See friends".
 */
export function NewFriendsModal({ me, friend, onChallenge, onSeeFriends, onClose }: {
  me: InvitePerson;
  friend: InvitePerson;
  onChallenge: () => void;
  onSeeFriends: () => void;
  onClose: () => void;
}) {
  return (
    <WindowFrame accent={INVITE_ACCENT} bar={INVITE_BAR} labelledBy="new-friends-title" onClose={onClose}>
      <div className="relative px-3 pt-3">
        <SceneArt name="art-scene-friends-match" fullWidth spring priority />
        <HeartBurst />
      </div>
      <div className="flex flex-col items-center text-center gap-2 px-5 pb-5 pt-1">
        <Lettering id="new-friends-title" size={32}>New friends!</Lettering>
        <div className="flex items-end justify-center gap-3 pt-1">
          <figure className="m-0 flex flex-col items-center gap-1 min-w-0" style={{ width: 96 }}>
            <PersonAvatar person={me} size={52} />
            <figcaption className="text-[11px] font-black truncate max-w-full" style={{ color: SOFT_INK.title }}>{me.name}</figcaption>
          </figure>
          <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true" style={{ marginBottom: 24, filter: 'drop-shadow(0 2px 3px rgba(190, 24, 93, 0.3))' }}>
            <path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.5 3 4.5 6.8 4.5c2.2 0 3.6 1.2 5.2 3.1 1.6-1.9 3-3.1 5.2-3.1 3.8 0 5.9 4 4.4 7.3C19.5 16.4 12 21 12 21z" fill="#ec4899" stroke="#ffffff" strokeWidth="1.4" />
          </svg>
          <figure className="m-0 flex flex-col items-center gap-1 min-w-0" style={{ width: 96 }}>
            <PersonAvatar person={friend} size={52} />
            <figcaption className="text-[11px] font-black truncate max-w-full" style={{ color: SOFT_INK.title }}>@{friend.name}</figcaption>
          </figure>
        </div>
        <p className="m-0 text-xs font-bold" style={{ color: SOFT_INK.label }}>You and @{friend.name} are now friends. Race them on every daily.</p>
        <div className="flex w-full flex-col gap-2 pt-2">
          <CandyButton size="lg" color="pink" block icon="play" onClick={onChallenge}>Challenge them</CandyButton>
          <CandyButton size="md" color="peach" block onClick={onSeeFriends}>See friends</CandyButton>
        </div>
      </div>
      <Confetti colors={CANDY_CONFETTI.pink} />
    </WindowFrame>
  );
}

/** T4 — the recipient's "Pro unlocked!": W crowned (pro-crown) + gold confetti + "7 days of Pro are yours!" + candy "Start playing". */
export function ProUnlockedBody({ onStart, startHref, note, titleId }: { onStart?: () => void; startHref?: string; note?: React.ReactNode; titleId?: string }) {
  return (
    <div className="flex flex-col items-center text-center" role="status">
      <div className="relative">
        <div aria-hidden="true" className="absolute celebrate-glow" style={{ inset: '8% -10%', borderRadius: '50%', background: 'radial-gradient(circle, rgba(255, 209, 102, 0.55), rgba(245, 165, 36, 0) 68%)' }} />
        <SceneArt name="art-scene-pro-crown" height={140} spring priority className="relative mb-2" />
      </div>
      <Lettering as="h1" id={titleId} size={30}>Pro unlocked!</Lettering>
      <p className="m-0 mt-1.5 text-sm font-black" style={{ color: SOFT_INK.title }}>{GIFT_DAYS} days of Pro are yours!</p>
      {note && <p className="m-0 mt-1 text-xs font-bold" style={{ color: SOFT_INK.label }}>{note}</p>}
      <div className="w-full mt-4">
        {startHref
          ? <CandyLink href={startHref} color="amber" size="lg" block icon="play">Start playing</CandyLink>
          : <CandyButton color="amber" size="lg" block icon="play" onClick={onStart}>Start playing</CandyButton>}
      </div>
      <Confetti colors={CANDY_CONFETTI.gold} />
    </div>
  );
}

/** T4 — "Pro unlocked!" as a window (the referral redeemer, after a sign-up claims a pending gift). */
export function ProUnlockedModal({ onClose }: { onClose: () => void }) {
  return (
    <WindowFrame accent={GIFT_GOLD} bar={GIFT_BAR} labelledBy="pro-unlocked-title" onClose={onClose}>
      <div className="px-5 pt-4 pb-5">
        <ProUnlockedBody onStart={onClose} titleId="pro-unlocked-title" />
      </div>
    </WindowFrame>
  );
}

/** The soft-number "7 DAYS" badge (T4) on a gold pill. */
export function SevenDaysBadge() {
  return (
    <span className="inline-flex items-baseline gap-1 px-2.5 py-1" style={{ ...softPill(GIFT_GOLD, { radius: 12 }), paddingTop: 7 }} aria-label={`${GIFT_DAYS} days`}>
      <SoftNum size={22}>{GIFT_DAYS}</SoftNum>
      <span className="text-[11px] font-black uppercase" style={{ letterSpacing: '0.08em', color: SOFT_INK.title }}>days</span>
    </span>
  );
}

/** The gold candy "Send a gift" icon (a white gift with the candy outline). */
export function GiftCandyIcon() {
  return <span className="candy-icon"><Gift className="w-5 h-5" color="#fff" strokeWidth={2.6} aria-hidden="true" /></span>;
}

/**
 * T4 — "GIFT A WEEK OF PRO": O3 with the crowned gift box on a gold-tinted
 * card, the soft-number 7 DAYS badge, the gifts-left counter in soft numbers
 * and the gold candy "Send a gift". `children` = the program's details.
 */
export function GiftProCard({ giftsLeft, slots = GIFT_SLOTS, onSend, sendHref, sending = false, sendLabel, sendDisabled = false, children, footer, className = '' }: {
  /** Omit to hide the counter (a viewer who can't gift yet). */
  giftsLeft?: number;
  slots?: number;
  onSend?: () => void;
  sendHref?: string;
  sending?: boolean;
  sendLabel?: React.ReactNode;
  sendDisabled?: boolean;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  const label = sendLabel ?? (sending ? 'Sending…' : 'Send a gift');
  return (
    <InviteCard accent={GIFT_GOLD} bar={GIFT_BAR} className={className}>
      <div className="p-4 space-y-3">
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0 space-y-2">
            <Lettering as="h2" size={21}>Gift a week of Pro</Lettering>
            <div className="flex flex-wrap items-center gap-2">
              <SevenDaysBadge />
              {giftsLeft != null && (
                <span className="inline-flex items-baseline gap-1 px-2.5 py-1" style={{ ...softPill('#7c3aed', { radius: 12 }), paddingTop: 7 }} aria-label={`${giftsLeft} of ${slots} gifts left`}>
                  <SoftNum size={20}>{giftsLeft}</SoftNum>
                  <span className="text-[11px] font-black" style={{ color: SOFT_INK.label }}>/</span>
                  <SoftNum size={14}>{slots}</SoftNum>
                  <span className="text-[11px] font-black uppercase" style={{ letterSpacing: '0.08em', color: SOFT_INK.title }}>gifts left</span>
                </span>
              )}
            </div>
          </div>
          <SceneArt name="art-scene-gift-pro" height={92} className="shrink-0" style={{ marginTop: -4, marginRight: -4 }} />
        </div>
        {children}
        {(onSend || sendHref) && (
          sendHref
            ? <CandyLink href={sendHref} color="amber" size="md" block icon={<GiftCandyIcon />}>{label}</CandyLink>
            : <CandyButton color="amber" size="md" block icon={<GiftCandyIcon />} onClick={onSend} disabled={sending || sendDisabled}>{label}</CandyButton>
        )}
        {footer}
      </div>
    </InviteCard>
  );
}

/** A small gift-shield notice (T4): the shield-guard art small on a teal-tinted pill row. */
export function ShieldNotice({ children, onDismiss }: { children: React.ReactNode; onDismiss?: () => void }) {
  return (
    <div
      className="flex items-center gap-2.5 px-3 py-2"
      role="status"
      onClick={onDismiss}
      style={{ ...popupCard('#0d9488', { radius: 14, share: 0.12 }), boxShadow: `inset 0 4px 0 #0d9488, 0 4px 10px ${alphaHex('#0d9488', 0.12)}` }}
    >
      <SceneArt name="art-scene-shield-guard" height={36} className="shrink-0" style={{ marginTop: 3 }} />
      <span className="flex-1 min-w-0 text-xs font-extrabold" style={{ color: SOFT_INK.title }}>{children}</span>
    </div>
  );
}
