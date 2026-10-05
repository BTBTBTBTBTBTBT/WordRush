'use client';

import { ChevronLeft, ChevronRight, Rocket } from 'lucide-react';
import { STATUS_LOOK } from './status-look';
import {
  bandsOn, monthGrid, weekOf, type Band, type DisplayStatus,
} from '@/lib/admin/studio';

export interface CalPost {
  id: string;
  title: string;
  scheduled_at: string;
  status: DisplayStatus;
  thumb: string | null;
  /** Posted / posting posts cannot be dragged. */
  locked: boolean;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const time = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { timeZone: 'America/Chicago', hour: 'numeric', minute: '2-digit' });
const monthLabel = (month: string) => new Date(`${month}-15T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const dayNum = (day: string) => Number(day.slice(8));
const shortDay = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });

function Chip({ post, compact, onDragStart }: { post: CalPost; compact: boolean; onDragStart: (e: React.DragEvent) => void }) {
  const look = STATUS_LOOK[post.status];
  return (
    <span
      draggable={!post.locked}
      onDragStart={onDragStart}
      title={`${post.title} · ${time(post.scheduled_at)} · ${look.label}`}
      className={`relative inline-flex items-center gap-1 min-w-0 rounded-lg ring-2 ${look.chip} ${post.locked ? '' : 'cursor-grab active:cursor-grabbing'} ${compact ? 'p-0.5' : 'p-0.5 pr-1.5 w-full max-w-full'}`}
    >
      {post.thumb ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.thumb} alt="" className={`${compact ? 'w-6 h-7 sm:w-7 sm:h-8' : 'w-8 h-10'} shrink-0 rounded-md object-cover bg-purple-100`} draggable={false} />
      ) : (
        <span className={`${compact ? 'w-6 h-7' : 'w-8 h-10'} shrink-0 rounded-md bg-purple-100`} />
      )}
      {!compact && (
        <span className="min-w-0">
          <span className="block text-[11px] font-black leading-tight truncate">{post.title}</span>
          <span className="block text-[10px] font-bold opacity-80 leading-tight">{time(post.scheduled_at)} · {look.label}</span>
        </span>
      )}
      <span className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full ring-2 ring-white ${look.dot}`} aria-hidden />
    </span>
  );
}

function BandStrip({ bands, day }: { bands: Band[]; day: string }) {
  const season = bands.find((b) => b.tone === 'season');
  return (
    <>
      {season && (
        <span
          className={`absolute left-0 right-0 top-0 h-1.5 bg-gradient-to-r from-orange-400 to-amber-400 ${day === season.start ? 'rounded-l-full ml-1' : ''} ${day === season.end ? 'rounded-r-full mr-1' : ''}`}
          title={`${season.label} season`}
        />
      )}
    </>
  );
}

