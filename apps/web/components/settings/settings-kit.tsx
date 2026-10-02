'use client';

import { Switch } from '@/components/ui/switch';
import { SoftSectionLabel, softRow } from '@/components/ui/soft-popup';
import { alphaHex, cardBarStyle, softBackground, softBorder } from '@/lib/soft-surface';

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
      style={{ background: softBackground(accent, 0.1), border: softBorder(accent, 0.1), borderRadius: 18 }}
    >
      <div aria-hidden="true" style={cardBarStyle(accent, 6)} />
      <div className="p-3 space-y-2">
        <SoftSectionLabel ink={accent} className="px-1">{title}</SoftSectionLabel>
        {children}
      </div>
    </section>
  );
}

/** A selectable option row (theme, keyboard): tinted, selected = stronger wash + ring. */
export function SettingsOption({ selected, accent, label, description, onClick }: {
  selected: boolean;
  accent: string;
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className="w-full text-left p-3 flex items-center gap-3"
      onClick={onClick}
      style={softRow(accent, { selected, radius: 14 })}
    >
      <span className="flex-1 min-w-0">
        <span className="block font-extrabold text-xs" style={{ color: 'var(--color-text)' }}>{label}</span>
        <span className="block text-[10px] font-bold" style={{ color: 'var(--color-text-muted)' }}>{description}</span>
      </span>
      <span
        aria-hidden="true"
        className="grid place-items-center shrink-0 rounded-full"
        style={{ width: 18, height: 18, border: `2px solid ${selected ? accent : alphaHex(accent, 0.4)}`, background: selected ? accent : 'transparent' }}
      >
        {selected && <span className="rounded-full" style={{ width: 6, height: 6, background: '#ffffff' }} />}
      </span>
    </button>
  );
}

/** A tinted switch: the accent when on, its soft wash when off. */
export function SoftSwitch({ checked, onCheckedChange, accent, disabled, label }: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  accent: string;
  disabled?: boolean;
  /** Accessible name when the row text isn't its label. */
  label?: string;
}) {
  return (
    <Switch
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      aria-label={label}
      className="shrink-0"
      style={{
        background: checked ? `linear-gradient(${alphaHex(accent, 0.75)}, ${accent})` : alphaHex(accent, 0.2),
        boxShadow: checked ? `inset 0 -2px 0 rgba(0, 0, 0, 0.12), 0 2px 6px ${alphaHex(accent, 0.3)}` : `inset 0 1px 2px ${alphaHex(accent, 0.25)}`,
      }}
    />
  );
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
    <label data-squish="" className="flex items-center justify-between gap-3 p-3 cursor-pointer" style={{ ...softRow(accent, { radius: 14 }), opacity: dim ? 0.55 : 1 }}>
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
