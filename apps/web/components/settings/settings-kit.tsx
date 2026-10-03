'use client';

import { Switch } from '@/components/ui/switch';
import { CandySwitch } from '@/components/ui/candy-switch';
import { SoftSectionLabel, softRow } from '@/components/ui/soft-popup';
import { alphaHex, cardBarStyle, softBackground } from '@/lib/soft-surface';
import { KEY_DELETE, KEY_ENTER, KEY_SPACE, keyRows, themePreview } from '@/lib/settings-previews';

// The Settings + Edit profile kit (docs/FINISH_SPEC.md C4b / G5; A1 no plain
// white): each section is a tinted card in its own accent with a slim top bar,
// options are tinted rows (selected = a stronger wash + an accent ring), and
// toggles are tinted switches (the accent when on, its soft wash when off).
// Rows squish on tap through the global SquishHost.

/** Section accents. */
export const SETTINGS_ACCENT = {
  theme: '#7c3aed',
  keyboard: '#3b82f6',
  sound: '#0d9488',
  notifications: '#ec4899',
  subscription: '#f5a524',
  linked: '#6366f1',
  account: '#e11d48',
  accessibility: '#10b981',
} as const;

/** A tinted section card: slim accent top bar, the label in the accent's ink, then its rows. */
export function SettingsSection({ title, accent, children, className = '' }: {
  title: string;
  accent: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`overflow-hidden ${className}`}
      // BJ7: wash + bar, no outline; 8 under the label.
      style={{ background: softBackground(accent, 0.1), borderRadius: 18 }}
    >
      <div aria-hidden="true" style={cardBarStyle(accent, 6)} />
      <div className="p-3 space-y-1.5">
        <SoftSectionLabel ink={accent} className="px-1">{title}</SoftSectionLabel>
        {children}
      </div>
    </section>
  );
}

/**
 * BI25: a theme / keyboard choice as a soft filled tile — unselected a pale wash of the
 * section's color (no stroke); selected a glossy filled tile in that color with white
 * text and a small white check badge; an optional live preview on the right.
 */
export function SettingsOption({ selected, accent, label, description, onClick, preview }: {
  selected: boolean;
  accent: string;
  label: string;
  description: string;
  onClick: () => void;
  preview?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className="relative w-full text-left px-3 py-2 flex items-center gap-2.5 overflow-hidden"
      onClick={onClick}
      style={{ background: softBackground(accent, 0.11), borderRadius: 16, border: 'none', minHeight: 44 }}
    >
      <span
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          borderRadius: 16,
          background: `linear-gradient(180deg, rgba(255,255,255,0.32) 0%, rgba(255,255,255,0) 50%), linear-gradient(180deg, color-mix(in srgb, ${accent} 78%, #fff) 0%, ${accent} 55%, color-mix(in srgb, ${accent} 88%, #000) 100%)`,
          boxShadow: `0 4px 12px ${alphaHex(accent, 0.35)}`,
          opacity: selected ? 1 : 0,
          transition: 'opacity 180ms ease-out',
        }}
      />
      <span className="relative flex-1 min-w-0">
        <span className="block font-black text-sm" style={{ color: selected ? '#ffffff' : 'var(--color-text)' }}>{label}</span>
        <span className="block text-[10px] font-bold truncate" style={{ color: selected ? 'rgba(255,255,255,0.88)' : 'var(--color-text-muted)' }}>{description}</span>
      </span>
      {preview && <span className="relative shrink-0">{preview}</span>}
      <span
        aria-hidden="true"
        className="relative grid place-items-center shrink-0 rounded-full"
        style={{ width: 20, height: 20, background: '#ffffff', boxShadow: '0 1px 2px rgba(0,0,0,0.15)', opacity: selected ? 1 : 0, transition: 'opacity 180ms ease-out' }}
      >
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M2.5 6.4l2.3 2.3L9.6 3.6" stroke={accent} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </span>
    </button>
  );
}

