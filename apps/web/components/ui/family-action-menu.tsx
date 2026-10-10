'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Send } from 'lucide-react';
import { BubbleText } from '@/components/ui/bubble-text';
import { CastButton } from '@/components/ui/cast-button';
import { FamIcon, RoundIconButton, type FamIconName } from '@/components/ui/family-button';
import { castColorForAccent } from '@/lib/cast-accent';
import { isNotesMenu } from '@/lib/friend-card-copy';
import { MOTION } from '@/lib/motion-spec';
import { prefersReducedMotion } from '@/lib/motion';
import { softMix } from '@/lib/soft-surface';

// The family ACTION MENU (founder 10-05: "There shouldn't be any plain text menus looking like this").
// Replaces every ad-hoc dropdown list in user-facing pages with the approved picker look (Pick a Friend
// option 1, 10-03): the calm lavender bottom sheet with the pink grabber and the BJ10 soft pop (its quick
// reverse on close), the subject's face + name, the family 3D X, and candy actions.
// Founder 10-09 ("hideous, needs to match the aesthetic"): the sheet follows the season (a dark season = its night
// glass with light ink); non-danger actions are family CAST buttons in the color nearest their tint, two across (an
// odd last one full width); Unfriend / Remove is one quiet centered line under them; a person's menu draws their name
// in the bubble lettering in their own color (`titleColor`); and a menu of sentences (React's quick notes) lists them
// one per row as speech bubbles. No plain text lists, no chevrons, no boxes.
// A picked row closes the sheet first, then runs (so a confirmation it opens presents cleanly).
// iOS: FamilyActionMenu.swift · Android: FamilyActionMenu.kt.

export const FAMILY_MENU_INK = {
  sheet: '#f4f0ff', // the picker's lavender (option 1; a dark season swaps in its night card)
  purple: '#7c3aed',
  pink: '#db2777',
  amber: '#d97706',
  teal: '#0d9488',
  /** The family danger tint (the same pink as a confirming Remove friend). */
  danger: '#db2777',
  heading: '#3b1f6e',
  sub: '#7a6a95',
} as const;

export type FamilyMenuAction = {
  id: string;
  title: string;
  /** A white-clay family icon name, or a full-color 3D icon node (Icon3D / UiIcon). */
  icon: FamIconName | ReactNode;
  tint?: string;
  danger?: boolean;
  disabled?: boolean;
  /** Screen-reader label (defaults to the title). */
  label?: string;
  /** Keep the sheet open (e.g. a step inside the menu, like the report reasons). */
  stay?: boolean;
  /** A picker row that is the current choice: a family check at the end. */
  selected?: boolean;
  run: () => void;
};

/** The ink a row's label + clay icon take (the helper pill's deep tint). */
export const familyMenuInk = (tint: string) => `color-mix(in srgb, ${tint} 68%, #000000)`;

/** A dark season (SeasonDocument sets html[data-season-tone="dark"]): the sheet wears the night glass with light ink. */
function isNightSeason(): boolean {
  return typeof document !== 'undefined' && document.documentElement.getAttribute('data-season-tone') === 'dark';
}

/** A tile's icon at the cast button's size: a clay name in white, or a full-color node scaled down to 20 px. */
function tileIcon(icon: FamilyMenuAction['icon']): ReactNode {
  if (typeof icon === 'string') return <FamIcon name={icon as FamIconName} size={16} ink="#ffffff" />;
  return (
    <span aria-hidden="true" className="inline-flex items-center justify-center shrink-0" style={{ width: 20, height: 20 }}>
      <span style={{ transform: 'scale(0.72)', display: 'inline-flex' }}>{icon}</span>
    </span>
  );
}

