'use client';

// Founder 10-05 ("I love the Stage idea … with the Dressing Room", docs/design/profile-2026-10-05): the shared
// dress-up pieces (iOS DressUp.swift / Android DressUp.kt parity) — the door every entry opens through
// (openDressUp + DressUpHost), the one-time nudges, the living mascot (breathe + blink, hop on tap), the
// stage set (backdrop · curtains · podium, ChatGPT art) and the gold title ribbon.

import * as React from 'react';
import type { AvatarConfig } from '@wordle-duel/core';
import { avatarColorHex, avatarPickConflict, seasonNudgeDue, seasonNudgeKey, seasonalShelf } from '@wordle-duel/core';

import { MascotAvatar } from '@/components/avatar/mascot-avatar';
import { artSrc } from '@/lib/art';
import { avatarBackdrop } from '@/lib/avatar-render';
import { prefersReducedMotion } from '@/lib/motion';
import { feedback } from '@/lib/sound-events';
import { useAuth } from '@/lib/auth-context';
import { useSeason } from '@/lib/season';
import { usePlayerAvatar } from '@/components/avatar/player-avatar';
import { RoundIconButton } from '@/components/ui/family-button';

export type DressDoor =
  | { kind: 'stage' }
  | { kind: 'room'; tab: string }
  | { kind: 'partyhat' }
  | { kind: 'titles' };

const EVENT = 'wd:dressup';

let hosts = 0;

/**
 * Open Edit Profile (the Stage) through a door. Signed-in players only (DressUpHost checks). The host lives
 * on the Stats page (and Home); from anywhere else the door goes there (/stats?dress=<door>).
 */
export function openDressUp(door: DressDoor = { kind: 'stage' }) {
  if (typeof window === 'undefined') return;
  if (hosts > 0) { window.dispatchEvent(new CustomEvent<DressDoor>(EVENT, { detail: door })); return; }
  window.location.href = `/stats?dress=${encodeURIComponent(JSON.stringify(door))}`;
}

/** The door a /stats?dress=… link carries (read once by the Stats page host). */
export function doorFromUrl(): DressDoor | null {
  if (typeof window === 'undefined') return null;
  const raw = new URLSearchParams(window.location.search).get('dress');
  if (!raw) return null;
  try { return JSON.parse(raw) as DressDoor; } catch { return { kind: 'stage' }; }
}

/**
 * DEV only (iOS `-storeShot`, Android `--es dressDemo` parity; never in production builds): `?dressDemo=room-<tab>|stage|nudge`
 * opens the Dressing Room / the Stage / the seasonal Home nudge for a GUEST (nothing saves), `?dressLook=k=v,k=v`
 * overrides the look it opens on (e.g. a seasonal item saved last season). Pair with `?season=halloween|none`.
 */
export function devDressDemo(): { door: DressDoor | null; nudge: boolean; look: Record<string, string> } | null {
  if (process.env.NODE_ENV === 'production' || typeof window === 'undefined') return null;
  const q = new URLSearchParams(window.location.search);
  const d = q.get('dressDemo');
  if (!d) return null;
  const look = Object.fromEntries((q.get('dressLook') ?? '').split(',').map((kv) => kv.split('=')).filter((p) => p.length === 2));
  const door: DressDoor | null = d === 'stage' ? { kind: 'stage' } : d.startsWith('room-') ? { kind: 'room', tab: d.slice(5) } : null;
  return { door, nudge: d === 'nudge', look };
}

/** Listens for openDressUp anywhere and hands the door to the caller (the Edit Profile host). */
export function useDressUpRequests(onOpen: (door: DressDoor) => void) {
  const ref = React.useRef(onOpen);
  ref.current = onOpen;
  React.useEffect(() => {
    const h = (e: Event) => ref.current((e as CustomEvent<DressDoor>).detail ?? { kind: 'stage' });
    window.addEventListener(EVENT, h);
    hosts += 1;
    return () => { window.removeEventListener(EVENT, h); hosts -= 1; };
  }, []);
}

