'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AudioLines, ChevronLeft, ChevronRight, Columns2, Download, LayoutGrid, MessageSquareText, PackageCheck, Palette,
  RotateCcw, Search, SlidersHorizontal, Smartphone, Star, X,
} from 'lucide-react';
import { PageHeader, useAdminData } from '../components/admin-ui';
import { PreviewPanel } from './preview-panel';
import { SectionBlock, type SectionMode } from './sections';
import { CHECKER, FRESH_MS, MediaGlyph, Thumb, useSigner, type Signer } from './thumbs';
import { artSrc, PAGE_SCENES } from '@/lib/art';
import {
  EMPTY_FILTERS, facetCounts, facetLabel, filterAssets, formatBytes, groupFounderPicks, heroIdFor, mediaOf,
  sortAssets, type ArtAsset, type ArtFacet, type ArtFilters, type ArtStatus,
} from '@/lib/admin/art-library';
import {
  indexReviews, BATCH_MAX, type ArtReview, type ArtReviewer, type ReviewContext, type ReviewDecision,
} from '@/lib/admin/art-review';
import {
  applyReviews, approveAllPlan, groupSections, matchesTab, REVIEW_TABS, sectionSummary, type ArtSection, type ReviewTab,
} from '@/lib/admin/art-sections';
import { FeedbackThread, OpenFeedbackList, ReviewPanel, useOpenFeedback } from './review-panel';
import { SEASON_PREVIEW_WIRED, seasonTitle, wiredFor } from '@/lib/admin/season-preview-wired';
import { LiveTag } from './sections';

// admin > Content & Ops > Art Library: every design asset in the private 'art-library' bucket
// (public.art_assets), as SECTIONS by area then sub-type ("Halloween · Costumes", "Buttons · Family"; see
// lib/admin/art-sections.ts). Sections waiting on the viewer open first (next season first); finished ones
// sit collapsed. Every tile has Approve / Reject / Comment inline (optimistic, with Undo), each section header
// has "See it in the app" and "Approve all", and Grid | Before & After switches the tiles between thumbnails
// and Today vs With-this-art phone frames. Two reviewers (public.art_reviewers: BMT and JP) both approve
// before art counts as approved. "Founder picks" (approved, not shipped) and "Open feedback" (the notes Claude
// reads before the next art pass) live in More filters.


const STATUS_LOOK: Record<ArtStatus, { label: string; dot: string; pill: string }> = {
  draft: { label: 'Draft', dot: 'bg-gray-300', pill: 'bg-gray-100 text-gray-600' },
  approved: { label: 'Approved', dot: 'bg-emerald-500', pill: 'bg-emerald-50 text-emerald-700' },
  rejected: { label: 'Rejected', dot: 'bg-rose-400', pill: 'bg-rose-50 text-rose-600' },
  shipped: { label: 'Shipped', dot: 'bg-purple-600', pill: 'bg-purple-100 text-purple-700' },
};

const FACET_TITLE: Record<ArtFacet, string> = { type: 'Type', season: 'Season', character: 'Character', status: 'Status' };

const fileUrl = (id: string) => `/api/admin/art/file?id=${encodeURIComponent(id)}`;

/**
 * A live animation player. The self-contained HTML is fetched with the admin
 * session and shown through srcdoc in a scripts-only sandbox (opaque origin: it
 * can't reach the admin page, cookies or storage). srcdoc instead of src keeps
 * it working where sub-frame loads are blocked (embedded browsers, extensions).
 */
