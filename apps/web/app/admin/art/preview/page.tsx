'use client';

import { Suspense, createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  AVATAR_FACES, AVATAR_HEADS, AVATAR_NECKS, castPreset, type AvatarConfig,
} from '@wordle-duel/core';
import { ArtTitle } from '@/components/ui/art-title';
import { CastHeader } from '@/components/ui/cast-header';
import { CastButton } from '@/components/ui/cast-button';
import { PageBackground } from '@/components/ui/page-background';
import { MascotAvatar } from '@/components/avatar/mascot-avatar';
import { dayArtName, gameTitleArt, type ArtName, type PageTint, type WallArtName } from '@/lib/art';
import { setArtOverrides, type ArtTrim } from '@/lib/art-override';
import type { ArtAsset } from '@/lib/admin/art-library';
import { planFor, seasonPicks, SURFACE_LABEL, type PreviewPlan, type Swap } from '@/lib/admin/art-preview';

/**
 * admin > Art Library > Preview in app (/admin/art/preview): one real web screen at phone width, drawn with a
 * candidate piece swapped in, for the lightbox's TODAY vs PREVIEW frames.
 *   ?asset=<id>            the surface that piece belongs on (lib/admin/art-preview.ts planFor)
 *   ?artSeason=<s>          Home + a game + the Leaderboard with the season's chosen pieces (approved, else main)
 *   &live=1                the same screen exactly as players see it today (no swaps)
 *   &theme=light|dark      forced for this frame only (never saved)
 * Behind the /admin middleware gate; the swapped URLs are signed by the admin-only /api/admin/art/sign, and the
 * overrides (lib/art-override.ts) live only in this page's JS, so players never see any of it.
 */
/** This frame's forced theme, for the stand-in cards (the app's dark: variant follows the saved preference). */
const DarkCtx = createContext(false);
const card = (dark: boolean) => (dark ? 'bg-white/10' : 'bg-white/80');

export default function ArtPreviewPage() {
  return (
    <Suspense fallback={<Shell><Skeleton /></Shell>}>
      <Preview />
    </Suspense>
  );
}

type State =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; plans: PreviewPlan[]; asset: ArtAsset | null; fullUrl: string | null };

function Preview() {
  const q = useSearchParams();
  const assetId = q.get('asset');
  const season = q.get('artSeason');
  const live = q.get('live') === '1';
  const theme = q.get('theme') === 'dark' ? 'dark' : 'light';
  const [state, setState] = useState<State>({ phase: 'loading' });

  useForcedTheme(theme);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch('/api/admin/art', { credentials: 'same-origin' });
        if (!r.ok) throw new Error(r.status === 401 || r.status === 403 ? 'Admins only.' : `Could not load the library (${r.status}).`);
        const { assets } = (await r.json()) as { assets: ArtAsset[] };
        const asset = assetId ? assets.find((a) => a.id === assetId) ?? null : null;
        if (assetId && !asset) throw new Error('That piece is not in the library.');
        const plans = season ? seasonPlans(assets, season) : asset ? [planFor(asset)] : [];
        const swaps = live ? [] : plans.flatMap((p) => p.swaps);
        const ids = Array.from(new Set([...swaps.map((s) => s.assetId), ...(asset ? [asset.id] : [])]));
        const urls = ids.length ? await sign(ids) : {};
        const trims = await castTrims(swaps, urls);
        if (!alive) return;
        setArtOverrides(Object.fromEntries(swaps.filter((s) => urls[s.assetId]).map((s) => [s.key, urls[s.assetId]])), trims);
        setState({ phase: 'ready', plans, asset, fullUrl: asset ? urls[asset.id] ?? null : null });
      } catch (e) {
        if (alive) setState({ phase: 'error', message: e instanceof Error ? e.message : 'Something went wrong.' });
      }
    })();
    return () => { alive = false; setArtOverrides({}); };
  }, [assetId, season, live]);

  if (state.phase === 'loading') return <Shell dark={theme === 'dark'}><Skeleton dark={theme === 'dark'} /></Shell>;
  if (state.phase === 'error') return <Shell dark={theme === 'dark'}><Note>{state.message}</Note></Shell>;
  const plans = state.plans.filter((p) => p.surface !== 'none');
  if (!plans.length) {
    return (
      <Shell dark={theme === 'dark'}>
        <div className="px-4 py-6 space-y-4">
          {state.fullUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={state.fullUrl} alt="" className="w-full max-h-[60vh] object-contain" />
          )}
          <Note>No in-app preview yet</Note>
        </div>
      </Shell>
    );
  }
  return (
    <DarkCtx.Provider value={theme === 'dark'}>
      <Shell dark={theme === 'dark'}>
        {plans.map((p, i) => <Surface key={i} plan={p} fullUrl={state.fullUrl} labelled={plans.length > 1} />)}
      </Shell>
    </DarkCtx.Provider>
  );
}