// ── One-time nudges (per account; never repeat once acted on or dismissed) ──

export type Nudge = 'host' | 'partyhat';
const NUDGE_EVENT = 'wd:dressup-nudge';
const nudgeKey = (n: Nudge, uid: string | null | undefined) => `wd_dressup_${n}_v1:${(uid ?? 'guest').toLowerCase()}`;

export function nudgeDone(n: Nudge, uid: string | null | undefined): boolean {
  try { return localStorage.getItem(nudgeKey(n, uid)) === '1'; } catch { return false; }
}
export function finishNudge(n: Nudge, uid: string | null | undefined) {
  try { localStorage.setItem(nudgeKey(n, uid), '1'); } catch { /* private mode */ }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(NUDGE_EVENT));
}
/** After a live win: queues the one-time party-hat card (Home) unless offered before / already hatted. */
export function noteWin(uid: string | null | undefined, ownHead?: string | null) {
  if (!uid || nudgeDone('partyhat', uid)) return;
  if (ownHead && ownHead !== 'none') { finishNudge('partyhat', uid); return; }
  try { sessionStorage.setItem('wd_dressup_partyhat_pending', '1'); } catch { /* ignore */ }
  window.dispatchEvent(new Event(NUDGE_EVENT));
}
/** Re-render on any nudge change. */
export function useNudgeVersion(): number {
  const [v, setV] = React.useState(0);
  React.useEffect(() => {
    const h = () => setV((x) => x + 1);
    window.addEventListener(NUDGE_EVENT, h);
    return () => window.removeEventListener(NUDGE_EVENT, h);
  }, []);
  return v;
}

// ── The living mascot ──

/** The idle breathe: a 1.8% squash on a 3.4 s loop (transform only; off under Reduce Motion). */
const BREATHE_CSS = '@keyframes dressBreathe{0%,100%{transform:scale(1,1)}50%{transform:scale(1.018,0.982)}}'
  + '.dress-breathe{animation:dressBreathe 3.4s ease-in-out infinite}@media (prefers-reduced-motion: reduce){.dress-breathe{animation:none}}';

const NO_BLINK = new Set(['glasses', 'sunglasses', 'cyclops', 'happy', 'none']);

/** The blink (eyes swap) and cheer (eyes + mouth swap) frames from the maker's own layers. */
export function liveFrame(c: AvatarConfig, f: 'rest' | 'blink' | 'cheer'): AvatarConfig {
  let v: AvatarConfig = { ...c, frame: 'none' };
  if (f === 'rest') return v;
  if (!NO_BLINK.has(c.eyes) && !avatarPickConflict(v, 'eyes', 'happy')) v = { ...v, eyes: 'happy' } as AvatarConfig;
  if (f === 'cheer' && c.mouth !== 'laugh' && c.mouth !== 'none' && !avatarPickConflict(v, 'mouth', 'laugh')) v = { ...v, mouth: 'laugh' } as AvatarConfig;
  return v;
}

/**
 * Your mascot, alive: an idle breathe (CSS transform loop), a blink every few seconds (the eyes layer
 * swaps), a hop + grin on tap. Three stacked cutouts (cached SVGs) + transforms only; Reduce Motion
 * keeps it still (a tap still grins).
 */
