'use client';

import { createContext, useContext, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Icon3D, type Icon3DName } from '@/components/ui/icon3d';
import { GameArt } from '@/components/ui/game-art';
import { isGameArtIcon, onPageShadow } from '@/lib/art';
import { SOFT, accentInk, alphaHex, softBackground } from '@/lib/soft-surface';
import { formatGuessStat, formatShortTime } from '@/lib/format';
import type { DailyCompletion } from '@/lib/daily-service';
import type { HomeCard } from './mode-chrome';
import { modeCardSlots } from '@/lib/stationary-layout';
import { TRIM, compactCardLine, seasonTrimStops, trimPath } from '@/lib/card-trim';
import { createCardNameScope, type CardNameScopeStore } from '@/lib/card-name-size';

// The home-grid mode card, extracted verbatim from app/page.tsx (More Games
// Stage 5) so the More Games sheet renders the SAME card pixel for pixel. The
// markup below is the grid's; only the inputs are now props. §255's fixed
// two-line subtitle box is kept so Daily⇄Unlimited never reflows the grid.

export type CardBadge = 'W' | 'L' | '✓' | null;

/** The 3D completion badge for a card badge (docs/ART_SPEC.md §4). */
export const BADGE_ICON: Record<'W' | 'L' | '✓', Icon3DName> = { W: 'badge-w', L: 'badge-l', '✓': 'badge-check' };
const BADGE_LABEL: Record<'W' | 'L' | '✓', string> = { W: 'Won', L: 'Lost', '✓': 'Played' };

export interface ModeCardState {
  isDailyDone: boolean;
  isLocked: boolean;
  badge: CardBadge;
  subtitle: string;
}

/**
 * Everything the card needs to know, derived once so the grid and the sheet
 * cannot disagree. `dailyResult` is today's row for this mode (Daily mode
 * only); `vsWon` is the daily-VS outcome for the VS card; `playedToday` is
 * the play-limit cache's answer; `subtitleOverride` is the More Games tile's
 * "N of M played" line, which replaces the description and never locks.
 */
export function modeCardState(args: {
  card: HomeCard;
  playMode: 'daily' | 'unlimited';
  dailyResult?: DailyCompletion;
  vsWon?: boolean | null;
  playedToday: boolean;
  isPro: boolean;
  signedIn: boolean;
  resetCountdownText: string;
  subtitleOverride?: string | null;
}): ModeCardState {
  const { card, playMode, dailyResult, vsWon, playedToday, isPro, signedIn, subtitleOverride } = args;
  if (subtitleOverride != null) {
    return { isDailyDone: false, isLocked: false, badge: null, subtitle: subtitleOverride };
  }
  const isVs = card.id === 'vs';
  // VS has no daily_results row; reflect its completed state from the
  // play-limit cache so the card shows "played" like other modes.
  const isDailyDone = !!dailyResult || (isVs && playMode === 'daily' && (vsWon != null || playedToday));
  // Freemium users: lock card once the daily is done OR the play-limit cache
  // says played. isDailyDone covers modes whose play-limit modeId was
  // recorded under the wrong key.
  const isLocked = !isPro && signedIn && (isDailyDone || playedToday);
  const badge: CardBadge = !isDailyDone ? null
    : dailyResult ? (dailyResult.won ? 'W' : 'L')
    : vsWon != null ? (vsWon ? 'W' : 'L')
    : '✓';
  const subtitle = isDailyDone
    ? (dailyResult
        ? compactCardLine(`${formatGuessStat(card.guessSemantics, card.guessBase, dailyResult.guesses)} · ${formatShortTime(dailyResult.timeSeconds)}`)
        : 'Played today')
    : isLocked
    // BJ6 (founder 10-03, one of each thing on Home): the reset countdown lives once, in the
    // banner's meta line — a locked card no longer repeats it.
    ? 'Played today'
    : card.desc;
  return { isDailyDone, isLocked, badge, subtitle };
}