/** Season mode: every chosen piece, grouped onto Home, one game and the Leaderboard. */
function seasonPlans(assets: ArtAsset[], season: string): PreviewPlan[] {
  const picks = seasonPicks(assets, season).map(planFor);
  const home: PreviewPlan = { surface: 'home', swaps: picks.filter((p) => p.surface === 'home' || (p.surface === 'title' && /dailies|puzzles/.test(p.titleArt ?? ''))).flatMap((p) => p.swaps) };
  const game = picks.find((p) => p.surface === 'game' && p.game === 'practice') ?? picks.find((p) => p.surface === 'game');
  const board = picks.find((p) => p.surface === 'leaderboard');
  return [
    home,
    game ?? { surface: 'game', game: 'practice', swaps: [] },
    board ?? { surface: 'leaderboard', swaps: [] },
  ];
}

async function sign(ids: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (let i = 0; i < ids.length; i += 100) {
    const r = await fetch('/api/admin/art/sign', {
      method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: ids.slice(i, i + 100), variant: 'full' }),
    });
    if (!r.ok) throw new Error(`Could not sign the art (${r.status}).`);
    Object.assign(out, ((await r.json()) as { urls: Record<string, string> }).urls);
  }
  return out;
}

/** A swapped cast member is framed by its own alpha box, like the shipped art (lib/season.ts castArt). */
async function castTrims(swaps: Swap[], urls: Record<string, string>): Promise<Record<string, { size: number; trim: ArtTrim }>> {
  const out: Record<string, { size: number; trim: ArtTrim }> = {};
  await Promise.all(swaps.filter((s) => s.cast && urls[s.assetId]).map(async (s) => {
    const box = await alphaBox(urls[s.assetId]).catch(() => null);
    if (box) out[s.key] = box;
  }));
  return out;
}

function alphaBox(url: string): Promise<{ size: number; trim: ArtTrim }> {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.crossOrigin = 'anonymous';
    im.onload = () => {
      const size = Math.max(im.naturalWidth, im.naturalHeight);
      const k = Math.min(1, 512 / size);
      const w = Math.round(im.naturalWidth * k), h = Math.round(im.naturalHeight * k);
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const g = c.getContext('2d');
      if (!g) { reject(new Error('no canvas')); return; }
      g.drawImage(im, 0, 0, w, h);
      const d = g.getImageData(0, 0, w, h).data;
      let x0 = w, y0 = h, x1 = 0, y1 = 0;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (d[(y * w + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      }
      if (x1 < x0) { reject(new Error('empty')); return; }
      resolve({ size, trim: [x0 / k, y0 / k, (x1 + 1) / k, (y1 + 1) / k] });
    };
    im.onerror = () => reject(new Error('load'));
    im.src = url;
  });
}

/** This frame's theme, without touching the saved preference (ThemeProvider re-applies the stored one; re-assert). */
function useForcedTheme(theme: 'light' | 'dark') {
  useEffect(() => {
    const el = document.documentElement;
    const apply = () => { if (el.getAttribute('data-theme') !== theme) el.setAttribute('data-theme', theme); };
    apply();
    const mo = new MutationObserver(apply);
    mo.observe(el, { attributes: true, attributeFilter: ['data-theme'] });
    return () => mo.disconnect();
  }, [theme]);
}

