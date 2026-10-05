import { describe, expect, it } from 'vitest';
import { currentSeason } from '@wordle-duel/core';
import {
  addDays, applyEdit, calendarFlags, captionBudget, countChars, dayKey, displayStatus, finalText, groupByDay, monthGrid, moveToDay,
  parseEditBody, parseReviewBody, parseScheduleBody, publishEligibility, reviewState, rollupStatus, seasonBands, targetSlug, weekOf,
  zonedInstant, type Platform, type SocialPost, type SocialReview, type SocialTarget,
} from './studio';

const BMT = 'b0000000-0000-4000-8000-000000000001';
const JP = 'a0000000-0000-4000-8000-000000000002';
const reviewers = [{ profile_id: BMT, short_name: 'BMT', sort: 1 }, { profile_id: JP, short_name: 'JP', sort: 2 }];
const POST_ID = '5a0c1a11-0001-4c00-9000-000000000001';

function post(over: Partial<SocialPost> = {}): SocialPost {
  return {
    id: POST_ID, title: 'Meet the cast', kind: 'cast', scheduled_at: '2026-10-07T16:30:00.000Z', hashtags: ['wordgames'],
    media: [{ size: 'portrait', src: 'public', path: '/social/seed/cast-portrait.jpg', width: 1080, height: 1350 }],
    link_slug: null, link_target: 'https://wordocious.com/', version: 1, edited_at: null, edited_by: null, paused: false,
    status: 'draft', created_at: '', updated_at: '', ...over,
  };
}
function target(platform: Platform, over: Partial<SocialTarget> = {}): SocialTarget {
  return {
    id: `t-${platform}`, post_id: POST_ID, platform, caption: 'Hello', status: 'pending', attempts: 0, next_attempt_at: null,
    remote_id: null, remote_url: null, last_error: null, posted_at: null, link_slug: targetSlug(POST_ID, platform), ...over,
  };
}
const rev = (who: string, decision: SocialReview['decision'], version = 1): SocialReview =>
  ({ post_id: POST_ID, reviewer_id: who, decision, version, note: null, updated_at: '' });

describe('approvals', () => {
  it('is approved only when both approve the current version', () => {
    expect(reviewState(post(), [rev(BMT, 'approve')], reviewers).approved).toBe(false);
    expect(reviewState(post(), [rev(BMT, 'approve'), rev(JP, 'approve')], reviewers).approved).toBe(true);
  });

  it('an edit after approval resets BOTH approvals and flags re-approval', () => {
    const p = post();
    const reviews = [rev(BMT, 'approve'), rev(JP, 'approve')];
    const edited = applyEdit(p, [target('x')], { caption: { platform: 'x', text: 'Hello there' } }, BMT, '2026-10-05T19:00:00Z');
    expect(edited.changed).toBe(true);
    expect(edited.post.version).toBe(2);
    expect(edited.targets[0].caption).toBe('Hello there');
    const s = reviewState(edited.post, reviews, reviewers);
    expect(s.approved).toBe(false);
    expect(s.approvedBy).toEqual([]);
    expect(s.needsReapproval).toBe(true);
  });

  it('an image or hashtag change also resets; a no-op save does not', () => {
    const p = post();
    expect(applyEdit(p, [target('x')], { media: [{ ...p.media[0], path: '/social/seed/other.jpg' }] }, BMT, 'now').post.version).toBe(2);
    expect(applyEdit(p, [target('x')], { hashtags: ['wordgames', 'new'] }, BMT, 'now').post.version).toBe(2);
    const same = applyEdit(p, [target('x')], { caption: { platform: 'x', text: 'Hello' }, hashtags: ['wordgames'] }, BMT, 'now');
    expect(same.changed).toBe(false);
    expect(same.post.version).toBe(1);
  });

  it('rescheduling keeps approvals (the day moves, the version does not)', () => {
    const p = post();
    const moved = { ...p, scheduled_at: moveToDay(p.scheduled_at, '2026-10-09') };
    expect(moved.version).toBe(1);
    expect(reviewState(moved, [rev(BMT, 'approve'), rev(JP, 'approve')], reviewers).approved).toBe(true);
    expect(dayKey(moved.scheduled_at)).toBe('2026-10-09');
    expect(new Date(moved.scheduled_at).toISOString()).toBe('2026-10-09T16:30:00.000Z');
  });

  it('display status: needs BMT / needs JP / approved / paused / posted / failed', () => {
    const one = (r: SocialReview[]) => displayStatus(post(), reviewState(post(), r, reviewers), reviewers, false);
    expect(one([])).toBe('draft');
    expect(one([rev(JP, 'approve')])).toBe('needs-bmt');
    expect(one([rev(BMT, 'approve')])).toBe('needs-jp');
    expect(one([rev(BMT, 'approve'), rev(JP, 'approve')])).toBe('approved');
    expect(one([rev(BMT, 'approve'), rev(JP, 'approve', 0)])).toBe('needs-jp');
    const st = reviewState(post(), [], reviewers);
    expect(displayStatus(post(), st, reviewers, true)).toBe('paused');
    expect(displayStatus(post({ paused: true }), st, reviewers, false)).toBe('paused');
    expect(displayStatus(post({ status: 'posted' }), st, reviewers, true)).toBe('posted');
    expect(displayStatus(post({ status: 'failed' }), st, reviewers, false)).toBe('failed');
  });
});

