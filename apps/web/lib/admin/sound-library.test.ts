import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import {
  applySoundReviews, catalogAssets, eventKeyOf, eventReviewed, groupSoundSections, indexReviews, isMissingTable,
  siblingApprovesToClear, siblingIds, soundApproveAllPlan, soundScope, soundScopeLabel, soundSectionSummary,
  SOUND_CATALOG, type SoundReview, type SoundReviewContext, type SoundStatus,
} from './sound-library';
import { approvedIdsFrom, formatPicksPlan, picksPlan } from './sound-picks';
import { SCOPE_RE } from './art-review';

const BMT = '11111111-1111-4111-8111-111111111111';
const JP = '22222222-2222-4222-8222-222222222222';
const REVIEWERS = [
  { profile_id: BMT, short_name: 'BMT', sort: 1 },
  { profile_id: JP, short_name: 'JP', sort: 2 },
];
const WEB = path.resolve(__dirname, '../..');
const rev = (asset_id: string, reviewer_id: string, decision: SoundReview['decision']): SoundReview =>
  ({ asset_id, reviewer_id, decision, note: null, created_at: '2026-10-10T00:00:00Z', updated_at: '2026-10-10T00:00:00Z' });
const ctxFor = (reviews: SoundReview[], me: string | null = BMT): SoundReviewContext => ({ index: indexReviews(reviews), reviewers: REVIEWERS, me });