/** BI25: four mini glossy letter tiles in the theme's colors on its page wash. */
export function ThemeTilesPreview({ theme }: { theme: string }) {
  const spec = themePreview(theme);
  return (
    <span aria-hidden="true" className="flex gap-0.5 p-1" style={{ background: spec.page, borderRadius: 7 }}>
      {spec.tiles.map((t, i) => (
        <span
          key={i}
          className="grid place-items-center font-black text-white"
          style={{
            width: 15, height: 15, borderRadius: 3.5, fontSize: 9, lineHeight: 1,
            background: `linear-gradient(180deg, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0) 50%), linear-gradient(180deg, color-mix(in srgb, ${t.hex} 75%, #fff), ${t.hex})`,
          }}
        >
          {t.letter}
        </span>
      ))}
    </span>
  );
}

/** BI25: a mini key row showing where Enter and Delete sit for a keyboard layout. */
export function KeyRowPreview({ layout }: { layout: string }) {
  return (
    <span aria-hidden="true" className="flex flex-col gap-0.5 p-1" style={{ background: 'rgba(255,255,255,0.55)', borderRadius: 7 }}>
      {keyRows(layout).map((row, r) => (
        <span key={r} className="flex gap-0.5 justify-center">
          {row.map((k, i) => {
            const special = k === KEY_ENTER || k === KEY_DELETE;
            return (
              <span
                key={i}
                className="grid place-items-center font-black"
                style={{
                  width: special ? 15 : k === KEY_SPACE ? 26 : 8, height: 11, borderRadius: 2.5, fontSize: special ? 7 : 6, lineHeight: 1,
                  background: special ? '#f59e0b' : '#ffffff', color: special ? '#ffffff' : '#3b1a78',
                  boxShadow: '0 1px 0 rgba(0,0,0,0.12)',
                }}
              >
                {k === KEY_ENTER ? '\u21B5' : k === KEY_DELETE ? '\u232B' : k === KEY_SPACE ? '' : k}
              </span>
            );
          })}
        </span>
      ))}
    </span>
  );
}

/**
 * The settings switch: the candy on/off switch (night art 10-03 sprites, "Small menus with flair"
 * proposal 3) — frosted lilac off, glossy purple on, a pearl knob that springs across.
 * `accent` is kept for callers (the row keeps its accent wash).
 */
export function SoftSwitch({ checked, onCheckedChange, disabled, label }: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  accent: string;
  disabled?: boolean;
  /** Accessible name when the row text isn't its label. */
  label?: string;
}) {
  return <CandySwitch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} label={label} />;
}

/** A toggle row: label + hint on a tinted row, the tinted switch at the end. */
export function SettingsToggle({ label, description, checked, onCheckedChange, accent, disabled, dim }: {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  accent: string;
  disabled?: boolean;
  /** Saving: the row reads faded. */
  dim?: boolean;
}) {
  return (
    // FINISH_SPEC AK: the whole row squishes (a <label> without `for` isn't otherwise tappable to the SquishHost).
    <label data-squish="" className="flex items-center justify-between gap-3 px-3 py-2 cursor-pointer" style={{ ...softRow(accent, { radius: 14 }), opacity: dim ? 0.55 : 1, minHeight: 44 }}>
      <span className="min-w-0">
        <span className="block text-xs font-extrabold" style={{ color: 'var(--color-text)' }}>{label}</span>
        <span className="block text-[10px] font-bold" style={{ color: 'var(--color-text-muted)' }}>{description}</span>
      </span>
      <SoftSwitch checked={checked} onCheckedChange={onCheckedChange} accent={accent} disabled={disabled} label={label} />
    </label>
  );
}

/** A plain tinted row body (links and actions that read as list rows). */
export function settingsRowStyle(accent: string): React.CSSProperties {
  return softRow(accent, { radius: 14 });
}
