'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CalendarDays, CalendarRange, CircleCheck, CircleDashed, Clapperboard, Pause, Play, RotateCcw, X } from 'lucide-react';
import { PageHeader, useAdminData } from '../components/admin-ui';
import { StudioCalendar, type CalPost } from './calendar';
import { PostCard, type CardActions } from './post-card';
import { artSrc, PAGE_SCENES } from '@/lib/art';
import {
  addDays, applyEdit, calendarFlags, dayKey, displayStatus, groupByDay, moveToDay, PLATFORM_INFO, PROVIDERS, releaseBands, reviewState,
  seasonBands, type Platform, type Provider, type SocialPost, type SocialReview, type SocialTarget,
} from '@/lib/admin/studio';
import type { StudioPayload } from '@/lib/admin/studio-types';

// admin > Growth > Social Studio: the marketing calendar on top (month / week, status-colored thumbnails, season
// and release bands, drag to reschedule), the review queue under it (inline caption edits with character counts,
// Approve / Reject / Comment with a 5-second Undo), and the Accounts panel. BMT and JP (public.art_reviewers) both
// approve a post's CURRENT version; then /api/cron/social-publish posts it at its time on every connected account.
// Rules: lib/admin/studio.ts. Tables: docs/sql/20261005-social-studio.sql.

const UNDO_MS = 5000;
interface Toast { id: number; message: string; undo: (() => void) | null }

async function postJson<T>(url: string, body: unknown, keepalive = false): Promise<T> {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), keepalive });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j?.error) throw new Error(j?.error ?? `Request failed (${r.status})`);
  return j as T;
}

