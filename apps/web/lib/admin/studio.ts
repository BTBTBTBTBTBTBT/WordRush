/**
 * admin > Growth > Social Studio: the pure rules shared by the page, the /api/admin/studio routes, the publisher
 * cron and the tests. No React, no Supabase. Tables: docs/sql/20261005-social-studio.sql.
 *
 * - Two approvers (public.art_reviewers: BMT and JP). A post is approved only when BOTH approve its CURRENT
 *   version; any caption or image edit bumps the version, so older approvals stop counting.
 * - Rescheduling does not touch the version (approvals stay).
 * - The publisher posts a target only when it is due, the post is approved, nothing is paused, the platform is
 *   connected and that target has not been posted.
 */
import { currentSeason } from '@wordle-duel/core';

/* ------------------------------------------------------------- platforms */

export const PLATFORMS = ['instagram', 'facebook', 'threads', 'pinterest', 'x', 'tiktok'] as const;
export type Platform = (typeof PLATFORMS)[number];

export type MediaSize = 'portrait' | 'pin' | 'landscape';
export const MEDIA_SIZES: Record<MediaSize, { width: number; height: number; label: string }> = {
  portrait: { width: 1080, height: 1350, label: '1080 × 1350' },
  pin: { width: 1000, height: 1500, label: '1000 × 1500' },
  landscape: { width: 1600, height: 900, label: '1600 × 900' },
};

/** The OAuth app behind each Connect button ('meta' connects Instagram and the Facebook Page together). */
export type Provider = 'meta' | 'threads' | 'pinterest' | 'x' | 'tiktok';

export interface PlatformInfo {
  id: Platform;
  label: string;
  /** Caption limit in characters (X counts every link as 23). */
  limit: number;
  size: MediaSize;
  /** Where the tracked link goes: in the text, the pin's link field, or nowhere (bio link). */
  link: 'text' | 'field' | 'bio';
  provider: Provider;
  handle: string;
}

export const PLATFORM_INFO: Record<Platform, PlatformInfo> = {
  instagram: { id: 'instagram', label: 'Instagram', limit: 2200, size: 'portrait', link: 'bio', provider: 'meta', handle: '@wordocious2' },
  facebook: { id: 'facebook', label: 'Facebook', limit: 63206, size: 'portrait', link: 'text', provider: 'meta', handle: 'Wordocious (Page)' },
  threads: { id: 'threads', label: 'Threads', limit: 500, size: 'portrait', link: 'text', provider: 'threads', handle: '@wordocious2' },
  pinterest: { id: 'pinterest', label: 'Pinterest', limit: 500, size: 'pin', link: 'field', provider: 'pinterest', handle: 'wordocious' },
  x: { id: 'x', label: 'X', limit: 280, size: 'landscape', link: 'text', provider: 'x', handle: '@wordocious' },
  tiktok: { id: 'tiktok', label: 'TikTok', limit: 2200, size: 'portrait', link: 'bio', provider: 'tiktok', handle: '@wordocious2' },
};

export const PROVIDERS: Record<Provider, { label: string; platforms: Platform[]; env: string[] }> = {
  meta: { label: 'Instagram + Facebook Page', platforms: ['instagram', 'facebook'], env: ['META_APP_ID', 'META_APP_SECRET'] },
  threads: { label: 'Threads', platforms: ['threads'], env: ['THREADS_APP_ID', 'THREADS_APP_SECRET'] },
  pinterest: { label: 'Pinterest', platforms: ['pinterest'], env: ['PINTEREST_APP_ID', 'PINTEREST_APP_SECRET'] },
  x: { label: 'X', platforms: ['x'], env: ['X_CLIENT_ID', 'X_CLIENT_SECRET'] },
  tiktok: { label: 'TikTok (drafts to inbox)', platforms: ['tiktok'], env: ['TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_SECRET'] },
};

export function isPlatform(p: unknown): p is Platform {
  return typeof p === 'string' && (PLATFORMS as readonly string[]).includes(p);
}
export function isProvider(p: unknown): p is Provider {
  return typeof p === 'string' && Object.prototype.hasOwnProperty.call(PROVIDERS, p);
}