export function FamilyActionMenu({ title, subtitle, avatar, actions, onClose, label, titleColor }: {
  title: string;
  subtitle?: string;
  avatar?: ReactNode;
  actions: FamilyMenuAction[];
  onClose: () => void;
  /** The dialog's accessible name (defaults to "<title> actions"). */
  label?: string;
  /** A person's menu draws their name in the bubble lettering in this color (their backdrop; lib/player-tint). */
  titleColor?: string;
}) {
  const night = isNightSeason();
  const headingInk = night ? 'var(--color-text, #f7eeff)' : FAMILY_MENU_INK.heading;
  const subInk = night ? 'var(--color-text-muted, #c8b6e2)' : FAMILY_MENU_INK.sub;
  const plain = actions.filter((a) => !a.danger);
  const danger = actions.filter((a) => a.danger);
  const notes = isNotesMenu(actions);
  const [closing, setClosing] = useState(false);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const pending = useRef<(() => void) | null>(null);
  const close = useCallback(() => {
    const finish = () => {
      closeRef.current();
      const run = pending.current;
      pending.current = null;
      run?.();
    };
    if (prefersReducedMotion()) { finish(); return; }
    setClosing((was) => {
      if (!was) window.setTimeout(finish, MOTION.popDismissMs);
      return true;
    });
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [close]);

  const pick = (a: FamilyMenuAction) => () => {
    if (a.stay) { a.run(); return; }
    pending.current = a.run;
    close();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center animate-fade-in"
      style={{ background: 'rgba(42,22,80,0.35)', transition: `opacity ${MOTION.popDismissMs}ms ease-in`, opacity: closing ? 0 : 1 }}
      onClick={close}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label ?? `${title} actions`}
        className={`w-full max-w-md ${closing ? 'soft-pop-out' : 'soft-pop'}`}
        style={{
          background: night ? 'var(--color-card-base, #1c0f30)' : FAMILY_MENU_INK.sheet, borderRadius: '24px 24px 0 0', maxHeight: '88vh', overflowY: 'auto',
          padding: '8px 16px max(20px, env(safe-area-inset-bottom))', boxShadow: '0 -8px 30px rgba(60,30,110,0.18)',
          colorScheme: night ? 'dark' : 'light',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-2" aria-hidden="true" style={{ width: 40, height: 5, borderRadius: 999, background: softMix('#ec4899', 0.35) }} />
        <div className="flex items-center gap-3" style={{ minHeight: 48, marginBottom: 8 }}>
          {avatar}
          <div className="min-w-0 flex-1" role="heading" aria-level={2}>
            {titleColor ? (
              <BubbleText text={title.toUpperCase()} accent={titleColor} maxSize={26} minSize={15} align="left" />
            ) : (
              <div className="font-black truncate" style={{ fontSize: 19, color: headingInk, lineHeight: 1.15 }}>{title}</div>
            )}
            {subtitle && <div className="font-extrabold truncate" style={{ fontSize: 12, color: subInk }}>{subtitle}</div>}
          </div>
          <RoundIconButton icon="close" label="Close menu" onClick={close} />
        </div>
        <div className="flex flex-col" style={{ gap: 6 }}>
          {notes ? (
            <div className="flex flex-col overflow-y-auto" style={{ gap: 10, maxHeight: '60vh', padding: '2px 0 8px' }}>
              {plain.map((a) => <FamilyMenuNote key={a.id} a={a} night={night} onPick={pick(a)} />)}
            </div>
          ) : (
            // Two across; an odd last one takes the whole row (never a lone half-width button).
            <div className="grid grid-cols-2" style={{ gap: 10 }}>
              {plain.map((a, i) => (
                <CastButton
                  key={a.id}
                  color={castColorForAccent(a.tint ?? FAMILY_MENU_INK.purple)}
                  size="m"
                  block
                  capScale={0.82}
                  icon={tileIcon(a.icon)}
                  trailing={a.selected ? <FamIcon name="check" size={16} ink="#ffffff" /> : undefined}
                  disabled={a.disabled}
                  aria-label={a.label ?? a.title}
                  aria-current={a.selected ? 'true' : undefined}
                  style={i === plain.length - 1 && plain.length % 2 === 1 ? { gridColumn: '1 / -1' } : undefined}
                  onClick={pick(a)}
                >
                  {a.title}
                </CastButton>
              ))}
            </div>
          )}
          {danger.map((a) => <FamilyMenuDanger key={a.id} a={a} night={night} onPick={pick(a)} />)}
        </div>
      </div>
    </div>
  );
}

/** The frosted family candy coin the notes and the danger line carry their icon on. */
function MenuCoin({ a, tint, size }: { a: FamilyMenuAction; tint: string; size: number }) {
  const ink = familyMenuInk(tint);
  const coin = {
    ['--fam-tint' as string]: tint,
    ['--fam-fill' as string]: `color-mix(in srgb, ${tint} 20%, #ffffff)`,
    ['--fam-fill-p' as string]: `color-mix(in srgb, ${tint} 27%, #ffffff)`,
    ['--fam-ink' as string]: ink,
    ['--fam-lm-a' as string]: 1,
    ['--candy-h' as string]: `${size}px`,
    cursor: 'inherit',
  } as CSSProperties;
  return (
    <span aria-hidden="true" className="candy candy-round" style={coin}>
      {typeof a.icon === 'string' ? <FamIcon name={a.icon as FamIconName} size={Math.round(size * 0.55)} ink={ink} /> : a.icon}
    </span>
  );
}

/** Unfriend / Remove: one quiet centered line in the danger pink under the tiles (never a big red row). */
function FamilyMenuDanger({ a, night, onPick }: { a: FamilyMenuAction; night: boolean; onPick: () => void }) {
  const tint = FAMILY_MENU_INK.danger;
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={a.disabled}
      aria-label={a.label ?? a.title}
      data-squish
      className="w-full flex items-center justify-center"
      style={{ gap: 7, height: 40, border: 0, background: 'transparent', opacity: a.disabled ? 0.5 : 1, cursor: a.disabled ? 'default' : 'pointer' }}
    >
      <MenuCoin a={a} tint={tint} size={26} />
      <span className="font-black" style={{ fontSize: 14, color: night ? '#f9a8d4' : familyMenuInk(tint) }}>{a.title}</span>
    </button>
  );
}

/**
 * A quick note as a speech bubble from you: the whole sentence (two lines at most), its icon in a candy coin, a little
 * tail bottom-left, a paper plane at the end. Tap sends it.
 */
function FamilyMenuNote({ a, night, onPick }: { a: FamilyMenuAction; night: boolean; onPick: () => void }) {
  const tint = a.tint ?? FAMILY_MENU_INK.purple;
  const fill = night
    ? `linear-gradient(180deg, color-mix(in srgb, ${tint} 42%, transparent), color-mix(in srgb, ${tint} 26%, transparent))`
    : `linear-gradient(180deg, #ffffff, ${softMix(tint, 0.1)})`;
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={a.disabled}
      aria-label={a.label ?? a.title}
      data-squish
      className="relative w-full flex items-center text-left"
      style={{
        gap: 10, minHeight: 54, padding: '6px 14px 6px 10px', borderRadius: 20, border: 0, background: fill,
        boxShadow: `0 3px 6px ${tint}40`, opacity: a.disabled ? 0.5 : 1, cursor: a.disabled ? 'default' : 'pointer',
      }}
    >
      <MenuCoin a={a} tint={tint} size={32} />
      <span
        className="font-black flex-1 min-w-0"
        style={{ fontSize: 14.5, lineHeight: 1.2, color: night ? '#ffffff' : FAMILY_MENU_INK.heading, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
      >
        {a.title}
      </span>
      <Send aria-hidden="true" className="shrink-0" style={{ width: 15, height: 15, color: tint, opacity: night ? 0.9 : 0.7, fill: 'currentColor' }} />
      {/* The bubble's little tail: a soft triangle pointing down-left. */}
      <span
        aria-hidden="true"
        className="absolute"
        style={{
          left: 18, bottom: -7, width: 14, height: 10,
          background: night ? `color-mix(in srgb, ${tint} 26%, transparent)` : '#ffffff',
          clipPath: 'polygon(0 0, 100% 0, 8% 100%)',
        }}
      />
    </button>
  );
}