export function LiveMascot({ config, initial, size = 176, hopToken = 0, tappable = true }: {
  config: AvatarConfig; initial: string; size?: number; hopToken?: number; tappable?: boolean;
}) {
  const [frame, setFrame] = React.useState<'rest' | 'blink' | 'cheer'>('rest');
  const hopRef = React.useRef<HTMLSpanElement>(null);
  const still = React.useMemo(() => prefersReducedMotion(), []);
  React.useEffect(() => {
    if (still || NO_BLINK.has(config.eyes)) return;
    let t: number;
    const loop = () => {
      t = window.setTimeout(() => {
        setFrame((f) => (f === 'rest' ? 'blink' : f));
        window.setTimeout(() => setFrame((f) => (f === 'blink' ? 'rest' : f)), 140);
        loop();
      }, 2600 + Math.random() * 2200);
    };
    loop();
    return () => window.clearTimeout(t);
  }, [config.eyes, still]);
  const hop = React.useCallback((sound: boolean) => {
    if (sound) feedback('hop');
    setFrame('cheer');
    window.setTimeout(() => setFrame((f) => (f === 'cheer' ? 'rest' : f)), 750);
    const el = hopRef.current;
    if (still || !el || typeof el.animate !== 'function') return;
    el.animate(
      [
        { transform: 'translateY(0) scale(1, 1)' },
        { transform: 'translateY(0) scale(1.05, 0.92)', offset: 0.12 },
        { transform: 'translateY(-14%) scale(0.97, 1.04)', offset: 0.4 },
        { transform: 'translateY(2%) scale(1.04, 0.96)', offset: 0.7 },
        { transform: 'translateY(0) scale(1, 1)' },
      ],
      { duration: 620, easing: 'cubic-bezier(0.3, 1.4, 0.5, 1)' },
    );
  }, [still]);
  const first = React.useRef(true);
  React.useEffect(() => {
    if (first.current) { first.current = false; return; }
    hop(false);
  }, [hopToken, hop]);
  const frames = React.useMemo(() => ({ rest: liveFrame(config, 'rest'), blink: liveFrame(config, 'blink'), cheer: liveFrame(config, 'cheer') }), [config]);
  const body = (
    <>
    <style>{BREATHE_CSS}</style>
    <span ref={hopRef} className="relative block" style={{ width: size, height: size, transformOrigin: '50% 100%' }}>
      <span className={`absolute inset-0 block${still ? '' : ' dress-breathe'}`} style={{ transformOrigin: '50% 100%' }}>
        {(['rest', 'blink', 'cheer'] as const).map((f) => (
          <span key={f} className="absolute inset-0 block" style={{ opacity: frame === f ? 1 : 0 }}>
            <MascotAvatar config={frames[f]} initial={initial} size={size} cutout />
          </span>
        ))}
      </span>
    </span>
    </>
  );
  if (!tappable) return body;
  return (
    <button type="button" onClick={() => hop(true)} aria-label="Your mascot, tap to hop" className="block p-0 border-0 bg-transparent cursor-pointer">
      {body}
    </button>
  );
}

// ── The stage set ──

/** The player's backdrop as CSS, full-bleed on the stage (the avatar tile's backdrop, stretched). */
export function backdropCss(bg: string, color: string): string {
  const base = avatarColorHex(color);
  const b = avatarBackdrop(bg);
  if (!b) return `radial-gradient(circle at 50% 35%, ${base}22, ${base}55)`;
  const [c0, ...rest] = b.colors;
  if (b.kind === 'solid') return `radial-gradient(circle at 50% 34%, ${c0}cc, ${c0})`;
  if (b.kind === 'gradient') return `linear-gradient(135deg, ${b.colors.join(', ')})`;
  const m = rest[0] ?? '#ffffff';
  switch (b.id) {
    case 'polka': case 'confetti': return `radial-gradient(${m} 18%, transparent 20%) 0 0 / 22px 22px, ${c0}`;
    case 'starry': case 'galaxy': return `radial-gradient(${m} 1.5px, transparent 2px) 0 0 / 34px 34px, radial-gradient(#ffffff 1px, transparent 1.5px) 17px 17px / 34px 34px, ${c0}`;
    case 'sunburst': return `repeating-conic-gradient(from 0deg at 50% 100%, ${m}88 0 10deg, ${c0} 10deg 20deg)`;
    case 'checkers': return `conic-gradient(${m} 25%, ${c0} 0 50%, ${m} 0 75%, ${c0} 0) 0 0 / 36px 36px`;
    default: return c0;
  }
}