describe('publish eligibility', () => {
  const now = new Date('2026-10-07T17:00:00Z');
  const base = { post: post(), target: target('x'), approved: true, globalPause: false, connected: new Set<Platform>(['x']), now };
  it('posts when due + both approved + not paused + connected + not posted', () => {
    expect(publishEligibility(base)).toEqual({ ok: true });
  });
  it.each([
    ['not-due', { post: post({ scheduled_at: '2026-10-08T00:00:00Z' }) }],
    ['not-approved', { approved: false }],
    ['paused-all', { globalPause: true }],
    ['paused-post', { post: post({ paused: true }) }],
    ['not-connected', { connected: new Set<Platform>() }],
    ['already-posted', { target: target('x', { status: 'posted' }) }],
    ['already-posted', { target: target('x', { remote_id: '123' }) }],
    ['in-flight', { target: target('x', { status: 'posting' }) }],
    ['failed', { target: target('x', { attempts: 3 }) }],
    ['backoff', { target: target('x', { attempts: 1, next_attempt_at: '2026-10-07T17:10:00Z' }) }],
  ] as const)('%s', (reason, over) => {
    expect(publishEligibility({ ...base, ...over })).toEqual({ ok: false, reason });
  });
  it('rolls targets up into the post status', () => {
    expect(rollupStatus([{ status: 'posted' }, { status: 'skipped' }])).toBe('posted');
    expect(rollupStatus([{ status: 'posted' }, { status: 'pending' }])).toBe('partial');
    expect(rollupStatus([{ status: 'failed' }, { status: 'failed' }])).toBe('failed');
    expect(rollupStatus([{ status: 'posted' }, { status: 'failed' }])).toBe('partial');
  });
});

describe('calendar', () => {
  it('groups by Central-time day, sorted by time', () => {
    const late = post({ id: 'b', scheduled_at: '2026-10-08T03:30:00Z' }); // Oct 7, 22:30 CDT
    const early = post({ id: 'a', scheduled_at: '2026-10-07T14:00:00Z' });
    const g = groupByDay([late, early]);
    expect(Array.from(g.keys())).toEqual(['2026-10-07']);
    expect(g.get('2026-10-07')!.map((p) => p.id)).toEqual(['a', 'b']);
  });
  it('builds Sunday-first month and week grids', () => {
    const weeks = monthGrid('2026-10');
    expect(weeks[0][0]).toBe('2026-09-27');
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(weeks.flat()).toContain('2026-10-31');
    expect(weekOf('2026-10-07')).toEqual(['2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10']);
  });
  it('marks Halloween exactly where the season registry (core currentSeason) has it', () => {
    const band = seasonBands([2026]).find((b) => b.label === 'Halloween')!;
    expect(band.end).toBe('2026-11-01');
    expect(currentSeason(band.start)).toBe('halloween');
    expect(currentSeason(addDays(band.start, -1))).toBeNull();
    expect(currentSeason(addDays(band.end, 1))).toBeNull();
  });
  it('handles DST in zonedInstant', () => {
    expect(zonedInstant('2026-11-02', 9, 0).toISOString()).toBe('2026-11-02T15:00:00.000Z'); // CST
    expect(zonedInstant('2026-10-30', 9, 0).toISOString()).toBe('2026-10-30T14:00:00.000Z'); // CDT
  });
  it('flags an empty upcoming week and an unapproved post within 48 h', () => {
    const now = new Date('2026-10-05T19:00:00Z');
    const soon = { ...post({ scheduled_at: '2026-10-07T16:30:00Z' }), approved: false };
    expect(calendarFlags([soon], now).unapprovedSoon).toHaveLength(1);
    expect(calendarFlags([{ ...soon, approved: true }], now).unapprovedSoon).toHaveLength(0);
    expect(calendarFlags([soon], now).emptyWeek).toBeNull();
    expect(calendarFlags([], now).emptyWeek).toEqual({ start: '2026-10-06', end: '2026-10-12' });
  });
});

