'use client';

import { useEffect, useState } from 'react';
import { STATUS_LOOK } from './status-look';
import {
  AlertTriangle, CalendarClock, ExternalLink, Link2, MousePointerClick, Pause, Play, RotateCcw, UserPlus,
} from 'lucide-react';
import { ReviewerDisc, TileActions } from '../art/review-panel';
import {
  captionBudget, PLATFORM_INFO, PLATFORMS, trackedUrl, zonedInstant, zonedTime, dayKey,
  type DisplayStatus, type Platform, type ReviewState, type Reviewer, type SocialPost, type SocialReview, type SocialTarget,
} from '@/lib/admin/studio';
import type { StudioPayload } from '@/lib/admin/studio-types';

const when = (iso: string) => new Date(iso).toLocaleString('en-US', {
  timeZone: 'America/Chicago', weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
});

export interface CardActions {
  approve: (post: SocialPost) => void;
  note: (post: SocialPost, decision: 'reject' | 'changes', text: string) => void;
  saveCaption: (post: SocialPost, platform: Platform, text: string) => Promise<boolean>;
  saveHashtags: (post: SocialPost, tags: string[]) => Promise<boolean>;
  reschedule: (post: SocialPost, iso: string) => void;
  togglePause: (post: SocialPost) => void;
  togglePlatform: (post: SocialPost, platform: Platform, on: boolean) => void;
}