/* --------------------------------------------------------------- rows */

export interface SocialMedia { size: MediaSize; src: 'public' | 'bucket'; path: string; width: number; height: number }

export interface SocialPost {
  id: string;
  title: string;
  kind: string;
  scheduled_at: string;
  hashtags: string[];
  media: SocialMedia[];
  link_slug: string | null;
  link_target: string;
  version: number;
  edited_at: string | null;
  edited_by: string | null;
  paused: boolean;
  status: 'draft' | 'posted' | 'partial' | 'failed';
  created_at: string;
  updated_at: string;
}

export type TargetStatus = 'pending' | 'posting' | 'posted' | 'failed' | 'skipped';
export interface SocialTarget {
  id: string;
  post_id: string;
  platform: Platform;
  caption: string;
  status: TargetStatus;
  attempts: number;
  next_attempt_at: string | null;
  remote_id: string | null;
  remote_url: string | null;
  last_error: string | null;
  posted_at: string | null;
  link_slug: string | null;
}

export const REVIEW_DECISIONS = ['approve', 'reject', 'changes'] as const;
export type Decision = (typeof REVIEW_DECISIONS)[number];
export interface SocialReview {
  post_id: string;
  reviewer_id: string;
  decision: Decision;
  version: number;
  note: string | null;
  updated_at: string;
}
export interface Reviewer { profile_id: string; short_name: string; sort: number }

/* ------------------------------------------------------------- approvals */

export interface ReviewState {
  /** Reviewer ids whose approval counts (given on the current version). */
  approvedBy: string[];
  /** Reviewers still owed (no current-version approve). */
  waitingOn: string[];
  /** Someone rejected / asked for changes on the current version. */
  rejectedBy: string[];
  changesBy: string[];
  /** An approval was given on an older version: the post was edited after approval. */
  needsReapproval: boolean;
  approved: boolean;
}

export function reviewState(
  post: Pick<SocialPost, 'id' | 'version'>,
  reviews: ReadonlyArray<Pick<SocialReview, 'post_id' | 'reviewer_id' | 'decision' | 'version'>>,
  reviewers: ReadonlyArray<Pick<Reviewer, 'profile_id'>>,
): ReviewState {
  const ids = reviewers.map((r) => r.profile_id);
  const mine = reviews.filter((r) => r.post_id === post.id && ids.includes(r.reviewer_id));
  const current = mine.filter((r) => r.version === post.version);
  const approvedBy = ids.filter((id) => current.some((r) => r.reviewer_id === id && r.decision === 'approve'));
  const rejectedBy = ids.filter((id) => current.some((r) => r.reviewer_id === id && r.decision === 'reject'));
  const changesBy = ids.filter((id) => current.some((r) => r.reviewer_id === id && r.decision === 'changes'));
  const needsReapproval = mine.some((r) => r.decision === 'approve' && r.version < post.version);
  return {
    approvedBy,
    waitingOn: ids.filter((id) => !approvedBy.includes(id)),
    rejectedBy,
    changesBy,
    needsReapproval,
    approved: ids.length > 0 && approvedBy.length === ids.length,
  };
}

/** What changes the post's content (and so resets approvals). Scheduling / pausing / platforms do not. */
export interface ContentEdit { caption?: { platform: Platform; text: string }; hashtags?: string[]; media?: SocialMedia[] }

/** True when applying `edit` changes what would be posted (a no-op save does not reset approvals). */
export function editChangesContent(post: Pick<SocialPost, 'hashtags' | 'media'>, targets: readonly Pick<SocialTarget, 'platform' | 'caption'>[], edit: ContentEdit): boolean {
  if (edit.caption) {
    const t = targets.find((x) => x.platform === edit.caption!.platform);
    if (!t || t.caption !== edit.caption.text) return true;
  }
  if (edit.hashtags && edit.hashtags.join(' ') !== post.hashtags.join(' ')) return true;
  if (edit.media && JSON.stringify(edit.media) !== JSON.stringify(post.media)) return true;
  return false;
}