function PlayerFrame({ asset }: { asset: ArtAsset }) {
  const [html, setHtml] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    fetch(fileUrl(asset.id), { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
      .then((t) => { if (live) setHtml(t); })
      .catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [asset.id]);
  if (failed) {
    return (
      <div className="h-[70vh] rounded-xl flex flex-col items-center justify-center gap-3 text-sm font-bold text-purple-700" style={CHECKER}>
        The player did not load.
        <a href={fileUrl(asset.id)} target="_blank" rel="noreferrer" className="rounded-full bg-purple-600 px-4 py-2 text-white">Open it in a new tab</a>
      </div>
    );
  }
  if (html === null) return <div className="h-[70vh] rounded-xl animate-pulse" style={CHECKER} />;
  return <iframe srcDoc={html} sandbox="allow-scripts" title={asset.title} className="w-full h-[70vh] rounded-xl" style={CHECKER} />;
}
const shortDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '';

/* -------------------------------------------------------------------- page */

const GRID_LIMIT = 30;
const COMPARE_LIMIT = 9;
const UNDO_MS = 5000;
const HINT_KEY = 'art-library.hint.before-after.v1';

type Mode = SectionMode;
/** The top switch: the review tabs plus "In app preview" (what the season preview toggle shows today). */
type Tab = ReviewTab | 'preview';
interface Undo { id: number; message: string; undo: (() => void) | null }
interface PendingOp { timer: ReturnType<typeof setTimeout>; commit: (keepalive: boolean) => void }

const TAB_LABEL: Record<Tab, { long: string; short: string }> = {
  preview: { long: 'In app preview', short: 'In app preview' },
  mine: { long: 'Needs my review', short: 'To review' },
  all: { long: 'All', short: 'All' },
  approved: { long: 'Approved', short: 'Approved' },
  rejected: { long: 'Rejected', short: 'Rejected' },
};

function readHint(): boolean {
  try { return window.localStorage.getItem(HINT_KEY) !== 'done'; } catch { return true; }
}
function dismissHint() {
  try { window.localStorage.setItem(HINT_KEY, 'done'); } catch { /* private mode: the hint just shows again */ }
}

export default function ArtLibraryPage() {
  const { data, error, loading, reload } = useAdminData<{
    assets: ArtAsset[]; reviews?: ArtReview[]; reviewers?: ArtReviewer[]; me?: string | null;
  }>('/api/admin/art');
  const [assets, setAssets] = useState<ArtAsset[]>([]);
  const [reviews, setReviews] = useState<ArtReview[]>([]);
  useEffect(() => {
    if (data?.assets) setAssets(data.assets);
    if (data?.reviews) setReviews(data.reviews);
  }, [data]);
  // Preview frames (Before & After, the lightbox) read the library from here instead of refetching it.
  useEffect(() => {
    (window as unknown as { __artLibraryAssets?: ArtAsset[] }).__artLibraryAssets = assets;
  }, [assets]);
  // ... and sign through one shared cache, so dozens of frames do not each re-sign the same files.
  useEffect(() => {
    const cache = new Map<string, { at: number; url: Promise<string | null> }>();
    const w = window as unknown as { __artLibrarySign?: (ids: string[]) => Promise<Record<string, string>> };
    w.__artLibrarySign = async (ids) => {
      const now = Date.now();
      const need = Array.from(new Set(ids)).filter((id) => { const e = cache.get(id); return !e || now - e.at > FRESH_MS; });
      for (let i = 0; i < need.length; i += 100) {
        const chunk = need.slice(i, i + 100);
        const req = postJson<{ urls?: Record<string, string> }>('/api/admin/art/sign', { ids: chunk, variant: 'full' }).then((j) => j.urls ?? {});
        req.catch(() => chunk.forEach((id) => cache.delete(id)));
        for (const id of chunk) cache.set(id, { at: now, url: req.then((u) => u[id] ?? null) });
      }
      const out: Record<string, string> = {};
      await Promise.all(ids.map(async (id) => { const u = await cache.get(id)?.url; if (u) out[id] = u; }));
      return out;
    };
    return () => { delete w.__artLibrarySign; };
  }, []);
  const reviewers = useMemo(() => data?.reviewers ?? [], [data]);
  const me = data?.me ?? null;
  const iReview = !!me && reviewers.some((r) => r.profile_id === me);
  const reviewIndex = useMemo(() => indexReviews(reviews), [reviews]);
  const ctx = useMemo<ReviewContext>(() => ({ index: reviewIndex, reviewers, me }), [reviewIndex, reviewers, me]);
  const openFeedback = useOpenFeedback();

  const [view, setView] = useState<'sections' | 'picks' | 'feedback'>('sections');
  const [tab, setTab] = useState<Tab>('all');
  const [mode, setMode] = useState<Mode>('grid');
  const [filters, setFilters] = useState<ArtFilters>(EMPTY_FILTERS);
  const [moreOpen, setMoreOpen] = useState(false);
  const [openOverride, setOpenOverride] = useState<Record<string, boolean>>({});
  const [limits, setLimits] = useState<Record<string, number>>({});
  const [confirmKey, setConfirmKey] = useState<string | null>(null);
  /** Pieces reviewed this visit stay in view under "Needs my review" until the tab or filters change. */
  const [touched, setTouched] = useState<Set<string>>(() => new Set());
  const [lightbox, setLightbox] = useState<{ ids: string[]; index: number; preview: null | 'piece' | 'season' } | null>(null);
  const [toast, setToast] = useState<Undo | null>(null);
  const [hint, setHint] = useState(false);
  useEffect(() => { setHint(readHint()); }, []);
  const signer = useSigner();

  // Re-check freshness every few minutes so long sessions never show expired URLs.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 5 * 60 * 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => { setTouched(new Set()); setConfirmKey(null); }, [tab, filters]);

  const byId = useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets]);
  /** Everything the search, the More filters and the working-files switch allow (the tab narrows further). */
  const base = useMemo(() => filterAssets(assets, { ...filters, status: null }), [assets, filters]);
  // "In app preview" lists every wired piece, working files included (the shipped skins are working copies).
  const wired = useMemo(() => filterAssets(assets, { ...filters, status: null, working: true }).filter((a) => wiredFor(a)), [assets, filters]);
  const tabCounts = useMemo(() => {
    const out = { mine: 0, all: base.length, approved: 0, rejected: 0, preview: wired.length } as Record<Tab, number>;
    for (const a of base) for (const t of ['mine', 'approved', 'rejected'] as const) if (matchesTab(a, t, ctx)) out[t] += 1;
    return out;
  }, [base, wired, ctx]);
  const list = useMemo(
    // A to Z: an order a review never changes, so a tile never jumps away under the finger.
    () => sortAssets(tab === 'preview' ? wired : base.filter((a) => matchesTab(a, tab, ctx) || touched.has(a.id)), 'az'),
    [base, wired, tab, ctx, touched],
  );
  const grouped = useMemo(() => groupSections(list, ctx), [list, ctx]);

  // Section order is fixed when the tab or filters change (or the library loads), not on every review, so a
  // section never jumps away under the finger once it is done: it just collapses where it is.
  const orderRef = useRef<{ key: string; order: Map<string, number> } | null>(null);
  const orderKey = JSON.stringify([tab, filters, assets.length > 0, reviewers.length]);
  if (!orderRef.current || orderRef.current.key !== orderKey) {
    orderRef.current = { key: orderKey, order: new Map(grouped.map((s, i) => [s.key, i])) };
  }
  const sections = useMemo(() => {
    const order = orderRef.current!.order;
    const rank = (k: string) => order.get(k) ?? Number.MAX_SAFE_INTEGER;
    return grouped.slice().sort((a, b) => rank(a.key) - rank(b.key));
  }, [grouped, orderKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // "In app preview" is shipped art (nothing to review), so its sections open; elsewhere done ones fold.
  const isOpen = (s: ArtSection) => openOverride[s.key] ?? (tab === 'preview' || !s.done);
  const limitFor = (s: ArtSection) => limits[s.key] ?? (mode === 'compare' ? COMPARE_LIMIT : GRID_LIMIT);

  const picks = useMemo(() => groupFounderPicks(assets), [assets]);
  const pickCount = picks.reduce((n, g) => n + g.assets.length, 0);
  const feedbackAssets = (openFeedback.items ?? []).flatMap((f) => (f.asset_id && byId.get(f.asset_id) ? [byId.get(f.asset_id)!] : []));

  const thumbIds = (view === 'sections'
    ? sections.filter(isOpen).flatMap((s) => s.assets.slice(0, limitFor(s)))
    : view === 'picks' ? picks.flatMap((g) => g.assets) : feedbackAssets)
    .filter((a) => mediaOf(a.mime) === 'image')
    .map((a) => a.id);
  const thumbKey = thumbIds.join('|');
  useEffect(() => {
    if (thumbKey) signer.ensure('thumb', thumbKey.split('|'));
  }, [thumbKey, tick, signer]);

  const setFacet = (facet: ArtFacet, value: string | null) =>
    setFilters((f) => ({ ...f, [facet]: f[facet] === value ? null : value }));

  const open = (ids: string[], id: string, preview: null | 'piece' | 'season' = null) =>
    setLightbox({ ids, index: Math.max(0, ids.indexOf(id)), preview });

  const toastSeq = useRef(0);
  const flash = (message: string, undo: (() => void) | null = null) => {
    const id = ++toastSeq.current;
    setToast({ id, message, undo });
    setTimeout(() => setToast((t) => (t?.id === id ? null : t)), undo ? UNDO_MS : 3500);
  };

  /* ------------------------------------------------ review: optimistic + undo */

  const assetsRef = useRef(assets);
  assetsRef.current = assets;
  const reviewsRef = useRef(reviews);
  reviewsRef.current = reviews;
  const pending = useRef(new Map<number, PendingOp>());

  // Leaving the page commits anything still inside its undo window.
  useEffect(() => {
    const flush = () => {
      for (const [id, op] of Array.from(pending.current)) {
        clearTimeout(op.timer);
        pending.current.delete(id);
        op.commit(true);
      }
    };
    window.addEventListener('pagehide', flush);
    return () => { window.removeEventListener('pagehide', flush); flush(); };
  }, []);

  /**
   * Apply my call on `ids` now, offer Undo, and send it once the undo window closes. One piece goes to
   * /review (with the note filed as feedback when there is one); several go to /review/batch in chunks.
   */
  const act = (ids: string[], decision: ReviewDecision, note: string | null, message: string) => {
    if (!me || !ids.length) return;
    const idSet = new Set(ids);
    const prevAssets = new Map(assetsRef.current.filter((a) => idSet.has(a.id)).map((a) => [a.id, a]));
    const prevMine = reviewsRef.current.filter((r) => r.reviewer_id === me && idSet.has(r.asset_id));
    const next = applyReviews(assetsRef.current, reviewsRef.current, ids, me, decision, note, reviewers);
    setAssets(next.assets);
    setReviews(next.reviews);
    setTouched((t) => new Set([...Array.from(t), ...ids]));

    const revert = () => {
      setAssets((list) => list.map((a) => prevAssets.get(a.id) ?? a));
      setReviews((list) => [...list.filter((r) => !(r.reviewer_id === me && idSet.has(r.asset_id))), ...prevMine]);
    };
    const merge = (fresh: ArtAsset[], rows: ArtReview[]) => {
      const freshById = new Map(fresh.map((a) => [a.id, a]));
      const ids2 = new Set(fresh.map((a) => a.id));
      setAssets((list) => list.map((a) => freshById.get(a.id) ?? a));
      setReviews((list) => [...list.filter((r) => !ids2.has(r.asset_id)), ...rows]);
    };
    const commit = async (keepalive: boolean) => {
      try {
        if (ids.length === 1) {
          const body = note ? { asset_id: ids[0], decision, note, feedback: true } : { asset_id: ids[0], decision };
          const j = await postJson<{ asset: ArtAsset; reviews: ArtReview[]; item?: unknown }>('/api/admin/art/review', body, keepalive);
          merge([j.asset], j.reviews ?? []);
          if (j.item) openFeedback.reload();
        } else {
          for (let i = 0; i < ids.length; i += BATCH_MAX) {
            const j = await postJson<{ assets: ArtAsset[]; reviews: ArtReview[] }>(
              '/api/admin/art/review/batch', { asset_ids: ids.slice(i, i + BATCH_MAX), decision: 'approve' }, keepalive,
            );
            merge(j.assets ?? [], j.reviews ?? []);
          }
        }
      } catch (e) {
        revert();
        flash(`Could not save: ${e instanceof Error ? e.message : String(e)}`);
      }
    };
    const opId = ++toastSeq.current;
    const timer = setTimeout(() => { pending.current.delete(opId); commit(false); }, UNDO_MS);
    pending.current.set(opId, { timer, commit });
    flash(message, () => {
      clearTimeout(timer);
      pending.current.delete(opId);
      revert();
      setToast(null);
    });
  };

  const approveOne = (id: string) => {
    const mine = me ? reviewIndex.get(id)?.get(me)?.decision : undefined;
    if (mine === 'approve') return;
    act([id], 'approve', null, `Approved ${byId.get(id)?.title ?? 'it'}`);
  };
  const noteOne = (id: string, decision: 'reject' | 'changes', note: string) =>
    act([id], decision, note, decision === 'reject' ? `Rejected ${byId.get(id)?.title ?? 'it'} with a note` : `Asked for changes on ${byId.get(id)?.title ?? 'it'}`);
  const approveSection = (s: ArtSection) => {
    const plan = approveAllPlan(s.assets, ctx);
    setConfirmKey(null);
    if (!plan.ids.length) return;
    setOpenOverride((o) => { const n = { ...o }; delete n[s.key]; return n; });
    act(plan.ids, 'approve', null, `Approved ${plan.ids.length} in ${s.label}`);
  };

  /** Lightbox panel: record my review now (no undo window; the panel shows the result). */
  const submitReview = async (assetId: string, decision: ReviewDecision, note: string | null): Promise<boolean> => {
    try {
      const j = await postJson<{ asset: ArtAsset; reviews: ArtReview[] }>('/api/admin/art/review', { asset_id: assetId, decision, note });
      setAssets((list) => list.map((a) => (a.id === assetId ? j.asset : a)));
      setReviews((list) => [...list.filter((x) => x.asset_id !== assetId), ...(j.reviews ?? [])]);
      setTouched((t) => new Set([...Array.from(t), assetId]));
      return true;
    } catch (e) {
      flash(`Could not save: ${e instanceof Error ? e.message : String(e)}`);
      return false;
    }
  };

  /** Optimistic status change (ship / back to draft); reverts and explains on failure. */
  const decide = async (id: string, status: ArtStatus, note?: string | null) => {
    const before = byId.get(id);
    if (!before) return;
    const now = new Date().toISOString();
    setAssets((list) => list.map((a) => (a.id === id
      ? { ...a, status, decided_at: now, updated_at: now, ...(note !== undefined ? { note } : {}) }
      : a)));
    try {
      const j = await postJson<{ asset: ArtAsset }>('/api/admin/art/decide', note !== undefined ? { id, status, note } : { id, status });
      setAssets((list) => list.map((a) => (a.id === id ? j.asset : a)));
    } catch (e) {
      setAssets((list) => list.map((a) => (a.id === id ? before : a)));
      flash(`Could not save: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const download = async (id: string) => {
    try {
      const j = await postJson<{ urls?: Record<string, string> }>('/api/admin/art/sign', { ids: [id], variant: 'download' });
      const url = j.urls?.[id];
      if (!url) throw new Error('No link');
      window.location.assign(url);
    } catch (e) {
      flash(`Download failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const loaded = !!data && !loading;
  const moreActive = [filters.type, filters.season, filters.character].filter(Boolean).length + (filters.working ? 1 : 0);
  const clearAll = () => { setFilters(EMPTY_FILTERS); setTab('all'); };
  const closeHint = () => { setHint(false); dismissHint(); };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Art Library"
        icon={Palette}
        subtitle="New art by section. Approve, reject or comment right on each piece; BMT and JP both approve the keepers."
      />

      {error && !data ? (
        <StateScene
          scene="offline"
          title="The library did not load"
          body={error}
          action={<SoftButton onClick={reload}><RotateCcw className="w-3.5 h-3.5" /> Try again</SoftButton>}
        />
      ) : !loaded ? (
        <SkeletonGrid />
      ) : view !== 'sections' ? (
        <>
          <button onClick={() => setView('sections')} className="inline-flex items-center gap-1 h-9 rounded-xl bg-white shadow-sm px-3 text-sm font-extrabold text-purple-700 hover:bg-purple-50">
            <ChevronLeft className="w-4 h-4" /> All sections
          </button>
          {view === 'feedback' ? (
            <OpenFeedbackList
              items={openFeedback.items}
              error={openFeedback.error}
              onReload={openFeedback.reload}
              onResolved={openFeedback.drop}
              onOpenAsset={(id) => open(feedbackAssets.map((a) => a.id), id)}
              thumb={(id) => {
                const a = byId.get(id);
                return a ? <div className="absolute inset-0" style={CHECKER}><Thumb asset={a} signer={signer} size="sm" /></div> : null;
              }}
              empty={(
                <StateScene
                  scene="empty"
                  title="No open feedback"
                  body="Notes left on art, a season or a screen show up here until they are resolved. Claude reads this list before every art pass."
                />
              )}
              failed={(message) => (
                <StateScene
                  scene="offline"
                  title="Feedback did not load"
                  body={message}
                  action={<SoftButton onClick={openFeedback.reload}><RotateCcw className="w-3.5 h-3.5" /> Try again</SoftButton>}
                />
              )}
            />
          ) : (
            <FounderPicks
              groups={picks}
              signer={signer}
              onOpen={(id) => open(picks.flatMap((g) => g.assets.map((a) => a.id)), id)}
              onShip={(id) => decide(id, 'shipped')}
            />
          )}
        </>
      ) : (
        <>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className="w-full sm:w-auto min-w-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <Segmented
                  value={tab}
                  onChange={setTab}
                  options={[...REVIEW_TABS.filter((t) => t !== 'mine' || iReview), ...(wired.length ? ['preview' as const] : [])].map((t) => ({
                    value: t,
                    label: <><span className="sm:hidden">{TAB_LABEL[t].short}</span><span className="hidden sm:inline">{TAB_LABEL[t].long}</span></>,
                    count: tabCounts[t],
                  }))}
                />
              </div>
              <div className="ml-auto">
                <Segmented
                  value={mode}
                  onChange={(m) => { setMode(m); setLimits({}); if (m === 'compare') closeHint(); }}
                  options={[
                    { value: 'grid', label: <span className="inline-flex items-center gap-1.5"><LayoutGrid className="w-3.5 h-3.5" />Grid</span> },
                    { value: 'compare', label: <span className="inline-flex items-center gap-1.5"><Columns2 className="w-3.5 h-3.5" />Before &amp; After</span> },
                  ]}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <label className="flex-1 min-w-0 h-10 flex items-center gap-2 rounded-xl bg-white shadow-sm px-3 focus-within:ring-2 focus-within:ring-purple-300">
                <Search className="w-4 h-4 text-purple-400 shrink-0" />
                <input
                  value={filters.q}
                  onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
                  placeholder="Search art"
                  className="w-full min-w-0 bg-transparent text-sm font-semibold text-gray-800 placeholder:text-purple-300 outline-none"
                />
                {filters.q && (
                  <button onClick={() => setFilters((f) => ({ ...f, q: '' }))} aria-label="Clear search" className="text-purple-400 hover:text-purple-700">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </label>
              <button
                onClick={() => setMoreOpen((o) => !o)}
                aria-expanded={moreOpen}
                className={`shrink-0 h-10 inline-flex items-center gap-1.5 rounded-xl px-3 text-sm font-extrabold shadow-sm transition ${
                  moreOpen || moreActive ? 'bg-purple-600 text-white' : 'bg-white text-purple-700 hover:bg-purple-50'
                }`}
              >
                <SlidersHorizontal className="w-4 h-4" />
                <span className="hidden sm:inline">More filters</span>
                <span className="sm:hidden">Filters</span>
                {moreActive > 0 && <span className="tabular-nums text-purple-200">{moreActive}</span>}
              </button>
            </div>
            {moreOpen && (
              <MoreFilters
                assets={assets}
                filters={filters}
                onFacet={setFacet}
                onWorking={(working) => setFilters((f) => ({ ...f, working }))}
                onClear={() => setFilters((f) => ({ ...EMPTY_FILTERS, q: f.q }))}
                picks={pickCount}
                feedback={openFeedback.items?.length}
                onView={(v) => { setView(v); setMoreOpen(false); }}
              />
            )}
          </div>

          {hint && mode === 'grid' && (
            <div className="rounded-2xl bg-gradient-to-r from-purple-600 to-fuchsia-500 text-white shadow-sm pl-3 pr-1.5 py-1.5 flex items-center gap-2.5">
              <Columns2 className="w-5 h-5 shrink-0" />
              <p className="min-w-0 flex-1 text-[13px] font-bold leading-snug">
                Tip: switch to Before &amp; After to compare what players see today with the new art.
              </p>
              <button onClick={() => { setMode('compare'); setLimits({}); closeHint(); }} className="shrink-0 h-9 rounded-xl bg-white text-purple-700 hover:bg-purple-50 px-3 text-xs font-extrabold">
                Show me
              </button>
              <button onClick={closeHint} aria-label="Dismiss tip" className="shrink-0 w-9 h-9 rounded-xl hover:bg-white/15 flex items-center justify-center">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {(() => {
            const live = Array.from(new Set(sections.filter((x) => x.season && SEASON_PREVIEW_WIRED[x.season]).map((x) => x.season!)));
            return live.length > 0 && (
              <p className="flex items-start gap-2 rounded-xl bg-orange-50 px-3 py-2 text-[13px] font-bold text-orange-900">
                <Smartphone className="w-4 h-4 mt-0.5 shrink-0 text-orange-500" />
                <span>
                  {live.map((x) => `Turn on Settings → Season preview → ${seasonTitle(x)} in the app to see these live.`).join(' ')}
                  {tab !== 'preview' && (
                    <button onClick={() => setTab('preview')} className="ml-1.5 font-extrabold text-orange-700 underline underline-offset-2">
                      What is in it
                    </button>
                  )}
                </span>
              </p>
            );
          })()}

          {sections.length === 0 ? (
            <StateScene
              scene="empty"
              title={!assets.length ? 'The library is empty' : tab === 'mine' ? 'Nothing waiting on you' : 'Nothing matches'}
              body={!assets.length
                ? 'Run the art upload and every file will show up here.'
                : tab === 'mine' ? 'Every piece here has your call. New art lands in this list as it is added.' : 'Loosen a filter or clear the search to see more art.'}
              action={assets.length ? <SoftButton onClick={clearAll}>Show all art</SoftButton> : undefined}
            />
          ) : (
            <div>
              {sections.map((s) => {
                const sOpen = isOpen(s);
                return (
                  <SectionBlock
                    key={s.key}
                    section={s}
                    ctx={ctx}
                    open={sOpen}
                    mode={mode}
                    limit={limitFor(s)}
                    signer={signer}
                    summary={sectionSummary(s, ctx)}
                    plan={approveAllPlan(s.assets, ctx)}
                    confirming={confirmKey === s.key}
                    iReview={iReview}
                    actions={{
                      onToggle: () => setOpenOverride((o) => ({ ...o, [s.key]: !sOpen })),
                      onMore: () => setLimits((l) => ({ ...l, [s.key]: s.assets.length })),
                      onOpenAsset: (id) => open(s.assets.map((a) => a.id), id),
                      onSeeInApp: () => {
                        const ids = s.assets.filter((a) => mediaOf(a.mime) === 'image').map((a) => a.id);
                        if (ids.length) open(ids, ids[0], s.season ? 'season' : 'piece');
                      },
                      onAskApproveAll: () => setConfirmKey(s.key),
                      onConfirmApproveAll: () => approveSection(s),
                      onCancelApproveAll: () => setConfirmKey(null),
                      onApprove: approveOne,
                      onNote: noteOne,
                    }}
                  />
                );
              })}
            </div>
          )}
        </>
      )}

      {lightbox && (
        <Lightbox
          ids={lightbox.ids}
          index={lightbox.index}
          preview={lightbox.preview}
          byId={byId}
          signer={signer}
          onIndex={(index) => setLightbox((l) => (l ? { ...l, index } : l))}
          onClose={() => setLightbox(null)}
          onDecide={decide}
          onDownload={download}
          review={(asset) => (
            <ReviewPanel
              assetId={asset.id}
              shipped={asset.status === 'shipped'}
              reviewers={reviewers}
              reviews={reviewIndex.get(asset.id)}
              me={me}
              onReview={submitReview}
            />
          )}
          feedback={(asset) => <FeedbackThread key={asset.id} assetId={asset.id} onChange={openFeedback.reload} />}
        />
      )}

      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[60] w-max max-w-[92vw] rounded-2xl bg-gray-900 text-white shadow-lg pl-4 pr-1.5 py-1.5 flex items-center gap-3">
          <p className="min-w-0 text-sm font-bold truncate py-1">{toast.message}</p>
          {toast.undo && (
            <button onClick={toast.undo} className="shrink-0 h-9 rounded-xl bg-white/15 hover:bg-white/25 px-3 text-sm font-extrabold text-amber-200">
              Undo
            </button>
          )}
        </div>
      )}
    </div>
  );
}

async function postJson<T>(url: string, body: unknown, keepalive = false): Promise<T> {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), keepalive });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j?.error) throw new Error(j?.error ?? `Request failed (${r.status})`);
  return j as T;
}

/* ---------------------------------------------------------------- controls */

function Segmented<T extends string>({ value, onChange, options }: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: React.ReactNode; count?: number }>;
}) {
  return (
    <div className="inline-flex rounded-xl bg-purple-100/70 p-1">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            aria-pressed={on}
            className={`shrink-0 whitespace-nowrap px-3 h-8 rounded-lg text-sm font-extrabold transition ${on ? 'bg-white text-purple-700 shadow-sm' : 'text-purple-900/60 hover:text-purple-800'}`}
          >
            {o.label}
            {o.count != null && <span className={`ml-1.5 tabular-nums ${on ? 'text-purple-400' : 'text-purple-900/35'}`}>{o.count.toLocaleString('en-US')}</span>}
          </button>
        );
      })}
    </div>
  );
}

