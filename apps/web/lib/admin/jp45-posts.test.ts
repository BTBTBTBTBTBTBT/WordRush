import { describe, expect, it } from 'vitest';
import {
  createInitialState, generateDailySeed, GameMode, initDictionary, initDictionaryForLength,
} from '@wordle-duel/core';
import { wordOfDay, parseDateKey } from '@/lib/word-of-day';
import a5 from '@/data/allowed.json';
import s5 from '@/data/solutions.json';
import l5 from '@/data/solutions-legacy.json';
import a6 from '@/data/allowed-6.json';
import s6 from '@/data/solutions-6.json';
import l6 from '@/data/solutions-6-legacy.json';
import a7 from '@/data/allowed-7.json';
import s7 from '@/data/solutions-7.json';
import l7 from '@/data/solutions-7-legacy.json';
import plan from './jp45-posts.json';
import {
  PLATFORM_INFO, captionBudget, countChars, finalText, isPlatform, targetSlug, trackedUrl, type Platform,
} from './studio';

/**
 * JP's 45-day plan as Social Studio drafts (jp45-posts.json -> docs/sql/20261014-jp45-posts.sql). These tests pin
 * the brand rules from the plan (no emoji, no competitor names, American spelling, exact Pro prices, never a
 * puzzle answer) and every platform's caption budget, so an edited caption cannot quietly break either.
 */
interface PlanPost {
  id: string; title: string; kind: string; date: string; time: string; slot: string; hashtags: string[];
  link_target: string; paused: boolean; wotd: { date: string; word: string; answer: string } | null; note: string | null;
  targets: { platform: string; caption: string }[];
}
const posts = (plan as { posts: PlanPost[] }).posts;

describe('jp45 plan: structure', () => {
  it('has unique ids and slugs, all inside Oct 15 - Nov 29', () => {
    expect(new Set(posts.map((p) => p.id)).size).toBe(posts.length);
    const slugs = posts.flatMap((p) => p.targets.map((t) => targetSlug(p.id, t.platform as Platform)));
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const p of posts) {
      expect(p.date >= '2026-10-15' && p.date <= '2026-11-29').toBe(true);
      expect(p.time).toMatch(/^\d\d:\d\d$/);
      expect(p.targets.length).toBeGreaterThan(0);
      for (const t of p.targets) expect(isPlatform(t.platform)).toBe(true);
    }
  });

  it('every video slot is a paused "[Needs capture]" TikTok + Instagram draft', () => {
    const videos = posts.filter((p) => p.slot === 'video');
    expect(videos.length).toBeGreaterThan(20);
    for (const v of videos) {
      expect(v.kind).toBe('video');
      expect(v.paused).toBe(true);
      expect(v.title.startsWith('[Needs capture] ')).toBe(true);
      expect(v.targets.map((t) => t.platform)).toEqual(['tiktok', 'instagram']);
    }
  });

  it('three pins per Pinterest day', () => {
    const byDay = new Map<string, number>();
    for (const p of posts.filter((x) => x.slot === 'pin')) byDay.set(p.date, (byDay.get(p.date) ?? 0) + 1);
    for (const n of Array.from(byDay.values())) expect(n).toBe(3);
  });

  it('a caption with a [BRACKET] placeholder belongs to a paused post', () => {
    for (const p of posts) {
      if (p.targets.some((t) => /\[[A-Z ]+\]/.test(t.caption))) expect(p.paused, p.title).toBe(true);
    }
  });
});