describe('the catalog (export-sound-catalog.py)', () => {
  it('has every Sound Lab section in lab order', () => {
    expect(SOUND_CATALOG.sections.map((s) => s.id)).toEqual([
      'classic', 'six', 'seven', 'quadword', 'octoword', 'succession', 'deliverance', 'gauntlet', 'propernoundle',
      'hubbub', 'sudocious', 'muddle', 'crossword', 'codebreaker', 'kindred', 'ladder', 'spyglass', 'starsweep',
      'vs', 'pocket', 'app',
    ]);
  });

  it('every event leads with exactly one LIVE candidate: Now, what ships today', () => {
    for (const s of SOUND_CATALOG.sections) {
      for (const e of s.events) {
        expect(e.candidates[0].opt, `${s.id}/${e.id}`).toBe('now');
        expect(e.candidates.filter((c) => c.live).map((c) => c.opt), `${s.id}/${e.id}`).toEqual(['now']);
        expect(e.candidates.length, `${s.id}/${e.id}`).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('ids are unique and every playable clip exists on disk', () => {
    const ids = catalogAssets().map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of SOUND_CATALOG.sections) for (const e of s.events) for (const c of e.candidates) {
      for (const u of c.clips) expect(existsSync(path.join(WEB, 'public', u)), u).toBe(true);
    }
  });

  it('the shipped picks show as the options they came from', () => {
    const ev = (sid: string, eid: string) => SOUND_CATALOG.sections.find((s) => s.id === sid)!.events.find((e) => e.id === eid)!;
    expect(ev('classic', 'win').candidates[0]).toMatchObject({ shipped: 'classic-win', clips: ['/sounds/classic-win.m4a'] });
    expect(ev('classic', 'win').candidates.filter((c) => c.same).map((c) => c.opt)).toEqual(['a']);
    expect(ev('hubbub', 'pangram').candidates.filter((c) => c.same).map((c) => c.opt)).toEqual(['b']);
    expect(ev('app', 'laugh').candidates[0].clips).toHaveLength(10);
    expect(ev('app', 'laugh').candidates.filter((c) => c.same).map((c) => c.opt)).toEqual(['a']);
    // Silent today: Now has nothing to play.
    expect(ev('app', 'tab').candidates[0]).toMatchObject({ name: 'Silent today', clips: [] });
    // Six plays the pack's win, not Classic's pick.
    expect(ev('six', 'win').candidates[0].shipped).toBe('win');
  });

  it('the SQL seed matches the catalog row for row', () => {
    const sql = readFileSync(path.resolve(WEB, '../../docs/sql/20261010-sound-library.sql'), 'utf8');
    const seeded = Array.from(sql.matchAll(/^ {2}\('([^']+)'/gm)).map((m) => m[1]);
    expect(seeded).toEqual(catalogAssets().map((a) => a.id));
    expect(sql).toMatch(/create table if not exists public\.sound_assets/);
    expect(sql).toMatch(/create or replace view public\.sound_open_feedback with \(security_invoker = true\)/);
    for (const t of ['sound_assets', 'sound_reviews', 'sound_feedback']) {
      expect(sql).toMatch(new RegExp(`alter table public\\.${t} +enable row level security;`));
      expect(sql).toMatch(new RegExp(`revoke all on public\\.${t} +from anon;`));
      expect(sql).toMatch(new RegExp(`create policy ${t}_admin_all on public\\.${t}`));
    }
  });
});

describe('grouping', () => {
  it('groups by game with Now first, statuses from the database (draft when missing)', () => {
    const statuses = new Map<string, SoundStatus>([['classic/win/b', 'approved']]);
    const sections = groupSoundSections(statuses, ctxFor([]));
    const classic = sections[0];
    expect(classic.title).toBe('Classic');
    const win = classic.events.find((e) => e.id === 'win')!;
    expect(win.key).toBe('classic/win');
    expect(win.candidates.map((c) => c.id)).toEqual(['classic/win/now', 'classic/win/a', 'classic/win/b', 'classic/win/c']);
    expect(win.candidates.map((c) => c.status)).toEqual(['draft', 'draft', 'approved', 'draft']);
    expect(win.picked?.id).toBe('classic/win/b');
    expect(classic.counts.decided).toBe(1);
    expect(classic.counts.toReview).toBe(classic.counts.events);
    expect(classic.done).toBe(false);
  });

  it('an event is reviewed for me once I picked anything in it; a section is done when every event is', () => {
    const ids = groupSoundSections(new Map(), ctxFor([]))[0].events.map((e) => `${e.key}/now`);
    const reviews = ids.map((id) => rev(id, BMT, 'approve'));
    const s = groupSoundSections(new Map(), ctxFor(reviews))[0];
    expect(s.events.every((e) => eventReviewed(e, ctxFor(reviews)))).toBe(true);
    expect(s.done).toBe(true);
    expect(soundSectionSummary(s, ctxFor(reviews))).toBe('All picked by you · waiting on JP');
    // A non-reviewer waits on both.
    expect(eventReviewed(s.events[0], ctxFor(reviews, 'someone-else'))).toBe(false);
  });

  it('summaries read like the Art Library', () => {
    const s = groupSoundSections(new Map(), ctxFor([]))[0];
    expect(soundSectionSummary(s, ctxFor([]))).toBe(`${s.counts.events} to review · waiting on JP`);
    const all = new Map(s.events.map((e) => [`${e.key}/now`, 'approved' as SoundStatus]));
    const done = groupSoundSections(all, ctxFor([]))[0];
    expect(soundSectionSummary(done, ctxFor([]))).toBe('Picked for every event');
  });
});

describe('approvals', () => {
  it('one pick per event: approving B clears my approve on A, not JP\'s, not my comments', () => {
    const reviews = [rev('classic/win/a', BMT, 'approve'), rev('classic/win/a', JP, 'approve'), rev('classic/win/c', BMT, 'changes'), rev('classic/loss/a', BMT, 'approve')];
    expect(siblingApprovesToClear(['classic/win/b'], reviews, BMT)).toEqual(['classic/win/a']);
    const statuses = new Map<string, SoundStatus>([['classic/win/a', 'approved']]);
    const out = applySoundReviews(statuses, reviews, ['classic/win/b'], BMT, 'approve', null, REVIEWERS);
    expect(out.cleared).toEqual(['classic/win/a']);
    const mine = out.reviews.filter((r) => r.reviewer_id === BMT).map((r) => `${r.asset_id}:${r.decision}`).sort();
    expect(mine).toEqual(['classic/loss/a:approve', 'classic/win/b:approve', 'classic/win/c:changes']);
    // A loses BMT's approve (only JP's is left): back to draft. B has only BMT's: draft.
    expect(out.statuses.get('classic/win/a')).toBe('draft');
    expect(out.statuses.get('classic/win/b')).toBe('draft');
    // JP picks B too: approved.
    const both = applySoundReviews(out.statuses, out.reviews, ['classic/win/b'], JP, 'approve', null, REVIEWERS);
    expect(both.statuses.get('classic/win/b')).toBe('approved');
    expect(both.statuses.get('classic/win/a')).toBe('draft');
  });

  it('a reject from either reviewer rejects; a comment keeps it a draft; shipped never moves', () => {
    const r1 = applySoundReviews(new Map(), [rev('app/tab/a', JP, 'approve')], ['app/tab/a'], BMT, 'reject', 'too clicky', REVIEWERS);
    expect(r1.statuses.get('app/tab/a')).toBe('rejected');
    expect(r1.cleared).toEqual([]);
    const r2 = applySoundReviews(new Map(), [rev('app/tab/a', JP, 'approve')], ['app/tab/a'], BMT, 'changes', 'softer', REVIEWERS);
    expect(r2.statuses.get('app/tab/a')).toBe('draft');
    const r3 = applySoundReviews(new Map([['app/tab/a', 'shipped' as SoundStatus]]), [], ['app/tab/a'], BMT, 'reject', 'x', REVIEWERS);
    expect(r3.statuses.get('app/tab/a')).toBe('shipped');
  });

  it('Approve all keeps what ships for every event I have not picked in, skipping ones I flagged', () => {
    const reviews = [rev('classic/win/b', BMT, 'approve'), rev('classic/loss/now', BMT, 'reject')];
    const s = groupSoundSections(new Map(), ctxFor(reviews))[0];
    const plan = soundApproveAllPlan(s, ctxFor(reviews));
    expect(plan.ids.every((id) => id.endsWith('/now'))).toBe(true);
    expect(plan.ids).not.toContain('classic/win/now');
    expect(plan.ids).not.toContain('classic/loss/now');
    expect(plan.skipped).toBe(1);
    expect(plan.ids).toHaveLength(s.events.length - 2);
    // Non-reviewers can't.
    expect(soundApproveAllPlan(s, ctxFor(reviews, 'someone-else')).ids).toEqual([]);
  });

  it('siblings come from the catalog', () => {
    expect(siblingIds('classic/win/b')).toEqual(['classic/win/now', 'classic/win/a', 'classic/win/b', 'classic/win/c']);
    expect(siblingIds('app/laugh/a')).toEqual(['app/laugh/now', 'app/laugh/a', 'app/laugh/b']);
    expect(eventKeyOf('app/laugh/a')).toBe('app/laugh');
    expect(siblingIds('nope/x/a')).toEqual(['nope/x/a']);
  });

  it('feedback scopes fit the art scope rule and read well', () => {
    expect(SCOPE_RE.test(soundScope('game', 'classic'))).toBe(true);
    expect(SCOPE_RE.test(soundScope('event', 'app/intro'))).toBe(true);
    expect(soundScopeLabel('game:classic')).toBe('Classic (whole game)');
    expect(soundScopeLabel('event:app/intro')).toBe('Across the app · App intro (the cast parades in)');
  });

  it('a missing table (SQL not applied) is recognized', () => {
    expect(isMissingTable({ code: '42P01', message: 'relation "public.sound_assets" does not exist' })).toBe(true);
    expect(isMissingTable({ code: 'PGRST205', message: "Could not find the table 'public.sound_assets' in the schema cache" })).toBe(true);
    expect(isMissingTable({ code: '23505', message: 'duplicate key' })).toBe(false);
    expect(isMissingTable(null)).toBe(false);
  });
});

describe('approved picks -> make-sounds.py PICKS rows', () => {
  it('maps every kind of pick', () => {
    const plan = picksPlan(['classic/win/b', 'classic/streak/b', 'classic/key/now', 'six/win/c', 'app/tab/a', 'app/laugh/b', 'hubbub/pangram/b', 'pocket/win/c', 'nope/x/a']);
    const row = (n: string) => plan.rows.find((r) => r.name === n);
    expect(row('classic-win')).toMatchObject({ src: 'alt-win-b', target: "'match:win'", kind: 'replace', wiring: false });
    expect(row('classic-streak')).toMatchObject({ src: 'alt-streak-b', kind: 'same' });
    expect(row('six-win')).toMatchObject({ src: 'alt-win-c', target: "'match:win'", kind: 'new', wiring: true });
    expect(row('tab')).toMatchObject({ src: 'tab-a', target: 'UI', kind: 'new', wiring: true });
    expect(row('laugh-w')).toMatchObject({ src: 'laugh-b-w', target: 'UI', kind: 'replace' });
    expect(plan.rows.filter((r) => r.name.startsWith('laugh-'))).toHaveLength(10);
    expect(row('pangram')).toMatchObject({ src: 'pangram-b', kind: 'same' });
    expect(row('pocket-win')).toMatchObject({ alias: 'win', wiring: true });
    expect(plan.kept).toEqual(['Classic · Letter key']);
    expect(plan.unknown).toEqual(['nope/x/a']);
    const text = formatPicksPlan(plan);
    expect(text).toContain("    'classic-win':");
    expect(text).toContain("('alt-win-b', 'match:win'),");
    expect(text).toContain("#   pocket-win -> plays the shipped 'win' (no PICKS row)");
    expect(text).not.toMatch(/'pocket-win':/);
  });

  it('flags two approved options in one event and two events landing on one name', () => {
    const plan = picksPlan(['app/sweep/a', 'app/sweep/b', 'classic/key/a', 'classic/enter/b']);
    expect(plan.conflicts).toContain('app/sweep');
    expect(plan.conflicts.some((c) => c.startsWith('classic-tap'))).toBe(true);
    expect(plan.rows.filter((r) => r.name === 'classic-tap')).toHaveLength(1);
  });

  it('reads ids or { id, status } rows', () => {
    expect(approvedIdsFrom(['a/b/c', { id: 'x/y/z', status: 'approved' }, { id: 'q/r/s', status: 'draft' }, { id: 't/u/v' }, 7])).toEqual(['a/b/c', 'x/y/z', 't/u/v']);
    expect(() => approvedIdsFrom({})).toThrow();
  });
});

describe('the page', () => {
  it('is in the Design group next to the Art Library', async () => {
    const { ADMIN_NAV } = await import('@/app/admin/components/admin-nav');
    const design = ADMIN_NAV.find((g) => g.title === 'Design')!;
    expect(design.items.map((i) => i.href)).toEqual(['/admin/art', '/admin/sounds']);
  });

  it('stays silent: no game sound engine, no autoplay; audio starts only from a play button', () => {
    const src = readFileSync(path.join(WEB, 'app/admin/sounds/page.tsx'), 'utf8');
    expect(src).not.toMatch(/from '@\/lib\/sounds'/);
    expect(src).not.toMatch(/autoPlay|autoplay/);
    // Every .play( call sits inside the player hook, reached from onClick handlers only.
    expect(src.match(/new Audio\(/g)).toHaveLength(1);
    expect(src.match(/player\.play\(/g)!.length).toBeGreaterThan(0);
    for (const line of src.split('\n').filter((l) => l.includes('player.play('))) expect(line).toMatch(/onClick/);
  });
});