/**
 * Apply a content edit: the new fields and, when anything actually changed, version + 1 (every earlier
 * approval stops counting, for BOTH approvers). Pure; the route writes the result.
 */
export function applyEdit<P extends SocialPost, T extends SocialTarget>(
  post: P, targets: readonly T[], edit: ContentEdit, editor: string | null, now: string,
): { post: P; targets: T[]; changed: boolean } {
  if (!editChangesContent(post, targets, edit)) return { post, targets: targets.slice(), changed: false };
  const next: P = {
    ...post,
    hashtags: edit.hashtags ?? post.hashtags,
    media: edit.media ?? post.media,
    version: post.version + 1,
    edited_at: now,
    edited_by: editor,
    updated_at: now,
  };
  const nextTargets = targets.map((t) => (edit.caption && t.platform === edit.caption.platform ? { ...t, caption: edit.caption.text } : t));
  return { post: next, targets: nextTargets, changed: true };
}

/* ---------------------------------------------------------------- status */

export type DisplayStatus = 'draft' | 'needs-bmt' | 'needs-jp' | 'approved' | 'posted' | 'failed' | 'paused';

/**
 * The calendar / card status. Posted and failed come from the publisher; otherwise paused (this post or all
 * posting), approved (both), needs <the one missing approver> (exactly one approved), else draft.
 * Reviewer names come from art_reviewers.short_name (BMT, JP).
 */
export function displayStatus(
  post: Pick<SocialPost, 'status' | 'paused'>,
  state: ReviewState,
  reviewers: readonly Pick<Reviewer, 'profile_id' | 'short_name'>[],
  globalPause: boolean,
): DisplayStatus {
  if (post.status === 'posted' || post.status === 'partial') return 'posted';
  if (post.status === 'failed') return 'failed';
  if (post.paused || globalPause) return 'paused';
  if (state.approved) return 'approved';
  if (state.approvedBy.length >= 1 && state.waitingOn.length === 1) {
    const who = reviewers.find((r) => r.profile_id === state.waitingOn[0])?.short_name.toUpperCase();
    if (who === 'BMT') return 'needs-bmt';
    if (who === 'JP') return 'needs-jp';
  }
  return 'draft';
}

/* ------------------------------------------------------------ publishing */

export const MAX_ATTEMPTS = 3;
/** Backoff after the n-th failure: 15 min, then 60 min. */
export function retryDelayMs(attempts: number): number {
  return attempts <= 1 ? 15 * 60_000 : 60 * 60_000;
}
/** A 'posting' claim older than this is treated as abandoned (the run died mid-post) and NOT retried blindly. */
export const CLAIM_STALE_MS = 10 * 60_000;

export type Ineligible =
  | 'not-due' | 'not-approved' | 'paused-all' | 'paused-post' | 'not-connected' | 'already-posted' | 'failed'
  | 'in-flight' | 'backoff' | 'skipped';

/** Why a target can or cannot publish right now. */
export function publishEligibility(input: {
  post: Pick<SocialPost, 'scheduled_at' | 'paused'>;
  target: Pick<SocialTarget, 'status' | 'attempts' | 'next_attempt_at' | 'platform' | 'remote_id'>;
  approved: boolean;
  globalPause: boolean;
  connected: ReadonlySet<Platform>;
  now: Date;
}): { ok: true } | { ok: false; reason: Ineligible } {
  const { post, target, approved, globalPause, connected, now } = input;
  if (target.status === 'posted' || target.remote_id) return { ok: false, reason: 'already-posted' };
  if (target.status === 'skipped') return { ok: false, reason: 'skipped' };
  if (target.status === 'failed' || target.attempts >= MAX_ATTEMPTS) return { ok: false, reason: 'failed' };
  if (target.status === 'posting') return { ok: false, reason: 'in-flight' };
  if (globalPause) return { ok: false, reason: 'paused-all' };
  if (post.paused) return { ok: false, reason: 'paused-post' };
  if (!approved) return { ok: false, reason: 'not-approved' };
  if (new Date(post.scheduled_at).getTime() > now.getTime()) return { ok: false, reason: 'not-due' };
  if (target.next_attempt_at && new Date(target.next_attempt_at).getTime() > now.getTime()) return { ok: false, reason: 'backoff' };
  if (!connected.has(target.platform)) return { ok: false, reason: 'not-connected' };
  return { ok: true };
}

