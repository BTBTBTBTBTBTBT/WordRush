'use client';

import { Swords } from 'lucide-react';
import { CastLoader, LoadingTip } from '@/components/ui/cast-loader';
import { PageHeader } from '@/components/ui/page-header';
import { LetterTileAvatar } from '@/components/ui/letter-tile-avatar';
import { PlayerAvatar } from '@/components/avatar/player-avatar';
import { CandyButton, type CandyIconName, type CandySize } from '@/components/ui/candy-button';
import { CastButton } from '@/components/ui/cast-button';
import type { MascotId } from '@/lib/mascots';
import { MODE_BY_DBKEY } from '@/lib/modes.generated';
import { MODE_CHROME } from '@/components/home/mode-chrome';
import { isGameArtIcon, type TitleArtName } from '@/lib/art';
import { VS, modeColor, modeTitle } from '@/lib/vs-lobby';
import { SOFT, alphaHex, cardBarStyle, overAlpha, softMix, softShadow } from '@/lib/soft-surface';
import { botArt, type BotPose } from '@/lib/bot/bot-personas';

import { HeadingArt, type HeadingSlug } from '@/components/ui/heading-art';
// Shared pieces of the VS screens (VS overhaul, spec docs/VS_REDESIGN_SPEC.md
// §0; finishing build docs/FINISH_SPEC.md D3): the real mode icons from the
// home cards, the mode chip, section labels, the teal nav, the tinted VS cards
// (A1), the candy buttons in the VS teal (A8), avatars, the bots' own
// characters (D1) and the player's faded letter tile for "Your Ghost".

/** The VS accent family's card / button color (candy teal's bottom stop). */
export const VS_ACCENT = '#0d9488';

/**
 * VS pages are light-only (PageBackground scheme="light"): pin the light theme's
 * surface + text tokens on the page root so every A1 wash (laid over
 * --color-card-base) and every shared piece that reads the theme tokens (the
 * result boards, modals) stays light and legible in the dark theme too.
 */
export const VS_LIGHT_VARS = {
  '--color-bg': '#f8f7ff',
  '--color-surface': '#f5eeff',
  '--color-card-base': '#ffffff',
  '--color-border': '#e6dcf6',
  '--color-border-light': '#e0d4f4',
  '--color-text': '#1a1a2e',
  '--color-text-muted': '#6b7280',
  '--color-text-secondary': '#6b7280',
  '--color-surface-hover': '#eee4fd',
  '--color-surface-alt': '#f1eafc',
  '--color-border-alt': '#e4daf3',
  '--color-divider': '#ece4f8',
} as React.CSSProperties;

/** The home card's icon for a VS mode: the game's 3D art, else the old glyph (roman numeral for Quad/Octo) in `color`. */
export function VsModeIcon({ mode, size = 16, color }: { mode: string; size?: number; color?: string }) {
  const meta = MODE_BY_DBKEY[mode];
  const ink = color ?? modeColor(mode);
  const chrome = meta ? MODE_CHROME[meta.id]?.icon : null;
  // The game's 3D art (docs/ART_SPEC.md §3) fills the tile the glyph sat in.
  if (chrome && isGameArtIcon(chrome)) {
    const Art = chrome;
    return <Art style={{ width: size, height: size, color: ink }} />;
  }
  if (meta?.romanNumeral) {
    return <span className="font-black leading-none" style={{ color: ink, fontSize: meta.romanNumeral.length > 2 ? size * 0.55 : size * 0.72 }}>{meta.romanNumeral}</span>;
  }
  const Icon = chrome || Swords;
  return <Icon style={{ width: size, height: size, color: ink }} />;
}

/** A mode's icon in a mini game card (A1 icon tile: wash + border + a 4 px top bar), light-pinned. */
export function VsModeTile({ mode, size = 24, icon }: { mode: string; size?: number; icon?: number }) {
  return (
    <span className="flex items-center justify-center shrink-0" style={{ width: size, height: size, ...vsIconTile(modeColor(mode), Math.round(size * 0.3)) }}>
      <VsModeIcon mode={mode} size={icon ?? Math.round(size * 0.54)} />
    </span>
  );
}