const todayDay = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function Surface({ plan, fullUrl, labelled }: { plan: PreviewPlan; fullUrl: string | null; labelled: boolean }) {
  const tag = labelled ? <p className="px-4 pt-3 text-[10px] font-black uppercase tracking-wider text-purple-400">{SURFACE_LABEL[plan.surface]}</p> : null;
  switch (plan.surface) {
    case 'home':
      return (
        <PageBackground tint="home" className="pb-6">
          {tag}
          <CastHeader ground className="mx-auto pt-2" />
          <div className="px-4 pt-5 space-y-5">
            <ArtTitle name={'art-titlecast-dailies' as ArtName} as="div" maxWidth={230} />
            <SampleCards />
            <ArtTitle name={'art-titlecast-puzzles' as ArtName} as="div" maxWidth={230} />
          </div>
        </PageBackground>
      );
    case 'game': {
      const name = gameTitleArt(plan.game ?? 'practice');
      return (
        <PageBackground tint="home" wall={(`art-wall-game-${plan.game ?? 'practice'}`) as WallArtName} className="pb-6">
          {tag}
          <div className="px-4 pt-6">{name && <ArtTitle name={name} as="h1" maxWidth={320} />}</div>
          <SampleBoard />
        </PageBackground>
      );
    }
    case 'leaderboard':
      return (
        <PageBackground tint="leaderboard" className="pb-6">
          {tag}
          <div className="px-4 pt-6 space-y-4">
            <ArtTitle name={(plan.titleArt ?? dayArtName(todayDay())) as ArtName} as="h1" maxWidth={300} />
            <SampleRows />
          </div>
        </PageBackground>
      );
    case 'title':
      return (
        <PageBackground tint={titleTint(plan.titleArt)} className="pb-6">
          {tag}
          <div className="px-4 pt-6 space-y-4">
            <ArtTitle name={plan.titleArt as ArtName} as="h1" maxWidth={320} />
            <SampleCards />
          </div>
        </PageBackground>
      );
    case 'wallpaper':
      return (
        <PageBackground tint={plan.tint ?? 'home'} wall={plan.wall as WallArtName} className="pb-6 min-h-[640px]">
          {tag}
          <CastHeader className="mx-auto" />
          <div className="px-4 pt-5 space-y-4">
            <ArtTitle name={'art-titlecast-dailies' as ArtName} as="div" maxWidth={230} />
            <SampleCards />
          </div>
        </PageBackground>
      );
    case 'buttons':
      return <ButtonSurface color={plan.buttonColor ?? 'purple'} label={plan.label} tag={tag} />;
    case 'mascot':
      return <MascotSurface part={plan.part!} tag={tag} />;
    case 'widget':
      return (
        <div className="min-h-[640px] px-5 py-8" style={{ background: 'linear-gradient(160deg,#6d4fc4,#c86ad6 60%,#f4a7b9)' }}>
          {tag}
          <div className="grid grid-cols-4 gap-4 mb-5">
            {Array.from({ length: 8 }, (_, i) => <span key={i} className="aspect-square rounded-[22%] bg-white/25" />)}
          </div>
          {fullUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={fullUrl} alt="" className="w-full rounded-[22px] shadow-xl" />
          )}
        </div>
      );
    default:
      return null;
  }
}

function titleTint(name?: string): PageTint {
  if (!name) return 'home';
  if (/friends/.test(name)) return 'friends';
  if (/stats|records/.test(name)) return 'stats';
  if (/leaderboard/.test(name)) return 'leaderboard';
  if (/vs/.test(name)) return 'vs';
  return 'home';
}

function ButtonSurface({ color, label, tag }: { color: string; label?: string; tag: React.ReactNode }) {
  const c = color as 'purple';
  const text = label ? label.toUpperCase() : 'PLAY';
  return (
    <PageBackground tint="home" className="pb-8 min-h-[520px]">
      {tag}
      <div className="px-5 pt-8 space-y-5">
        <ArtTitle name={'art-titlecast-dailies' as ArtName} as="div" maxWidth={200} />
        <CastButton color={c} size="l" block>{text}</CastButton>
        <div className="flex gap-3">
          <CastButton color={c} size="m" block>{text}</CastButton>
          <CastButton color={c} size="m" block>SHARE</CastButton>
        </div>
        <div className="flex gap-3 justify-center">
          <CastButton color={c} size="s">DONE</CastButton>
          <CastButton color={c} size="s">NEXT</CastButton>
          <CastButton color={c} size="s">HINT</CastButton>
        </div>
      </div>
    </PageBackground>
  );
}

