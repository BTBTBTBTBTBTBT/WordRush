'use client';

import * as React from 'react';
import type { AvatarConfig } from '@wordle-duel/core';

import { AchievementArt } from '@/components/badges/badge-art';
import { ACHIEVEMENTS, type AchievementDef } from '@/lib/achievement-service';
import { achievementBadge } from '@/lib/badges';
import { LiveMascot, StageArt, TitleRibbon } from './dress-up';

/** Founder 10-05 "T1 Title Shelves": the shelves in order (catalog category → label). iOS / Android parity. */
export const TITLE_SHELVES: Array<[string, string]> = [
  ['skill', 'Skill'], ['consistency', 'Streaks'], ['beginner', 'Firsts'], ['puzzles', 'Puzzles'], ['social', 'VS'], ['friends', 'Friends'],
  ['collection', 'Medals'], ['mascot', 'Mascot'], ['pocket', 'Pocket'], ['bots', 'Bots'], ['streaks', 'Time of day'], ['seasonal', 'Seasonal'],
];

export function recentTitles(defs: AchievementDef[], dates: Record<string, string>, limit = 8): AchievementDef[] {
  return defs.filter((d) => d.key in dates).sort((a, b) => (dates[b.key] ?? '').localeCompare(dates[a.key] ?? '')).slice(0, limit);
}

/**
 * The featured-title picker: a live name plate on top (your mascot, name and the gold ribbon), search,
 * Recently earned, then one shelf per category with its count ("13 / 94"). Earned badges try the title
 * on; locked ones are dimmed with the lock and say how to earn them. Badge art = art-ach-<key>; shelf,
 * plaque, lock and PICK YOUR TITLE lettering = ChatGPT art.
 */