/** Icon tile + mode name in its color (nav right side on the Friend and Bots pages). */
export function ModeChip({ mode }: { mode: string }) {
  const color = modeColor(mode);
  return (
    <span className="flex items-center gap-1.5">
      <VsModeTile mode={mode} size={24} icon={13} />
      <span className="text-[11px] font-black uppercase" style={{ color, letterSpacing: 0.6 }}>{modeTitle(mode)}</span>
    </span>
  );
}

export function SectionLabel({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between pt-1">
      <span className="text-[11px] font-black uppercase" style={{ letterSpacing: 1.2, color: VS.label }}>{children}</span>
      {right}
    </div>
  );
}

/**
 * The VS page header (HEADER_SPEC §4): the shared PageHeader in the VS teal —
 * the bare 3D back glyph, the gradient caps title, the host when no banner
 * below carries it, and a right slot.
 */
export function VsNav({ title, onBack, right, host, art, artLabel, heading }: {
  title: string; onBack: () => void; right?: React.ReactNode; host?: MascotId;
  /** Whole-cast title art in place of the text title (docs/ART_SPEC.md §2). */
  art?: TitleArtName; artLabel?: string;
}) {
  /** FINISH_SPEC BJ16: a heading lettering (art-titlecast-<slug>) in place of the text title. */
  heading?: HeadingSlug;
  return <PageHeader title={title} art={art} artLabel={artLabel} accent="vs" back={{ onClick: onBack }} host={host} right={right} />;
  if (heading) {
    return <PageHeader title={<HeadingArt slug={heading} height={36} maxWidth={240} />} titleTag="div" accent="vs" back={{ onClick: onBack }} right={right} />;
  }
}

// ── A1 tinted surfaces (light-pinned: VS pages are light-only) ──────────────

/**
 * A VS card (A1): the accent's soft wash over white, its 1.5 px soft border, a
 * soft accent shadow; `selected` = the stronger wash + a 2 px accent ring.
 * Pair with <CardBar/> for the 10 px game-card top bar (needs overflow hidden).
 */
export function vsCard(accent: string = VS_ACCENT, { selected = false, radius = 16, shadow = true }: { selected?: boolean; radius?: number; shadow?: boolean } = {}): React.CSSProperties {
  const share = selected ? SOFT.strong : SOFT.tint;
  const wash = alphaHex(accent, share);
  return {
    background: `linear-gradient(${wash}, ${wash}), #ffffff`,
    border: selected ? `2px solid ${accent}` : `1.5px solid ${alphaHex(accent, overAlpha(SOFT.line, share))}`,
    borderRadius: radius,
    boxShadow: shadow ? softShadow(accent, selected ? 0.2 : 0.12) : undefined,
  };
}

/** A mini game card for icons (A1): wash + border + a 4 px accent top bar + a soft accent shadow. */
export function vsIconTile(accent: string, radius = 10): React.CSSProperties {
  const wash = alphaHex(accent, SOFT.tint);
  return {
    background: `linear-gradient(${wash}, ${wash}), #ffffff`,
    border: `1.5px solid ${alphaHex(accent, overAlpha(SOFT.line, SOFT.tint))}`,
    borderRadius: radius,
    boxShadow: `inset 0 ${SOFT.iconBar}px 0 ${accent}, 0 3px 8px ${alphaHex(accent, 0.2)}`,
  };
}

/** FINISH_SPEC A1 / WHITE_AUDIT lever 2: the VS card in the VS teal. */
export const vsCardStyle: React.CSSProperties = vsCard(VS_ACCENT, { radius: 14 });

/** The game-card top bar (10 px) in the accent; the card needs `overflow: hidden`. */
export function CardBar({ accent = VS_ACCENT, height }: { accent?: string; height?: number }) {
  return <span aria-hidden="true" className="block shrink-0" style={cardBarStyle(accent, height)} />;
}