const MASCOT_BODIES = ['classic', 'blob', 'tall'] as const;
const PREVIEW_CAST = ['w', 'o2', 'r'] as const;

function withPart(base: AvatarConfig, part: { field: string; id: string }): AvatarConfig {
  const c: Record<string, unknown> = { ...base };
  if (part.field === 'acc') {
    const slot = (AVATAR_HEADS as readonly string[]).includes(part.id) ? 'head'
      : (AVATAR_FACES as readonly string[]).includes(part.id) ? 'face'
      : (AVATAR_NECKS as readonly string[]).includes(part.id) ? 'neck' : null;
    if (slot) c[slot] = part.id;
  } else {
    c[part.field] = part.id;
  }
  return c as unknown as AvatarConfig;
}

function MascotSurface({ part, tag }: { part: { field: string; id: string }; tag: React.ReactNode }) {
  const configs = useMemo(() => PREVIEW_CAST.map((id, i) => {
    const base = { ...castPreset(id), body: MASCOT_BODIES[i] } as AvatarConfig;
    return part.field === 'body' && i === 0 ? withPart(castPreset(id), part) : withPart(base, part);
  }), [part]);
  return (
    <PageBackground tint="friends" className="pb-8 min-h-[520px]">
      {tag}
      <div className="px-4 pt-8 space-y-6">
        <ArtTitle name={'art-titlecast-mascot' as ArtName} as="div" maxWidth={280} />
        <div className="flex justify-center gap-3">
          {configs.map((c, i) => <MascotAvatar key={i} config={c} initial={['W', 'O', 'R'][i]} size={104} />)}
        </div>
        <p className="text-center text-xs font-bold text-purple-700/70">{part.field} · {part.id}</p>
      </div>
    </PageBackground>
  );
}

/** Stand-ins for the page body so the header sits in its real rhythm (soft cards, never bordered). */
function SampleCards() {
  const dark = useContext(DarkCtx);
  return (
    <div className="grid grid-cols-2 gap-3">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className={`h-24 rounded-2xl ${card(dark)} shadow-sm`} />
      ))}
    </div>
  );
}

function SampleBoard() {
  const dark = useContext(DarkCtx);
  return (
    <div className="px-8 pt-6 grid grid-cols-5 gap-1.5">
      {Array.from({ length: 30 }, (_, i) => <span key={i} className={`aspect-square rounded-lg ${card(dark)} shadow-sm`} />)}
    </div>
  );
}

function SampleRows() {
  const dark = useContext(DarkCtx);
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }, (_, i) => <div key={i} className={`h-12 rounded-xl ${card(dark)} shadow-sm`} />)}
    </div>
  );
}

function Shell({ children, dark = false }: { children: React.ReactNode; dark?: boolean }) {
  // Covers the admin chrome: this route is a bare phone screen for the lightbox frames.
  return (
    <div className={`fixed inset-0 z-[70] overflow-y-auto ${dark ? 'bg-[#15111f]' : 'bg-[#f7f4fd]'}`}>
      <div className="mx-auto max-w-[430px] min-h-full">{children}</div>
    </div>
  );
}

function Skeleton({ dark = false }: { dark?: boolean }) {
  const fill = dark ? 'bg-white/10' : 'bg-purple-100/70';
  return (
    <div className="px-4 py-6 space-y-4 animate-pulse">
      <div className={`h-20 rounded-2xl ${fill}`} />
      <div className={`h-10 w-1/2 mx-auto rounded-xl ${fill}`} />
      <div className="grid grid-cols-2 gap-3">{Array.from({ length: 4 }, (_, i) => <div key={i} className={`h-24 rounded-2xl ${fill}`} />)}</div>
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className="px-4 py-3 text-center text-sm font-extrabold text-purple-700">{children}</p>;
}
