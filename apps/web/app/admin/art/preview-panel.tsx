'use client';

import { useEffect, useRef, useState } from 'react';
import { Moon, Smartphone, Sun, Sparkles } from 'lucide-react';
import type { ArtAsset } from '@/lib/admin/art-library';
import { planFor, SURFACE_LABEL } from '@/lib/admin/art-preview';

/** The phone screen the frames draw (CSS px); scaled down to fit the column. */
const PHONE_W = 390;
const PHONE_H = 760;

type Theme = 'light' | 'dark';

function previewUrl(target: { asset?: string; season?: string }, live: boolean, theme: Theme): string {
  const q = new URLSearchParams();
  if (target.asset) q.set('asset', target.asset);
  if (target.season) q.set('artSeason', target.season);
  if (live) q.set('live', '1');
  q.set('theme', theme);
  return `/admin/art/preview?${q.toString()}`;
}

/**
 * Lightbox "Preview in app": TODAY (live, exactly what players see now) next to PREVIEW (with this art), two
 * phone frames with one light/dark switch. Side by side when there is room; on a phone one at a time with a
 * TODAY / PREVIEW toggle. Seasonal pieces also get "Preview whole season" (Home + a game + the Leaderboard).
 */
export function PreviewPanel({ asset, after, initial = null }: {
  asset: ArtAsset;
  after?: (scope: string) => React.ReactNode;
  /** Open straight onto this comparison ("See it in the app" on a section header). */
  initial?: null | 'piece' | 'season';
}) {
  const plan = planFor(asset);
  const start = initial === 'season' && !asset.season ? 'piece' : initial;
  const [open, setOpen] = useState<null | 'piece' | 'season'>(start);
  const [theme, setTheme] = useState<Theme>('light');
  useEffect(() => { setOpen(start); }, [asset.id, start]);

  const mapped = plan.surface !== 'none';
  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setOpen(open === 'piece' ? null : 'piece')}
          disabled={!mapped}
          className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-extrabold transition-colors ${
            open === 'piece' ? 'bg-purple-600 text-white' : mapped ? 'bg-purple-50 text-purple-700 hover:bg-purple-100' : 'bg-gray-50 text-gray-400'
          }`}
        >
          <Smartphone className="w-3.5 h-3.5" />
          {mapped ? `Preview in app · ${SURFACE_LABEL[plan.surface]}` : 'No in-app preview yet'}
        </button>
        {asset.season && (
          <button
            onClick={() => setOpen(open === 'season' ? null : 'season')}
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-extrabold transition-colors ${
              open === 'season' ? 'bg-purple-600 text-white' : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Preview whole season
          </button>
        )}
        {open && <ThemeSwitch theme={theme} onChange={setTheme} />}
      </div>
      {open && (
        <>
          <Compare
            key={`${open}-${asset.id}`}
            target={open === 'season' ? { season: asset.season! } : { asset: asset.id }}
            theme={theme}
          />
          {after?.(open === 'season' ? `season:${asset.season}` : `surface:${plan.surface}`)}
        </>
      )}
    </div>
  );
}

function ThemeSwitch({ theme, onChange }: { theme: Theme; onChange: (t: Theme) => void }) {
  return (
    <div className="ml-auto inline-flex rounded-full bg-purple-50 p-0.5" role="radiogroup" aria-label="Theme">
      {(['light', 'dark'] as const).map((t) => (
        <button
          key={t}
          role="radio"
          aria-checked={theme === t}
          onClick={() => onChange(t)}
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-extrabold ${theme === t ? 'bg-white text-purple-700 shadow-sm' : 'text-purple-400'}`}
        >
          {t === 'light' ? <Sun className="w-3 h-3" /> : <Moon className="w-3 h-3" />}
          {t === 'light' ? 'Light' : 'Dark'}
        </button>
      ))}
    </div>
  );
}