export default function SocialStudioPage() {
  const [search, setSearch] = useState<string | null>(null);
  useEffect(() => { setSearch(window.location.search); }, []);
  const empty = !!search?.includes('empty=1');
  const { data, error, loading, reload } = useAdminData<StudioPayload>(search === null ? null : `/api/admin/studio${empty ? '?empty=1' : ''}`);

  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [targets, setTargets] = useState<SocialTarget[]>([]);
  const [reviews, setReviews] = useState<SocialReview[]>([]);
  const [paused, setPaused] = useState(false);
  const [urls, setUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!data) return;
    setPosts(data.posts);
    setTargets(data.targets);
    setReviews(data.reviews);
    setPaused(data.paused);
    setUrls(data.urls);
  }, [data]);

  const reviewers = useMemo(() => data?.reviewers ?? [], [data]);
  const me = data?.me ?? null;
  const now = useMemo(() => new Date(), [data]); // eslint-disable-line react-hooks/exhaustive-deps
  const today = dayKey(now);

  const [view, setView] = useState<'month' | 'week'>('month');
  const [anchor, setAnchor] = useState(today);
  const [selected, setSelected] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => {
    if (search === null) return;
    const sp = new URLSearchParams(search);
    if (sp.get('connected')) setNotice({ ok: true, text: `${PROVIDERS[sp.get('connected') as Provider]?.label ?? sp.get('connected')} connected.` });
    if (sp.get('connect_error')) setNotice({ ok: false, text: sp.get('connect_error')! });
    const v = sp.get('view');
    if (v === 'week' || v === 'month') setView(v);
    const d = sp.get('day');
    if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) { setSelected(d); setAnchor(d); }
  }, [search]);

  /* -------------------------------------------------------------- derived */

  const states = useMemo(() => new Map(posts.map((p) => [p.id, reviewState(p, reviews, reviewers)])), [posts, reviews, reviewers]);
  const statusOf = useCallback((p: SocialPost) => displayStatus(p, states.get(p.id)!, reviewers, paused), [states, reviewers, paused]);
  const thumbOf = useCallback((p: SocialPost) => {
    const m = p.media.find((x) => x.size === 'portrait') ?? p.media[0];
    return m ? urls[m.path] ?? m.path : null;
  }, [urls]);
  const byDay = useMemo(() => {
    const g = groupByDay(posts);
    const out = new Map<string, CalPost[]>();
    for (const [k, list] of Array.from(g)) {
      out.set(k, list.map((p) => ({ id: p.id, title: p.title, scheduled_at: p.scheduled_at, status: statusOf(p), thumb: thumbOf(p), locked: p.status !== 'draft' })));
    }
    return out;
  }, [posts, statusOf, thumbOf]);
  const bands = useMemo(() => {
    const y = Number(today.slice(0, 4));
    return [...seasonBands([y - 1, y, y + 1]), ...releaseBands()];
  }, [today]);
  const flags = useMemo(
    () => calendarFlags(posts.map((p) => ({ ...p, approved: states.get(p.id)?.approved ?? false })), now),
    [posts, states, now],
  );
  const connectedCount = (data?.accounts ?? []).filter((a) => a.connected).length;

  const queue = useMemo(() => {
    const list = selected
      ? posts.filter((p) => dayKey(p.scheduled_at) === selected)
      : posts.filter((p) => dayKey(p.scheduled_at) >= addDays(today, -2) || p.status === 'failed');
    return list.slice().sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
  }, [posts, selected, today]);

  /* -------------------------------------------------------------- toasts */

  const [toast, setToast] = useState<Toast | null>(null);
  const seq = useRef(0);
  const flash = (message: string, undo: (() => void) | null = null) => {
    const id = ++seq.current;
    setToast({ id, message, undo });
    setTimeout(() => setToast((t) => (t?.id === id ? null : t)), undo ? UNDO_MS : 3500);
  };
  const pending = useRef(new Map<number, { timer: ReturnType<typeof setTimeout>; commit: (keepalive: boolean) => void }>());
  useEffect(() => {
    const flush = () => {
      for (const [id, op] of Array.from(pending.current)) { clearTimeout(op.timer); pending.current.delete(id); op.commit(true); }
    };
    window.addEventListener('pagehide', flush);
    return () => { window.removeEventListener('pagehide', flush); flush(); };
  }, []);

  /* ------------------------------------------------------------- actions */

  const review = (post: SocialPost, decision: 'approve' | 'reject' | 'changes', note: string | null, message: string) => {
    if (!me) return;
    const prev = reviews.filter((r) => r.post_id === post.id && r.reviewer_id === me);
    const optimistic: SocialReview = { post_id: post.id, reviewer_id: me, decision, version: post.version, note, updated_at: new Date().toISOString() };
    setReviews((list) => [...list.filter((r) => !(r.post_id === post.id && r.reviewer_id === me)), optimistic]);
    const revert = () => setReviews((list) => [...list.filter((r) => !(r.post_id === post.id && r.reviewer_id === me)), ...prev]);
    const commit = async (keepalive: boolean) => {
      try {
        const body = note ? { post_id: post.id, decision, note, feedback: true, version: post.version } : { post_id: post.id, decision, version: post.version };
        const j = await postJson<{ reviews: SocialReview[]; fixture?: boolean }>('/api/admin/studio/review', body, keepalive);
        if (!j.fixture) setReviews((list) => [...list.filter((r) => r.post_id !== post.id), ...j.reviews]);
      } catch (e) {
        revert();
        flash(`Could not save: ${e instanceof Error ? e.message : String(e)}`);
      }
    };
    const opId = ++seq.current;
    const timer = setTimeout(() => { pending.current.delete(opId); commit(false); }, UNDO_MS);
    pending.current.set(opId, { timer, commit });
    flash(message, () => { clearTimeout(timer); pending.current.delete(opId); revert(); setToast(null); });
  };

  const applyLocal = (post: SocialPost, edit: Parameters<typeof applyEdit>[2]) => {
    const mine = targets.filter((t) => t.post_id === post.id);
    const next = applyEdit(post, mine, edit, me, new Date().toISOString());
    if (!next.changed) return null;
    setPosts((list) => list.map((p) => (p.id === post.id ? next.post : p)));
    setTargets((list) => [...list.filter((t) => t.post_id !== post.id), ...next.targets]);
    return { before: { post, targets: mine } };
  };

  const saveEdit = async (post: SocialPost, edit: Parameters<typeof applyEdit>[2], label: string): Promise<boolean> => {
    const undo = applyLocal(post, edit);
    if (!undo) return true;
    try {
      const j = await postJson<{ post?: SocialPost; targets?: SocialTarget[]; fixture?: boolean }>('/api/admin/studio/edit', { post_id: post.id, ...edit });
      if (j.post && j.targets) {
        setPosts((list) => list.map((p) => (p.id === post.id ? j.post! : p)));
        setTargets((list) => [...list.filter((t) => t.post_id !== post.id), ...j.targets!]);
      }
      flash(`${label} saved. ${states.get(post.id)?.approvedBy.length ? 'Approvals reset: both re-approve.' : ''}`.trim());
      return true;
    } catch (e) {
      setPosts((list) => list.map((p) => (p.id === post.id ? undo.before.post : p)));
      setTargets((list) => [...list.filter((t) => t.post_id !== post.id), ...undo.before.targets]);
      flash(`Could not save: ${e instanceof Error ? e.message : String(e)}`);
      return false;
    }
  };

  const schedule = async (post: SocialPost, patch: { scheduled_at?: string; paused?: boolean; platforms?: Platform[] }, message: string) => {
    const before = post;
    if (patch.scheduled_at || patch.paused !== undefined) {
      setPosts((list) => list.map((p) => (p.id === post.id ? { ...p, ...(patch.scheduled_at ? { scheduled_at: patch.scheduled_at } : {}), ...(patch.paused !== undefined ? { paused: patch.paused } : {}) } : p)));
    }
    try {
      const j = await postJson<{ post?: SocialPost; targets?: SocialTarget[]; fixture?: boolean }>('/api/admin/studio/schedule', { post_id: post.id, ...patch });
      if (j.post && j.targets) {
        setPosts((list) => list.map((p) => (p.id === post.id ? j.post! : p)));
        setTargets((list) => [...list.filter((t) => t.post_id !== post.id), ...j.targets!]);
      }
      flash(message);
    } catch (e) {
      setPosts((list) => list.map((p) => (p.id === post.id ? before : p)));
      flash(`Could not save: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const actions: CardActions = {
    approve: (post) => review(post, 'approve', null, `Approved ${post.title}`),
    note: (post, decision, text) => review(post, decision, text, decision === 'reject' ? `Rejected ${post.title} with a note` : `Asked for changes on ${post.title}`),
    saveCaption: (post, platform, text) => saveEdit(post, { caption: { platform, text } }, `${PLATFORM_INFO[platform].label} caption`),
    saveHashtags: (post, tags) => saveEdit(post, { hashtags: tags }, 'Hashtags'),
    reschedule: (post, iso) => schedule(post, { scheduled_at: iso }, `Moved ${post.title}. Approvals kept.`),
    togglePause: (post) => schedule(post, { paused: !post.paused }, post.paused ? `${post.title} will post at its time` : `${post.title} is on hold`),
    togglePlatform: (post, platform, on) => {
      const current = targets.filter((t) => t.post_id === post.id && t.status !== 'skipped').map((t) => t.platform);
      const next = on ? [...current, platform] : current.filter((p) => p !== platform);
      if (!next.length) { flash('Keep at least one platform'); return; }
      schedule(post, { platforms: next }, on ? `Added ${PLATFORM_INFO[platform].label}: it needs both approvals again` : `Removed ${PLATFORM_INFO[platform].label}`);
    },
  };

  const move = (postId: string, day: string) => {
    const post = posts.find((p) => p.id === postId);
    if (!post || post.status !== 'draft' || dayKey(post.scheduled_at) === day) return;
    actions.reschedule(post, moveToDay(post.scheduled_at, day));
  };

  const togglePauseAll = async () => {
    const next = !paused;
    setPaused(next);
    try {
      await postJson('/api/admin/studio/pause', { paused: next });
      flash(next ? 'All posting paused. Nothing will publish until you resume.' : 'Posting resumed.');
    } catch (e) {
      setPaused(!next);
      flash(`Could not save: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const nav = (dir: -1 | 1 | 0) => {
    if (dir === 0) { setAnchor(today); return; }
    if (view === 'week') setAnchor((a) => addDays(a, dir * 7));
    else setAnchor((a) => {
      const [y, m] = a.split('-').map(Number);
      const d = new Date(Date.UTC(y, m - 1 + dir, 1));
      return d.toISOString().slice(0, 10);
    });
  };

  /* ---------------------------------------------------------------- view */

  return (
    <div className="space-y-4">
      <PageHeader
        title="Social Studio"
        icon={Clapperboard}
        subtitle="Posts for the week ahead. Approve, reject or tweak each one; once BMT and JP both approve, it posts by itself at its time."
        actions={data && (
          <button
            onClick={togglePauseAll}
            aria-pressed={paused}
            className={`h-10 rounded-xl px-3.5 text-sm font-extrabold inline-flex items-center gap-1.5 shadow-sm ${paused ? 'bg-slate-800 text-white hover:bg-slate-900' : 'bg-white text-slate-700 hover:bg-slate-50'}`}
          >
            {paused ? <><Play className="w-4 h-4" /> Resume posting</> : <><Pause className="w-4 h-4" /> Pause all posting</>}
          </button>
        )}
      />

      {notice && (
        <p className={`rounded-2xl px-4 py-2.5 text-sm font-bold flex items-center gap-2 ${notice.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-700'}`}>
          {notice.ok ? <CircleCheck className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
          <span className="min-w-0 flex-1 break-words">{notice.text}</span>
          <button onClick={() => setNotice(null)} aria-label="Dismiss" className="shrink-0"><X className="w-4 h-4" /></button>
        </p>
      )}

      {error && !data ? (
        <StateScene
          scene="offline"
          title="The studio did not load"
          body={error}
          action={<button onClick={reload} className="h-10 rounded-xl bg-purple-600 px-4 text-sm font-extrabold text-white inline-flex items-center gap-1.5"><RotateCcw className="w-4 h-4" /> Try again</button>}
        />
      ) : !data || (loading && !posts.length) ? (
        <Skeleton />
      ) : (
        <>
          {paused && (
            <p className="rounded-2xl bg-slate-800 px-4 py-2.5 text-sm font-bold text-white flex items-center gap-2">
              <Pause className="w-4 h-4 shrink-0" /> All posting is paused. Approved posts wait here until you resume.
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-xl bg-white shadow-sm p-1">
              {(['month', 'week'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => { setView(v); if (v === 'week' && selected) setAnchor(selected); }}
                  className={`h-8 rounded-lg px-3 text-xs font-extrabold inline-flex items-center gap-1 ${view === v ? 'bg-purple-600 text-white' : 'text-purple-700 hover:bg-purple-50'}`}
                >
                  {v === 'month' ? <CalendarDays className="w-3.5 h-3.5" /> : <CalendarRange className="w-3.5 h-3.5" />}
                  {v === 'month' ? 'Month' : 'Week'}
                </button>
              ))}
            </div>
            {flags.emptyWeek && posts.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-800">
                <CircleDashed className="w-3.5 h-3.5" /> Nothing scheduled for the next 7 days
              </span>
            )}
            {flags.unapprovedSoon.map((f) => (
              <button
                key={f.id}
                onClick={() => { const d = dayKey(f.scheduled_at); setSelected(d); setAnchor(d); }}
                className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-700 hover:bg-rose-100"
              >
                <AlertTriangle className="w-3.5 h-3.5" /> {f.title} posts within 48 h and is not approved
              </button>
            ))}
            {connectedCount === 0 && (
              <a href="#accounts" className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-200">
                <CircleDashed className="w-3.5 h-3.5" /> No accounts connected: nothing will post yet
              </a>
            )}
          </div>

          <StudioCalendar
            view={view}
            anchor={view === 'month' ? anchor.slice(0, 7) : anchor}
            today={today}
            posts={byDay}
            bands={bands}
            selected={selected}
            onSelect={setSelected}
            onMove={move}
            onNav={nav}
          />

          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <h2 className="min-w-0 flex-1 text-sm font-black uppercase tracking-wide text-gray-500 truncate">
                {selected
                  ? new Date(`${selected}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' })
                  : 'Coming up'}
                <span className="ml-1.5 text-purple-500 tabular-nums">{queue.length}</span>
              </h2>
              {selected && (
                <button onClick={() => setSelected(null)} className="h-8 rounded-lg bg-white shadow-sm px-3 text-xs font-extrabold text-purple-700 hover:bg-purple-50">Show all</button>
              )}
            </div>
            {!posts.length ? (
              <StateScene
                scene="empty"
                title="No posts yet"
                body="Claude drafts a few posts each week. They land here, on the calendar above, for BMT and JP to review before anything goes out."
              />
            ) : !queue.length ? (
              <StateScene
                scene="empty"
                title={selected ? 'Nothing on this day' : 'Nothing coming up'}
                body={selected ? 'Drag a post here on the calendar to move it to this day.' : 'Every scheduled post has gone out. New drafts show up here as Claude writes them.'}
              />
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {queue.map((p) => (
                  <PostCard
                    key={p.id}
                    post={p}
                    targets={targets.filter((t) => t.post_id === p.id)}
                    reviews={reviews.filter((r) => r.post_id === p.id)}
                    reviewers={reviewers}
                    me={me}
                    state={states.get(p.id)!}
                    status={statusOf(p)}
                    urls={urls}
                    links={data.links}
                    feedback={data.feedback.filter((f) => f.post_id === p.id)}
                    actions={actions}
                  />
                ))}
              </div>
            )}
          </section>

          <Accounts accounts={data.accounts} onChange={reload} />
          {data.fixture && <p className="text-[11px] font-bold text-gray-400">Local fixture data (dev only).</p>}
        </>
      )}

      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[60] w-max max-w-[92vw] rounded-2xl bg-gray-900 text-white shadow-lg pl-4 pr-1.5 py-1.5 flex items-center gap-3">
          <p className="min-w-0 text-sm font-bold truncate py-1">{toast.message}</p>
          {toast.undo && (
            <button onClick={toast.undo} className="shrink-0 h-9 rounded-xl bg-white/15 hover:bg-white/25 px-3 text-sm font-extrabold text-amber-200">Undo</button>
          )}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------- accounts */

function Accounts({ accounts, onChange }: { accounts: StudioPayload['accounts']; onChange: () => void }) {
  const providers = Object.keys(PROVIDERS) as Provider[];
  const disconnect = async (p: Provider) => {
    if (!window.confirm(`Disconnect ${PROVIDERS[p].label}? Posts for it will wait until you connect again.`)) return;
    await postJson('/api/admin/studio/disconnect', { provider: p }).catch(() => null);
    onChange();
  };
  return (
    <section id="accounts" className="rounded-2xl bg-white shadow-sm p-3 sm:p-4 space-y-2 scroll-mt-20">
      <h2 className="text-sm font-black uppercase tracking-wide text-gray-500">Accounts</h2>
      <p className="text-xs font-semibold text-gray-500">
        Each Connect uses our own developer app for that platform. Setup steps: docs/marketing/SOCIAL-CONNECT-CHECKLIST.md.
      </p>
      <ul className="divide-y divide-gray-100">
        {providers.map((p) => {
          const rows = accounts.filter((a) => a.provider === p);
          const connected = rows.some((a) => a.connected);
          const configured = rows.every((a) => a.configured);
          const err = rows.find((a) => a.last_error)?.last_error;
          return (
            <li key={p} className="py-2.5 flex flex-wrap items-center gap-2">
              <div className="min-w-0 w-full sm:w-auto sm:flex-1">
                <p className="text-sm font-black text-gray-900">{PROVIDERS[p].label}</p>
                <p className="text-[11px] font-semibold text-gray-500 break-words">
                  {rows.map((a) => `${PLATFORM_INFO[a.platform].label}: ${a.connected ? a.handle ?? 'connected' : PLATFORM_INFO[a.platform].handle}`).join(' · ')}
                </p>
                {!configured && <p className="text-[11px] font-bold text-amber-700 break-words">Needs {PROVIDERS[p].env.join(' + ')} in Vercel</p>}
                {err && <p className="text-[11px] font-bold text-rose-600 break-words">{err}</p>}
              </div>
              <span className={`mr-auto sm:mr-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${connected ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                {connected ? <CircleCheck className="w-3 h-3" /> : <CircleDashed className="w-3 h-3" />}
                {connected ? 'Connected' : 'Not connected'}
              </span>
              {connected ? (
                <button onClick={() => disconnect(p)} className="h-9 rounded-xl bg-gray-50 px-3 text-xs font-extrabold text-gray-600 hover:bg-gray-100">Disconnect</button>
              ) : configured ? (
                <a href={`/api/admin/studio/connect/${p}`} className="h-9 rounded-xl bg-purple-600 px-3.5 text-xs font-extrabold text-white hover:bg-purple-700 inline-flex items-center">Connect</a>
              ) : (
                <span className="h-9 rounded-xl bg-purple-50 px-3.5 text-xs font-extrabold text-purple-300 inline-flex items-center" title="Add the app keys in Vercel first">Connect</span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ---------------------------------------------------------------- states */

function StateScene({ scene, title, body, action }: { scene: 'empty' | 'offline'; title: string; body: React.ReactNode; action?: React.ReactNode }) {
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

function Skeleton() {
  return (
    <div className="space-y-3" aria-label="Loading the studio">
      <div className="rounded-2xl bg-white shadow-sm p-3 flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={artSrc(`art-scene-${PAGE_SCENES.allDone}`)} alt="" className="w-12 h-12 object-contain animate-pulse" />
        <p className="text-sm font-bold text-purple-700">Setting out this week&apos;s posts…</p>
      </div>
      <div className="rounded-2xl bg-white shadow-sm p-3 grid grid-cols-7 gap-1">
        {Array.from({ length: 35 }, (_, i) => <div key={i} className="h-16 sm:h-24 rounded-xl bg-purple-50/70 animate-pulse" />)}
      </div>
    </div>
  );
}