export function PostCard({
  post, targets, reviews, reviewers, me, state, status, urls, links, feedback, actions,
}: {
  post: SocialPost;
  targets: SocialTarget[];
  reviews: SocialReview[];
  reviewers: Reviewer[];
  me: string | null;
  state: ReviewState;
  status: DisplayStatus;
  urls: Record<string, string>;
  links: StudioPayload['links'];
  feedback: StudioPayload['feedback'];
  actions: CardActions;
}) {
  const live = targets.filter((t) => t.status !== 'skipped');
  const [tab, setTab] = useState<Platform>(live[0]?.platform ?? 'instagram');
  useEffect(() => { if (!live.some((t) => t.platform === tab) && live[0]) setTab(live[0].platform); }, [live, tab]);
  const target = live.find((t) => t.platform === tab) ?? null;
  const info = PLATFORM_INFO[tab];
  const media = post.media.filter((m) => m.size === info.size);
  const shown = media.length ? media : post.media.slice(0, 1);
  const done = post.status !== 'draft';
  const look = STATUS_LOOK[status];
  const mine = me ? reviews.find((r) => r.reviewer_id === me && r.version === post.version)?.decision ?? null : null;

  return (
    <article className={`rounded-2xl bg-white shadow-sm overflow-hidden ${status === 'failed' ? 'ring-2 ring-rose-300' : ''}`}>
      <header className="px-3 pt-3 flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ring-1 ${look.chip}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${look.dot}`} />{look.label}
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-gray-500">
              <CalendarClock className="w-3.5 h-3.5" />{when(post.scheduled_at)} CT
            </span>
          </div>
          <h3 className="mt-1 text-base font-black text-gray-900 break-words">{post.title}</h3>
        </div>
        <span className="shrink-0 inline-flex items-center gap-1 pt-0.5">
          {reviewers.map((r, i) => (
            <ReviewerDisc
              key={r.profile_id}
              reviewer={r}
              index={i}
              size="md"
              decision={reviews.find((x) => x.reviewer_id === r.profile_id && x.version === post.version)?.decision ?? null}
            />
          ))}
        </span>
      </header>

      {state.needsReapproval && !state.approved && !done && (
        <p className="mx-3 mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 flex items-center gap-2">
          <RotateCcw className="w-4 h-4 shrink-0" />
          Edited, needs re-approval{post.edited_at ? ` (changed ${new Date(post.edited_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago' })})` : ''}. Earlier approvals no longer count.
        </p>
      )}

      {/* platform tabs */}
      <div className="mt-2 px-3 flex gap-1 overflow-x-auto no-scrollbar">
        {live.map((t) => {
          const b = captionBudget(t.platform, t.caption, post.hashtags, trackedUrl(t.link_slug));
          return (
            <button
              key={t.platform}
              onClick={() => setTab(t.platform)}
              className={`shrink-0 h-8 rounded-lg px-2.5 text-xs font-extrabold inline-flex items-center gap-1 ${tab === t.platform ? 'bg-purple-600 text-white' : 'bg-purple-50 text-purple-700 hover:bg-purple-100'}`}
            >
              {PLATFORM_INFO[t.platform].label}
              {t.status === 'posted' && <span className="w-1.5 h-1.5 rounded-full bg-sky-300" />}
              {t.status === 'failed' && <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />}
              {b.over && t.status !== 'posted' && <AlertTriangle className="w-3 h-3 text-amber-400" />}
            </button>
          );
        })}
      </div>

      <div className="p-3 grid gap-3 sm:grid-cols-[minmax(0,220px)_minmax(0,1fr)]">
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
          {shown.map((m) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={m.path}
              src={urls[m.path] ?? m.path}
              alt={`${post.title} (${info.label}, ${m.width} × ${m.height})`}
              className="w-full max-w-[220px] mx-auto rounded-xl bg-purple-50 object-cover"
              style={{ aspectRatio: `${m.width} / ${m.height}` }}
            />
          ))}
        </div>
        <div className="min-w-0 space-y-2">
          {target && (
            <CaptionEditor
              key={`${post.id}-${tab}-${post.version}`}
              post={post}
              target={target}
              locked={done || target.status === 'posted'}
              hasApprovals={state.approvedBy.length > 0}
              onSave={(text) => actions.saveCaption(post, tab, text)}
            />
          )}
          <HashtagEditor key={`${post.id}-tags-${post.version}`} post={post} locked={done} hasApprovals={state.approvedBy.length > 0} onSave={(t) => actions.saveHashtags(post, t)} />
          {target && <LinkLine target={target} links={links} />}
          {target?.status === 'failed' && (
            <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 break-words">
              Failed after {target.attempts} {target.attempts === 1 ? 'try' : 'tries'}: {target.last_error ?? 'unknown error'}
            </p>
          )}
          {target?.status === 'pending' && target.last_error && (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 break-words">
              Try {target.attempts} failed, retrying{target.next_attempt_at ? ` after ${when(target.next_attempt_at)}` : ''}: {target.last_error}
            </p>
          )}
        </div>
      </div>

      {feedback.length > 0 && (
        <ul className="mx-3 mb-2 space-y-1">
          {feedback.map((f) => (
            <li key={f.id} className="rounded-xl bg-purple-50 px-3 py-1.5 text-xs font-semibold text-purple-900 break-words">
              <span className="font-black">{f.author ?? 'Admin'}:</span> {f.body}
            </li>
          ))}
        </ul>
      )}

      {!done && (
        <div className="px-3 pb-3 space-y-2">
          <Schedule post={post} onChange={(iso) => actions.reschedule(post, iso)} onPause={() => actions.togglePause(post)} />
          <div className="flex flex-wrap gap-1">
            {PLATFORMS.map((p) => {
              const on = live.some((t) => t.platform === p);
              return (
                <button
                  key={p}
                  onClick={() => actions.togglePlatform(post, p, !on)}
                  aria-pressed={on}
                  className={`h-7 rounded-full px-2.5 text-[11px] font-extrabold ${on ? 'bg-purple-100 text-purple-800' : 'bg-gray-50 text-gray-400 hover:text-gray-600'}`}
                >
                  {on ? '✓ ' : '+ '}{PLATFORM_INFO[p].label}
                </button>
              );
            })}
          </div>
          {reviewers.some((r) => r.profile_id === me) ? (
            <TileActions mine={mine} onApprove={() => actions.approve(post)} onNote={(d, text) => actions.note(post, d, text)} />
          ) : (
            <p className="text-[11px] font-semibold text-gray-400">{reviewers.map((r) => r.short_name).join(' and ')} approve posts.</p>
          )}
          <p className="text-[11px] font-semibold text-gray-400">
            {state.approved
              ? 'Approved by both. It posts automatically at its time on every connected account.'
              : `Posts automatically once ${reviewers.map((r) => r.short_name).join(' and ')} both approve this version.`}
          </p>
        </div>
      )}
    </article>
  );
}

function CaptionEditor({ post, target, locked, hasApprovals, onSave }: {
  post: SocialPost; target: SocialTarget; locked: boolean; hasApprovals: boolean; onSave: (text: string) => Promise<boolean>;
}) {
  const [text, setText] = useState(target.caption);
  const [busy, setBusy] = useState(false);
  const dirty = text !== target.caption;
  const b = captionBudget(target.platform, text, post.hashtags, trackedUrl(target.link_slug));
  const info = PLATFORM_INFO[target.platform];
  return (
    <div className="space-y-1">
      <textarea
        value={text}
        readOnly={locked}
        onChange={(e) => setText(e.target.value)}
        rows={Math.min(9, Math.max(3, text.split('\n').length + 1))}
        aria-label={`${info.label} caption`}
        className={`block w-full resize-y rounded-xl px-3 py-2 text-sm font-semibold text-gray-800 outline-none focus:ring-2 focus:ring-purple-300 ${locked ? 'bg-gray-50' : 'bg-purple-50/60'} ${dirty ? 'ring-2 ring-amber-300' : ''}`}
      />
      <div className="flex flex-wrap items-center gap-2">
        <span className={`text-[11px] font-black tabular-nums ${b.over ? 'text-rose-600' : b.left < 20 ? 'text-amber-600' : 'text-gray-400'}`}>
          {b.used.toLocaleString()} / {b.limit.toLocaleString()}
        </span>
        <span className="text-[11px] font-semibold text-gray-400">
          {info.label} counts caption{info.link === 'text' ? ' + link' : ''} + hashtags{target.platform === 'x' ? ' (links count as 23)' : ''}
        </span>
        {dirty && !locked && (
          <span className="ml-auto inline-flex items-center gap-1.5">
            <button onClick={() => setText(target.caption)} className="h-8 rounded-lg px-2.5 text-xs font-extrabold text-gray-500 hover:text-gray-700">Cancel</button>
            <button
              disabled={busy}
              onClick={async () => { setBusy(true); await onSave(text); setBusy(false); }}
              className="h-8 rounded-lg bg-purple-600 px-3 text-xs font-extrabold text-white hover:bg-purple-700 disabled:opacity-60"
            >
              Save caption
            </button>
          </span>
        )}
      </div>
      {dirty && hasApprovals && !locked && (
        <p className="text-[11px] font-bold text-amber-700">Saving resets both approvals: BMT and JP re-approve what will post.</p>
      )}
    </div>
  );
}

