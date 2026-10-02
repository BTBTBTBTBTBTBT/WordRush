'use client';

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { BadgeArt } from './badge-art';
import { Icon3D } from '@/components/ui/icon3d';
import { SoftNum } from '@/components/ui/soft-number';
import { CandyButton } from '@/components/ui/candy-button';
import { POPUP_DIM, PopupBar, popupCard } from '@/components/ui/soft-popup';
import { ACHIEVEMENTS, type AchievementDef } from '@/lib/achievement-service';
import { achievementBadge, achievementTarget, CATEGORY_ACCENT, formatUnlockDate } from '@/lib/badges';
import { alphaHex, softBackground, softBorder, softPill } from '@/lib/soft-surface';

// The achievements grid (docs/FINISH_SPEC.md V1): the 3D badge per
// achievement, grouped by category. Unlocked = full color with a soft glow,
// the name and the unlock date; locked = grayscale at 45% with a small 3D lock
// in the corner, the name and a progress bar ("37/50") in soft numbers (just
// the goal when the count isn't known). A tap opens the detail sheet with the
// big badge.

export const ACHIEVEMENT_CATEGORIES = [
  ['beginner', 'Getting Started'],
  ['consistency', 'Consistency'],
  ['skill', 'Skill'],
  ['social', 'Social'],
  ['collection', 'Collection'],
] as const;

type Progress = { current: number; target: number } | null;