describe('jp45 plan: captions', () => {
  it('fit every platform budget (X counts the tracked link as 23)', () => {
    for (const p of posts) {
      for (const t of p.targets) {
        const platform = t.platform as Platform;
        const link = trackedUrl(targetSlug(p.id, platform));
        const b = captionBudget(platform, t.caption, p.hashtags, link);
        expect(b.over, `${p.date} ${p.title} ${platform}: ${b.used}/${b.limit}`).toBe(false);
        if (platform === 'x') {
          expect(countChars('x', `${t.caption}\n\n${link}`), `${p.date} X caption + link`).toBeLessThanOrEqual(260);
        }
      }
    }
  });

  it('brand voice: no emoji, no competitor names, American spelling, exact Pro prices', () => {
    const emoji = /\p{Extended_Pictographic}/u;
    const competitors = /wordle|\bnyt\b|new york times|quordle|octordle|heardle|connections/i;
    const british = /\b(colour|favourite|centre|neighbour|grey|realise|organise|recognise|travelling|cancelled|programme|whilst|learnt)\w*/i;
    for (const p of posts) {
      const text = [p.title, ...p.targets.map((t) => t.caption), ...p.hashtags].join('\n');
      expect(emoji.test(text), `${p.title}: emoji`).toBe(false);
      expect(competitors.test(text), `${p.title}: competitor`).toBe(false);
      expect(british.test(text), `${p.title}: spelling`).toBe(false);
      for (const m of Array.from(text.matchAll(/\$\d[\d.,]*/g))) {
        expect(['$6.99', '$59.99', '$1', '$5'], `${p.title}: ${m[0]}`).toContain(m[0]);
      }
    }
  });

  it('the plan hashtag spine is on every post', () => {
    for (const p of posts) {
      expect(p.hashtags.includes('wordgames') || p.hashtags.includes('halloween') || p.hashtags.includes('wordocious'), p.title).toBe(true);
      expect(p.hashtags.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('WOTD answer choices are never revealed in the caption text itself', () => {
    for (const p of posts.filter((x) => x.wotd)) {
      for (const t of p.targets) expect(/answer\s*:\s*\(?[abc]\)?\b/i.test(t.caption), p.title).toBe(false);
    }
  });
});

describe('jp45 plan: Word of the Day quiz days', () => {
  it('the word matches the app and is not that day\'s puzzle answer in any daily', async () => {
    initDictionary(a5 as string[], s5 as string[], l5 as string[]);
    initDictionaryForLength(6, a6 as string[], s6 as string[], l6 as string[]);
    initDictionaryForLength(7, a7 as string[], s7 as string[], l7 as string[]);
    const modes = [GameMode.DUEL, GameMode.QUORDLE, GameMode.OCTORDLE, GameMode.SEQUENCE, GameMode.RESCUE, GameMode.GAUNTLET,
      GameMode.PROPERNOUNDLE, GameMode.DUEL_6, GameMode.DUEL_7];
    const days = posts.filter((p) => p.wotd);
    expect(days.length).toBeGreaterThanOrEqual(7);
    for (const p of days) {
      const w = p.wotd!;
      expect(w.date).toBe(p.date);
      const entry = await wordOfDay(parseDateKey(w.date)!);
      expect(entry.word.toUpperCase(), `${p.date} WOTD`).toBe(w.word);
      const answers = new Set<string>();
      for (const m of modes) {
        const st = createInitialState(generateDailySeed(w.date, m), m) as { boards?: { solution: string }[] };
        for (const b of st.boards ?? []) answers.add(b.solution.toUpperCase());
      }
      expect(answers.has(w.word), `${p.date}: ${w.word} is a puzzle answer that day`).toBe(false);
      // The post leads with the word, and the evening answer is one of a/b/c.
      expect(p.targets.every((t) => t.caption.includes(w.word))).toBe(true);
      expect(['a', 'b', 'c']).toContain(w.answer);
    }
  });
});

describe('jp45 plan: sanity on the helpers it relies on', () => {
  it('finalText puts the link in text only where the platform carries it there', () => {
    const link = 'https://wordocious.com/go/p-12345678-x';
    expect(finalText('x', 'Hi', ['a'], link)).toContain(link);
    expect(finalText('instagram', 'Hi', ['a'], link)).not.toContain(link);
    expect(PLATFORM_INFO.pinterest.link).toBe('field');
  });
});
