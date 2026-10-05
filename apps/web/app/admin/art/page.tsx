'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AudioLines, ChevronLeft, ChevronRight, Clapperboard, Download, PackageCheck, Palette, Play,
  RotateCcw, Search, Star, X,
} from 'lucide-react';
import { PageHeader, useAdminData } from '../components/admin-ui';
import { PreviewPanel } from './preview-panel';
import { artSrc, PAGE_SCENES } from '@/lib/art';
import {
  EMPTY_FILTERS, facetCounts, facetLabel, filterAssets, formatBytes, groupFounderPicks, heroIdFor, mediaOf,
  sortAssets, type ArtAsset, type ArtFacet, type ArtFilters, type ArtSort, type ArtStatus, type SignVariant,
} from '@/lib/admin/art-library';
import {
  filterByReview, indexReviews, reviewChips, type ArtReview, type ArtReviewer, type ReviewContext, type ReviewDecision,
  type ReviewFilter, type ReviewIndex,
} from '@/lib/admin/art-review';
import {
  FeedbackThread, OpenFeedbackList, ReviewChipRow, ReviewerDiscs, ReviewPanel, useOpenFeedback,
} from './review-panel';

// admin > Content & Ops > Art Library: every design asset in the private
// 'art-library' bucket (public.art_assets). Browse with filters, open one to
// compare a costume with its hero, play animations and sounds, download, and
// review it. Two reviewers (public.art_reviewers: BMT and JP) both approve
// before art counts as approved. "Founder picks" = approved but not yet shipped:
// the to-do list for wiring art into the apps. "Open feedback" = unresolved
// notes (public.art_feedback) that Claude reads before the next art pass.

const PAGE_SIZE = 60;
const FRESH_MS = 50 * 60 * 1000; // signed URLs live 1h; refresh after 50 minutes
const SIGN_BATCH = 120;

const STATUS_LOOK: Record<ArtStatus, { label: string; dot: string; pill: string }> = {
  draft: { label: 'Draft', dot: 'bg-gray-300', pill: 'bg-gray-100 text-gray-600' },
  approved: { label: 'Approved', dot: 'bg-emerald-500', pill: 'bg-emerald-50 text-emerald-700' },
  rejected: { label: 'Rejected', dot: 'bg-rose-400', pill: 'bg-rose-50 text-rose-600' },
  shipped: { label: 'Shipped', dot: 'bg-purple-600', pill: 'bg-purple-100 text-purple-700' },
};

const FACET_TITLE: Record<ArtFacet, string> = { type: 'Type', season: 'Season', character: 'Character', status: 'Status' };

/** Soft lavender checkerboard behind transparent art. */
const CHECKER: React.CSSProperties = {
  backgroundColor: '#faf7ff',
  backgroundImage: 'repeating-conic-gradient(#efe8fd 0% 25%, transparent 0% 50%)',
  backgroundSize: '18px 18px',
};

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

/* ------------------------------------------------------------------ signing */

interface Signer {
  get: (variant: SignVariant, id: string) => string | null;
  ensure: (variant: SignVariant, ids: string[]) => void;
}

/** Signed-URL cache (variant:id -> url), batched requests, 50-minute freshness. */
function useSigner(): Signer {
  const cache = useRef(new Map<string, { url: string; at: number }>());
  const inflight = useRef(new Set<string>());
  const [, setVersion] = useState(0);

  const get = useCallback((variant: SignVariant, id: string) => {
    const e = cache.current.get(`${variant}:${id}`);
    return e ? e.url : null;
  }, []);

  const ensure = useCallback((variant: SignVariant, ids: string[]) => {
    const now = Date.now();
    const need = ids.filter((id) => {
      const k = `${variant}:${id}`;
      const e = cache.current.get(k);
      return !inflight.current.has(k) && (!e || now - e.at > FRESH_MS);
    });
    for (let i = 0; i < need.length; i += SIGN_BATCH) {
      const chunk = need.slice(i, i + SIGN_BATCH);
      chunk.forEach((id) => inflight.current.add(`${variant}:${id}`));
      fetch('/api/admin/art/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: chunk, variant }),
      })
        .then((r) => r.json())
        .then((j: { urls?: Record<string, string> }) => {
          const at = Date.now();
          for (const [id, url] of Object.entries(j.urls ?? {})) cache.current.set(`${variant}:${id}`, { url, at });
          setVersion((v) => v + 1);
        })
        .catch(() => {})
        .finally(() => chunk.forEach((id) => inflight.current.delete(`${variant}:${id}`)));
    }
  }, []);

  return useMemo(() => ({ get, ensure }), [get, ensure]);
}

