'use client';

import * as React from 'react';
import { Lock } from 'lucide-react';
import { AVATAR_COLORS, AVATAR_TINTABLE, applyAvatarPick, avatarColorHex, avatarPartSeason, avatarPickConflict, castPreset, enforceAvatarPro, isPartAvailable, seasonalShelf, type AvatarConfig, type AvatarFrame } from '@wordle-duel/core';

import { ProPill } from '@/components/game/finished-kit';
import { openGoProPopup } from '@/lib/payment/go-pro-popup';
import { feedback } from '@/lib/sound-events';
import { prefersReducedMotion } from '@/lib/motion';
import { softBackground, softBorder, softMix } from '@/lib/soft-surface';
import { AVATAR_CAST_IDS, AVATAR_CAST_NAME } from '@/lib/avatar-cast';
import { MASCOT_LETTER } from '@/lib/mascots';
import {
  BUILDER_TABS, FRAME_UNLOCK_LEVEL, INTEGRATED_SECTIONS, SWATCH_FIELDS, SWATCH_ROWS, avatarConfigKey, avatarOptionArt, avatarOptionIds, avatarOptionIsNew, avatarOptionLabel, avatarProOnly,
  effectiveAvatarFrame, frameLevelLocked, randomAvatar, swatchCss, type BuilderField, type BuilderTab,
} from '@/lib/avatar-render';
import { MascotAvatar } from './mascot-avatar';
import { DressStage, StageArt, StageClose, backdropCss, warmDressArt } from '@/components/profile/dress-up';
import { CastButton } from '@/components/ui/cast-button';
import { artSrc } from '@/lib/art';
import { useSeason } from '@/lib/season';

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
  /** The tab a door opens on ('season' = the seasonal shelf). */
  initialTab?: string;
  /** The player's SAVED look: a seasonal part they saved stays offered after its season (never strip a look). */
  saved?: AvatarConfig | null;
}

const ACCENT = '#7c3aed';

/** The backdrop swatch for a tile (the stage's own CSS). */
function backdropFill(id: string, color: string): string { return backdropCss(id, color); }

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
  nose: [{ field: 'nose', heading: 'Nose' }, { field: 'cheeks', heading: 'Cheeks' }],
  cheeks: [{ field: 'cheeks' }],
  mouth: [{ field: 'mouth' }],
  head: [{ field: 'head' }, { field: 'accColor', heading: 'Accessory color' }],
  extras: [{ field: 'face', heading: 'Face' }, { field: 'neck', heading: 'Neck and back' }, ...INTEGRATED_SECTIONS, { field: 'accColor', heading: 'Accessory color' }],
  bg: [{ field: 'bg' }],
  frame: [{ field: 'frame' }],
};