/** A dress-up art piece (pre-decoded by the browser; decorative). */
export function StageArt({ name, height, width, style, className }: { name: string; height?: number; width?: number; style?: React.CSSProperties; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={artSrc(name)} alt="" aria-hidden="true" decoding="async" draggable={false} className={className}
    style={{ height: height ?? 'auto', width: width ?? 'auto', display: 'block', pointerEvents: 'none', ...style }} />;
}

/** The stage header's side slots (× left, SAVE / DONE right): equal, so the heading centers. */
export const STAGE_SIDE_SLOT = 86;

/**
 * The Stage / Dressing Room / Title Shelves close (iOS StageCloseButton, Android StageCloseButton): the family's
 * soft 3D X, bare. On the stage it is whitened with a deep drop shadow so it reads on the curtains (the pale
 * family X disappeared there); off the stage it wears the deep violet (a masked multiply). A 44 px hit area.
 */
export function StageClose({ onClick, label = 'Close', onStage = true, disabled, className = '', style }: {
  onClick: () => void; label?: string; onStage?: boolean; disabled?: boolean; className?: string; style?: React.CSSProperties;
}) {
  const src = artSrc('art-fam-cic-close');
  return (
    <button type="button" aria-label={label} onClick={onClick} disabled={disabled} data-squish=""
      className={`w-11 h-11 flex items-center justify-center border-0 bg-transparent p-0 cursor-pointer ${className}`} style={style}>
      <span aria-hidden="true" className="relative block" style={{
        width: 24, height: 24, isolation: 'isolate',
        filter: onStage ? 'drop-shadow(0 2px 2.5px rgba(46,16,101,0.6))' : 'drop-shadow(0 2.5px 2px rgba(76,29,149,0.22))',
      }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" draggable={false} width={24} height={24} className="block"
          style={onStage ? { filter: 'grayscale(1) brightness(1.32)' } : undefined} />
        {!onStage && (
          <span className="absolute inset-0" style={{
            background: '#8b5cf6', mixBlendMode: 'multiply',
            WebkitMaskImage: `url(${src})`, maskImage: `url(${src})`, WebkitMaskSize: 'contain', maskSize: 'contain',
          }} />
        )}
      </span>
    </button>
  );
}

/** The dress-up art, decoded ahead of the Stage opening (founder: "everything loads instantly"). */
export const DRESS_ART = [
  'art-dress-podium', 'art-dress-curtain-l', 'art-dress-curtain-r', 'art-dress-bulbs', 'art-dress-ribbon-l', 'art-dress-ribbon-m',
  'art-dress-ribbon-r', 'art-dress-tag-new', 'art-dress-tag-pro', 'art-dress-tag-dressup', 'art-dress-bubble', 'art-dress-partyhat',
  'art-dress-none', 'art-dress-shelf-l', 'art-dress-shelf-m', 'art-dress-shelf-r', 'art-dress-plaque', 'art-dress-title', 'art-dress-lock',
  'art-fam-cic-close',
  ...['body', 'color', 'pattern', 'eyes', 'nose', 'mouth', 'hats', 'extras', 'backdrop', 'frame'].map((t) => `art-dress-tab-${t}`),
];
let warmed = false;
export function warmDressArt() {
  if (warmed || typeof Image === 'undefined') return;
  warmed = true;
  for (const n of DRESS_ART) { const im = new Image(); im.decoding = 'async'; im.src = artSrc(n); void im.decode?.().catch(() => {}); }
}

/**
 * The Stage: the player's backdrop, soft curtains at the sides, a spotlight, the podium (ChatGPT stage set)
 * and the living mascot (or the framed photo) standing on it. `children` sit on top (the header row).
 */
export function DressStage({ config, initial, photo, height = 300, mascotSize = 176, hopToken = 0, curtains = true, bulbs = false, children, rounded = true }: {
  config: AvatarConfig; initial: string; photo?: React.ReactNode; height?: number; mascotSize?: number; hopToken?: number;
  curtains?: boolean; bulbs?: boolean; children?: React.ReactNode; rounded?: boolean;
}) {
  const podiumW = Math.min(232, mascotSize * 1.34);
  const podiumH = podiumW * (241 / 555);
  return (
    <div className="relative w-full overflow-hidden" style={{ height, background: backdropCss(config.bg, config.color), borderRadius: rounded ? '0 0 28px 28px' : 0 }}>
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 100%, rgba(255,255,255,0.42), rgba(255,255,255,0) 70%)' }} />
      {curtains && (
        <>
          <StageArt name="art-dress-curtain-l" height={height * 0.78} className="absolute left-0 top-0" />
          <StageArt name="art-dress-curtain-r" height={height * 0.78} className="absolute right-0 top-0" />
        </>
      )}
      {bulbs && <StageArt name="art-dress-bulbs" width={280} className="absolute top-1.5 left-1/2 -translate-x-1/2" />}
      <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center" style={{ bottom: 10 }}>
        <StageArt name="art-dress-podium" width={podiumW} />
        <div className="absolute left-1/2 -translate-x-1/2 flex justify-center" style={{ bottom: podiumH * 0.42 }}>
          {photo ?? <LiveMascot config={config} initial={initial} size={mascotSize} hopToken={hopToken} />}
        </div>
      </div>
      {children}
    </div>
  );
}

/**
 * The featured title as a gold ribbon (three-slice ChatGPT art, so it stretches); long titles shrink to fit
 * (never wrap or truncate). `placeholder` = the soft "Choose a title" state.
 */
export function TitleRibbon({ text, height = 28, maxWidth = 260, placeholder = false }: { text: string; height?: number; maxWidth?: number; placeholder?: boolean }) {
  const cap = height * (147 / 120);
  const ref = React.useRef<HTMLSpanElement>(null);
  const base = height * 0.43;
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let s = base;
    el.style.fontSize = `${s}px`;
    while (el.scrollWidth > el.clientWidth + 1 && s > base * 0.4) { s -= 0.5; el.style.fontSize = `${s}px`; }
  }, [text, base]);
  return (
    <span className="relative inline-flex items-center justify-center" style={{ height, maxWidth, opacity: 1 }} aria-label={placeholder ? text : `Title, ${text}`}>
      <span className="absolute inset-0 flex" style={{ opacity: placeholder ? 0.55 : 1 }} aria-hidden="true">
        <StageArt name="art-dress-ribbon-l" height={height} style={{ width: cap }} />
        <span className="flex-1" style={{ background: `url(${artSrc('art-dress-ribbon-m')}) 0 0 / 100% 100%` }} />
        <StageArt name="art-dress-ribbon-r" height={height} style={{ width: cap }} />
      </span>
      <span ref={ref} className="relative whitespace-nowrap overflow-hidden font-black uppercase"
        style={{ padding: `0 ${cap * 0.8}px`, letterSpacing: 0.6, color: placeholder ? '#92400eb3' : '#7c2d12', lineHeight: 1, transform: `translateY(${-height * 0.07}px)`, maxWidth }}>
        {text}
      </span>
    </span>
  );
}