/**
 * The card's measures (FINISH_SPEC BH2, the compact card; was §18.2's 10 band / 52 icon / 2-line
 * subtitle at ~104 tall). Founder 10-03 ("align at the tops … clear off some of the empty space"):
 * ONE top row — the 40 icon, the name 900 / 17 (one line, shrinks for long names, never wraps)
 * and the W / L / ✓ badge (22) at the row's end — all top-aligned on one line, the subtitle 13 /
 * 500 4 under the name (one line). Under the candy trim (9 + its drips) with 7 / 9 padding the
 * card hugs it: 66 tall. The VS Battle card reuses the surface, trim and padding (§21.5).
 */
export const MODE_CARD = {
  radius: 16, band: TRIM.band, icon: 40, name: 17, nameMin: 11, nameMinLast: 10.5, desc: 13,
  titleLine: 21, descGap: 4, descLine: 16, badge: 22, padX: 10, padY: 9, padTop: 7, height: 66,
} as const;

/**
 * The game card's surface (§18.2 / §21.5; FINISH_SPEC A1 — no plain white; BH4 — no strokes):
 * every card takes a soft wash of its game's accent (≈13% over white), radius 16 and the page's
 * tinted shadow. A finished daily gets a stronger wash so "played" still reads; a locked card a
 * gray wash. Shared with the VS Battle card so all of Home is one card style. Dark mode keeps
 * the dark surface under the wash (--color-card-base).
 */
export function modeCardSurface(accent: string, { done = false, locked = false }: { done?: boolean; locked?: boolean } = {}): CSSProperties {
  if (locked) return { background: softBackground('#9ca3af', SOFT.tint), borderRadius: MODE_CARD.radius, boxShadow: onPageShadow() };
  // Founder 10-05 (2.7.1, "the finished game color" vanished under Haunted glass): a DARK season
  // hands the document --season-done-pct / --season-idle-pct / --season-done-glow (season-kit
  // SEASON_DONE), so a finished daily wears a deep glass of its game color and an accent glow while
  // an unplayed card stays plain night glass. Out of season the fallbacks are the normal 20% / 13%
  // wash and no glow. iOS GameCardChrome, Android gameCardBg.
  const wash = `color-mix(in srgb, ${accent} var(${done ? '--season-done-pct, 20%' : '--season-idle-pct, 13%'}), transparent)`;
  return {
    background: `linear-gradient(${wash}, ${wash}), var(--color-card-base, #ffffff)`,
    borderRadius: MODE_CARD.radius,
    // §11: lifts off the page tint with the page's tinted shadow (+ the finished glow in a dark season).
    boxShadow: done ? `0 0 var(--season-done-glow, 0px) ${alphaHex(accent, 0.55)}, ${onPageShadow('0 0 #0000')}` : onPageShadow(),
  };
}

/**
 * The candy cap trim across the card's top (FINISH_SPEC BH1; replaces the flat band): one SVG
 * path — a slim glossy band in the game's color with a row of frosting drips along its bottom.
 * It takes `band` of the card's flow; the drips hang over the padding below it. The card's
 * rounded clip rounds its top corners. Static: no blur, no shadow, no animation.
 */
export function ModeCardBand({ accent, locked = false }: { accent: string; locked?: boolean }) {
  const gid = `trim${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <div aria-hidden="true" className="relative pointer-events-none" style={{ height: TRIM.band, zIndex: 1 }}>
      <svg
        className="absolute inset-x-0 top-0 block"
        width="100%"
        height={TRIM.band + TRIM.drip}
        viewBox={`0 0 ${TRIM.viewW} ${TRIM.band + TRIM.drip}`}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            {seasonTrimStops(accent, locked).map(([o, c]) => <stop key={o} offset={o} style={{ stopColor: c }} />)}
          </linearGradient>
        </defs>
        <path d={TRIM_PATH} fill={`url(#${gid})`} />
      </svg>
    </div>
  );
}

const TRIM_PATH = trimPath();

