'use client';

import * as React from 'react';
import { Lock } from 'lucide-react';
import { avatarColorHex, castPreset, enforceAvatarPro, type AvatarConfig, type AvatarFrame } from '@wordle-duel/core';

import { CandyButton, candyClass } from '@/components/ui/candy-button';
import { ProPill } from '@/components/game/finished-kit';
import { openGoProPopup } from '@/lib/payment/go-pro-popup';
import { feedback } from '@/lib/sound-events';
import { prefersReducedMotion } from '@/lib/motion';
import { softBackground, softBorder, softMix } from '@/lib/soft-surface';
import { AVATAR_CAST_IDS, AVATAR_CAST_NAME } from '@/lib/avatar-cast';
import { MASCOT_LETTER } from '@/lib/mascots';
import {
  BUILDER_TABS, FRAME_UNLOCK_LEVEL, avatarConfigKey, avatarOptionIds, avatarOptionLabel, avatarProOnly,
  effectiveAvatarFrame, frameLevelLocked, randomAvatar, type BuilderField, type BuilderTab,
} from '@/lib/avatar-render';
import { MascotAvatar } from './mascot-avatar';

/**
 * FINISH_SPEC AN4 (+ addendum): Edit Profile → "Make your mascot". A big live
 * preview on a tinted stage that hops on every change (`hop` sound; still
 * under Reduce Motion), a "My mascot | My photo" switch for players with a
 * photo, the ten cast presets ("Start from W" …), category candy chips, a grid
 * of squishy option tiles each showing that option on the current mascot,
 * Randomize (dice) and Save. Pro-only options carry the gold PRO pill for free
 * players and open the Go Pro popup instead of applying. Every option is
 * labeled for screen readers.
 */
export interface MascotBuilderProps {
  value: AvatarConfig;
  onChange: (next: AvatarConfig) => void;
  /** The player's initial (the body letter). */
  initial: string;
  isPro: boolean;
  level: number;
  /** The player's photo, when they have one (enables the mascot / photo switch). */
  photoUrl?: string | null;
  saving?: boolean;
  onSave: (config: AvatarConfig) => void;
  onBack: () => void;
}

const ACCENT = '#7c3aed';