/* -------------------------------------------------------------------- page */

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
  const reviewers = useMemo(() => data?.reviewers ?? [], [data]);
  const me = data?.me ?? null;
  const reviewIndex = useMemo(() => indexReviews(reviews), [reviews]);
  const reviewCtx = useMemo<ReviewContext>(() => ({ index: reviewIndex, reviewers, me }), [reviewIndex, reviewers, me]);
  const openFeedback = useOpenFeedback();

  const [view, setView] = useState<'all' | 'picks' | 'feedback'>('all');
  const [review, setReview] = useState<ReviewFilter | null>(null);
  const [filters, setFilters] = useState<ArtFilters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<ArtSort>('featured');
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [lightbox, setLightbox] = useState<{ ids: string[]; index: number } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const signer = useSigner();

  // Re-check freshness every few minutes so long sessions never show expired URLs.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 5 * 60 * 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => { setLimit(PAGE_SIZE); }, [filters, sort, view, review]);

  const byId = useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets]);
  // The Review filter narrows first, so every other chip row counts within it.
  const reviewed = useMemo(() => filterByReview(assets, review, reviewCtx), [assets, review, reviewCtx]);
  const chips = useMemo(() => reviewChips(filterAssets(assets, filters), reviewCtx), [assets, filters, reviewCtx]);
  const list = useMemo(() => sortAssets(filterAssets(reviewed, filters), sort), [reviewed, filters, sort]);
  const shown = list.slice(0, limit);
  const picks = useMemo(() => groupFounderPicks(assets), [assets]);
  const pickCount = picks.reduce((n, g) => n + g.assets.length, 0);

  const feedbackAssets = (openFeedback.items ?? []).flatMap((f) => (f.asset_id && byId.get(f.asset_id) ? [byId.get(f.asset_id)!] : []));
  const thumbIds = (view === 'all' ? shown : view === 'picks' ? picks.flatMap((g) => g.assets) : feedbackAssets)
    .filter((a) => mediaOf(a.mime) === 'image')
    .map((a) => a.id);
  const thumbKey = thumbIds.join('|');
  useEffect(() => {
    if (thumbKey) signer.ensure('thumb', thumbKey.split('|'));
  }, [thumbKey, tick, signer]);

  const setFacet = (facet: ArtFacet, value: string | null) =>
    setFilters((f) => ({ ...f, [facet]: f[facet] === value ? null : value }));

  const open = (ids: string[], id: string) => setLightbox({ ids, index: Math.max(0, ids.indexOf(id)) });

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast((t) => (t === msg ? null : t)), 3500);
  };

  /** Optimistic status change; reverts and explains on failure. */
  const decide = async (id: string, status: ArtStatus, note?: string | null) => {
    const before = byId.get(id);
    if (!before) return;
    const now = new Date().toISOString();
    setAssets((list) => list.map((a) => (a.id === id
      ? { ...a, status, decided_at: now, updated_at: now, ...(note !== undefined ? { note } : {}) }
      : a)));
    try {
      const r = await fetch('/api/admin/art/decide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(note !== undefined ? { id, status, note } : { id, status }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.asset) throw new Error(j.error ?? `Request failed (${r.status})`);
      setAssets((list) => list.map((a) => (a.id === id ? (j.asset as ArtAsset) : a)));
    } catch (e) {
      setAssets((list) => list.map((a) => (a.id === id ? before : a)));
      flash(`Could not save: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  /** Record my review; the server recomputes the status (approved only when every reviewer approves). */
  const submitReview = async (assetId: string, decision: ReviewDecision, note: string | null): Promise<boolean> => {
    try {
      const r = await fetch('/api/admin/art/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asset_id: assetId, decision, note }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.asset) throw new Error(j.error ?? `Request failed (${r.status})`);
      setAssets((list) => list.map((a) => (a.id === assetId ? (j.asset as ArtAsset) : a)));
      setReviews((list) => [...list.filter((x) => x.asset_id !== assetId), ...((j.reviews ?? []) as ArtReview[])]);
      return true;
    } catch (e) {
      flash(`Could not save: ${e instanceof Error ? e.message : String(e)}`);
      return false;
    }
  };

  const download = async (id: string) => {
    try {
      const r = await fetch('/api/admin/art/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [id], variant: 'download' }),
      });
      const j = await r.json();
      const url = j.urls?.[id];
      if (!url) throw new Error(j.error ?? 'No link');
      window.location.assign(url);
    } catch (e) {
      flash(`Download failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const loaded = !!data && !loading;
  // Total in scope: finished art, plus working files when they are shown.
  const shownTotal = useMemo(() => (filters.working ? assets.length : assets.filter((a) => a.stage !== 'working').length), [assets, filters.working]);
  const anyFilter = filters.type || filters.season || filters.character || filters.status || filters.q.trim() || review;
  const clearAll = () => { setFilters(EMPTY_FILTERS); setReview(null); };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Art Library"
        icon={Palette}
        subtitle="Every design asset in one place. Open one to compare, play or download it; BMT and JP both approve the keepers."
      />

      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          value={view}
          onChange={setView}
          options={[
            { value: 'all', label: 'All art', count: shownTotal },
            { value: 'picks', label: 'Founder picks', count: pickCount },
            { value: 'feedback', label: 'Open feedback', count: openFeedback.items?.length },
          ]}
        />
      </div>

      {error && !data ? (
        <StateScene
          scene="offline"
          title="The library did not load"
          body={error}
          action={<SoftButton onClick={reload}><RotateCcw className="w-3.5 h-3.5" /> Try again</SoftButton>}
        />
      ) : !loaded ? (
        <SkeletonGrid />
      ) : view === 'feedback' ? (
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
      ) : view === 'picks' ? (
        <FounderPicks
          groups={picks}
          signer={signer}
          onOpen={(id) => open(picks.flatMap((g) => g.assets.map((a) => a.id)), id)}
          onShip={(id) => decide(id, 'shipped')}
        />
      ) : (
        <>
          <Filters
            assets={reviewed}
            filters={filters}
            onFacet={setFacet}
            onQuery={(q) => setFilters((f) => ({ ...f, q }))}
            onWorking={(working) => setFilters((f) => ({ ...f, working }))}
            sort={sort}
            onSort={setSort}
            review={<ReviewChipRow chips={chips} value={review} onPick={setReview} />}
          />

          {(filters.type == null || filters.type === 'animation') && (
            <AnimationStrip
              assets={assets}
              onOpenCast={() => open(['animation/cast'], 'animation/cast')}
              onShowAll={() => setFilters((f) => ({ ...f, type: 'animation' }))}
              showAllActive={filters.type === 'animation'}
            />
          )}

          <div className="flex items-baseline justify-between gap-2 px-0.5">
            <p className="text-xs font-extrabold text-gray-400 uppercase tracking-wide">
              {list.length.toLocaleString()} {list.length === 1 ? 'asset' : 'assets'}
              {anyFilter ? ` of ${shownTotal.toLocaleString()}` : ''}
            </p>
            {anyFilter && (
              <button onClick={clearAll} className="text-xs font-extrabold text-purple-700 hover:text-purple-900">
                Clear filters
              </button>
            )}
          </div>

          {list.length === 0 ? (
            <StateScene
              scene="empty"
              title={assets.length ? 'Nothing matches these filters' : 'The library is empty'}
              body={assets.length ? 'Loosen a filter or clear the search to see more art.' : 'Run the art upload and every file will show up here.'}
              action={assets.length ? <SoftButton onClick={clearAll}>Clear filters</SoftButton> : undefined}
            />
          ) : (
            <>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6 gap-2.5 sm:gap-3">
                {shown.map((a) => (
                  <Tile
                    key={a.id}
                    asset={a}
                    signer={signer}
                    reviewers={reviewers}
                    reviewIndex={reviewIndex}
                    onOpen={() => open(list.map((x) => x.id), a.id)}
                  />
                ))}
              </div>
              {limit < list.length && <Sentinel onHit={() => setLimit((n) => n + PAGE_SIZE)} />}
            </>
          )}
        </>
      )}

      {lightbox && (
        <Lightbox
          ids={lightbox.ids}
          index={lightbox.index}
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
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[60] max-w-[90vw] rounded-xl bg-gray-900 text-white text-sm font-bold px-4 py-2.5 shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- controls */

function Segmented<T extends string>({ value, onChange, options }: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: string; count?: number }>;
}) {
  return (
    <div className="inline-flex rounded-xl bg-purple-100/70 p-1">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-extrabold transition ${on ? 'bg-white text-purple-700 shadow-sm' : 'text-purple-900/60 hover:text-purple-800'}`}
          >
            {o.label}
            {o.count != null && <span className={`ml-1.5 tabular-nums ${on ? 'text-purple-400' : 'text-purple-900/35'}`}>{o.count.toLocaleString()}</span>}
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

function Filters({ assets, filters, onFacet, onQuery, onWorking, sort, onSort, review }: {
  assets: ArtAsset[];
  filters: ArtFilters;
  onFacet: (facet: ArtFacet, value: string | null) => void;
  onQuery: (q: string) => void;
  onWorking: (on: boolean) => void;
  sort: ArtSort;
  onSort: (s: ArtSort) => void;
  /** The Review chip row (Needs my review / Waiting on ... / Approved by both). */
  review?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-white shadow-sm p-3 sm:p-4 space-y-2.5 min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex-1 min-w-[180px] flex items-center gap-2 rounded-xl bg-purple-50 px-3 py-2 focus-within:ring-2 focus-within:ring-purple-300">
          <Search className="w-4 h-4 text-purple-400 shrink-0" />
          <input
            value={filters.q}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Search title, caption or path"
            className="w-full min-w-0 bg-transparent text-sm font-semibold text-gray-800 placeholder:text-purple-300 outline-none"
          />
          {filters.q && (
            <button onClick={() => onQuery('')} aria-label="Clear search" className="text-purple-400 hover:text-purple-700">
              <X className="w-4 h-4" />
            </button>
          )}
        </label>
        <Segmented value={sort} onChange={onSort} options={[{ value: 'featured', label: 'Featured' }, { value: 'newest', label: 'Newest' }, { value: 'az', label: 'A to Z' }]} />
      </div>
      {(['type', 'season', 'character', 'status'] as const).map((facet) => (
        <ChipRow key={facet} facet={facet} assets={assets} filters={filters} onPick={(v) => onFacet(facet, v)} />
      ))}
      {review}
      <WorkingToggle assets={assets} filters={filters} onChange={onWorking} />
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

/* -------------------------------------------------------------------- grid */

function MediaGlyph({ media, size = 'md' }: { media: 'html' | 'audio' | 'other'; size?: 'sm' | 'md' }) {
  const Icon = media === 'html' ? Play : media === 'audio' ? AudioLines : Palette;
  const label = media === 'html' ? 'Animation' : media === 'audio' ? 'Sound' : 'File';
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-gradient-to-br from-purple-100 to-purple-200/70">
      <span className={`${size === 'sm' ? 'w-7 h-7' : 'w-11 h-11'} rounded-full bg-white/90 shadow-sm flex items-center justify-center text-purple-600`}>
        <Icon className={size === 'sm' ? 'w-3.5 h-3.5' : 'w-5 h-5'} />
      </span>
      {size === 'md' && <span className="text-[10px] font-black text-purple-700/80 uppercase tracking-wide">{label}</span>}
    </div>
  );
}

/** A thumbnail that falls back to the full file when the resized render fails. */
function Thumb({ asset, signer, size = 'md' }: { asset: ArtAsset; signer: Signer; size?: 'sm' | 'md' }) {
  const [fallback, setFallback] = useState(false);
  const media = mediaOf(asset.mime);
  useEffect(() => { if (fallback) signer.ensure('full', [asset.id]); }, [fallback, asset.id, signer]);
  if (media !== 'image') return <MediaGlyph media={media} size={size} />;
  const url = fallback ? signer.get('full', asset.id) : signer.get('thumb', asset.id);
  if (!url) return <div className="absolute inset-0 animate-pulse bg-purple-100/50" />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setFallback(true)}
      className="absolute inset-0 w-full h-full object-contain p-1.5"
    />
  );
}

function Tile({ asset, signer, reviewers, reviewIndex, onOpen }: {
  asset: ArtAsset; signer: Signer; reviewers: readonly ArtReviewer[]; reviewIndex: ReviewIndex; onOpen: () => void;
}) {
  const reviews = reviewIndex.get(asset.id);
  const look = STATUS_LOOK[asset.status] ?? STATUS_LOOK.draft;
  return (
    <button onClick={onOpen} className="group text-left min-w-0" title={asset.path}>
      <div className="relative aspect-square rounded-xl overflow-hidden shadow-sm transition group-hover:shadow-md group-hover:-translate-y-0.5" style={CHECKER}>
        <Thumb asset={asset} signer={signer} />
        {asset.status !== 'draft' && (
          <span className={`absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full ring-2 ring-white ${look.dot}`} aria-label={look.label} />
        )}
      </div>
      <div className="mt-1 flex items-center gap-1 min-w-0">
        <p className="min-w-0 flex-1 text-[11px] font-bold text-gray-700 truncate">{asset.title}</p>
        {(asset.status !== 'shipped' || reviews) && <ReviewerDiscs reviewers={reviewers} reviews={reviews} />}
      </div>
    </button>
  );
}

function Sentinel({ onHit }: { onHit: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const hit = useRef(onHit);
  hit.current = onHit;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // The admin layout scrolls <main>, not the window: observe against it so the margin preloads.
    const root = el.closest('main');
    const io = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) hit.current(); }, {
      root,
      rootMargin: '800px 0px',
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <div ref={ref} className="h-6" aria-hidden />;
}

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

function AnimationStrip({ assets, onOpenCast, onShowAll, showAllActive }: {
  assets: ArtAsset[]; onOpenCast: () => void; onShowAll: () => void; showAllActive: boolean;
}) {
  const cast = assets.find((a) => a.id === 'animation/cast');
  const players = assets.filter((a) => a.type === 'animation' && a.mime === 'text/html' && a.id !== 'animation/cast').length;
  if (!cast && !players) return null;
  return (
    <div className="rounded-2xl bg-gradient-to-r from-purple-600 to-fuchsia-500 text-white shadow-sm p-3 flex items-center gap-3 min-w-0">
      <span className="w-10 h-10 shrink-0 rounded-xl bg-white/20 flex items-center justify-center">
        <Clapperboard className="w-5 h-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-black truncate">Animations</p>
        <p className="text-xs font-semibold text-white/80 truncate">
          {cast ? 'The whole cast moving, live' : 'Rig previews'}
          {players ? ` · ${players} rig ${players === 1 ? 'preview' : 'previews'}` : ''}
        </p>
      </div>
      {players > 0 && !showAllActive && (
        <button onClick={onShowAll} className="hidden sm:inline-flex shrink-0 rounded-xl bg-white/15 hover:bg-white/25 px-3 py-2 text-xs font-extrabold">
          Show rigs
        </button>
      )}
      {cast && (
        <button onClick={onOpenCast} className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-white text-purple-700 hover:bg-purple-50 px-3 py-2 text-xs font-extrabold shadow-sm">
          <Play className="w-3.5 h-3.5" /> Play cast
        </button>
      )}
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

function Lightbox({ ids, index, byId, signer, onIndex, onClose, onDecide, onDownload, review, feedback }: {
  ids: string[];
  index: number;
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

      <div className="flex-1 min-h-0 overflow-y-auto">
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
          <div className="px-3 sm:px-4 pb-4">
            <PreviewPanel
              asset={asset}
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