/**
 * The slot at the right end of a title line (§21.1): the 3D badge (or
 * lock) at its own size, vertically centered on the name's line
 * box, without making the line taller (the art overflows the box evenly).
 * Used by the VS Battle card; the game cards pin their badge to the icon (BH2).
 */
export function TitleLineSlot({ children, line = MODE_CARD.titleLine }: { children: ReactNode; line?: number }) {
  return (
    <span className="shrink-0 flex items-center justify-center" style={{ height: line, minWidth: MODE_CARD.badge }}>
      {children}
    </span>
  );
}

/**
 * `unlimited`: Pro's Unlimited mode (home redesign, 2026-10-01): no badges. FINISH_SPEC Y: no infinity
 * mark; Z: the badge slot and the one-line subtitle box exist in both modes (empty when a mode has
 * nothing for them), so Daily ⇄ Unlimited never moves or resizes a card (lib/stationary-layout.ts).
 *
 * Layout (FINISH_SPEC BH): a compact card 66 tall, radius 16, no stroke, with the candy trim across
 * its rounded top; under it one top-aligned row: the glossy game icon at 40 (no chip box), the game
 * name in its accent (900, 17, one line, shrinking for long names) and the 3D W / L / ✓ badge (or
 * the lock) at the row's end; ONE muted subtitle line (13, ellipsis) 4 under the name. No
 * disclosure chevron (§21.4).
 */
export function ModeCard({ card, state, unlimited = false }: { card: HomeCard; state: ModeCardState; unlimited?: boolean }) {
  const { isDailyDone, isLocked, badge, subtitle } = state;
  const Icon = card.icon;
  // The old glyph (lucide / custom / roman numeral), drawn only when the art is missing.
  const glyph = Icon && isGameArtIcon(Icon)
    ? null
    : card.romanNumeral
    ? <span className="text-[16px] font-black leading-none" style={{ color: card.accentColor }}>{card.romanNumeral}</span>
    : Icon
    ? <Icon className="w-6 h-6" style={{ color: card.accentColor }} />
    : null;
  // One slot at the end of the title row: the W / L / ✓ badge once today's daily is on
  // the books (§4); otherwise the lock; Unlimited leaves it empty.
  const slot = unlimited ? null
    : isDailyDone && badge
    ? <Icon3D name={BADGE_ICON[badge]} size={MODE_CARD.badge} label={BADGE_LABEL[badge]} />
    : isLocked && isDailyDone
    ? <Icon3D name="lock" size={14} label="Locked" />
    : null;
  const slots = modeCardSlots(unlimited ? 'unlimited' : 'daily');
  return (
    <div
      data-squish="card"
      className={`relative cursor-pointer overflow-hidden flex flex-col ${isLocked ? 'opacity-60' : ''}`}
      style={{ ...modeCardSurface(card.accentColor, { done: isDailyDone, locked: isLocked }), minHeight: MODE_CARD.height }}
    >
      {/* BH1: the candy cap trim in the game's color, rounded with the card. */}
      <ModeCardBand accent={card.accentColor} locked={isLocked} />

      {/* Founder 10-03: icon, name and badge share ONE top line; the subtitle sits right under the name. */}
      <div className="flex items-start gap-2" style={{ padding: `${MODE_CARD.padTop}px ${MODE_CARD.padX}px ${MODE_CARD.padY}px` }}>
        {/* Icon — the game's art when daily is done (even if locked); the lock only when locked without a result. */}
        <div className="shrink-0 flex items-center justify-center" style={{ width: MODE_CARD.icon, height: MODE_CARD.icon }}>
          {(isLocked && !isDailyDone)
            ? <Icon3D name="lock" size={26} />
            : <GameArt id={card.id} size={MODE_CARD.icon} fallback={glyph} />}
        </div>
        <div className="flex-1 min-w-0 flex flex-col" style={{ minHeight: slots.textHeight }} data-testid="mode-card-text">
          {/* The name's cap height sits on the icon's top edge (the line box's top air pulled up). */}
          <div className="flex items-start gap-1" style={{ marginTop: -3 }}>
            <div className="flex-1 min-w-0">
              <FitName color={isLocked ? 'var(--color-text-muted)' : null} accent={card.accentColor}>{card.title}</FitName>
            </div>
            {/* Z: the slot is always there (empty in Unlimited / before a result) so the name never reflows. */}
            <span className="shrink-0 flex items-start justify-center" style={{ width: slots.titleSlotWidth, height: MODE_CARD.titleLine, paddingTop: 1 }}>
              {slot}
            </span>
          </div>
          {/* Z: a fixed one-line box, the same in both modes. */}
          <FitDesc key={unlimited ? 'u' : 'd'} height={slots.descHeight}>{subtitle}</FitDesc>
        </div>
      </div>
    </div>
  );
}