/** A small die (Randomize) — drawn, never an emoji. */
function DiceGlyph({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="2.5" y="2.5" width="19" height="19" rx="5" fill="#ffffff" stroke="rgba(0,0,0,0.18)" strokeWidth="1" />
      {[[8, 8], [16, 8], [12, 12], [8, 16], [16, 16]].map(([cx, cy]) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.9" fill="#7c2d12" />)}
    </svg>
  );
}

/** The fields each tab edits (Pattern adds its color row; Extras = face + neck). */
const TAB_FIELDS: Record<BuilderTab, Array<{ field: BuilderField; heading?: string }>> = {
  body: [{ field: 'body' }],
  color: [{ field: 'color' }],
  pattern: [{ field: 'pattern' }, { field: 'patternColor', heading: 'Pattern color' }],
  eyes: [{ field: 'eyes' }],
  nose: [{ field: 'nose' }],
  mouth: [{ field: 'mouth' }],
  head: [{ field: 'head' }],
  extras: [{ field: 'face', heading: 'Face' }, { field: 'neck', heading: 'Neck and back' }],
  bg: [{ field: 'bg' }],
  frame: [{ field: 'frame' }],
};

export function MascotBuilder({ value, onChange, initial, isPro, level, photoUrl, saving = false, onSave, onBack }: MascotBuilderProps) {
  const [tab, setTab] = React.useState<BuilderTab>('body');
  const stageRef = React.useRef<HTMLSpanElement>(null);
  const key = avatarConfigKey(value);
  const first = React.useRef(true);
  const bodyHex = avatarColorHex(value.color);
  const showPhoto = value.display === 'photo' && !!photoUrl;

  // The mascot hops on every change (a one-shot; none under Reduce Motion) with the `hop` sound.
  React.useEffect(() => {
    if (first.current) { first.current = false; return; }
    feedback('hop');
    const el = stageRef.current;
    if (!el || prefersReducedMotion() || typeof el.animate !== 'function') return;
    el.animate(
      [
        { transform: 'translateY(0) scale(1, 1)' },
        { transform: 'translateY(-14%) scale(1.04, 0.97)', offset: 0.35 },
        { transform: 'translateY(2%) scale(0.98, 1.03)', offset: 0.62 },
        { transform: 'translateY(0) scale(1, 1)' },
      ],
      { duration: 520, easing: 'cubic-bezier(0.3, 1.4, 0.5, 1)' },
    );
  }, [key]);

  const set = (field: BuilderField, id: string) => {
    if (!isPro && avatarProOnly(field, id)) {
      openGoProPopup({ reason: 'Pro mascot styles' });
      return;
    }
    if (field === 'frame' && frameLevelLocked(id as AvatarFrame, level)) return;
    const next = { ...value, [field]: id } as AvatarConfig;
    // A pattern in the body's own color would vanish: start it in a contrasting swatch.
    if (field === 'pattern' && id !== 'solid' && next.patternColor === next.color) {
      next.patternColor = next.color === 'lilac' ? 'purple' : 'lilac';
    }
    onChange(next);
  };

  const tile = (field: BuilderField, id: string) => {
    // Pro players always wear a frame (AA2): their "none" is the Pro gold frame.
    const selected = field === 'frame' ? effectiveAvatarFrame(value.frame, { pro: isPro }) === id : value[field as keyof AvatarConfig] === id;
    const proLocked = !isPro && avatarProOnly(field, id);
    const levelLocked = field === 'frame' && frameLevelLocked(id as AvatarFrame, level);
    const label = avatarOptionLabel(field, id);
    const preview = { ...value, [field]: id, display: 'mascot' } as AvatarConfig;
    const a11y = levelLocked
      ? `${label}, unlocks at level ${FRAME_UNLOCK_LEVEL[id as AvatarFrame]}`
      : proLocked ? `${label}, Pro only` : label;
    const swatch = field === 'patternColor';
    return (
      <button
        key={`${field}-${id}`}
        type="button"
        onClick={() => set(field, id)}
        aria-label={a11y}
        aria-pressed={selected}
        disabled={saving || levelLocked}
        className="relative flex items-center justify-center"
        style={{
          aspectRatio: '1 / 1',
          borderRadius: 14,
          background: softBackground(ACCENT, selected ? 0.22 : 0.07),
          border: selected ? `2px solid ${ACCENT}` : softBorder(ACCENT, 0.1),
          boxShadow: selected ? `0 0 0 2px ${ACCENT}33` : undefined,
          opacity: levelLocked ? 0.5 : 1,
        }}
      >
        {swatch ? (
          <span
            aria-hidden="true"
            className="rounded-full"
            style={{
              width: '58%', height: '58%',
              background: `radial-gradient(circle at 35% 28%, rgba(255,255,255,0.55), rgba(255,255,255,0) 45%), ${avatarColorHex(id)}`,
              boxShadow: `inset 0 -2.5px 0 rgba(0,0,0,0.18), 0 2px 5px ${avatarColorHex(id)}55`,
            }}
          />
        ) : (
          <MascotAvatar config={preview} initial={initial} size={52} pro={field === 'frame' && (isPro || id === 'pro') ? true : null} />
        )}
        {proLocked && <span className="absolute" style={{ top: -5, right: -4 }}><ProPill /></span>}
        {levelLocked && (
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-0.5" aria-hidden="true">
            <Lock className="w-4 h-4" style={{ color: '#4c1d95' }} />
            <span className="text-[9px] font-black" style={{ color: '#4c1d95' }}>LV {FRAME_UNLOCK_LEVEL[id as AvatarFrame]}</span>
          </span>
        )}
      </button>
    );
  };

  const heading = (t: string) => (
    <div className="text-[10px] font-extrabold uppercase tracking-wide mt-3 mb-1.5" style={{ color: 'var(--color-text-muted)' }}>{t}</div>
  );

  return (
    <div>
      {/* The stage: the live mascot (or photo) on a wash of its own color. */}
      <div
        className="flex flex-col items-center justify-center mb-3"
        style={{
          borderRadius: 22, padding: '18px 12px 14px',
          background: `radial-gradient(circle at 50% 30%, ${softMix(bodyHex, 0.12)} 0%, ${softMix(bodyHex, 0.3)} 100%)`,
          border: softBorder(bodyHex, 0.25),
        }}
      >
        <span ref={stageRef} className="inline-block" style={{ transformOrigin: '50% 100%' }}>
          <MascotAvatar config={value} initial={initial} size={136} photoUrl={showPhoto ? photoUrl : null} pro={isPro} level={level} label="Your avatar preview" />
        </span>
        {photoUrl && (
          <div className="flex gap-2 mt-3" role="group" aria-label="Show on your profile">
            {(['mascot', 'photo'] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => onChange({ ...value, display: d })}
                aria-pressed={value.display === d}
                disabled={saving}
                className={candyClass({ color: value.display === d ? 'purple' : 'peach', size: 'sm' })}
              >
                <span className="candy-label">{d === 'mascot' ? 'My mascot' : 'My photo'}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Presets: the ten cast members as starting points. */}
      {heading('Start from the cast')}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" role="group" aria-label="Start from a cast member">
        {AVATAR_CAST_IDS.map((id) => {
          const preset = { ...castPreset(id), frame: value.frame, display: 'mascot' as const };
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange({ ...castPreset(id), frame: value.frame, display: value.display, bg: value.bg })}
              aria-label={`Start from ${MASCOT_LETTER[id]} (${AVATAR_CAST_NAME[id]})`}
              disabled={saving}
              className="shrink-0 flex items-center justify-center"
              style={{ width: 52, height: 52, borderRadius: 14, background: softBackground(avatarColorHex(preset.color), 0.1), border: softBorder(avatarColorHex(preset.color), 0.12) }}
            >
              <MascotAvatar config={preset} initial={MASCOT_LETTER[id]} size={44} />
            </button>
          );
        })}
      </div>

      {/* Category chips. */}
      <div className="flex gap-1.5 overflow-x-auto mt-3 pb-1 -mx-1 px-1" role="tablist" aria-label="Mascot parts">
        {BUILDER_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`mascot-tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls="mascot-tabpanel"
            onClick={() => setTab(t.id)}
            className={`${candyClass({ color: tab === t.id ? 'purple' : 'peach', size: 'sm' })} shrink-0`}
          >
            <span className="candy-label">{t.label}</span>
          </button>
        ))}
      </div>

      {/* The option grid for the tab. */}
      <div id="mascot-tabpanel" role="tabpanel" aria-labelledby={`mascot-tab-${tab}`}>
        {TAB_FIELDS[tab].map(({ field, heading: h }) => (
          <div key={field}>
            {h ? heading(h) : <div className="h-2" />}
            <div className="grid grid-cols-4 gap-2" role="group" aria-label={h ?? BUILDER_TABS.find((t) => t.id === tab)?.label}>
              {avatarOptionIds(field).filter((id) => !(field === 'frame' && isPro && id === 'none')).map((id) => tile(field, id))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2 mt-4">
        <CandyButton color="peach" size="md" className="flex-1" onClick={onBack} disabled={saving}>
          Back
        </CandyButton>
        <CandyButton
          color="amber"
          size="md"
          className="flex-1"
          icon={<DiceGlyph />}
          onClick={() => onChange(randomAvatar(value, Math.random, { isPro }))}
          disabled={saving}
        >
          Randomize
        </CandyButton>
      </div>
      <CandyButton
        color="purple"
        size="md"
        block
        className="mt-2"
        icon="check"
        onClick={() => onSave(enforceAvatarPro(value, isPro))}
        disabled={saving}
      >
        {saving ? 'Saving...' : 'Save'}
      </CandyButton>
    </div>
  );
}