function HashtagEditor({ post, locked, hasApprovals, onSave }: { post: SocialPost; locked: boolean; hasApprovals: boolean; onSave: (tags: string[]) => Promise<boolean> }) {
  const initial = post.hashtags.map((h) => `#${h}`).join(' ');
  const [text, setText] = useState(initial);
  const dirty = text.trim() !== initial;
  const tags = text.split(/[\s,]+/).map((t) => t.replace(/^#/, '')).filter(Boolean);
  return (
    <div className="flex items-center gap-1.5">
      <input
        value={text}
        readOnly={locked}
        onChange={(e) => setText(e.target.value)}
        aria-label="Hashtags"
        className={`min-w-0 flex-1 rounded-lg px-2.5 py-1.5 text-xs font-bold text-purple-700 outline-none focus:ring-2 focus:ring-purple-300 ${locked ? 'bg-gray-50' : 'bg-purple-50/60'} ${dirty ? 'ring-2 ring-amber-300' : ''}`}
      />
      {dirty && !locked && (
        <button onClick={() => onSave(tags)} title={hasApprovals ? 'Saving resets both approvals' : undefined} className="shrink-0 h-8 rounded-lg bg-purple-600 px-2.5 text-xs font-extrabold text-white hover:bg-purple-700">
          Save
        </button>
      )}
    </div>
  );
}

function LinkLine({ target, links }: { target: SocialTarget; links: StudioPayload['links'] }) {
  const url = trackedUrl(target.link_slug);
  const stats = target.link_slug ? links[target.link_slug] : undefined;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-bold text-gray-500">
      {target.status === 'posted' ? (
        <span className="inline-flex items-center gap-1 text-sky-700">
          Posted{target.posted_at ? ` ${when(target.posted_at)}` : ''}
          {target.remote_url && (
            <a href={target.remote_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 underline">
              View post <ExternalLink className="w-3 h-3" />
            </a>
          )}
          {!target.remote_url && target.last_error && <span className="text-gray-500">({target.last_error})</span>}
        </span>
      ) : null}
      {url && (
        <span className="inline-flex items-center gap-1 min-w-0">
          <Link2 className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{url.replace('https://', '')}</span>
        </span>
      )}
      {stats && (
        <>
          <span className="inline-flex items-center gap-1"><MousePointerClick className="w-3.5 h-3.5" />{stats.clicks} clicks</span>
          <span className="inline-flex items-center gap-1"><UserPlus className="w-3.5 h-3.5" />{stats.signups} signups</span>
        </>
      )}
    </div>
  );
}

function Schedule({ post, onChange, onPause }: { post: SocialPost; onChange: (iso: string) => void; onPause: () => void }) {
  const day = dayKey(post.scheduled_at);
  const { hour, minute } = zonedTime(post.scheduled_at);
  const value = `${day}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <input
        type="datetime-local"
        value={value}
        onChange={(e) => {
          const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/.exec(e.target.value);
          if (m) onChange(zonedInstant(m[1], Number(m[2]), Number(m[3])).toISOString());
        }}
        aria-label="Scheduled time (Central)"
        className="h-8 rounded-lg bg-purple-50/60 px-2 text-xs font-bold text-gray-700 outline-none focus:ring-2 focus:ring-purple-300"
      />
      <span className="text-[11px] font-semibold text-gray-400">Central time · moving it keeps approvals</span>
      <button onClick={onPause} className={`ml-auto h-8 rounded-lg px-2.5 text-xs font-extrabold inline-flex items-center gap-1 ${post.paused ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
        {post.paused ? <><Play className="w-3.5 h-3.5" /> Resume</> : <><Pause className="w-3.5 h-3.5" /> Hold</>}
      </button>
    </div>
  );
}