export function StudioCalendar({
  view, anchor, today, posts, bands, selected, onSelect, onMove, onNav,
}: {
  view: 'month' | 'week';
  /** 'YYYY-MM' for month, a day for week. */
  anchor: string;
  today: string;
  posts: Map<string, CalPost[]>;
  bands: Band[];
  selected: string | null;
  onSelect: (day: string | null) => void;
  onMove: (postId: string, day: string) => void;
  onNav: (dir: -1 | 1 | 0) => void;
}) {
  const weeks = view === 'month' ? monthGrid(anchor) : [weekOf(anchor)];
  const title = view === 'month' ? monthLabel(anchor) : `${shortDay(weeks[0][0])} – ${shortDay(weeks[0][6])}`;
  const seasonsShown = Array.from(new Set(weeks.flat().flatMap((d) => bandsOn(d, bands)).map((b) => `${b.tone}:${b.label}`)));

  const drop = (day: string) => (e: React.DragEvent) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/x-studio-post');
    if (id && day >= today) onMove(id, day);
  };
  const drag = (id: string) => (e: React.DragEvent) => {
    e.dataTransfer.setData('text/x-studio-post', id);
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="rounded-2xl bg-white shadow-sm p-2 sm:p-3">
      <div className="flex items-center gap-2 px-1 pb-2">
        <button onClick={() => onNav(-1)} aria-label="Previous" className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 hover:bg-purple-100 flex items-center justify-center">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <p className="min-w-0 flex-1 text-center text-sm sm:text-base font-black text-gray-900 truncate">{title}</p>
        <button onClick={() => onNav(0)} className="h-9 rounded-xl bg-purple-50 px-3 text-xs font-extrabold text-purple-700 hover:bg-purple-100">Today</button>
        <button onClick={() => onNav(1)} aria-label="Next" className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 hover:bg-purple-100 flex items-center justify-center">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className={`grid grid-cols-7 gap-1 ${view === 'week' ? 'hidden sm:grid' : ''}`}>
        {WEEKDAYS.map((d) => <p key={d} className="text-center text-[10px] font-black uppercase tracking-wide text-gray-400">{d.slice(0, view === 'month' ? 1 : 3)}<span className="hidden sm:inline">{view === 'month' ? d.slice(1) : ''}</span></p>)}
      </div>

      <div className={view === 'week' ? 'mt-1 grid grid-cols-1 sm:grid-cols-7 gap-1' : 'mt-1 grid grid-cols-7 gap-1'}>
        {weeks.flat().map((day) => {
          const list = posts.get(day) ?? [];
          const inMonth = view === 'week' || day.startsWith(anchor);
          const isSel = selected === day;
          const isToday = day === today;
          const past = day < today;
          const max = view === 'month' ? 2 : 6;
          return (
            <div
              key={day}
              role="button"
              tabIndex={0}
              onClick={() => onSelect(isSel ? null : day)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(isSel ? null : day); } }}
              onDragOver={(e) => { if (!past) e.preventDefault(); }}
              onDrop={drop(day)}
              className={`relative overflow-hidden rounded-xl text-left transition outline-none focus-visible:ring-2 focus-visible:ring-purple-400
                ${view === 'month' ? 'min-h-[64px] sm:min-h-[96px] p-1 sm:p-1.5' : 'min-h-[56px] sm:min-h-[180px] p-1.5 flex sm:block items-center gap-2'}
                ${isSel ? 'bg-purple-100 ring-2 ring-purple-400' : inMonth ? 'bg-purple-50/50 hover:bg-purple-50' : 'bg-gray-50/60'}
                ${past ? 'opacity-60' : ''}`}
            >
              <BandStrip bands={bandsOn(day, bands)} day={day} />
              <p className={`mt-1 text-[11px] sm:text-xs font-black ${view === 'week' ? 'w-20 sm:w-auto shrink-0' : ''} ${isToday ? 'text-purple-700' : inMonth ? 'text-gray-700' : 'text-gray-300'}`}>
                {view === 'week' ? <><span className="sm:hidden">{shortDay(day)}</span><span className="hidden sm:inline">{dayNum(day)}</span></> : dayNum(day)}
                {isToday && <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-purple-600 align-middle" aria-label="today" />}
                {bandsOn(day, bands).filter((b) => b.tone === 'release').map((b) => (
                  <span key={b.id} className="ml-1 inline-flex items-center gap-0.5 rounded-full bg-sky-100 text-sky-700 px-1 align-middle text-[9px] font-black" title={`Release ${b.label}`}>
                    <Rocket className="w-2.5 h-2.5" /><span className="hidden lg:inline">{b.label}</span>
                  </span>
                ))}
              </p>
              <div className={`mt-1 flex flex-wrap gap-1 ${view === 'week' ? 'sm:flex-col' : ''}`}>
                {list.slice(0, max).map((p) => <Chip key={p.id} post={p} compact={view === 'month'} onDragStart={drag(p.id)} />)}
                {list.length > max && <span className="text-[10px] font-black text-purple-700 self-center">+{list.length - max}</span>}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-2 px-1 flex flex-wrap items-center gap-x-3 gap-y-1">
        {(['draft', 'needs-bmt', 'needs-jp', 'approved', 'posted', 'failed', 'paused'] as DisplayStatus[]).map((s) => (
          <span key={s} className="inline-flex items-center gap-1 text-[10px] font-bold text-gray-500">
            <span className={`w-2 h-2 rounded-full ${STATUS_LOOK[s].dot}`} />{STATUS_LOOK[s].label}
          </span>
        ))}
        {seasonsShown.map((s) => (
          <span key={s} className="inline-flex items-center gap-1 text-[10px] font-bold text-gray-500">
            {s.startsWith('season:')
              ? <><span className="w-4 h-1.5 rounded-full bg-gradient-to-r from-orange-400 to-amber-400" />{s.slice(7)}</>
              : <><Rocket className="w-3 h-3 text-sky-600" />Release {s.slice(8)}</>}
          </span>
        ))}
        <span className="hidden sm:inline text-[10px] font-bold text-gray-400 ml-auto">Drag a post to another day to move it (approvals stay).</span>
      </div>
    </div>
  );
}
