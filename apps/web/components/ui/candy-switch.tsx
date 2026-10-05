'use client';

import { CANDY_SWITCH, threeSlice } from '@/lib/candy-toggle';

// The candy on/off switch ("Small menus with flair" proposal 3; night art 10-03 sprites): a short
// frosted-lilac track (art-toggle-*-switch) that turns glossy purple (art-toggle-*-switch-on, a
// crossfade) while a pearl knob (art-toggle-*-knob) springs across — transform + opacity only.
// role="switch" + aria-checked; the 44 px hit area is the row around it or the padding here.

export function CandySwitch({ checked, onCheckedChange, label, disabled = false, id }: {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  /** Accessible name (omit when a <label htmlFor> names it). */
  label?: string;
  disabled?: boolean;
  id?: string;
}) {
  const { width, height } = CANDY_SWITCH;
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className="relative shrink-0 disabled:opacity-50"
      style={{ width, height, padding: 0, background: 'transparent', border: 0, margin: '7px 0' }}
    >
      <CandySwitchTrack checked={checked} />
    </button>
  );
}

/** The switch's look alone (track + crossfade + knob), for a whole row that is the switch (role="switch" on the row). */
export function CandySwitchTrack({ checked, standalone = false }: { checked: boolean; standalone?: boolean }) {
  const { width, height } = CANDY_SWITCH;
  const knob = height - 4;
  const art = (
    <>
      <span aria-hidden="true" className="absolute inset-0" style={threeSlice('switch', height, '--candy-switch')} />
      <span aria-hidden="true" className="absolute inset-0 candy-fade" style={{ ...threeSlice('switch-on', height, '--candy-switch-on'), opacity: checked ? 1 : 0 }} />
      <span
        aria-hidden="true"
        className="absolute candy-slide"
        style={{
          top: 2, left: 2, width: knob, height: knob,
          backgroundImage: 'var(--candy-knob)', backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundPosition: 'center',
          transform: `translateX(${checked ? width - knob - 4 : 0}px)`,
        }}
      />
    </>
  );
  if (!standalone) return art;
  return <span aria-hidden="true" className="relative shrink-0 block" style={{ width, height }}>{art}</span>;
}
