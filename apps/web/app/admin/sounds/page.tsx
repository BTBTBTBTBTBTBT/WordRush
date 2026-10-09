'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AudioLines, CheckCheck, ChevronDown, MessageSquareText, Play, Send, Square, X } from 'lucide-react';
import { Callout, ErrorNote, LoadingGrid, PageHeader, useAdminData } from '../components/admin-ui';
import { ReviewerDiscs, TileActions } from '../art/review-panel';
import { BATCH_MAX, type ArtFeedback, type ReviewDecision } from '@/lib/admin/art-review';
import {
  applySoundReviews, eventReviewed, groupSoundSections, indexReviews, soundApproveAllPlan, soundScope, soundScopeLabel,
  soundSectionSummary, SOUND_CATALOG, type SoundAsset, type SoundCandidateView, type SoundEventView, type SoundReview,
  type SoundReviewContext, type SoundReviewer, type SoundSection, type SoundStatus,
} from '@/lib/admin/sound-library';

// admin > Design > Sound Library (founder 10-06), modeled on the Art Library: every app sound grouped by game
// (the Sound Lab's sections, lib/admin/sound-catalog.json), each event's CURRENT sound (what ships, tagged LIVE)
// next to its options, every one with a play button. BMT + JP approve / reject / comment inline (optimistic, with
// a 5-second Undo); an approve is that reviewer's ONE pick for the event. Each section has "Approve all" (keep
// what ships for every event not picked yet) and a note box; "Open feedback" lists what Claude reads
// (public.sound_open_feedback). The page is silent except the explicit play buttons (lib/sounds.ts mutes /admin;
// these play plain <audio>).

const UNDO_MS = 5000;

interface Resp {
  assets: Array<Pick<SoundAsset, 'id' | 'status' | 'live'>>;
  reviews: SoundReview[];
  reviewers: SoundReviewer[];
  me: string | null;
  setup?: string;
}
interface Undo { id: number; message: string; undo: (() => void) | null }
interface PendingOp { timer: ReturnType<typeof setTimeout>; commit: (keepalive: boolean) => void }

async function postJson<T>(url: string, body: unknown, keepalive = false): Promise<T> {
  const res = await fetch(url, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), keepalive, credentials: 'same-origin',
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((j as { error?: string }).error ?? `HTTP ${res.status}`);
  return j as T;
}

/* ------------------------------------------------------------------ player */

/** One sound at a time; a grid candidate plays its cells one after another. Only ever started by a tap. */
function usePlayer() {
  const audio = useRef<HTMLAudioElement | null>(null);
  const seq = useRef(0);
  const [playing, setPlaying] = useState<string | null>(null);
  const stop = useCallback(() => {
    seq.current += 1;
    if (audio.current) { try { audio.current.pause(); } catch { /* already stopped */ } }
    audio.current = null;
    setPlaying(null);
  }, []);
  const play = useCallback((key: string, urls: string[]) => {
    if (!urls.length) return;
    const run = ++seq.current;
    if (audio.current) { try { audio.current.pause(); } catch { /* already stopped */ } }
    setPlaying(key);
    const next = (i: number) => {
      if (run !== seq.current) return;
      if (i >= urls.length) { setPlaying(null); audio.current = null; return; }
      const a = new Audio(urls[i]);
      audio.current = a;
      a.onended = () => setTimeout(() => next(i + 1), urls.length > 1 ? 120 : 0);
      a.onerror = () => next(i + 1);
      a.play().catch(() => { if (run === seq.current) setPlaying(null); });
    };
    next(0);
  }, []);
  useEffect(() => () => stop(), [stop]);
  return { playing, play, stop };
}
type Player = ReturnType<typeof usePlayer>;

/* ------------------------------------------------------------------ pieces */

