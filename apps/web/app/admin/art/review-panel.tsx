'use client';

import { useCallback, useEffect, useState } from 'react';
import { Ban, Check, CheckCheck, MessageSquareText, PencilLine, Send } from 'lucide-react';
import {
  scopeLabel, type ArtFeedback, type ArtReview, type ArtReviewer, type ReviewChip, type ReviewDecision, type ReviewFilter,
} from '@/lib/admin/art-review';

// admin > Art Library: the two-approver review pieces (reviewer discs, the
// lightbox review panel, the Review chip row) and the feedback threads Claude
// reads (FeedbackThread for one asset or scope, OpenFeedbackList for the
// "Open feedback" view). Kept apart from page.tsx so other lightbox blocks can
// be added there without touching this file.

/* ----------------------------------------------------------------- shared */

/** Soft disc colors, by reviewer order (BMT first, JP second). */
const DISC = [
  { bg: 'bg-purple-200', fg: 'text-purple-800' },
  { bg: 'bg-amber-200', fg: 'text-amber-800' },
  { bg: 'bg-sky-200', fg: 'text-sky-800' },
  { bg: 'bg-emerald-200', fg: 'text-emerald-800' },
];
const discFor = (i: number) => DISC[((i % DISC.length) + DISC.length) % DISC.length];

const DECISION_LOOK: Record<ReviewDecision, { label: string; mark: string; text: string }> = {
  approve: { label: 'Approved', mark: 'bg-emerald-500', text: 'text-emerald-700' },
  changes: { label: 'Asked for changes', mark: 'bg-amber-400', text: 'text-amber-700' },
  reject: { label: 'Rejected', mark: 'bg-rose-500', text: 'text-rose-600' },
};

const when = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';

function DecisionMark({ decision, size }: { decision: ReviewDecision; size: 'sm' | 'md' }) {
  const look = DECISION_LOOK[decision];
  const box = size === 'sm' ? 'w-2.5 h-2.5 -right-0.5 -bottom-0.5' : 'w-4 h-4 -right-1 -bottom-1';
  const icon = size === 'sm' ? 'w-2 h-2' : 'w-2.5 h-2.5';
  return (
    <span className={`absolute ${box} rounded-full ring-2 ring-white ${look.mark} flex items-center justify-center text-white`} aria-hidden>
      {decision === 'approve' ? <Check className={icon} strokeWidth={4} /> : decision === 'reject' ? <Ban className={icon} strokeWidth={4} /> : null}
    </span>
  );
}

/** A reviewer's initials disc with their decision mark (faded while they have not reviewed). */
export function ReviewerDisc({ reviewer, index, decision, size = 'sm' }: {
  reviewer: ArtReviewer; index: number; decision?: ReviewDecision | null; size?: 'sm' | 'md';
}) {
  const c = discFor(index);
  const dims = size === 'sm' ? 'w-4 h-4 text-[8px]' : 'w-8 h-8 text-[11px]';
  const label = size === 'sm' ? reviewer.short_name.charAt(0) : reviewer.short_name;
  return (
    <span
      className={`relative shrink-0 inline-flex items-center justify-center rounded-full font-black ${dims} ${c.bg} ${c.fg} ${decision ? '' : 'opacity-40'}`}
      title={`${reviewer.short_name}: ${decision ? DECISION_LOOK[decision].label.toLowerCase() : 'not reviewed yet'}`}
    >
      {label}
      {decision && <DecisionMark decision={decision} size={size} />}
    </span>
  );
}

/** The small reviewer row under a tile: one disc per reviewer, marked with their call. */
export function ReviewerDiscs({ reviewers, reviews }: { reviewers: readonly ArtReviewer[]; reviews: Map<string, ArtReview> | undefined }) {
  if (!reviewers.length) return null;
  return (
    <span className="shrink-0 inline-flex items-center gap-0.5">
      {reviewers.map((r, i) => (
        <ReviewerDisc key={r.profile_id} reviewer={r} index={i} decision={reviews?.get(r.profile_id)?.decision ?? null} />
      ))}
    </span>
  );
}

/* --------------------------------------------------------- Review chip row */