function Compare({ target, theme }: { target: { asset?: string; season?: string }; theme: Theme }) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [side, setSide] = useState<'today' | 'preview'>('preview');
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  const both = width >= 2 * 300 + 16;
  const frameW = both ? Math.min(PHONE_W, (width - 16) / 2) : Math.min(PHONE_W, width);
  const scale = frameW / PHONE_W;

  const frames = [
    { id: 'today' as const, label: 'Today (live)', live: true },
    { id: 'preview' as const, label: 'Preview (with this art)', live: false },
  ];
  return (
    <div ref={box} className="space-y-2">
      {!both && width > 0 && (
        <div className="flex justify-center">
          <div className="inline-flex rounded-full bg-purple-50 p-0.5">
            {frames.map((f) => (
              <button
                key={f.id}
                onClick={() => setSide(f.id)}
                className={`rounded-full px-3 py-1 text-[11px] font-extrabold ${side === f.id ? 'bg-white text-purple-700 shadow-sm' : 'text-purple-400'}`}
              >
                {f.id === 'today' ? 'Today' : 'Preview'}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="flex justify-center gap-4">
        {width > 0 && frames.filter((f) => both || f.id === side).map((f) => (
          <figure key={f.id} className="m-0 flex flex-col items-center gap-1.5">
            <figcaption className={`text-[10px] font-black uppercase tracking-wider ${f.live ? 'text-gray-400' : 'text-purple-600'}`}>{f.label}</figcaption>
            <div
              className="relative overflow-hidden rounded-[28px] bg-gray-900 p-[6px] shadow-[0_10px_30px_rgba(60,30,120,0.18)]"
              style={{ width: frameW + 12, height: PHONE_H * scale + 12 }}
            >
              <div className="overflow-hidden rounded-[22px] bg-white" style={{ width: frameW, height: PHONE_H * scale }}>
                <iframe
                  title={f.label}
                  src={previewUrl(target, f.live, theme)}
                  loading="lazy"
                  style={{ width: PHONE_W, height: PHONE_H, transform: `scale(${scale})`, transformOrigin: '0 0', border: 0 }}
                />
              </div>
            </div>
          </figure>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------ Before & After pair */

/** True while the element is within `margin` of the admin scroll area (<main>); false again once it leaves. */
function useNearViewport<T extends HTMLElement>(margin = 500): [React.RefObject<T>, boolean] {
  const ref = useRef<T>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => setNear(entries.some((e) => e.isIntersecting)), {
      root: el.closest('main'),
      rootMargin: `${margin}px 0px`,
    });
    io.observe(el);
    return () => io.disconnect();
  }, [margin]);
  return [ref, near];
}

/**
 * Before & After on a tile: a small "Today" phone (live, what players see now) next to "With this art". The
 * frames mount only near the viewport and unmount when scrolled far away, so a long section stays light.
 * Pieces with no in-app surface show `fallback` (the plain image) with "No in-app preview".
 */
export function MiniCompare({ asset, fallback, onOpen }: { asset: ArtAsset; fallback: React.ReactNode; onOpen: () => void }) {
  const plan = planFor(asset);
  const [ref, near] = useNearViewport<HTMLDivElement>();
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, [ref]);
  const gap = 6;
  const frameW = Math.max(0, (width - gap) / 2 - 8);
  const scale = frameW / PHONE_W;
  const frameH = PHONE_H * scale;

  if (plan.surface === 'none') {
    return (
      <div ref={ref} className="min-w-0">
        <button onClick={onOpen} className="relative block w-full aspect-[2/1.6] rounded-xl overflow-hidden shadow-sm">
          {fallback}
        </button>
        <p className="mt-1 text-center text-[10px] font-black text-gray-400 uppercase tracking-wide">No in-app preview</p>
      </div>
    );
  }
  const frames = [
    { id: 'today', label: 'Today', live: true },
    { id: 'with', label: 'With this art', live: false },
  ];
  return (
    <div ref={ref} className="min-w-0 grid grid-cols-2" style={{ gap }}>
      {frames.map((f) => (
        <figure key={f.id} className="m-0 min-w-0 flex flex-col items-center gap-1">
          <figcaption className={`text-[10px] font-black uppercase tracking-wide ${f.live ? 'text-gray-400' : 'text-purple-600'}`}>{f.label}</figcaption>
          <button
            onClick={onOpen}
            aria-label={`${f.label}: open ${asset.title}`}
            className={`relative overflow-hidden rounded-[18px] p-[4px] shadow-sm ${f.live ? 'bg-gray-300' : 'bg-purple-600'}`}
            style={{ width: frameW + 8, height: frameH + 8 }}
          >
            <div className="relative overflow-hidden rounded-[14px] bg-white" style={{ width: frameW, height: frameH }}>
              {near && width > 0 ? (
                <iframe
                  title={`${f.label}: ${asset.title}`}
                  src={previewUrl({ asset: asset.id }, f.live, 'light')}
                  tabIndex={-1}
                  style={{ width: PHONE_W, height: PHONE_H, transform: `scale(${scale})`, transformOrigin: '0 0', border: 0, pointerEvents: 'none' }}
                />
              ) : (
                <div className="absolute inset-0 animate-pulse bg-purple-50" />
              )}
            </div>
          </button>
        </figure>
      ))}
    </div>
  );
}