const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

// BJ18: the shared-size store lives in lib/card-name-size.ts (pure, unit-tested).
const CardNameScopeContext = createContext<CardNameScopeStore | null>(null);

/** Wrap ONE grid of mode cards so their names share one size (BJ18). */
export function CardNameScope({ children }: { children: ReactNode }) {
  const [store] = useState(createCardNameScope);
  return <CardNameScopeContext.Provider value={store}>{children}</CardNameScopeContext.Provider>;
}

/**
 * The muted subtitle on ONE line (iOS ModeCardView.subtitle parity: lineLimit 1, minimumScaleFactor 0.9,
 * tail truncation): 13 px, shrinking to fit down to 90% (11.7 px) before an ellipsis may show, so
 * "4 words at once" / "Rescue 4 boards" read whole on a 360–390 px phone like they do on iOS.
 */
function FitDesc({ height, children }: { height: number; children: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let lastWidth = -1;
    // Sub-pixel widths: scrollWidth rounds, so a text 0.4 px too wide would still draw its ellipsis.
    const range = document.createRange();
    const textWidth = () => { range.selectNodeContents(el); return range.getBoundingClientRect().width; };
    const fit = (force = false) => {
      const width = el.getBoundingClientRect().width;
      if (width <= 0 || (!force && width === lastWidth)) return;
      lastWidth = width;
      el.style.fontSize = `${MODE_CARD.desc}px`;
      el.style.letterSpacing = '';
      const room = width - 0.5;
      const natural = textWidth();
      if (natural > room) {
        // Text width scales with the font size; floor at iOS's 0.9 (then a touch tighter
        // tracking on a 360 px phone), then the ellipsis.
        el.style.fontSize = `${Math.max(MODE_CARD.desc * DESC_MIN_SCALE, Math.floor(((MODE_CARD.desc * room) / natural) * 10) / 10)}px`;
        for (const ls of ['-0.01em', '-0.02em', '-0.03em']) {
          if (textWidth() <= room) break;
          el.style.letterSpacing = ls;
        }
      }
    };
    fit();
    let live = true;
    const refit = () => { if (live) fit(true); };
    document.fonts?.ready.then(refit);
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => fit());
    ro?.observe(el);
    return () => { live = false; ro?.disconnect(); };
  }, [children]);
  return (
    <div
      ref={ref}
      className="font-medium mode-xfade truncate"
      style={{ marginTop: MODE_CARD.descGap, fontSize: MODE_CARD.desc, color: 'var(--color-text-muted)', lineHeight: `${MODE_CARD.descLine}px`, height }}
    >
      {children}
    </div>
  );
}

/** iOS ModeCardView: the subtitle's minimumScaleFactor. */
const DESC_MIN_SCALE = 0.9;
/** iOS ModeCardView.titleRow: minimumScaleFactor(0.6) — the last resort for a long name before an ellipsis. */
const NAME_MIN_SCALE = 0.6;