export function TitleShelves({ username, mascot, initial, accent, unlockedDates, selected, onDone, onClose }: {
  username: string; mascot: AvatarConfig; initial: string; accent: string;
  unlockedDates: Record<string, string>; selected: string | null;
  onDone: (key: string | null) => void; onClose: () => void;
}) {
  const [pick, setPick] = React.useState<string | null>(selected);
  const [query, setQuery] = React.useState('');
  const [hint, setHint] = React.useState('Tap a badge to try it on.');
  const [hop, setHop] = React.useState(0);
  const earned = (d: AchievementDef) => d.key in unlockedDates;
  const q = query.trim().toLowerCase();
  const matches = (d: AchievementDef) => !q || d.name.toLowerCase().includes(q);
  const pickName = pick ? ACHIEVEMENTS.find((a) => a.key === pick)?.name ?? null : null;
  const tap = (d: AchievementDef) => {
    if (!earned(d)) { setHint(`Locked · ${d.description || 'Keep playing'}`); return; }
    setPick(d.key); setHint(d.description); setHop((h) => h + 1);
  };

  const shelf = (label: string, count: string | null, list: AchievementDef[]) => (
    <div key={label} className="pt-2.5">
      <div className="flex items-center justify-between px-4">
        <span className="text-[10px] font-black uppercase tracking-[1.2px]" style={{ color: '#6d28d9' }}>{label}</span>
        {count && (
          <span className="relative inline-flex items-center justify-center text-[10px] font-black" style={{ width: 64, height: 22, color: '#7c2d12' }}>
            <StageArt name="art-dress-plaque" width={64} height={22} className="absolute inset-0" />
            <span className="relative">{count}</span>
          </span>
        )}
      </div>
      <div className="flex gap-1 overflow-x-auto px-2.5 pt-1" style={{ scrollbarWidth: 'none' }}>
        {list.map((d) => {
          const e = earned(d); const on = pick === d.key;
          return (
            <button key={d.key} type="button" onClick={() => tap(d)} aria-pressed={on}
              aria-label={`${d.name}${e ? '' : `, locked. ${d.description}`}`}
              className="shrink-0 w-[66px] flex flex-col items-center border-0 bg-transparent p-0 cursor-pointer">
              <span className="relative block" style={{ width: 50, height: 50, transform: on ? 'scale(1.08)' : undefined, filter: on ? 'drop-shadow(0 0 7px rgba(245,158,11,0.9))' : e ? undefined : 'grayscale(1)', opacity: e ? 1 : 0.42 }}>
                <AchievementArt achKey={d.key} fallback={achievementBadge(d.icon)} size={50} />
                {!e && <StageArt name="art-dress-lock" height={16} className="absolute" style={{ right: -2, top: -2, filter: 'none' }} />}
              </span>
              <span className="text-[9.5px] font-extrabold text-center leading-[11px] mt-0.5 h-[26px] overflow-hidden" style={{ color: on ? '#b45309' : e ? '#2a1650' : '#a99ccf' }}>{d.name}</span>
            </button>
          );
        })}
      </div>
      <div className="flex px-2 h-4" aria-hidden="true">
        <StageArt name="art-dress-shelf-l" height={16} />
        <span className="flex-1 h-4" style={{ background: 'url(/art/art-dress-shelf-m.webp) 0 0 / 100% 100%' }} />
        <StageArt name="art-dress-shelf-r" height={16} />
      </div>
    </div>
  );

  const recent = recentTitles(ACHIEVEMENTS, unlockedDates).filter(matches);
  return (
    <div className="fixed inset-0 z-[60] flex justify-center" style={{ background: 'rgba(30,16,60,0.45)' }} role="dialog" aria-modal="true" aria-label="Pick your title">
      <div className="w-full max-w-sm h-full overflow-y-auto" style={{ background: '#f6f0ff' }}>
        <div className="flex items-center px-3 pt-3">
          <button type="button" aria-label="Close" onClick={onClose} className="w-10 h-10 border-0 bg-transparent font-black text-lg cursor-pointer" style={{ color: '#6d28d9' }}>✕</button>
          <span className="flex-1 flex justify-center"><StageArt name="art-dress-title" height={30} /></span>
          <button type="button" className="candy candy-purple candy-sm" onClick={() => onDone(pick)}><span className="candy-label">Done</span></button>
        </div>
        <div className="mx-3.5 mt-2.5 flex items-center gap-2 px-2 py-1.5 rounded-[20px]" style={{ background: 'linear-gradient(120deg, rgba(255,255,255,0.8), rgba(237,233,254,0.6))' }}>
          <LiveMascot config={mascot} initial={initial} size={78} hopToken={hop} />
          <div className="flex-1 min-w-0 flex flex-col gap-1">
            <div className="text-xl font-black truncate" style={{ color: accent }}>{username}</div>
            <TitleRibbon text={pickName ?? 'No title'} height={26} maxWidth={220} placeholder={!pickName} />
            <div className="text-[11px] font-bold" style={{ color: '#7a6aa6' }}>{hint}</div>
          </div>
          {pick && <button type="button" onClick={() => { setPick(null); setHint('No title for now.'); }} className="text-[11px] font-black px-2.5 py-1 rounded-full border-0 cursor-pointer" style={{ color: '#7c3aed', background: 'rgba(124,58,237,0.1)' }}>None</button>}
        </div>
        <div className="mx-3.5 mt-2 rounded-full px-3.5 py-2" style={{ background: 'rgba(255,255,255,0.8)' }}>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search your titles" aria-label="Search your titles"
            className="w-full bg-transparent border-0 outline-none text-[13px] font-extrabold" style={{ color: '#2a1650' }} />
        </div>
        {recent.length > 0 && shelf('Recently earned', null, recent)}
        {TITLE_SHELVES.map(([id, label]) => {
          const all = ACHIEVEMENTS.filter((a) => a.category === id);
          const list = [...all.filter(earned), ...all.filter((a) => !earned(a))].filter(matches);
          return list.length ? shelf(label, `${all.filter(earned).length} / ${all.length}`, list) : null;
        })}
        {ACHIEVEMENTS.every((a) => !matches(a)) && (
          <div className="flex flex-col items-center pt-6 gap-1">
            <StageArt name="art-pose-d-skeptic" height={70} />
            <div className="text-[13px] font-black" style={{ color: '#2a1650' }}>No title matches &ldquo;{query}&rdquo;</div>
          </div>
        )}
        <div className="h-8" />
      </div>
    </div>
  );
}