/** A tinted VS card with its top bar. */
export function VsCard({ accent = VS_ACCENT, selected, radius = 16, bar = true, className = '', style, children }: {
  accent?: string; selected?: boolean; radius?: number; bar?: boolean; className?: string; style?: React.CSSProperties; children?: React.ReactNode;
}) {
  return (
    <div className={`overflow-hidden ${className}`} style={{ ...vsCard(accent, { selected, radius }), ...style }}>
      {bar && <CardBar accent={accent} />}
      {children}
    </div>
  );
}

// ── Avatars ─────────────────────────────────────────────────────────────────

/**
 * A player's avatar (FINISH_SPEC AN5 / AN6): their photo as a rounded square,
 * else their mascot (the row's avatar_config, else the default seeded by
 * `userId` / name), in their frame; the signed-in player's own always comes
 * from their profile. AM2: `emoji` is never drawn.
 */
export function InitialAvatar({ name, url, accent, size = 34, castId, level, userId, config, pro }: {
  name: string; url?: string | null;
  /** Retired (AM2): never drawn. */
  emoji?: string | null;
  accent?: string | null; size?: number;
  /** Legacy AH avatar_cast_id when the data carries it. */
  castId?: string | null;
  level?: number | null;
  /** FINISH_SPEC AN3: the row's user id / avatar_config / Pro flag when the data carries them. */
  userId?: string | null;
  config?: unknown;
  pro?: boolean | null;
}) {
  return <PlayerAvatar name={name} userId={userId} url={url} accent={accent} config={config} castId={castId} level={level} pro={pro} size={size} />;
}

/**
 * "Your Ghost" (D1): the player's best run replayed, drawn as a faded version
 * of the player's own mascot (opacity .45; AN5) — never a bot character.
 */
export function GhostAvatar({ name, emoji, accent, size = 36 }: { name: string; emoji?: string | null; accent?: string | null; size?: number }) {
  return <LetterTileAvatar name={name || 'You'} emoji={emoji} accent={accent} size={size} style={{ opacity: 0.45 }} />;
}

/**
 * A bot's character in a soft tinted circle (§9 — never an emoji). `src` is the
 * pose art (lib/bot/bot-personas botArt); the art is decorative — the bot's
 * name is always printed beside it.
 */