/** The post's overall status from its targets (after a publish attempt). */
export function rollupStatus(targets: readonly Pick<SocialTarget, 'status'>[]): SocialPost['status'] {
  const live = targets.filter((t) => t.status !== 'skipped');
  if (!live.length) return 'draft';
  const posted = live.filter((t) => t.status === 'posted').length;
  if (posted === live.length) return 'posted';
  if (live.some((t) => t.status === 'failed')) return posted ? 'partial' : 'failed';
  return posted ? 'partial' : 'draft';
}

/* -------------------------------------------------------------- captions */

const URL_RE = /https?:\/\/\S+/g;

/** The tracked link for one target: wordocious.com/go/<slug>. */
export function trackedUrl(slug: string | null, origin = 'https://wordocious.com'): string | null {
  return slug ? `${origin}/go/${slug}` : null;
}

/** The text a platform receives: caption, hashtags, and the link when that platform carries it in the text. */
export function finalText(platform: Platform, caption: string, hashtags: readonly string[], link: string | null): string {
  const tags = hashtags.map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ');
  const parts = [caption.trim()];
  if (link && PLATFORM_INFO[platform].link === 'text') parts.push(link);
  if (tags) parts.push(tags);
  return parts.filter(Boolean).join('\n\n');
}

/** Characters as the platform counts them (X weights every URL as 23). */
export function countChars(platform: Platform, text: string): number {
  const n = Array.from(text).length;
  if (platform !== 'x') return n;
  let out = n;
  for (const m of Array.from(text.matchAll(URL_RE))) out += 23 - Array.from(m[0]).length;
  return out;
}

export function captionBudget(platform: Platform, caption: string, hashtags: readonly string[], link: string | null) {
  const used = countChars(platform, finalText(platform, caption, hashtags, link));
  const limit = PLATFORM_INFO[platform].limit;
  return { used, limit, over: used > limit, left: limit - used };
}

/* -------------------------------------------------------------- calendar */

export const STUDIO_TZ = 'America/Chicago';

/** YYYY-MM-DD of an instant in the studio time zone. */
export function dayKey(iso: string | Date, tz = STUDIO_TZ): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Minutes east of UTC for `tz` at instant `d` (CDT = -300). */
function tzOffsetMinutes(d: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second'));
  return Math.round((asUtc - d.getTime()) / 60_000);
}

/** The instant for a wall-clock date + time in `tz` (DST-correct). */
export function zonedInstant(day: string, hour: number, minute: number, tz = STUDIO_TZ): Date {
  const [y, m, d] = day.split('-').map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d, hour, minute));
  const off1 = tzOffsetMinutes(guess, tz);
  const first = new Date(guess.getTime() - off1 * 60_000);
  const off2 = tzOffsetMinutes(first, tz);
  return off2 === off1 ? first : new Date(guess.getTime() - off2 * 60_000);
}

/** Wall-clock hour + minute of an instant in `tz`. */
export function zonedTime(iso: string, tz = STUDIO_TZ): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date(iso));
  return { hour: Number(parts.find((p) => p.type === 'hour')?.value) % 24, minute: Number(parts.find((p) => p.type === 'minute')?.value) };
}

/** Move a post to another day, keeping its time of day (the calendar drag). */
export function moveToDay(iso: string, day: string, tz = STUDIO_TZ): string {
  const { hour, minute } = zonedTime(iso, tz);
  return zonedInstant(day, hour, minute, tz).toISOString();
}

export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

/** 0 = Sunday. */
export function weekday(day: string): number {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Posts grouped by studio-time day, each day sorted by time. */
export function groupByDay<T extends Pick<SocialPost, 'scheduled_at'>>(posts: readonly T[], tz = STUDIO_TZ): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const p of posts) {
    const k = dayKey(p.scheduled_at, tz);
    const list = out.get(k) ?? [];
    list.push(p);
    out.set(k, list);
  }
  for (const list of Array.from(out.values())) list.sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
  return out;
}