describe('captions', () => {
  it('counts X links as 23 and applies each limit', () => {
    const link = 'https://wordocious.com/go/p-00000001-x';
    const text = finalText('x', 'Hi', ['a'], link);
    expect(text).toBe(`Hi\n\n${link}\n\n#a`);
    expect(countChars('x', text)).toBe(2 + 2 + 23 + 2 + 2);
    expect(captionBudget('x', 'y'.repeat(260), [], link).over).toBe(true);
    expect(captionBudget('instagram', 'y'.repeat(2000), ['a'], link).over).toBe(false);
    expect(captionBudget('threads', 'y'.repeat(499), [], null)).toMatchObject({ limit: 500, over: false });
  });
  it('keeps the link out of Instagram text (bio link) and in Pinterest’s field', () => {
    expect(finalText('instagram', 'Hi', [], 'https://x.y')).toBe('Hi');
    expect(finalText('pinterest', 'Hi', [], 'https://x.y')).toBe('Hi');
    expect(finalText('facebook', 'Hi', [], 'https://x.y')).toBe('Hi\n\nhttps://x.y');
  });
  it('tracked slugs fit /go/<slug>', () => {
    expect(targetSlug(POST_ID, 'instagram')).toBe('p-00000001-instagram');
    expect(/^[a-z0-9-]{1,40}$/.test(targetSlug('ffffffff-ffff-4fff-8fff-ffffffffffff', 'pinterest'))).toBe(true);
  });
});

describe('request validation', () => {
  it('review bodies', () => {
    expect(parseReviewBody({ post_id: POST_ID, decision: 'approve', version: 2 })).toMatchObject({ decision: 'approve', version: 2 });
    expect(parseReviewBody({ post_id: 'nope', decision: 'approve' })).toHaveProperty('error');
    expect(parseReviewBody({ post_id: POST_ID, decision: 'maybe' })).toHaveProperty('error');
    expect(parseReviewBody({ post_id: POST_ID, decision: 'reject', feedback: true })).toHaveProperty('error');
  });
  it('edit bodies', () => {
    expect(parseEditBody({ post_id: POST_ID, caption: { platform: 'x', text: 'hi' } })).toHaveProperty('edit.caption');
    expect(parseEditBody({ post_id: POST_ID })).toHaveProperty('error');
    expect(parseEditBody({ post_id: POST_ID, caption: { platform: 'myspace', text: 'hi' } })).toHaveProperty('error');
    expect(parseEditBody({ post_id: POST_ID, media: [{ size: 'portrait', src: 'public', path: '../etc/passwd', width: 1, height: 1 }] })).toHaveProperty('error');
    expect(parseEditBody({ post_id: POST_ID, hashtags: ['#ok', 'two words'] })).toHaveProperty('error');
  });
  it('schedule bodies', () => {
    expect(parseScheduleBody({ post_id: POST_ID, scheduled_at: '2026-10-09T17:00:00Z' })).toMatchObject({ scheduled_at: '2026-10-09T17:00:00.000Z' });
    expect(parseScheduleBody({ post_id: POST_ID, platforms: ['x', 'x', 'threads'] })).toMatchObject({ platforms: ['x', 'threads'] });
    expect(parseScheduleBody({ post_id: POST_ID })).toHaveProperty('error');
    expect(parseScheduleBody({ post_id: POST_ID, scheduled_at: 'tomorrow-ish' })).toHaveProperty('error');
  });
});