function SoftButton({ onClick, children, tone = 'purple', disabled }: {
  onClick: () => void; children: React.ReactNode; tone?: 'purple' | 'green' | 'rose' | 'solid'; disabled?: boolean;
}) {
  const cls = {
    purple: 'bg-purple-100 text-purple-700 hover:bg-purple-200',
    green: 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-sm',
    rose: 'bg-rose-50 text-rose-600 hover:bg-rose-100',
    solid: 'bg-purple-600 text-white hover:bg-purple-700 shadow-sm',
  }[tone];
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-extrabold transition disabled:opacity-50 ${cls}`}
    >
      {children}
    </button>
  );
}

/** The "More filters" menu: type, season and character, the working-files switch, and the two side views. */
function MoreFilters({ assets, filters, onFacet, onWorking, onClear, picks, feedback, onView }: {
  assets: ArtAsset[];
  filters: ArtFilters;
  onFacet: (facet: ArtFacet, value: string | null) => void;
  onWorking: (on: boolean) => void;
  onClear: () => void;
  picks: number;
  feedback: number | undefined;
  onView: (v: 'picks' | 'feedback') => void;
}) {
  const any = filters.type || filters.season || filters.character || filters.working;
  return (
    <div className="rounded-2xl bg-white shadow-sm p-3 space-y-2.5 min-w-0">
      {(['type', 'season', 'character'] as const).map((facet) => (
        <ChipRow key={facet} facet={facet} assets={assets} filters={filters} onPick={(v) => onFacet(facet, v)} />
      ))}
      <WorkingToggle assets={assets} filters={filters} onChange={onWorking} />
      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-purple-50">
        <button onClick={() => onView('picks')} className="h-9 inline-flex items-center gap-1.5 rounded-xl bg-purple-50 text-purple-800 hover:bg-purple-100 px-3 text-xs font-extrabold">
          <Star className="w-3.5 h-3.5" /> Founder picks <span className="tabular-nums text-purple-400">{picks.toLocaleString('en-US')}</span>
        </button>
        <button onClick={() => onView('feedback')} className="h-9 inline-flex items-center gap-1.5 rounded-xl bg-purple-50 text-purple-800 hover:bg-purple-100 px-3 text-xs font-extrabold">
          <MessageSquareText className="w-3.5 h-3.5" /> Open feedback {feedback != null && <span className="tabular-nums text-purple-400">{feedback.toLocaleString('en-US')}</span>}
        </button>
        {any && (
          <button onClick={onClear} className="ml-auto text-xs font-extrabold text-purple-700 hover:text-purple-900">Clear filters</button>
        )}
      </div>
    </div>
  );
}

/** Working files (rig parts, raw captures, keyed copies, pieces, retired art) stay out of the grid until asked for. */
function WorkingToggle({ assets, filters, onChange }: { assets: ArtAsset[]; filters: ArtFilters; onChange: (on: boolean) => void }) {
  const hidden = useMemo(
    () => filterAssets(assets, { ...filters, working: true }).filter((a) => a.stage === 'working').length,
    [assets, filters],
  );
  if (!hidden && !filters.working) return null;
  const on = filters.working;
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="flex items-center gap-2.5 pt-1 text-left"
    >
      <span className={`relative w-9 h-5 shrink-0 rounded-full transition-colors ${on ? 'bg-purple-600' : 'bg-purple-100'}`}>
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all ${on ? 'left-[18px]' : 'left-0.5'}`} />
      </span>
      <span className="text-xs font-extrabold text-purple-800">
        Show working files <span className="font-bold text-purple-400 tabular-nums">{hidden.toLocaleString('en-US')}</span>
      </span>
      <span className="hidden sm:inline text-[11px] font-semibold text-gray-400">rig parts, raw captures, keyed copies, pieces, retired art</span>
    </button>
  );
}