/** Door 3: the one-time "Party hat?" card on Home after the first win. Never on top of a game. */
export function PartyHatOffer() {
  const { user, profile } = useAuth();
  useNudgeVersion();
  const uid = user ? profile?.id ?? null : null;
  let pending = false;
  try { pending = typeof window !== 'undefined' && sessionStorage.getItem('wd_dressup_partyhat_pending') === '1'; } catch { /* ignore */ }
  if (!uid || !pending || nudgeDone('partyhat', uid)) return null;
  const done = () => { try { sessionStorage.removeItem('wd_dressup_partyhat_pending'); } catch { /* ignore */ } finishNudge('partyhat', uid); };
  return (
    <div className="flex items-center gap-2.5 pl-2.5 pr-1 py-2 rounded-[18px]" style={{ background: 'linear-gradient(90deg, #fce7f3, #ede9fe)' }}>
      <StageArt name="art-dress-partyhat" height={50} />
      <div className="flex-1 min-w-0">
        <div className="text-[15px] font-black truncate" style={{ color: '#6d28d9' }}>First win! Party hat?</div>
        <div className="text-[11px] font-bold truncate" style={{ color: '#7a6aa6' }}>Your mascot wants to celebrate.</div>
      </div>
      <button type="button" className="candy candy-pink candy-sm" onClick={() => { done(); openDressUp({ kind: 'partyhat' }); }}><span className="candy-label">Yes!</span></button>
      <RoundIconButton icon="close" label="No thanks" size={22} onClick={done} className="-my-1" />
    </div>
  );
}