export function MascotBuilder({ value, onChange, initial, isPro, level, photoUrl, saving = false, onSave, onBack, initialTab, saved }: MascotBuilderProps) {
  // 10-05 seasonal items (core avatar-season.ts): the season = the admin preview, else the calendar's window.
  const season = useSeason();
  const savedRef = React.useRef<AvatarConfig | null>(saved ?? value);
  const shelf = React.useMemo(() => seasonalShelf(season), [season]);
  const available = React.useCallback((field: string, id: string) => isPartAvailable({ field, id }, new Date(), season ?? 'none', savedRef.current), [season]);
  const [tab, setTab] = React.useState<BuilderTab | 'season'>(
    initialTab === 'season' ? 'season' : (BUILDER_TABS.some((t) => t.id === initialTab) ? initialTab as BuilderTab : 'body'));
  React.useEffect(() => { if (tab === 'season' && season && shelf.length === 0) setTab('head'); }, [tab, season, shelf.length]);
  /** "Swapped out the heart shades" — a pick that doesn't fit with something worn replaces it (fit system). */
  const [note, setNote] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (!note) return;
    const t = window.setTimeout(() => setNote(null), 2600);
    return () => window.clearTimeout(t);
  }, [note]);
  const PART_FIELDS: readonly string[] = ['eyes', 'nose', 'cheeks', 'mouth', 'head', 'face', 'neck', 'held', 'wrap', 'feet', 'pet', 'brows', 'extra'];
  const stageRef = React.useRef<HTMLSpanElement>(null);
  const key = avatarConfigKey(value);
  const first = React.useRef(true);
  const bodyHex = avatarColorHex(value.color);
  const showPhoto = value.display === 'photo' && !!photoUrl;

  // Founder 10-05 (Dressing Room): the living mascot hops on every change (`hop` sound); Undo walks back.
  const [hop, setHop] = React.useState(0);
  const history = React.useRef<AvatarConfig[]>([]);
  const prev = React.useRef(value);
  const undoing = React.useRef(false);
  React.useEffect(() => { warmDressArt(); }, []);
  React.useEffect(() => {
    if (first.current) { first.current = false; prev.current = value; return; }
    if (!undoing.current) { history.current.push(prev.current); if (history.current.length > 40) history.current.shift(); }
    undoing.current = false;
    prev.current = value;
    feedback('hop');
    setHop((h) => h + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  void stageRef; void prefersReducedMotion;

  const set = (field: BuilderField, id: string) => {
    if (!isPro && avatarProOnly(field, id)) {
      openGoProPopup({ reason: 'Pro mascot styles' });
      return;
    }
    if (field === 'frame' && frameLevelLocked(id as AvatarFrame, level)) return;
    let next = { ...value, [field]: id } as AvatarConfig;
    if (PART_FIELDS.includes(field)) {
      const hit = avatarPickConflict(value, field, id);
      next = applyAvatarPick(value, field as keyof AvatarConfig & string, id);
      setNote(hit ? `${avatarOptionLabel(field, id)} doesn't fit with ${avatarOptionLabel(hit.field as BuilderField, hit.id)}, so it came off` : null);
    }
    // A pattern in the body's own color would vanish: start it in a contrasting swatch.
    if (field === 'pattern' && id !== 'solid' && next.patternColor === next.color) {
      next.patternColor = next.color === 'lilac' ? 'purple' : 'lilac';
    }
    onChange(next);
  };

  /** A glossy round swatch (no tile, no outline): selected = a white check + a gentle scale. */
  const swatchTile = (field: BuilderField, id: string) => {
    const selected = value[field as keyof AvatarConfig] === id;
    const proLocked = !isPro && avatarProOnly(field, id);
    const label = avatarOptionLabel(field, id);
    const hex = id === 'default' ? '#ffffff' : avatarColorHex(id);
    return (
      <button
        key={`${field}-${id}`}
        type="button"
        onClick={() => set(field, id)}
        aria-label={proLocked ? `${label}, Pro only` : label}
        aria-pressed={selected}
        disabled={saving}
        className="relative flex items-center justify-center"
        style={{ width: 44, height: 44, borderRadius: '50%', background: 'transparent', border: 0, padding: 0 }}
      >
        <span
          aria-hidden="true"
          className="rounded-full flex items-center justify-center"
          style={{
            width: 36, height: 36,
            background: `radial-gradient(circle at 35% 28%, rgba(255,255,255,0.6), rgba(255,255,255,0) 46%), ${swatchCss(id)}`,
            boxShadow: `inset 0 -3px 0 rgba(0,0,0,0.16), 0 3px 7px ${hex}66`,
            transform: selected ? 'scale(1.14)' : 'scale(1)',
            transition: 'transform 180ms cubic-bezier(0.3, 1.4, 0.5, 1)',
          }}
        >
          {selected && (
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke={id === 'default' || id === 'white' || id === 'cream' ? '#7c3aed' : '#ffffff'} strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
          {id === 'default' && !selected && <span className="text-[9px] font-black" style={{ color: '#7c3aed' }}>AUTO</span>}
        </span>
        {proLocked && <span className="absolute" style={{ top: -6, right: -8 }}><ProPill /></span>}
      </button>
    );
  };

  /** The swatch grid, one row per color family. */
  const swatchGrid = (field: BuilderField) => (
    <div className="flex flex-col gap-1.5">
      {field === 'accColor' && <div className="flex flex-wrap gap-1">{swatchTile(field, 'default')}</div>}
      {SWATCH_ROWS.map((row) => (
        <div key={row.group}>
          <div className="text-[9px] font-extrabold uppercase tracking-wide mb-0.5" style={{ color: 'var(--color-text-muted)' }}>{row.label}</div>
          <div className="flex flex-wrap gap-1">{AVATAR_COLORS.filter((c) => c.group === row.group).map((c) => swatchTile(field, c.id))}</div>
        </div>
      ))}
    </div>
  );

  /** Founder 10-05: a tile shows ONLY the part on a soft round pad (no framed mascot thumbnails). */
  const bodyOnly = (c: AvatarConfig): AvatarConfig => ({ ...c, eyes: 'none', mouth: 'none', nose: 'none', cheeks: 'none', head: 'none', face: 'none', neck: 'none', frame: 'none', display: 'mascot' } as AvatarConfig);
  const partArt = (field: BuilderField, id: string): React.ReactNode => {
    if (id === 'none' || (field === 'pattern' && id === 'solid')) return <StageArt name="art-dress-none" height={30} />;
    switch (field) {
      case 'body': return <MascotAvatar config={bodyOnly({ ...value, body: id } as AvatarConfig)} initial=" " size={50} cutout />;
      case 'pattern': return <MascotAvatar config={bodyOnly({ ...value, pattern: id } as AvatarConfig)} initial=" " size={50} cutout />;
      case 'bg': return <span className="block w-full h-full rounded-full" style={{ background: backdropFill(id, value.color) }} />;
      case 'frame': return <MascotAvatar config={{ ...bodyOnly(value), frame: id } as AvatarConfig} initial=" " size={46} pro={id === 'pro' ? true : null} />;
      default: {
        // eslint-disable-next-line @next/next/no-img-element
        return <img src={artSrc(avatarOptionArt(field, id))} alt="" draggable={false} style={{ width: '78%', height: '78%', objectFit: 'contain' }} />;
      }
    }
  };
  const NEW_IDS = new Set(['head:santa', 'head:witch', 'neck:scarf', 'neck:bubbletea', 'neck:guitar', 'neck:fairywings']);
  const tile = (field: BuilderField, id: string) => {
    // Pro players always wear a frame (AA2): their "none" is the Pro gold frame.
    const selected = field === 'frame' ? effectiveAvatarFrame(value.frame, { pro: isPro }) === id : value[field as keyof AvatarConfig] === id;
    const proLocked = !isPro && avatarProOnly(field, id);
    const levelLocked = field === 'frame' && frameLevelLocked(id as AvatarFrame, level);
    const label = id === 'none' ? 'None' : avatarOptionLabel(field, id);
    const a11y = levelLocked
      ? `${label}, unlocks at level ${FRAME_UNLOCK_LEVEL[id as AvatarFrame]}`
      : proLocked ? `${label}, Pro only` : label;
    const swatch = field === 'patternColor';
    const seasonOf = avatarPartSeason(field, id);
    return (
      <button
        key={`${field}-${id}`}
        type="button"
        onClick={() => set(field, id)}
        aria-label={a11y}
        aria-pressed={selected}
        disabled={saving || levelLocked}
        className="relative flex flex-col items-center justify-center"
        style={{ aspectRatio: '1 / 1', borderRadius: '50%', border: 0, padding: 0, background: 'transparent' }}
      >
        <span
          className="relative flex items-center justify-center overflow-hidden w-full h-full"
          style={{
            borderRadius: '50%',
            background: selected ? '#ffffff' : '#eae2fa',
            boxShadow: selected ? '0 0 0 3px #f5b82e, 0 4px 14px rgba(245,158,11,0.4)' : undefined,
            opacity: levelLocked ? 0.5 : 1,
            padding: field === 'bg' ? 0 : 6,
          }}
        >
          {swatch ? (
            <span aria-hidden="true" className="rounded-full" style={{ width: '58%', height: '58%', background: `radial-gradient(circle at 35% 28%, rgba(255,255,255,0.55), rgba(255,255,255,0) 45%), ${avatarColorHex(id)}` }} />
          ) : partArt(field, id)}
          {levelLocked && <span className="absolute inset-0 flex items-center justify-center"><StageArt name="art-dress-lock" height={20} /></span>}
        </span>
        {seasonOf && <StageArt name={`art-dress-tag-${seasonOf}`} height={13} className="absolute" style={{ top: -3, right: -8 }} />}
        {!seasonOf && (NEW_IDS.has(`${field}:${id}`) || avatarOptionIsNew(field, id)) && !proLocked && <StageArt name="art-dress-tag-new" height={15} className="absolute" style={{ top: -3, right: -4 }} />}
        {proLocked && <StageArt name="art-dress-tag-pro" height={15} className="absolute" style={{ bottom: -2, right: -6 }} />}
        {levelLocked && <span className="absolute -bottom-3.5 text-[9px] font-black" style={{ color: 'var(--color-text-muted)' }}>Lv {FRAME_UNLOCK_LEVEL[id as AvatarFrame]}</span>}
      </button>
    );
  };

  const heading = (t: string) => (
    <div className="text-[10px] font-extrabold uppercase tracking-wide mt-3 mb-1.5" style={{ color: 'var(--color-text-muted)' }}>{t}</div>
  );

  const ROOM_TABS: Array<[BuilderTab, string, string]> = [
    ['body', 'body', 'Body'], ['color', 'color', 'Color'], ['pattern', 'pattern', 'Pattern'], ['eyes', 'eyes', 'Eyes'], ['nose', 'nose', 'Nose'],
    ['mouth', 'mouth', 'Mouth'], ['head', 'hats', 'Hats'], ['extras', 'extras', 'Extras'], ['bg', 'backdrop', 'Backdrop'], ['frame', 'frame', 'Frame'],
  ];
  const round = (label: string, glyph: React.ReactNode, colors: [string, string], onClick: () => void, disabled = false) => (
    <button type="button" aria-label={label} onClick={onClick} disabled={disabled || saving}
      className="w-[38px] h-[38px] rounded-full flex items-center justify-center border-0 p-0 cursor-pointer"
      style={{ background: `linear-gradient(${colors[0]}, ${colors[1]})`, boxShadow: `0 3px 0 ${colors[1]}, inset 0 2px 0 rgba(255,255,255,0.45)`, opacity: disabled ? 0.45 : 1 }}>
      {glyph}
    </button>
  );
  const optionIds = (field: BuilderField): readonly string[] =>
    field === 'eyes' || field === 'mouth' ? ['none', ...avatarOptionIds(field)] : avatarOptionIds(field);   // founder 10-05: None on any part

  return (
    <div className="-mx-5 -mt-5">
      {/* The Dressing Room (founder 10-05): the stage stays pinned while you pick. */}
      <div className="sticky top-0 z-10" style={{ background: 'var(--color-surface, #f7f2ff)' }}>
        <DressStage config={{ ...value, display: 'mascot' }} initial={initial} height={250} mascotSize={160} hopToken={hop} bulbs curtains>
          <div className="absolute inset-x-0 top-0 flex items-center justify-between px-2.5" style={{ paddingTop: 40 }}>
            <StageClose label="Close without saving" onClick={onBack} disabled={saving} />
            {/* The finished cast primary (the frost helper pill read pale on the stage). */}
            <CastButton color="purple" size="s" onClick={() => onSave(enforceAvatarPro(value, isPro))} disabled={saving}>{saving ? 'Saving…' : 'Done'}</CastButton>
          </div>
          <div className="absolute left-3 flex flex-col gap-2.5" style={{ top: 92 }}>
            {round('Randomize', <DiceGlyph />, ['#5eead4', '#0d9488'], () => onChange(randomAvatar(value, Math.random, { isPro, available })))}
            {round('Undo', <span className="text-white font-black text-lg leading-none">↶</span>, ['#fde68a', '#f59e0b'], () => {
              const last = history.current.pop();
              if (last) { undoing.current = true; onChange(last); }
            }, history.current.length === 0)}
          </div>
        </DressStage>
        <div className="flex px-1.5 pt-2 pb-1" role="tablist" aria-label="Mascot parts">
          {season && shelf.length > 0 && (() => {
            // The season's shelf, first (its first hat is the tab icon: the pumpkin for Halloween).
            const on = tab === 'season';
            const label = season.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
            return (
              <button key="season" type="button" role="tab" aria-selected={on} aria-controls="mascot-tabpanel" id="mascot-tab-season" onClick={() => setTab('season')}
                className="flex-1 min-w-0 flex flex-col items-center border-0 bg-transparent p-0 cursor-pointer">
                <span className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: on ? '#ffffff' : 'rgba(255,255,255,0.55)', boxShadow: on ? '0 4px 14px rgba(249,115,22,0.4)' : undefined }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={artSrc(avatarOptionArt(shelf[0].field as BuilderField, shelf[0].id))} alt="" aria-hidden="true" draggable={false} style={{ width: 24, height: 24, objectFit: 'contain' }} />
                </span>
                <span className="text-[8.5px] font-black whitespace-nowrap tracking-[-0.25px]" style={{ color: on ? '#c2410c' : '#6b5c8f' }}>{label}</span>
              </button>
            );
          })()}
          {ROOM_TABS.map(([id, art, label]) => {
            const on = tab === id || (id === 'nose' && tab === 'cheeks');
            return (
              <button key={id} type="button" role="tab" aria-selected={on} aria-controls="mascot-tabpanel" id={`mascot-tab-${id}`} onClick={() => setTab(id)}
                className="flex-1 min-w-0 flex flex-col items-center border-0 bg-transparent p-0 cursor-pointer">
                <span className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: on ? '#ffffff' : 'rgba(255,255,255,0.55)', boxShadow: on ? '0 4px 14px rgba(124,58,237,0.35)' : undefined }}>
                  <StageArt name={`art-dress-tab-${art}`} height={24} />
                </span>
                <span className="text-[8.5px] font-black whitespace-nowrap tracking-[-0.25px]" style={{ color: on ? '#6d28d9' : '#6b5c8f' }}>{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* The option grid for the tab: only the part on each tile. */}
      <div id="mascot-tabpanel" role="tabpanel" aria-labelledby={`mascot-tab-${tab}`} className="px-3.5 pb-6">
        {tab === 'season' && (
          <div key="season">
            <div className="h-2" />
            <div className="grid grid-cols-5 gap-2.5" role="group" aria-label="Seasonal">
              {shelf.map((p) => tile(p.field as BuilderField, p.id))}
            </div>
            <p className="text-[11px] font-bold mt-2.5 text-center" style={{ color: 'var(--color-text-muted)' }}>Free for the season. Save a look and it stays yours.</p>
          </div>
        )}
        {tab !== 'season' && TAB_FIELDS[tab]
          // the accessory color row only shows when a white (tintable) accessory is worn
          .filter(({ field }) => field !== 'accColor' || [value.head, value.neck].some((x) => AVATAR_TINTABLE.includes(x)))
          .map(({ field, heading: h }) => (
          <div key={field}>
            {h ? heading(h) : <div className="h-2" />}
            {SWATCH_FIELDS.includes(field) ? (
              <div role="group" aria-label={h ?? BUILDER_TABS.find((t) => t.id === tab)?.label}>{swatchGrid(field)}</div>
            ) : (
              <div className="grid grid-cols-5 gap-2.5" role="group" aria-label={h ?? BUILDER_TABS.find((t) => t.id === tab)?.label}>
                {optionIds(field).filter((id) => !(field === 'frame' && isPro && id === 'none') && available(field, id)).map((id) => tile(field, id))}
              </div>
            )}
          </div>
        ))}
        {note && <p role="status" className="text-xs font-bold mt-2 text-center" style={{ color: '#6d28d9' }}>{note}</p>}
      </div>
    </div>
  );
}