export function ReviewChipRow({ chips, value, onPick }: {
  chips: ReviewChip[]; value: ReviewFilter | null; onPick: (v: ReviewFilter | null) => void;
}) {
  if (!chips.length) return null;
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className="w-[68px] shrink-0 text-[10px] font-black text-gray-400 uppercase tracking-wide">Review</span>
      <div className="flex-1 min-w-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex gap-1.5 w-max pr-2">
          {chips.map((c) => {
            const on = value === c.value;
            return (
              <button
                key={c.value}
                onClick={() => onPick(on ? null : c.value)}
                className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-extrabold whitespace-nowrap transition ${
                  on ? 'bg-purple-600 text-white shadow-sm' : 'bg-purple-50 text-purple-800 hover:bg-purple-100'
                }`}
              >
                {c.label}
                <span className={`tabular-nums ${on ? 'text-purple-200' : 'text-purple-400'}`}>{c.count.toLocaleString('en-US')}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------ lightbox: reviews */

/**
 * Each reviewer's call (decision, note, date) and, for a reviewer, the three
 * buttons: Approve, Request changes, Reject (with an optional note).
 */
export function ReviewPanel({ assetId, shipped, reviewers, reviews, me, onReview }: {
  assetId: string;
  shipped: boolean;
  reviewers: readonly ArtReviewer[];
  reviews: Map<string, ArtReview> | undefined;
  me: string | null;
  onReview: (assetId: string, decision: ReviewDecision, note: string | null) => Promise<boolean>;
}) {
  const mine = me ? reviews?.get(me) : undefined;
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<ReviewDecision | null>(null);
  useEffect(() => { setNote(mine?.note ?? ''); }, [assetId]); // eslint-disable-line react-hooks/exhaustive-deps

  const iReview = !!me && reviewers.some((r) => r.profile_id === me);
  const pending = reviewers.filter((r) => !reviews?.get(r.profile_id));

  const act = async (decision: ReviewDecision) => {
    setBusy(decision);
    await onReview(assetId, decision, note.trim() ? note.trim() : null);
    setBusy(null);
  };

  return (
    <div className="min-w-0 space-y-2.5">
      <div className="space-y-2">
        {reviewers.map((r, i) => {
          const rev = reviews?.get(r.profile_id);
          const look = rev ? DECISION_LOOK[rev.decision] : null;
          return (
            <div key={r.profile_id} className="flex items-start gap-2.5 min-w-0">
              <ReviewerDisc reviewer={r} index={i} decision={rev?.decision ?? null} size="md" />
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="text-xs font-extrabold text-gray-800">
                  {r.short_name}{' '}
                  {look ? <span className={look.text}>{look.label.toLowerCase()}</span> : <span className="text-gray-400">has not reviewed yet</span>}
                  {rev && <span className="font-bold text-gray-400"> · {when(rev.updated_at)}</span>}
                </p>
                {rev?.note && <p className="text-xs font-semibold text-gray-600 break-words">{rev.note}</p>}
              </div>
            </div>
          );
        })}
      </div>

      {iReview ? (
        <>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={mine ? 'Change your note (optional)' : 'Note for the artist (optional)'}
            className="w-full rounded-xl bg-purple-50 px-3 py-2 text-sm font-semibold text-gray-800 placeholder:text-purple-300 outline-none focus:ring-2 focus:ring-purple-300"
          />
          <div className="grid grid-cols-3 gap-1.5">
            <DecisionButton tone="green" on={mine?.decision === 'approve'} busy={busy === 'approve'} disabled={!!busy} onClick={() => act('approve')}>
              <Check className="w-4 h-4" /> Approve
            </DecisionButton>
            <DecisionButton tone="amber" on={mine?.decision === 'changes'} busy={busy === 'changes'} disabled={!!busy} onClick={() => act('changes')}>
              <PencilLine className="w-4 h-4" /> <span className="sm:hidden">Changes</span><span className="hidden sm:inline">Request changes</span>
            </DecisionButton>
            <DecisionButton tone="rose" on={mine?.decision === 'reject'} busy={busy === 'reject'} disabled={!!busy} onClick={() => act('reject')}>
              <Ban className="w-4 h-4" /> Reject
            </DecisionButton>
          </div>
          <p className="text-[11px] font-semibold text-gray-400">
            {shipped
              ? 'Already shipped: reviews are kept but do not change its status.'
              : pending.length
                ? `Approved once ${reviewers.map((r) => r.short_name).join(' and ')} both approve. Waiting on ${pending.map((r) => r.short_name).join(' and ')}.`
                : 'Every reviewer has weighed in.'}
          </p>
        </>
      ) : (
        <p className="text-[11px] font-semibold text-gray-400">
          {reviewers.map((r) => r.short_name).join(' and ')} review art; anyone can leave feedback below.
        </p>
      )}
    </div>
  );
}

function DecisionButton({ tone, on, busy, disabled, onClick, children }: {
  tone: 'green' | 'amber' | 'rose'; on: boolean; busy: boolean; disabled: boolean; onClick: () => void; children: React.ReactNode;
}) {
  const cls = {
    green: on ? 'bg-emerald-500 text-white shadow-sm' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
    amber: on ? 'bg-amber-400 text-white shadow-sm' : 'bg-amber-50 text-amber-700 hover:bg-amber-100',
    rose: on ? 'bg-rose-500 text-white shadow-sm' : 'bg-rose-50 text-rose-600 hover:bg-rose-100',
  }[tone];
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-pressed={on}
      className={`inline-flex items-center justify-center gap-1 rounded-xl px-2 py-2 text-xs sm:text-sm font-extrabold whitespace-nowrap transition disabled:opacity-60 ${cls} ${busy ? 'animate-pulse' : ''}`}
    >
      {children}
    </button>
  );
}

/* --------------------------------------------------------------- feedback */

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error ?? `Request failed (${r.status})`);
  return j as T;
}

function AuthorDisc({ name }: { name: string | null }) {
  const initial = (name ?? '?').charAt(0).toUpperCase();
  return (
    <span className="shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-purple-200 to-fuchsia-200 text-purple-800 text-[11px] font-black flex items-center justify-center">
      {initial}
    </span>
  );
}

/** "Resolve" with an optional note, inline. */
function ResolveControl({ id, onResolved }: { id: string; onResolved: (item: ArtFeedback) => void }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1 text-[11px] font-extrabold text-purple-700 hover:text-purple-900">
        <CheckCheck className="w-3.5 h-3.5" /> Resolve
      </button>
    );
  }
  const go = async () => {
    setBusy(true);
    setErr(null);
    try {
      const { item } = await postJson<{ item: ArtFeedback }>('/api/admin/art/feedback/resolve', { id, note: note.trim() || null });
      onResolved(item);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
        <input
          autoFocus
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') go(); }}
          placeholder="What was done (optional)"
          className="min-w-0 flex-1 rounded-lg bg-purple-50 px-2.5 py-1.5 text-xs font-semibold text-gray-800 placeholder:text-purple-300 outline-none focus:ring-2 focus:ring-purple-300"
        />
        <button onClick={go} disabled={busy} className="shrink-0 rounded-lg bg-purple-600 text-white hover:bg-purple-700 px-2.5 py-1.5 text-xs font-extrabold disabled:opacity-60">
          Resolve
        </button>
        <button onClick={() => setOpen(false)} className="shrink-0 px-1 text-xs font-extrabold text-gray-400 hover:text-gray-600">Cancel</button>
      </div>
      {err && <p className="text-[11px] font-bold text-rose-600">{err}</p>}
    </div>
  );
}

function FeedbackItem({ item, onResolved }: { item: ArtFeedback; onResolved: (item: ArtFeedback) => void }) {
  const resolved = !!item.resolved_at;
  return (
    <li className={`flex gap-2.5 min-w-0 ${resolved ? 'opacity-70' : ''}`}>
      <AuthorDisc name={item.author} />
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-[11px] font-bold text-gray-400">
          <span className="font-extrabold text-gray-700">{item.author ?? 'Admin'}</span> · {when(item.created_at)}
        </p>
        <p className="text-sm font-semibold text-gray-800 whitespace-pre-wrap break-words">{item.body}</p>
        {resolved ? (
          <p className="text-[11px] font-bold text-emerald-700">
            <CheckCheck className="inline w-3.5 h-3.5 -mt-0.5 mr-0.5" />
            Resolved {when(item.resolved_at)}{item.resolved_note ? `: ${item.resolved_note}` : ''}
          </p>
        ) : (
          <ResolveControl id={item.id} onResolved={onResolved} />
        )}
      </div>
    </li>
  );
}

/**
 * The feedback thread for one asset (assetId) or one area (scope, e.g.
 * 'season:halloween' or 'surface:leaderboard'): every note, oldest first, with
 * its resolved state, plus a box to add one. Claude reads the unresolved notes
 * from public.art_open_feedback before the next art pass.
 */
export function FeedbackThread({ assetId, scope, title = 'Feedback', onChange }: {
  assetId?: string; scope?: string; title?: string; onChange?: () => void;
}) {
  const key = assetId ? `asset_id=${encodeURIComponent(assetId)}` : scope ? `scope=${encodeURIComponent(scope)}` : '';
  const [items, setItems] = useState<ArtFeedback[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (!key) return;
    let live = true;
    setError(null);
    fetch(`/api/admin/art/feedback?${key}`, { credentials: 'same-origin' })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error ?? `Request failed (${r.status})`);
        if (live) setItems(j.feedback ?? []);
      })
      .catch((e) => { if (live) setError(e instanceof Error ? e.message : String(e)); });
    return () => { live = false; };
  }, [key]);

  useEffect(() => {
    setItems(null);
    setBody('');
    return load();
  }, [load]);

  const add = async () => {
    const text = body.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { item } = await postJson<{ item: ArtFeedback }>('/api/admin/art/feedback', assetId ? { asset_id: assetId, body: text } : { scope, body: text });
      setItems((list) => [...(list ?? []), item]);
      setBody('');
      onChange?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const resolved = (item: ArtFeedback) => {
    setItems((list) => (list ?? []).map((x) => (x.id === item.id ? item : x)));
    onChange?.();
  };

  if (!key) return null;
  const open = items?.filter((i) => !i.resolved_at).length ?? 0;

  return (
    <section className="min-w-0 space-y-2.5">
      <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-wide">
        {title}
        {open > 0 && <span className="ml-1.5 text-purple-500 tabular-nums">{open} open</span>}
      </h3>

      {items === null && !error ? (
        <div className="space-y-2" aria-hidden>
          {[0, 1].map((i) => (
            <div key={i} className="flex gap-2.5">
              <div className="w-7 h-7 rounded-full bg-purple-100/70 animate-pulse" />
              <div className="flex-1 space-y-1.5 pt-1">
                <div className="h-2.5 w-24 rounded bg-purple-100/70 animate-pulse" />
                <div className="h-3 w-3/4 rounded bg-purple-100/70 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      ) : items && items.length ? (
        <ul className="space-y-3">
          {items.map((item) => <FeedbackItem key={item.id} item={item} onResolved={resolved} />)}
        </ul>
      ) : items ? (
        <div className="flex items-center gap-2.5">
          <span className="shrink-0 w-7 h-7 rounded-full bg-purple-50 text-purple-500 flex items-center justify-center">
            <MessageSquareText className="w-3.5 h-3.5" />
          </span>
          <p className="text-xs font-semibold text-gray-500">No feedback yet. What you write here is what Claude reads before the next art pass.</p>
        </div>
      ) : null}

      {error && (
        <p className="text-xs font-bold text-rose-600">
          {error} <button onClick={load} className="underline">Try again</button>
        </p>
      )}

      <div className="flex items-end gap-1.5">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); add(); } }}
          rows={2}
          placeholder="Add feedback: what to change, keep or try"
          className="min-w-0 flex-1 resize-y rounded-xl bg-purple-50 px-3 py-2 text-sm font-semibold text-gray-800 placeholder:text-purple-300 outline-none focus:ring-2 focus:ring-purple-300"
        />
        <button
          onClick={add}
          disabled={!body.trim() || busy}
          aria-label="Add feedback"
          className="shrink-0 w-10 h-10 rounded-xl bg-purple-600 text-white hover:bg-purple-700 shadow-sm flex items-center justify-center disabled:opacity-40"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </section>
  );
}

/* ------------------------------------------------------ open feedback view */

export type OpenFeedbackItem = ArtFeedback & { asset: { id: string; path: string; title: string; season: string | null } | null };

/** Unresolved feedback across the library, newest first (the "Open feedback" view and its count). */
export function useOpenFeedback() {
  const [items, setItems] = useState<OpenFeedbackItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(() => {
    setError(null);
    fetch('/api/admin/art/feedback?open=1', { credentials: 'same-origin' })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error ?? `Request failed (${r.status})`);
        setItems(j.feedback ?? []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);
  useEffect(() => { reload(); }, [reload]);
  const drop = useCallback((id: string) => setItems((list) => (list ?? []).filter((x) => x.id !== id)), []);
  return { items, error, reload, drop };
}

/**
 * Every unresolved feedback item, newest first, each with a Resolve action.
 * `thumb` renders the asset's thumbnail (the page owns the signed URLs);
 * `empty` / `failed` are the page's own state scenes.
 */
export function OpenFeedbackList({ items, error, onReload, onResolved, onOpenAsset, thumb, empty, failed }: {
  items: OpenFeedbackItem[] | null;
  error: string | null;
  onReload: () => void;
  onResolved: (id: string) => void;
  onOpenAsset: (assetId: string) => void;
  thumb: (assetId: string) => React.ReactNode;
  empty: React.ReactNode;
  failed: (message: string) => React.ReactNode;
}) {
  if (error && !items) return <>{failed(error)}</>;
  if (!items) {
    return (
      <div className="space-y-2" aria-hidden>
        {[0, 1, 2].map((i) => <div key={i} className="h-20 rounded-2xl bg-white shadow-sm animate-pulse" />)}
      </div>
    );
  }
  if (!items.length) return <>{empty}</>;
  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-purple-50 px-4 py-3 flex items-center gap-3">
        <span className="w-9 h-9 shrink-0 rounded-xl bg-white shadow-sm flex items-center justify-center text-purple-600">
          <MessageSquareText className="w-4 h-4" />
        </span>
        <p className="text-sm font-semibold text-purple-900">
          <span className="font-black">{items.length.toLocaleString('en-US')} open {items.length === 1 ? 'note' : 'notes'}.</span>{' '}
          Claude works through these on the next art pass; resolve each one once it is handled.
        </p>
      </div>
      {error && (
        <p className="text-xs font-bold text-rose-600">{error} <button onClick={onReload} className="underline">Try again</button></p>
      )}
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id} className="rounded-2xl bg-white shadow-sm p-2.5 flex gap-3 min-w-0">
            {item.asset ? (
              <button
                onClick={() => onOpenAsset(item.asset!.id)}
                className="relative w-14 h-14 sm:w-16 sm:h-16 shrink-0 rounded-xl overflow-hidden"
                aria-label={`Open ${item.asset.title}`}
              >
                {thumb(item.asset.id)}
              </button>
            ) : (
              <span className="w-14 h-14 sm:w-16 sm:h-16 shrink-0 rounded-xl bg-gradient-to-br from-purple-100 to-fuchsia-100 text-purple-600 flex items-center justify-center">
                <MessageSquareText className="w-5 h-5" />
              </span>
            )}
            <div className="min-w-0 flex-1 space-y-0.5">
              {item.asset ? (
                <button onClick={() => onOpenAsset(item.asset!.id)} className="block max-w-full text-left text-sm font-black text-gray-900 truncate hover:text-purple-700">
                  {item.asset.title}
                </button>
              ) : (
                <p className="text-sm font-black text-gray-900 truncate">{item.scope ? scopeLabel(item.scope) : 'General'}</p>
              )}
              <p className="text-[11px] font-bold text-gray-400 truncate">
                <span className="text-gray-600">{item.author ?? 'Admin'}</span> · {when(item.created_at)}
                {item.asset && item.scope ? ` · ${scopeLabel(item.scope)}` : ''}
              </p>
              <p className="text-sm font-semibold text-gray-800 whitespace-pre-wrap break-words">{item.body}</p>
              <ResolveControl id={item.id} onResolved={() => onResolved(item.id)} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