/**
 * The one-time seasonal nudge (10-05, the party-hat card's pattern): first Home open in a season with a mascot shelf
 * ("Dress up for Halloween?"), only for players not already wearing one of its parts. Yes opens the Dressing Room on
 * the seasonal shelf; Yes or × end it for this season (it comes back next year). core seasonNudgeDue.
 */
const seasonSeenKey = (uid: string) => `wd_dressup_season_v1:${uid.toLowerCase()}`;
function seasonSeen(uid: string): string[] {
  try { const v = JSON.parse(localStorage.getItem(seasonSeenKey(uid)) ?? '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
}
export function SeasonDressOffer() {
  const { user, profile } = useAuth();
  useNudgeVersion();
  const season = useSeason();
  const demo = devDressDemo()?.nudge ? 'dev-demo' : null;   // DEV ?dressDemo=nudge: the card for a guest
  const uid = user ? profile?.id ?? null : demo;
  const own = usePlayerAvatar({ name: profile?.username ?? null, userId: user ? uid : null });
  if (!uid || !season) return null;
  const due = seasonNudgeDue(new Date(), season, own.config, seasonSeen(uid));
  if (!due) return null;
  const shelf = seasonalShelf(due);
  const title = due.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  const done = () => {
    try { localStorage.setItem(seasonSeenKey(uid), JSON.stringify([...seasonSeen(uid), seasonNudgeKey(due, new Date())])); } catch { /* private mode */ }
    window.dispatchEvent(new Event(NUDGE_EVENT));
  };
  return (
    <div className="flex items-center gap-2 pl-2 pr-0.5 py-2 rounded-[18px]" style={{ background: 'linear-gradient(90deg, #ffedd5, #ede9fe)' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={artSrc(`art-av-acc-${shelf[0]?.id ?? 'pumpkinhat'}`)} alt="" aria-hidden="true" draggable={false} style={{ height: 40, width: 40, objectFit: 'contain' }} />
      <div className="flex-1 min-w-0">
        {/* 14 px so "Dress up for Halloween?" fits a 390 px phone beside Yes + × */}
        <div className="text-[14px] font-black truncate tracking-[-0.2px]" style={{ color: '#6d28d9' }}>Dress up for {title}?</div>
        <div className="text-[11px] font-bold truncate" style={{ color: '#7a6aa6' }}>Free looks for the season.</div>
      </div>
      <button type="button" className="candy candy-pink candy-sm" onClick={() => { done(); openDressUp({ kind: 'room', tab: 'season' }); }}><span className="candy-label">Yes!</span></button>
      <RoundIconButton icon="close" label="No thanks" size={22} onClick={done} className="-my-1" />
    </div>
  );
}

/** Door 2: "Make me yours!" beside the plain Home host (× ends it for good). */
export function HostInviteBubble({ uid }: { uid: string }) {
  return (
    <span className="relative inline-block">
      <button type="button" onClick={() => { finishNudge('host', uid); openDressUp({ kind: 'room', tab: 'body' }); }}
        className="relative block border-0 bg-transparent p-0 cursor-pointer" aria-label="Make me yours! Dress up your mascot">
        <span className="absolute inset-0" style={{ background: `url(${artSrc('art-dress-bubble')}) 0 0 / 100% 100%` }} aria-hidden="true" />
        <span className="relative block whitespace-nowrap text-xs font-black" style={{ color: '#6d28d9', padding: '8px 14px 13px' }}>Make me yours!</span>
      </button>
      {/* Button family §3: the soft 3D X (44 px hit area centered on the bubble's corner). */}
      <RoundIconButton icon="close" label="Dismiss" size={18} onClick={() => finishNudge('host', uid)} className="absolute -top-[18px] -right-[18px]" />
    </span>
  );
}