export function AchievementGrid({ unlocked, progress }: {
  /** Unlocked keys → unlock time (ISO, or null when unknown). */
  unlocked: Map<string, string | null>;
  /** Progress for a locked achievement, when it can be read. */
  progress?: (def: AchievementDef) => Progress;
}) {
  const [open, setOpen] = useState<AchievementDef | null>(null);
  return (
    <>
      <div className="space-y-3 mb-2">
        {ACHIEVEMENT_CATEGORIES.map(([catKey, catLabel]) => {
          const items = ACHIEVEMENTS.filter((a) => a.category === catKey);
          if (items.length === 0) return null;
          const color = CATEGORY_ACCENT[catKey];
          const unlockedN = items.filter((a) => unlocked.has(a.key)).length;
          return (
            <div key={catKey}>
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="text-[11px] font-black uppercase tracking-wide" style={{ color }}>{catLabel}</span>
                <SoftNum size={11} className="soft-num-auto">{unlockedN}/{items.length}</SoftNum>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {items.map((a) => (
                  <AchievementTile
                    key={a.key}
                    def={a}
                    color={color}
                    unlockedAt={unlocked.has(a.key) ? unlocked.get(a.key) ?? null : undefined}
                    progress={unlocked.has(a.key) ? null : progress?.(a) ?? null}
                    onOpen={() => setOpen(a)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {open && (
        <AchievementSheet
          def={open}
          unlockedAt={unlocked.has(open.key) ? unlocked.get(open.key) ?? null : undefined}
          progress={unlocked.has(open.key) ? null : progress?.(open) ?? null}
          onClose={() => setOpen(null)}
        />
      )}
    </>
  );
}

/** The bar + "37/50" (or just the goal) under a locked badge. */
function ProgressLine({ color, progress, goal, big = false }: { color: string; progress: Progress; goal: number | null; big?: boolean }) {
  if (progress) {
    const pct = progress.target > 0 ? Math.min(100, (progress.current / progress.target) * 100) : 0;
    return (
      <div className={big ? 'mt-3 w-full max-w-[220px] mx-auto' : 'mt-1 w-full'}>
        <div className="rounded-full overflow-hidden" style={{ height: big ? 8 : 5, background: alphaHex(color, 0.16) }}>
          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
        </div>
        <SoftNum size={big ? 15 : 10} as="div" className="soft-num-auto mt-1">
          {progress.current.toLocaleString()}/{progress.target.toLocaleString()}
        </SoftNum>
      </div>
    );
  }
  if (goal == null) return null;
  return (
    <div className={big ? 'mt-3' : 'mt-1'}>
      <span className="inline-flex items-baseline gap-1 px-1.5 py-0.5" style={{ ...softPill(color, { bar: false, radius: 999 }) }}>
        <span className="font-black uppercase" style={{ fontSize: big ? 10 : 8, letterSpacing: '0.08em', color: 'var(--color-text-muted)' }}>Goal</span>
        <SoftNum size={big ? 14 : 10} className="soft-num-auto">{goal.toLocaleString()}</SoftNum>
      </span>
    </div>
  );
}

function AchievementTile({ def, color, unlockedAt, progress, onOpen }: {
  def: AchievementDef;
  color: string;
  /** undefined = locked; null = unlocked, date unknown. */
  unlockedAt: string | null | undefined;
  progress: Progress;
  onOpen: () => void;
}) {
  const isUnlocked = unlockedAt !== undefined;
  const date = isUnlocked ? formatUnlockDate(unlockedAt) : '';
  const goal = !isUnlocked && !progress ? achievementTarget(def.description) : null;
  const label = isUnlocked
    ? `${def.name}, unlocked${date ? ` ${date}` : ''}`
    : `${def.name}, locked${progress ? `, ${progress.current} of ${progress.target}` : ''}`;
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={label}
      className="flex flex-col items-center text-center px-1.5 pt-2 pb-2 min-w-0"
      style={isUnlocked
        ? softPill(color, { radius: 14 })
        : { background: softBackground(color, 0.06), border: softBorder(color, 0.06), borderRadius: 14 }}
    >
      <span className="relative block" style={{ width: 56, height: 56 }} aria-hidden="true">
        <BadgeArt
          name={achievementBadge(def.icon)}
          size={56}
          style={isUnlocked
            ? { filter: `drop-shadow(0 0 8px ${alphaHex(color, 0.5)}) drop-shadow(0 3px 4px rgba(59, 26, 120, 0.18))` }
            : { filter: 'grayscale(1)', opacity: 0.45 }}
        />
        {!isUnlocked && <Icon3D name="lock" size={18} className="absolute" style={{ right: -3, bottom: -2 }} />}
      </span>
      <span className="mt-1 w-full text-[10.5px] font-extrabold leading-tight truncate" style={{ color: 'var(--color-text)' }}>{def.name}</span>
      {isUnlocked ? (
        date ? <span className="text-[9px] font-bold truncate w-full" style={{ color: 'var(--color-text-muted)' }}>{date}</span> : null
      ) : (
        <ProgressLine color={color} progress={progress} goal={goal} />
      )}
    </button>
  );
}

/** The detail sheet: the big badge on a tinted sheet, the story and the progress; a candy close. */
export function AchievementSheet({ def, unlockedAt, progress, onClose }: {
  def: AchievementDef;
  unlockedAt: string | null | undefined;
  progress: Progress;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const color = CATEGORY_ACCENT[def.category] ?? '#7c3aed';
  const isUnlocked = unlockedAt !== undefined;
  const date = isUnlocked ? formatUnlockDate(unlockedAt) : '';
  const goal = !isUnlocked && !progress ? achievementTarget(def.description) : null;
  const cat = ACHIEVEMENT_CATEGORIES.find(([k]) => k === def.category)?.[1] ?? '';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    ref.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:px-5 animate-fade-in" style={{ background: POPUP_DIM }} onClick={onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={def.name}
        tabIndex={-1}
        className="relative w-full max-w-sm mx-3 sm:mx-0 outline-none animate-fade-in-up"
        style={{ ...popupCard(color, { radius: 28 }), marginBottom: 'max(12px, env(safe-area-inset-bottom))' }}
        onClick={(e) => e.stopPropagation()}
      >
        <PopupBar accent={color} />
        <div className="absolute" style={{ top: 18, right: 14 }}>
          <CandyButton
            size="round"
            color="peach"
            aria-label="Close"
            onClick={onClose}
            icon={<X className="w-4 h-4 candy-icon" color="#fff" strokeWidth={3} aria-hidden="true" />}
            style={{ ['--candy-h' as string]: '34px' } as React.CSSProperties}
          />
        </div>
        <div className="px-6 pt-6 pb-7 flex flex-col items-center text-center">
          <div className="relative" style={{ width: 168, height: 168 }} aria-hidden="true">
            {isUnlocked && (
              <span
                className="absolute inset-0 rp-rays"
                style={{
                  borderRadius: '50%',
                  background: `repeating-conic-gradient(${alphaHex(color, 0.14)} 0deg 10deg, transparent 10deg 24deg)`,
                  maskImage: 'radial-gradient(circle, #000 30%, transparent 70%)',
                  WebkitMaskImage: 'radial-gradient(circle, #000 30%, transparent 70%)',
                }}
              />
            )}
            <span className="absolute" style={{ inset: 24, borderRadius: '50%', background: `radial-gradient(circle, ${alphaHex(color, isUnlocked ? 0.32 : 0.12)}, transparent 70%)` }} />
            <BadgeArt
              name={achievementBadge(def.icon)}
              size={136}
              priority
              className="absolute rp-spring"
              style={{
                left: 16,
                top: 16,
                ...(isUnlocked
                  ? { filter: `drop-shadow(0 0 14px ${alphaHex(color, 0.5)}) drop-shadow(0 6px 8px rgba(59, 26, 120, 0.2))` }
                  : { filter: 'grayscale(1)', opacity: 0.45 }),
              }}
            />
            {!isUnlocked && <Icon3D name="lock" size={40} className="absolute" style={{ right: 10, bottom: 10 }} />}
          </div>
          <span className="mt-1 text-[10px] font-black uppercase" style={{ letterSpacing: '0.12em', color }}>{cat}</span>
          <h2 className="m-0 mt-0.5 text-[22px] font-black leading-tight" style={{ color: 'var(--color-text)' }}>{def.name}</h2>
          <p className="m-0 mt-1 text-[13.5px] font-bold" style={{ color: 'var(--color-text-secondary, var(--color-text-muted))' }}>{def.description}</p>
          {isUnlocked ? (
            <span className="mt-3 inline-flex items-center gap-1.5 px-3 py-1" style={{ ...softPill(color, { bar: false, radius: 999 }) }}>
              <Icon3D name="badge-check" size={16} />
              <span className="text-[11px] font-black" style={{ color: 'var(--color-text)' }}>{date ? `Unlocked ${date}` : 'Unlocked'}</span>
            </span>
          ) : (
            <ProgressLine color={color} progress={progress} goal={goal} big />
          )}
        </div>
      </div>
    </div>
  );
}