/** The month grid (Sunday-first weeks) covering `month` ('YYYY-MM'). */
export function monthGrid(month: string): string[][] {
  const first = `${month}-01`;
  const start = addDays(first, -weekday(first));
  const weeks: string[][] = [];
  let cur = start;
  do {
    const week = Array.from({ length: 7 }, (_, i) => addDays(cur, i));
    weeks.push(week);
    cur = addDays(cur, 7);
  } while (cur.slice(0, 7) === month);
  return weeks;
}

/** The Sunday-first week holding `day`. */
export function weekOf(day: string): string[] {
  const start = addDays(day, -weekday(day));
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export interface Band { id: string; label: string; start: string; end: string; tone: 'season' | 'release' }

/**
 * Season bands for the given years, read from core currentSeason (the season registry) day by day, so the
 * calendar always matches what the apps switch on (Halloween: Oct 9 - Oct 31 once the registry says so).
 */
export function seasonBands(years: readonly number[]): Band[] {
  const out: Band[] = [];
  for (const y of years) {
    let run: { id: string; start: string; end: string } | null = null;
    for (let day = `${y}-01-01`; day <= `${y}-12-31`; day = addDays(day, 1)) {
      const s = currentSeason(day);
      if (s && run && run.id === s && addDays(run.end, 1) === day) { run.end = day; continue; }
      if (run) out.push({ id: `${run.id}-${run.start}`, label: run.id.charAt(0).toUpperCase() + run.id.slice(1), start: run.start, end: run.end, tone: 'season' });
      run = s ? { id: s, start: day, end: day } : null;
    }
    if (run) out.push({ id: `${run.id}-${run.start}`, label: run.id.charAt(0).toUpperCase() + run.id.slice(1), start: run.start, end: run.end, tone: 'season' });
  }
  return out;
}

/**
 * App releases shown on the calendar. Add a row per release: { version, date (expected store day, YYYY-MM-DD) }.
 */
export const STUDIO_RELEASES: ReadonlyArray<{ version: string; date: string; note?: string }> = [
  { version: '2.7.1', date: '2026-10-05', note: 'submitted' },
];

export function releaseBands(): Band[] {
  return STUDIO_RELEASES.map((r) => ({ id: `release-${r.version}`, label: `v${r.version}${r.note ? ` (${r.note})` : ''}`, start: r.date, end: r.date, tone: 'release' as const }));
}

export function bandsOn(day: string, bands: readonly Band[]): Band[] {
  return bands.filter((b) => day >= b.start && day <= b.end);
}

/** Quiet flags above the calendar. */
export function calendarFlags(
  posts: ReadonlyArray<Pick<SocialPost, 'id' | 'title' | 'scheduled_at' | 'status'> & { approved: boolean }>,
  now: Date,
): { emptyWeek: { start: string; end: string } | null; unapprovedSoon: Array<{ id: string; title: string; scheduled_at: string }> } {
  const today = dayKey(now);
  const end = addDays(today, 7);
  const upcoming = posts.filter((p) => {
    const k = dayKey(p.scheduled_at);
    return k > today && k <= end;
  });
  const soon = posts.filter((p) => {
    const t = new Date(p.scheduled_at).getTime();
    return p.status === 'draft' && !p.approved && t >= now.getTime() && t - now.getTime() <= 48 * 3600_000;
  });
  return {
    emptyWeek: upcoming.length ? null : { start: addDays(today, 1), end },
    unapprovedSoon: soon.map((p) => ({ id: p.id, title: p.title, scheduled_at: p.scheduled_at })),
  };
}

/* ------------------------------------------------------------ validation */

const NOTE_MAX = 2000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (s: unknown): s is string => typeof s === 'string' && UUID_RE.test(s);

export function parseReviewBody(body: unknown):
  { post_id: string; decision: Decision; note: string | null; feedback: boolean; version: number | null } | { error: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  if (!isUuid(b.post_id)) return { error: 'post_id is required' };
  if (typeof b.decision !== 'string' || !(REVIEW_DECISIONS as readonly string[]).includes(b.decision)) {
    return { error: "decision must be 'approve', 'reject' or 'changes'" };
  }
  if (b.note != null && typeof b.note !== 'string') return { error: 'note must be a string' };
  const note = typeof b.note === 'string' && b.note.trim() ? b.note.trim().slice(0, NOTE_MAX) : null;
  if (b.feedback === true && !note) return { error: 'feedback needs a note' };
  const version = typeof b.version === 'number' && Number.isInteger(b.version) && b.version > 0 ? b.version : null;
  return { post_id: b.post_id, decision: b.decision as Decision, note, feedback: b.feedback === true, version };
}

export function parseEditBody(body: unknown): { post_id: string; edit: ContentEdit } | { error: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  if (!isUuid(b.post_id)) return { error: 'post_id is required' };
  const edit: ContentEdit = {};
  if (b.caption != null) {
    const c = b.caption as { platform?: unknown; text?: unknown };
    if (!isPlatform(c.platform) || typeof c.text !== 'string') return { error: 'caption needs { platform, text }' };
    if (Array.from(c.text).length > 5000) return { error: 'caption is too long' };
    edit.caption = { platform: c.platform, text: c.text };
  }
  if (b.hashtags != null) {
    if (!Array.isArray(b.hashtags) || b.hashtags.length > 30 || !b.hashtags.every((h) => typeof h === 'string' && /^#?[\p{L}\p{N}_]{1,60}$/u.test(h))) {
      return { error: 'hashtags must be up to 30 words (letters, numbers, _)' };
    }
    edit.hashtags = (b.hashtags as string[]).map((h) => h.replace(/^#/, ''));
  }
  if (b.media != null) {
    if (!Array.isArray(b.media) || !b.media.every(isMedia)) return { error: 'media is malformed' };
    edit.media = b.media as SocialMedia[];
  }
  if (!edit.caption && !edit.hashtags && !edit.media) return { error: 'nothing to change' };
  return { post_id: b.post_id, edit };
}

function isMedia(m: unknown): m is SocialMedia {
  const x = m as SocialMedia;
  return !!x && (x.size === 'portrait' || x.size === 'pin' || x.size === 'landscape')
    && (x.src === 'public' || x.src === 'bucket')
    && typeof x.path === 'string' && /^[A-Za-z0-9/_.-]{1,200}$/.test(x.path) && !x.path.includes('..')
    && Number.isInteger(x.width) && Number.isInteger(x.height);
}

export function parseScheduleBody(body: unknown):
  { post_id: string; scheduled_at?: string; paused?: boolean; platforms?: Platform[] } | { error: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  if (!isUuid(b.post_id)) return { error: 'post_id is required' };
  const out: { post_id: string; scheduled_at?: string; paused?: boolean; platforms?: Platform[] } = { post_id: b.post_id };
  if (b.scheduled_at != null) {
    if (typeof b.scheduled_at !== 'string' || Number.isNaN(Date.parse(b.scheduled_at))) return { error: 'scheduled_at must be a date' };
    out.scheduled_at = new Date(b.scheduled_at).toISOString();
  }
  if (b.paused != null) {
    if (typeof b.paused !== 'boolean') return { error: 'paused must be true or false' };
    out.paused = b.paused;
  }
  if (b.platforms != null) {
    if (!Array.isArray(b.platforms) || !b.platforms.every(isPlatform)) return { error: 'platforms must be platform ids' };
    out.platforms = Array.from(new Set(b.platforms as Platform[]));
  }
  if (out.scheduled_at === undefined && out.paused === undefined && out.platforms === undefined) return { error: 'nothing to change' };
  return out;
}

export function parsePauseBody(body: unknown): { paused: boolean } | { error: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  return typeof b.paused === 'boolean' ? { paused: b.paused } : { error: 'paused must be true or false' };
}

/** A per-post, per-platform tracked-link slug: 'p-<last 8 hex of the post id>-<platform>' (fits /go/<slug>). */
export function targetSlug(postId: string, platform: Platform): string {
  return `p-${postId.replace(/-/g, '').slice(-8).toLowerCase()}-${platform}`;
}