export function BotAvatar({ src, size = 36, ring, bg, accent = VS_ACCENT, faded = false }: {
  src: string; name?: string; size?: number; ring?: string; bg?: string; accent?: string; faded?: boolean;
}) {
  return (
    <span
      className="rounded-full flex items-center justify-center shrink-0 overflow-hidden"
      style={{ width: size, height: size, background: bg ?? `radial-gradient(circle at 50% 35%, #ffffff, ${softMix(accent, 0.22)})`, boxShadow: ring ?? `inset 0 0 0 1.5px ${alphaHex(accent, 0.3)}`, opacity: faded ? 0.5 : 1, filter: faded ? 'grayscale(0.6)' : undefined }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" aria-hidden="true" loading="lazy" decoding="async" width={Math.round(size * 0.96)} height={Math.round(size * 0.96)} draggable={false} style={{ width: size * 0.96, height: size * 0.96, objectFit: 'contain', marginTop: size * 0.06 }} />
    </span>
  );
}

/** A cast bot by id in a pose, in its tinted circle. */
export function BotPoseAvatar({ id, pose = 'ready', accent, size = 36, ring, faded }: { id: string; pose?: BotPose; accent?: string; size?: number; ring?: string; faded?: boolean }) {
  return <BotAvatar src={botArt(id, pose)} accent={accent} size={size} ring={ring} faded={faded} />;
}

/** A bot's full character in a pose, unframed (intro, results, the Bot of the Day card). Decorative. */
export function BotFigure({ id, pose = 'ready', size = 96, className = '', style }: { id: string; pose?: BotPose; size?: number; className?: string; style?: React.CSSProperties }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={botArt(id, pose)} alt="" aria-hidden="true" decoding="async" width={Math.round(size)} height={Math.round(size)} draggable={false} className={`shrink-0 select-none ${className}`} style={{ width: size, height: size, objectFit: 'contain', filter: 'drop-shadow(0 6px 10px rgba(59,26,120,0.18))', ...style }} />;
}

/** A bot's line in its own voice: a tinted speech bubble pointing at the character (kind, never mean). */
export function BotSpeech({ text, accent = VS_ACCENT, side = 'left' }: { text: string; accent?: string; side?: 'left' | 'right' }) {
  const wash = alphaHex(accent, 0.16);
  return (
    <span
      className="relative inline-block text-[12.5px] font-extrabold px-3 py-2 text-left"
      style={{ background: `linear-gradient(${wash}, ${wash}), #ffffff`, border: `1.5px solid ${alphaHex(accent, 0.4)}`, borderRadius: 14, color: VS.deep, boxShadow: softShadow(accent, 0.14, 10, 3) }}
    >
      {text}
      <span
        aria-hidden="true"
        className="absolute"
        style={{
          top: '50%', [side === 'left' ? 'left' : 'right']: -7, width: 12, height: 12, marginTop: -6,
          background: softMix(accent, 0.16), borderLeft: side === 'left' ? `1.5px solid ${alphaHex(accent, 0.4)}` : undefined,
          borderBottom: side === 'left' ? `1.5px solid ${alphaHex(accent, 0.4)}` : undefined,
          borderRight: side === 'right' ? `1.5px solid ${alphaHex(accent, 0.4)}` : undefined,
          borderTop: side === 'right' ? `1.5px solid ${alphaHex(accent, 0.4)}` : undefined,
          transform: 'rotate(45deg)',
        }}
      />
    </span>
  );
}

// ── A8 candy buttons in the VS roles ────────────────────────────────────────

/** The primary VS action: a teal candy button. */
export function TealButton({ children, onClick, disabled, size = 'md', block = false, icon, className = '' }: {
  children: React.ReactNode; onClick?: () => void; disabled?: boolean; size?: CandySize; block?: boolean; icon?: CandyIconName | React.ReactNode; className?: string;
}) {
  return <CastButton screen="blue" color="teal" size={size} block={block} icon={icon} onClick={onClick} disabled={disabled} className={className}>{children}</CastButton>;
}

/** A small row action (Challenge, Race it): a small teal candy pill. */
export function SoftPill({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) {
  return <CastButton screen="blue" color="teal" size="sm" onClick={onClick} disabled={disabled} className="shrink-0">{children}</CastButton>;
}

/** Centered teal ring spinner (VS polish §2 — loading, sending, starting). */
export function VsRingSpinner({ size = 44 }: { size?: number }) {
  return (
    <span
      className="block rounded-full animate-spin"
      style={{ width: size, height: size, border: `${Math.max(3, Math.round(size / 11))}px solid ${VS.soft}`, borderTopColor: VS.ink }}
      aria-hidden="true"
    />
  );
}

/**
 * The VS loading screen (VS polish §2): the mode icon in its tile, the cast
 * loader (it replaced the teal ring spinner) and `LOADING <MODE>` on the VS page — never bare text or a
 * blank screen while the match or its word lists load.
 */
export function VsLoadingScreen({ mode, label }: { mode: string; label?: string }) {
  return (
    <div
      className="h-screen-stable flex flex-col items-center justify-center gap-4 px-6"
      style={{ backgroundColor: VS.page, paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
      role="status"
      aria-live="polite"
    >
      <VsModeTile mode={mode} size={52} icon={26} />
      {/* The cast waves in place of the spinner (docs/MASCOT_SPEC.md §3). */}
      <CastLoader />
      <span className="text-[12px] font-black uppercase" style={{ color: VS.label, letterSpacing: 1.2 }}>
        {label ?? `Loading ${modeTitle(mode)}`}
      </span>
      <LoadingTip color={VS.label} />
    </div>
  );
}

/** Small solid teal `VS` pill beside a match title (VS polish §1). */
export function VsPill() {
  return (
    <span
      className="inline-flex items-center justify-center font-black text-white shrink-0"
      style={{ background: VS.ink, borderRadius: 999, fontSize: 11, letterSpacing: 0.8, height: 20, padding: '0 8px' }}
    >
      VS
    </span>
  );
}