const STATUS_PILL: Partial<Record<SoundStatus, { label: string; cls: string }>> = {
  approved: { label: 'Picked', cls: 'bg-emerald-50 text-emerald-700' },
  rejected: { label: 'Rejected', cls: 'bg-rose-50 text-rose-600' },
  shipped: { label: 'Shipped', cls: 'bg-purple-100 text-purple-700' },
};

function LiveTag() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-orange-500 text-white px-2 py-0.5 text-[9px] font-black uppercase tracking-wider shadow-sm">
      <span className="w-1.5 h-1.5 rounded-full bg-white" />
      Live
    </span>
  );
}

function Candidate({ c, ev, ctx, iCanReview, player, onApprove, onNote }: {
  c: SoundCandidateView;
  ev: SoundEventView;
  ctx: SoundReviewContext;
  iCanReview: boolean;
  player: Player;
  onApprove: () => void;
  onNote: (decision: 'reject' | 'changes', note: string) => void;
}) {
  const key = c.id;
  const isPlaying = player.playing === key || (player.playing?.startsWith(`${key}#`) ?? false);
  const silent = !c.clips.length;
  const pill = STATUS_PILL[c.status];
  const mine = ctx.me ? ctx.index.get(c.id)?.get(ctx.me)?.decision ?? null : null;
  return (
    <div className={`min-w-0 rounded-2xl p-1.5 ${c.live ? 'bg-orange-50 ring-1 ring-orange-200' : 'bg-white'} ${ev.picked?.id === c.id ? 'ring-2 ring-emerald-400' : ''}`}>
      <button
        type="button"
        disabled={silent}
        onClick={() => (isPlaying ? player.stop() : player.play(key, c.clips))}
        aria-label={`${isPlaying ? 'Stop' : 'Play'} ${ev.title}: ${c.letter} ${c.name}`}
        className={`w-full min-h-[64px] rounded-xl px-2 py-1.5 flex items-center gap-2 text-left transition active:scale-[0.98] disabled:cursor-default ${
          isPlaying ? 'bg-fuchsia-500 text-white' : c.opt === 'now' ? 'bg-purple-100 text-purple-900 hover:bg-purple-200' : 'bg-purple-600 text-white hover:bg-purple-700'
        } ${silent ? 'opacity-60' : ''}`}
      >
        <span className="shrink-0 w-8 h-8 rounded-full bg-white/25 flex items-center justify-center">
          {silent ? <X className="w-4 h-4" /> : isPlaying ? <Square className="w-3.5 h-3.5" fill="currentColor" /> : <Play className="w-4 h-4" fill="currentColor" />}
        </span>
        <span className="min-w-0">
          <span className="block text-base font-black leading-tight">{c.letter}</span>
          <span className="block text-[11px] font-bold leading-tight opacity-90 break-words">{c.name}</span>
        </span>
      </button>
      {ev.grid && c.clips.length > 1 && (
        <div className="mt-1.5 grid grid-cols-5 gap-1">
          {c.clips.map((u, i) => {
            const cellKey = `${key}#${i}`;
            const color = ev.colors?.[i];
            return (
              <button
                key={cellKey}
                type="button"
                onClick={() => (player.playing === cellKey ? player.stop() : player.play(cellKey, [u]))}
                aria-label={`Play ${c.letter} ${ev.grid?.[i] ?? i + 1}`}
                className={`h-8 rounded-lg text-[11px] font-black text-white ${player.playing === cellKey ? 'ring-2 ring-fuchsia-400' : ''}`}
                style={{ background: color ?? '#8b5cf6' }}
              >
                {ev.grid?.[i] ?? i + 1}
              </button>
            );
          })}
        </div>
      )}
      <div className="mt-1.5 flex flex-wrap items-center gap-1 min-h-[20px]">
        {c.live && <LiveTag />}
        {c.same && <span className="rounded-full bg-orange-100 text-orange-700 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide">Same as now</span>}
        {pill && <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wide ${pill.cls}`}>{pill.label}</span>}
        <span className="ml-auto"><ReviewerDiscs reviewers={ctx.reviewers} reviews={ctx.index.get(c.id)} /></span>
      </div>
      {iCanReview && (
        <TileActions mine={mine} shipped={c.status === 'shipped'} onApprove={onApprove} onNote={onNote} />
      )}
    </div>
  );
}

function ScopeNote({ scope, disabled, onSaved, onError }: { scope: string; disabled: boolean; onSaved: () => void; onError: (m: string) => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  if (!open) {
    return (
      <button type="button" disabled={disabled} onClick={() => setOpen(true)}
        className="h-9 rounded-xl bg-purple-50 text-purple-700 hover:bg-purple-100 px-3 text-xs font-extrabold inline-flex items-center gap-1.5 disabled:opacity-40">
        <MessageSquareText className="w-4 h-4" /> Note
      </button>
    );
  }
  const save = async () => {
    const body = text.trim();
    if (!body) return;
    setBusy(true);
    try {
      await postJson('/api/admin/sounds/feedback', { scope, body });
      setText(''); setOpen(false); onSaved();
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="basis-full flex gap-1.5 items-start">
      <textarea autoFocus rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder={`A note on ${soundScopeLabel(scope)}`}
        className="flex-1 resize-none rounded-xl bg-white px-2.5 py-2 text-[13px] font-semibold text-gray-800 outline-none ring-1 ring-purple-100 focus:ring-2 focus:ring-purple-300" />
      <button type="button" onClick={save} disabled={busy || !text.trim()} aria-label="Save note"
        className="h-9 w-9 shrink-0 rounded-xl bg-purple-600 text-white flex items-center justify-center disabled:opacity-40"><Send className="w-4 h-4" /></button>
      <button type="button" onClick={() => setOpen(false)} aria-label="Cancel"
        className="h-9 w-9 shrink-0 rounded-xl bg-white text-gray-500 flex items-center justify-center"><X className="w-4 h-4" /></button>
    </div>
  );
}

/** Every open note, newest first, with a play button for the candidate it's about and Resolve. */
function OpenFeedback({ items, loading, player, onResolve }: {
  items: ArtFeedback[] | null; loading: boolean; player: Player; onResolve: (id: string) => void;
}) {
  const byId = useMemo(() => {
    const m = new Map<string, { label: string; clips: string[] }>();
    for (const s of SOUND_CATALOG.sections) for (const e of s.events) for (const c of e.candidates) {
      m.set(`${s.id}/${e.id}/${c.opt}`, { label: `${s.title} · ${e.title} · ${c.letter} ${c.name}`, clips: c.clips });
    }
    return m;
  }, []);
  if (loading && !items) return <LoadingGrid tiles={2} />;
  if (!items?.length) return <Callout tone="purple">No open feedback. Notes from Reject, Comment and the section Note boxes land here.</Callout>;
  return (
    <ul className="space-y-2">
      {items.map((f) => {
        const target = f.asset_id ? byId.get(f.asset_id) : null;
        const key = `fb:${f.id}`;
        return (
          <li key={f.id} className="rounded-2xl bg-white p-3 shadow-sm">
            <div className="flex items-start gap-2">
              {target && target.clips.length > 0 && (
                <button type="button" onClick={() => (player.playing === key ? player.stop() : player.play(key, target.clips))}
                  aria-label="Play the sound this note is about"
                  className="shrink-0 w-9 h-9 rounded-full bg-purple-600 text-white flex items-center justify-center">
                  {player.playing === key ? <Square className="w-3.5 h-3.5" fill="currentColor" /> : <Play className="w-4 h-4" fill="currentColor" />}
                </button>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-black uppercase tracking-wide text-purple-500 break-words">
                  {target ? target.label : f.scope ? soundScopeLabel(f.scope) : f.asset_id}
                </p>
                <p className="text-sm font-semibold text-gray-800 whitespace-pre-wrap break-words">{f.body}</p>
                <p className="text-[11px] font-bold text-gray-400">{f.author ?? 'someone'} · {new Date(f.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
              </div>
              <button type="button" onClick={() => onResolve(f.id)}
                className="shrink-0 h-9 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-3 text-xs font-extrabold">Resolve</button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/* -------------------------------------------------------------------- page */

export default function SoundLibraryPage() {
  const { data, error, loading } = useAdminData<Resp>('/api/admin/sounds');
  const [statuses, setStatuses] = useState<Map<string, SoundStatus>>(() => new Map());
  const [reviews, setReviews] = useState<SoundReview[]>([]);
  useEffect(() => {
    if (!data) return;
    setStatuses(new Map(data.assets.map((a) => [a.id, a.status])));
    setReviews(data.reviews ?? []);
  }, [data]);
  const reviewers = useMemo(() => data?.reviewers ?? [], [data]);
  const me = data?.me ?? null;
  const setup = data?.setup ?? null;
  const iCanReview = !setup && !!me && reviewers.some((r) => r.profile_id === me);
  const index = useMemo(() => indexReviews(reviews), [reviews]);
  const ctx = useMemo<SoundReviewContext>(() => ({ index, reviewers, me }), [index, reviewers, me]);
  const sections = useMemo(() => groupSoundSections(statuses, ctx), [statuses, ctx]);
  const player = usePlayer();

  const [view, setView] = useState<'sections' | 'feedback'>('sections');
  const [onlyMine, setOnlyMine] = useState(false);
  const [touched, setTouched] = useState<Set<string>>(() => new Set());
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [confirmKey, setConfirmKey] = useState<string | null>(null);
  const [toast, setToast] = useState<Undo | null>(null);
  useEffect(() => { setTouched(new Set()); }, [onlyMine]);

  const [feedback, setFeedback] = useState<ArtFeedback[] | null>(null);
  const [fbLoading, setFbLoading] = useState(false);
  const loadFeedback = useCallback(async () => {
    if (setup) { setFeedback([]); return; }
    setFbLoading(true);
    try {
      const res = await fetch('/api/admin/sounds/feedback?open=1', { credentials: 'same-origin' });
      const j = await res.json();
      setFeedback(res.ok ? (j.feedback ?? []) : []);
    } finally {
      setFbLoading(false);
    }
  }, [setup]);
  useEffect(() => { if (data) loadFeedback(); }, [data, loadFeedback]);

  const toastSeq = useRef(0);
  const flash = (message: string, undo: (() => void) | null = null) => {
    const id = ++toastSeq.current;
    setToast({ id, message, undo });
    setTimeout(() => setToast((t) => (t?.id === id ? null : t)), undo ? UNDO_MS : 3500);
  };

  /* ------------------------------------------------ review: optimistic + undo */

  const statusesRef = useRef(statuses);
  statusesRef.current = statuses;
  const reviewsRef = useRef(reviews);
  reviewsRef.current = reviews;
  const pending = useRef(new Map<number, PendingOp>());
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

  const act = (ids: string[], decision: ReviewDecision, note: string | null, message: string) => {
    if (!me || !ids.length) return;
    const prevStatuses = statusesRef.current;
    const prevReviews = reviewsRef.current;
    const next = applySoundReviews(prevStatuses, prevReviews, ids, me, decision, note, reviewers);
    setStatuses(next.statuses);
    setReviews(next.reviews);
    const events = new Set(ids.map((id) => id.slice(0, id.lastIndexOf('/'))));
    setTouched((t) => new Set([...Array.from(t), ...Array.from(events)]));
    const revert = () => { setStatuses(prevStatuses); setReviews(prevReviews); };
    const merge = (fresh: Array<Pick<SoundAsset, 'id' | 'status'>>, rows: SoundReview[]) => {
      const ids2 = new Set(fresh.map((a) => a.id));
      setStatuses((m) => { const n = new Map(m); for (const a of fresh) n.set(a.id, a.status); return n; });
      setReviews((list) => [...list.filter((r) => !ids2.has(r.asset_id)), ...rows]);
    };
    const commit = async (keepalive: boolean) => {
      try {
        if (ids.length === 1) {
          const body = note ? { asset_id: ids[0], decision, note, feedback: true } : { asset_id: ids[0], decision };
          const j = await postJson<{ assets: SoundAsset[]; reviews: SoundReview[]; item?: unknown }>('/api/admin/sounds/review', body, keepalive);
          merge(j.assets ?? [], j.reviews ?? []);
          if (j.item) loadFeedback();
        } else {
          for (let i = 0; i < ids.length; i += BATCH_MAX) {
            const j = await postJson<{ assets: SoundAsset[]; reviews: SoundReview[] }>(
              '/api/admin/sounds/review/batch', { asset_ids: ids.slice(i, i + BATCH_MAX), decision: 'approve' }, keepalive,
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

  const approveSection = (s: SoundSection) => {
    const plan = soundApproveAllPlan(s, ctx);
    setConfirmKey(null);
    if (!plan.ids.length) return;
    act(plan.ids, 'approve', null, `Kept what ships for ${plan.ids.length} in ${s.title}`);
  };

  const resolve = async (id: string) => {
    try {
      await postJson('/api/admin/sounds/feedback/resolve', { id });
      setFeedback((list) => (list ?? []).filter((f) => f.id !== id));
    } catch (e) {
      flash(`Could not resolve: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const toReviewTotal = sections.reduce((n, s) => n + s.counts.toReview, 0);
  const eventsTotal = sections.reduce((n, s) => n + s.counts.events, 0);
  const shown = sections
    .map((s) => ({ ...s, events: onlyMine ? s.events.filter((e) => !eventReviewed(e, ctx) || touched.has(e.key)) : s.events }))
    .filter((s) => s.events.length);

  return (
    <div className="space-y-4 pb-24">
      <PageHeader
        title="Sound Library"
        icon={AudioLines}
        subtitle={`Every sound by game: what ships now (LIVE) next to the options. ${eventsTotal} moments in ${sections.length} sections.`}
      />
      {error && <ErrorNote>{error}</ErrorNote>}
      {setup && <Callout tone="amber">{setup}</Callout>}

      <div className="flex flex-wrap gap-2">
        <div className="inline-flex rounded-full bg-purple-50 p-1">
          {(['sections', 'feedback'] as const).map((v) => (
            <button key={v} type="button" onClick={() => setView(v)}
              className={`h-9 rounded-full px-4 text-sm font-extrabold ${view === v ? 'bg-purple-600 text-white' : 'text-purple-700'}`}>
              {v === 'sections' ? 'Sounds' : `Open feedback${feedback?.length ? ` (${feedback.length})` : ''}`}
            </button>
          ))}
        </div>
        {view === 'sections' && (
          <button type="button" onClick={() => setOnlyMine((x) => !x)} aria-pressed={onlyMine}
            className={`h-11 rounded-full px-4 text-sm font-extrabold ${onlyMine ? 'bg-purple-600 text-white' : 'bg-white text-purple-700 ring-1 ring-purple-100'}`}>
            {iCanReview ? 'Needs my pick' : 'Still open'} · {toReviewTotal}
          </button>
        )}
      </div>

      {loading && !data ? <LoadingGrid tiles={4} /> : view === 'feedback' ? (
        <OpenFeedback items={feedback} loading={fbLoading} player={player} onResolve={resolve} />
      ) : (
        <div className="space-y-3">
          {shown.map((s) => {
            const full = sections.find((x) => x.id === s.id)!;
            const isOpen = open[s.id] ?? !full.done;
            const plan = soundApproveAllPlan(full, ctx);
            const confirming = confirmKey === s.id;
            return (
              <section key={s.id} className="rounded-3xl bg-purple-50/60 p-2.5 sm:p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => setOpen((o) => ({ ...o, [s.id]: !isOpen }))} aria-expanded={isOpen}
                    className="flex-1 min-w-0 text-left flex items-center gap-2">
                    <ChevronDown className={`w-5 h-5 shrink-0 text-purple-500 transition ${isOpen ? '' : '-rotate-90'}`} />
                    <span className="min-w-0">
                      <span className="block text-lg font-black text-gray-900 leading-tight">{s.title}</span>
                      <span className="block text-xs font-bold text-gray-500">{soundSectionSummary(full, ctx)}</span>
                    </span>
                  </button>
                  {iCanReview && plan.ids.length > 0 && (
                    <button type="button" onClick={() => setConfirmKey(confirming ? null : s.id)}
                      className="h-9 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-3 text-xs font-extrabold inline-flex items-center gap-1.5">
                      <CheckCheck className="w-4 h-4" /> Approve all
                    </button>
                  )}
                  <ScopeNote scope={soundScope('game', s.id)} disabled={!!setup} onSaved={() => { loadFeedback(); flash('Note saved'); }} onError={(m) => flash(`Could not save: ${m}`)} />
                  {confirming && (
                    <div className="basis-full rounded-xl bg-white p-2.5 flex flex-wrap items-center gap-2">
                      <p className="flex-1 min-w-[12rem] text-xs font-bold text-gray-700">
                        Keep what ships now for {plan.ids.length} {plan.ids.length === 1 ? 'moment' : 'moments'} you haven&apos;t picked in yet
                        {plan.skipped ? ` (skips ${plan.skipped} you flagged)` : ''}?
                      </p>
                      <button type="button" onClick={() => setConfirmKey(null)} className="h-9 rounded-xl bg-purple-50 text-purple-700 px-3 text-xs font-extrabold">Cancel</button>
                      <button type="button" onClick={() => approveSection(full)} className="h-9 rounded-xl bg-emerald-500 text-white px-3.5 text-xs font-extrabold">Approve {plan.ids.length}</button>
                    </div>
                  )}
                </div>
                {isOpen && (
                  <>
                    <p className="mt-1 px-1 text-xs font-semibold text-gray-500">{s.blurb}</p>
                    <div className="mt-2 space-y-2">
                      {s.events.map((ev) => (
                        <div key={ev.key} className="rounded-2xl bg-purple-100/50 p-2">
                          <div className="px-1 pb-1.5">
                            <h3 className="text-sm font-black text-gray-900">{ev.title}</h3>
                            {ev.note && <p className="text-xs font-semibold text-gray-500">{ev.note}</p>}
                          </div>
                          <div className={`grid gap-1.5 grid-cols-2 ${ev.candidates.length >= 4 ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
                            {ev.candidates.map((c) => (
                              <Candidate
                                key={c.id}
                                c={c}
                                ev={ev}
                                ctx={ctx}
                                iCanReview={iCanReview}
                                player={player}
                                onApprove={() => {
                                  if (ctx.index.get(c.id)?.get(me ?? '')?.decision === 'approve') return;
                                  act([c.id], 'approve', null, `Picked ${c.letter} for ${ev.title}`);
                                }}
                                onNote={(decision, note) => act([c.id], decision, note,
                                  decision === 'reject' ? `Rejected ${c.letter} for ${ev.title} with a note` : `Commented on ${c.letter} for ${ev.title}`)}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </section>
            );
          })}
          {!shown.length && <Callout tone="purple">Nothing waiting on you. Switch the filter off to see every sound.</Callout>}
        </div>
      )}

      {toast && (
        <div role="status" className="fixed left-1/2 -translate-x-1/2 bottom-4 z-50 w-[min(92vw,28rem)] rounded-2xl bg-gray-900 text-white px-4 py-3 shadow-xl flex items-center gap-3">
          <p className="flex-1 text-sm font-bold">{toast.message}</p>
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