function ChipRow({ facet, assets, filters, onPick }: {
  facet: ArtFacet; assets: ArtAsset[]; filters: ArtFilters; onPick: (v: string | null) => void;
}) {
  const counts = useMemo(() => facetCounts(assets, filters, facet), [assets, filters, facet]);
  const all = useMemo(() => filterAssets(assets, { ...filters, [facet]: null }).length, [assets, filters, facet]);
  if (!counts.length) return null;
  const selected = filters[facet];
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className="w-[68px] shrink-0 text-[10px] font-black text-gray-400 uppercase tracking-wide">{FACET_TITLE[facet]}</span>
      <div className="flex-1 min-w-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex gap-1.5 w-max pr-2">
          <Chip on={selected == null} onClick={() => onPick(null)} label="All" count={all} />
          {counts.map((c) => (
            <Chip
              key={c.value}
              on={selected === c.value}
              onClick={() => onPick(c.value)}
              label={facet === 'status' ? STATUS_LOOK[c.value as ArtStatus]?.label ?? c.value : facetLabel(facet, c.value)}
              count={c.count}
              dot={facet === 'status' ? STATUS_LOOK[c.value as ArtStatus]?.dot : undefined}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function Chip({ on, onClick, label, count, dot }: { on: boolean; onClick: () => void; label: string; count: number; dot?: string }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-extrabold whitespace-nowrap transition ${
        on ? 'bg-purple-600 text-white shadow-sm' : 'bg-purple-50 text-purple-800 hover:bg-purple-100'
      }`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />}
      {label}
      <span className={`tabular-nums ${on ? 'text-purple-200' : 'text-purple-400'}`}>{count.toLocaleString()}</span>
    </button>
  );
}

/* ------------------------------------------------------------------ states */

function SkeletonGrid() {
  return (
    <div className="space-y-4">
      <div className="h-36 rounded-2xl bg-white shadow-sm animate-pulse" />
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6 gap-2.5 sm:gap-3">
        {Array.from({ length: 18 }).map((_, i) => (
          <div key={i}>
            <div className="aspect-square rounded-xl bg-purple-100/60 animate-pulse" />
            <div className="mt-1.5 h-2.5 w-3/4 rounded bg-purple-100/60 animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}

function StateScene({ scene, title, body, action }: {
  scene: 'empty' | 'offline'; title: string; body: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-gradient-to-b from-purple-50 to-white shadow-sm px-6 py-8 flex flex-col items-center text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={artSrc(`art-scene-${PAGE_SCENES[scene]}`)} alt="" className="w-36 h-36 object-contain" />
      <p className="mt-3 text-base font-black text-gray-900">{title}</p>
      <p className="mt-1 text-sm font-semibold text-gray-500 max-w-sm break-words">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ----------------------------------------------------------- founder picks */

function FounderPicks({ groups, signer, onOpen, onShip }: {
  groups: ReturnType<typeof groupFounderPicks>; signer: Signer; onOpen: (id: string) => void; onShip: (id: string) => void;
}) {
  const total = groups.reduce((n, g) => n + g.assets.length, 0);
  if (!total) {
    return (
      <StateScene
        scene="empty"
        title="No picks waiting"
        body="Art lands here once BMT and JP both approve it, and stays until it is wired into the apps."
      />
    );
  }
  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-purple-50 px-4 py-3 flex items-center gap-3">
        <span className="w-9 h-9 shrink-0 rounded-xl bg-white shadow-sm flex items-center justify-center text-purple-600">
          <Star className="w-4 h-4" />
        </span>
        <p className="text-sm font-semibold text-purple-900">
          <span className="font-black">{total.toLocaleString()} approved, not yet shipped.</span>{' '}
          Wire each one into the apps, then mark it shipped.
        </p>
      </div>
      {groups.map((g) => (
        <section key={g.type} className="space-y-2">
          <h2 className="px-0.5 text-xs font-black text-gray-400 uppercase tracking-wide">
            {facetLabel('type', g.type)} <span className="text-purple-400 tabular-nums">{g.assets.length}</span>
          </h2>
          <div className="space-y-2">
            {g.assets.map((a) => (
              <div key={a.id} className="rounded-2xl bg-white shadow-sm p-2.5 flex items-center gap-3 min-w-0">
                <button onClick={() => onOpen(a.id)} className="relative w-16 h-16 shrink-0 rounded-xl overflow-hidden" style={CHECKER} aria-label={`Open ${a.title}`}>
                  <Thumb asset={a} signer={signer} size="sm" />
                </button>
                <button onClick={() => onOpen(a.id)} className="min-w-0 flex-1 text-left">
                  <p className="text-sm font-black text-gray-900 truncate">{a.title}</p>
                  <p className="text-[11px] font-semibold text-gray-400 font-mono truncate">{a.path}</p>
                  {a.note && <p className="text-xs font-semibold text-purple-800 line-clamp-2 mt-0.5">{a.note}</p>}
                  {a.decided_at && <p className="text-[10px] font-bold text-gray-400 mt-0.5">Approved {shortDate(a.decided_at)}</p>}
                </button>
                <button
                  onClick={() => onShip(a.id)}
                  className="shrink-0 inline-flex items-center gap-1 rounded-xl bg-purple-600 text-white hover:bg-purple-700 px-2.5 py-2 text-xs font-extrabold shadow-sm"
                >
                  <PackageCheck className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Mark shipped</span>
                  <span className="sm:hidden">Shipped</span>
                </button>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- lightbox */

function FullImage({ asset, signer, label }: { asset: ArtAsset; signer: Signer; label?: string }) {
  const url = signer.get('full', asset.id);
  return (
    <div className="relative min-w-0 h-full rounded-xl overflow-hidden" style={CHECKER}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={asset.title} className="absolute inset-0 w-full h-full object-contain p-2" />
      ) : (
        <div className="absolute inset-0 animate-pulse bg-purple-100/50" />
      )}
      {label && (
        <span className="absolute top-2 left-2 rounded-full bg-white/90 shadow-sm px-2.5 py-0.5 text-[10px] font-black text-purple-700 uppercase tracking-wide">
          {label}
        </span>
      )}
    </div>
  );
}

function Lightbox({ ids, index, preview = null, byId, signer, onIndex, onClose, onDecide, onDownload, review, feedback }: {
  ids: string[];
  index: number;
  /** Opened from "See it in the app": the in-app comparison leads, open on this piece or the whole season. */
  preview?: null | 'piece' | 'season';
  byId: Map<string, ArtAsset>;
  signer: Signer;
  onIndex: (i: number) => void;
  onClose: () => void;
  onDecide: (id: string, status: ArtStatus, note?: string | null) => void;
  onDownload: (id: string) => void;
  /** The two-approver panel (review-panel.tsx). */
  review: (asset: ArtAsset) => React.ReactNode;
  /** The asset's feedback thread (review-panel.tsx). */
  feedback: (asset: ArtAsset) => React.ReactNode;
}) {
  const asset = byId.get(ids[index]);
  const hero = asset ? byId.get(heroIdFor(asset) ?? '') : undefined;
  const media = asset ? mediaOf(asset.mime) : 'other';

  // Sign the full file for this asset, its hero and both neighbors (instant prev / next).
  const neighborKey = [ids[index - 1], ids[index], ids[index + 1], hero?.id].filter(Boolean).join('|');
  useEffect(() => {
    const want = neighborKey.split('|').filter((id) => id && mediaOf(byId.get(id)?.mime ?? '') === 'image');
    if (want.length) signer.ensure('full', want);
  }, [neighborKey, byId, signer]);

  const go = useCallback((d: number) => {
    const next = index + d;
    if (next >= 0 && next < ids.length) onIndex(next);
  }, [index, ids.length, onIndex]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement | null)?.closest?.('input, textarea');
      if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
      if (typing) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, onClose]);

  if (!asset) {
    return (
      <Overlay onClose={onClose}>
        <div className="p-6">
          <StateScene scene="empty" title="That file is not in the library" body="It may not have been uploaded yet." />
        </div>
      </Overlay>
    );
  }

  const look = STATUS_LOOK[asset.status] ?? STATUS_LOOK.draft;
  const live = wiredFor(asset);
  const tags = [
    facetLabel('type', asset.type),
    asset.kind && facetLabel('type', asset.kind),
    asset.season && facetLabel('season', asset.season),
    asset.character && `Character ${asset.character.toUpperCase()}`,
  ].filter(Boolean) as string[];

  return (
    <Overlay onClose={onClose}>
      <div className="flex items-center gap-2 px-3 sm:px-4 py-2.5">
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${look.pill}`}>{look.label}</span>
        <p className="min-w-0 flex-1 text-sm font-black text-gray-900 truncate">{asset.title}</p>
        <span className="shrink-0 text-xs font-bold text-gray-400 tabular-nums">{index + 1} / {ids.length}</span>
        <button onClick={onClose} aria-label="Close" className="shrink-0 w-8 h-8 rounded-full bg-purple-50 text-purple-700 hover:bg-purple-100 flex items-center justify-center">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col">
        <div className="relative px-3 sm:px-4">
          {media === 'html' ? (
            <PlayerFrame key={asset.id} asset={asset} />
          ) : media === 'audio' ? (
            <div className="rounded-xl bg-gradient-to-br from-purple-100 to-purple-200/70 px-4 py-10 flex flex-col items-center gap-4">
              <span className="w-16 h-16 rounded-full bg-white shadow-sm flex items-center justify-center text-purple-600">
                <AudioLines className="w-7 h-7" />
              </span>
              <audio key={asset.id} controls preload="metadata" src={fileUrl(asset.id)} className="w-full max-w-md" />
            </div>
          ) : media === 'image' ? (
            hero && hero.id !== asset.id ? (
              <div className="grid grid-cols-2 gap-2 h-[44vh] sm:h-[58vh]">
                <FullImage asset={hero} signer={signer} label="Hero" />
                <FullImage asset={asset} signer={signer} label="Costume" />
              </div>
            ) : (
              <div className="h-[48vh] sm:h-[60vh]"><FullImage asset={asset} signer={signer} /></div>
            )
          ) : (
            <div className="relative h-48 rounded-xl overflow-hidden"><MediaGlyph media="other" /></div>
          )}

          {ids.length > 1 && (
            <>
              <NavButton side="left" disabled={index === 0} onClick={() => go(-1)} />
              <NavButton side="right" disabled={index === ids.length - 1} onClick={() => go(1)} />
            </>
          )}
        </div>

        <div className="px-3 sm:px-4 py-4 grid gap-4 sm:grid-cols-[1fr_minmax(0,320px)]">
          <div className="min-w-0 space-y-2">
            {asset.caption && <p className="text-sm font-semibold text-gray-700">{asset.caption}</p>}
            <p className="text-xs font-semibold text-gray-400 font-mono break-all">{asset.path}</p>
            <div className="flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <span key={t} className="rounded-full bg-purple-50 text-purple-800 px-2.5 py-0.5 text-[11px] font-extrabold">{t}</span>
              ))}
              {asset.width && asset.height ? (
                <span className="rounded-full bg-gray-100 text-gray-600 px-2.5 py-0.5 text-[11px] font-extrabold tabular-nums">{asset.width} × {asset.height}</span>
              ) : null}
              <span className="rounded-full bg-gray-100 text-gray-600 px-2.5 py-0.5 text-[11px] font-extrabold tabular-nums">{formatBytes(asset.bytes)}</span>
            </div>
            {live && (
              <p className="flex flex-wrap items-center gap-2 text-xs font-bold text-orange-900">
                <LiveTag />
                <span>{live.where}</span>
              </p>
            )}
            {(asset.note || asset.decided_at) && (
              <p className="text-xs font-semibold text-gray-500">
                {asset.decided_at && <span className="font-extrabold">{look.label} {shortDate(asset.decided_at)}</span>}
                {asset.note && <span>{asset.decided_at ? ': ' : ''}{asset.note}</span>}
              </p>
            )}
          </div>

          <div className="min-w-0 space-y-3">
            {review(asset)}
            <div className="flex flex-wrap gap-2">
              <SoftButton onClick={() => onDownload(asset.id)}>
                <Download className="w-4 h-4" /> Download
              </SoftButton>
              {asset.status === 'approved' && (
                <SoftButton tone="solid" onClick={() => onDecide(asset.id, 'shipped')}>
                  <PackageCheck className="w-4 h-4" /> Mark shipped
                </SoftButton>
              )}
              {asset.status !== 'draft' && (
                <SoftButton onClick={() => onDecide(asset.id, 'draft')}>
                  <RotateCcw className="w-4 h-4" /> Back to draft
                </SoftButton>
              )}
            </div>
          </div>
        </div>

        {media === 'image' && (
          <div className={`px-3 sm:px-4 pb-4 ${preview ? 'order-first pt-1' : ''}`}>
            <PreviewPanel
              asset={asset}
              initial={preview}
              after={(scope) => (
                <FeedbackThread key={scope} scope={scope} title={scope.startsWith('season:') ? 'Feedback on the whole season' : 'Feedback on this screen'} />
              )}
            />
          </div>
        )}

        <div className="px-3 sm:px-4 pb-5">
          {feedback(asset)}
        </div>
      </div>
    </Overlay>
  );
}

function NavButton({ side, disabled, onClick }: { side: 'left' | 'right'; disabled: boolean; onClick: () => void }) {
  const Icon = side === 'left' ? ChevronLeft : ChevronRight;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={side === 'left' ? 'Previous' : 'Next'}
      className={`absolute top-1/2 -translate-y-1/2 ${side === 'left' ? 'left-4 sm:left-6' : 'right-4 sm:right-6'} w-10 h-10 rounded-full bg-white/90 shadow-md text-purple-700 flex items-center justify-center transition hover:bg-white disabled:opacity-0`}
    >
      <Icon className="w-5 h-5" />
    </button>
  );
}

function Overlay({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-50 bg-[#1b1430]/75 backdrop-blur-sm flex items-stretch sm:items-center justify-center sm:p-6"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full h-full sm:h-auto sm:max-w-5xl bg-white sm:rounded-2xl shadow-2xl flex flex-col max-h-full sm:max-h-[94vh] overflow-hidden">
        {children}
      </div>
    </div>
  );
}
