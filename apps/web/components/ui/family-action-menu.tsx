'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { FamIcon, RoundIconButton, type FamIconName } from '@/components/ui/family-button';
import { MOTION } from '@/lib/motion-spec';
import { prefersReducedMotion } from '@/lib/motion';
import { softMix } from '@/lib/soft-surface';

// The family ACTION MENU (founder 10-05: "There shouldn't be any plain text menus looking like this").
// Replaces every ad-hoc dropdown list in user-facing pages with the approved picker look (Pick a Friend
// option 1, 10-03): the calm lavender bottom sheet with the pink grabber and the BJ10 soft pop (its quick
// reverse on close), the subject's face + name, the family 3D X, and illustrated candy rows — a frosted family
// coin (white-clay icon tinted like a helper pill, or a full-color 3D icon) + the label in Nunito Black.
// Destructive rows take the family pink (danger) tint. No plain text lists, no chevrons.
// A picked row closes the sheet first, then runs (so a confirmation it opens presents cleanly).
// iOS: FamilyActionMenu.swift · Android: FamilyActionMenu.kt.

export const FAMILY_MENU_INK = {
  sheet: '#f4f0ff', // the picker's lavender (option 1)
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

export function FamilyActionMenu({ title, subtitle, avatar, actions, onClose, label }: {
  title: string;
  subtitle?: string;
  avatar?: ReactNode;
  actions: FamilyMenuAction[];
  onClose: () => void;
  /** The dialog's accessible name (defaults to "<title> actions"). */
  label?: string;
}) {
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
          background: FAMILY_MENU_INK.sheet, borderRadius: '24px 24px 0 0', maxHeight: '88vh', overflowY: 'auto',
          padding: '8px 16px max(20px, env(safe-area-inset-bottom))', boxShadow: '0 -8px 30px rgba(60,30,110,0.18)',
          colorScheme: 'light',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-2" aria-hidden="true" style={{ width: 40, height: 5, borderRadius: 999, background: softMix('#ec4899', 0.35) }} />
        <div className="flex items-center gap-3" style={{ minHeight: 48, marginBottom: 8 }}>
          {avatar}
          <div className="min-w-0 flex-1" role="heading" aria-level={2}>
            <div className="font-black truncate" style={{ fontSize: 19, color: FAMILY_MENU_INK.heading, lineHeight: 1.15 }}>{title}</div>
            {subtitle && <div className="font-extrabold truncate" style={{ fontSize: 12, color: FAMILY_MENU_INK.sub }}>{subtitle}</div>}
          </div>
          <RoundIconButton icon="close" label="Close menu" onClick={close} />
        </div>
        <div className="flex flex-col" style={{ gap: 8 }}>
          {actions.map((a) => (
            <FamilyMenuRow key={a.id} a={a} onPick={() => {
              if (a.stay) { a.run(); return; }
              pending.current = a.run;
              close();
            }} />
          ))}
        </div>
      </div>
    </div>
  );
}

function FamilyMenuRow({ a, onPick }: { a: FamilyMenuAction; onPick: () => void }) {
  const tint = a.danger ? FAMILY_MENU_INK.danger : (a.tint ?? FAMILY_MENU_INK.purple);
  const ink = familyMenuInk(tint);
  const coin = {
    ['--fam-tint' as string]: tint,
    ['--fam-fill' as string]: `color-mix(in srgb, ${tint} 20%, #ffffff)`,
    ['--fam-fill-p' as string]: `color-mix(in srgb, ${tint} 27%, #ffffff)`,
    ['--fam-ink' as string]: ink,
    ['--fam-lm-a' as string]: 1,
    ['--candy-h' as string]: '40px',
    cursor: 'inherit',
  } as CSSProperties;
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={a.disabled}
      aria-label={a.label ?? a.title}
      aria-current={a.selected ? 'true' : undefined}
      className="w-full flex items-center text-left transition-transform duration-100 active:scale-[0.97] motion-reduce:active:scale-100"
      style={{
        gap: 12, height: 58, padding: '0 10px', borderRadius: 18, border: 0,
        background: a.danger ? softMix(tint, 0.10) : 'rgba(255,255,255,0.78)',
        boxShadow: `0 2px 6px ${tint}1a`,
        opacity: a.disabled ? 0.5 : 1,
        cursor: a.disabled ? 'default' : 'pointer',
      }}
    >
      <span aria-hidden="true" className="candy candy-round" style={coin}>
        {typeof a.icon === 'string' ? <FamIcon name={a.icon as FamIconName} size={22} ink={ink} /> : a.icon}
      </span>
      <span className="font-black truncate flex-1" style={{ fontSize: 17, color: a.danger ? ink : FAMILY_MENU_INK.heading }}>{a.title}</span>
      {a.selected && <FamIcon name="check" size={22} ink={ink} />}
    </button>
  );
}