/**
 * The game name at 900 / 17 in its color on ONE line (BH2). Inside a CardNameScope it takes the
 * grid's shared size (BJ18); a name wider than its column at that size still shrinks on its own
 * (down to 11, then tighter tracking, then 10.5, then — long names on a narrow phone — exactly to
 * fit, floored at iOS's 0.6) before an ellipsis may ever show.
 */
function FitName({ color, accent, children }: { color: string | null; accent: string; children: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const scope = useContext(CardNameScopeContext);
  // The accent name stays legible on the dark card: the accent itself on
  // light, its pastel on dark (deep accents like #1e40af vanish on #252542).
  const ink = color == null ? accentInk(accent, accent) : null;
  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const key = {};
    let lastWidth = -1;
    const range = document.createRange();
    // Draw at `start`, shrinking on this card only while the name is still wider than its column.
    const apply = (start: number) => {
      const width = el.clientWidth;
      let size = start;
      el.style.fontSize = `${size}px`;
      el.style.letterSpacing = '';
      while (size > MODE_CARD.nameMin && el.scrollWidth > width + 0.5) {
        size -= 0.5;
        el.style.fontSize = `${size}px`;
      }
      // Founder 10-03 (ProperNoundle 1 px over its 80 px slot at the floor): a touch tighter
      // tracking, then a 10.5 px last step, before an ellipsis may ever show.
      for (const ls of ['-0.01em', '-0.02em']) {
        if (el.scrollWidth <= width + 0.5) break;
        el.style.letterSpacing = ls;
      }
      if (el.scrollWidth > width + 0.5) el.style.fontSize = `${MODE_CARD.nameMinLast}px`;
      // Long names only (ProperNoundle at 360 / 375 px, cut to "ProperNou…" at 10.5): like iOS's
      // minimumScaleFactor(0.6) the name takes the exact size it fits at, measured sub-pixel (scrollWidth
      // rounds, so a name 0.4 px over still drew its ellipsis), floored at 60% of the grid's size.
      range.selectNodeContents(el);
      const natural = range.getBoundingClientRect().width;
      const room = width - 0.5;
      if (width > 0 && natural > room) {
        const current = parseFloat(el.style.fontSize);
        el.style.fontSize = `${Math.max(start * NAME_MIN_SCALE, Math.floor(((current * room) / natural) * 10) / 10)}px`;
      }
      // Still too wide at the floor (a very narrow screen): the ellipsis takes over (never wraps).
    };
    const fit = () => {
      const width = el.clientWidth;
      if (width === lastWidth) return;
      lastWidth = width;
      if (!scope) { apply(MODE_CARD.name); return; }
      if (width <= 0) return; // not laid out (hidden): a 0-wide slot must not drag the grid to the floor
      // The size this name fits at on its own (text width scales with the font size).
      el.style.fontSize = `${MODE_CARD.name}px`;
      el.style.letterSpacing = '';
      const natural = el.scrollWidth;
      const own = natural > width + 0.5 && natural > 0 ? (MODE_CARD.name * width) / natural : MODE_CARD.name;
      scope.report(key, own, apply);
    };
    fit();
    // Refit once the web font is in: measured in the narrower fallback, a name that "fit" overflows
    // (an ellipsis) when Nunito Black swaps in, and the width doesn't change so the observer stays quiet.
    let live = true;
    const refit = () => { if (live) { lastWidth = -1; fit(); } };
    document.fonts?.ready.then(refit);
    document.fonts?.addEventListener?.('loadingdone', refit);
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(fit);
    ro?.observe(el);
    return () => {
      live = false;
      ro?.disconnect();
      document.fonts?.removeEventListener?.('loadingdone', refit);
      scope?.remove(key);
    };
  }, [children, scope]);
  return (
    <div
      ref={ref}
      className={`font-black whitespace-nowrap overflow-hidden text-ellipsis ${ink?.className ?? ''}`}
      style={{ fontSize: MODE_CARD.name, lineHeight: `${MODE_CARD.titleLine}px`, ...(ink ? ink.style : { color: color ?? undefined }) }}
    >
      {children}
    </div>
  );
}
