import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * No system ("phone") emoji in the app UI (FINISH_SPEC AL addendum 2 + AM3; founder 10-02:
 * "No phone emojis anywhere on the app … match the aesthetic"). Every icon the player sees is
 * our own 3D art (Icon3D, badgeSrc sprites, medal art, art-react-*) or plain words.
 *
 * This scans the code in app/, components/, lib/ and hooks/ (string literals, JSX text and
 * `\u{…}` escapes; comments are ignored) for emoji. Emoji are allowed ONLY in plain-text
 * channels that cannot show images — the files in ALLOW below. Keep that list tight: a file
 * belongs there only when every emoji in it ends up in a push notification, an email, or the
 * text of a share / invite message.
 *
 * Not flagged: typographic glyphs that are text by default (✓ ✗ ✕ ★ ✦ → ↗ © …). Flagged: any
 * emoji-presentation character, any pictograph forced to emoji with U+FE0F, and anything in the
 * U+1F000–U+1FAFF emoji planes (🛡, 🏛 and friends render as emoji on phones even without FE0F).
 */
const ROOT = join(__dirname, '..');
const DIRS = ['app', 'components', 'lib', 'hooks'].map((d) => join(ROOT, d));

/** Plain-text channels, by path relative to apps/web. */
const ALLOW: Record<string, string> = {
  // Push notification bodies (server routes; text only).
  'app/api/admin/push/test/route.ts': 'admin test push title',
  'app/api/cron/daily-reminder/route.ts': 'daily reminder push titles',
  'app/api/cron/friends-recap/route.ts': 'weekly friends race push titles',
  'app/api/friends/accept/route.ts': 'friend request accepted push',
  'app/api/friends/gift-shield/route.ts': 'streak shield gift push',
  'app/api/friends/react/route.ts': 'reaction push text (REACTIONS key → emoji in the push body only)',
  'app/api/friends/remind/route.ts': 'friend request reminder push',
  'app/api/friends/request/route.ts': 'friend request push',
  'lib/referral-service.ts': '"Your invite worked" push title',
  // Share / invite message text (navigator.share / clipboard / SMS text).
  'lib/invite-screens.ts': 'gift-invite message text',
  'lib/share-utils.ts': 'the emoji result grid in share text',
};

/** Emoji: emoji-presentation chars, any pictograph + VS16, anything in the 1F000–1FAFF planes. */
const EMOJI = /\p{Emoji_Presentation}|\p{Extended_Pictographic}\uFE0F|[\u{1F000}-\u{1FAFF}]/u;

function* walk(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { if (name !== 'node_modules' && name !== '.next') yield* walk(p); }
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) yield p;
  }
}

/** Source with comments removed and \u escapes decoded, so `'\u{1F525}'` counts like '🔥'. */
function codeOf(text: string): string[] {
  const noBlock = text.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlock.split('\n').map((line) => {
    const t = line.trimStart();
    if (t.startsWith('//')) return '';
    const i = line.search(/\s\/\/\s/);
    const code = i >= 0 ? line.slice(0, i) : line;
    return code
      .replace(/\\u\{([0-9a-fA-F]{1,6})\}/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
      .replace(/\\u([dD][89abAB][0-9a-fA-F]{2})\\u([dD][c-fC-F][0-9a-fA-F]{2})/g, (_, a, b) => String.fromCharCode(parseInt(a, 16), parseInt(b, 16)))
      .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  });
}

describe('no system emoji in the app UI', () => {
  it('the scanner flags emoji and ignores typographic glyphs and comments', () => {
    const hit = (s: string) => codeOf(s).some((l) => EMOJI.test(l));
    expect(hit("const a = 'Sent 😈';")).toBe(true);
    expect(hit("const a = '\\u{1F525}';")).toBe(true);
    expect(hit("const a = 'Challenge ⚔️';")).toBe(true);
    expect(hit("const a = '\\u{1F6E1}';")).toBe(true);
    expect(hit("const a = '⚡';")).toBe(true);
    expect(hit("const a = '✓ done → next ★ ✦ © ✕';")).toBe(false);
    expect(hit('// a comment 🔥')).toBe(false);
    expect(hit("const a = 1; // trailing 🔥")).toBe(false);
    expect(hit('{/* jsx comment 🔥 */}')).toBe(false);
  });

  it('has no emoji in app/, components/, lib/, hooks/ outside the plain-text allowlist', () => {
    const hits: string[] = [];
    for (const file of DIRS.flatMap((d) => [...walk(d)])) {
      const rel = relative(ROOT, file).split('\\').join('/');
      if (rel in ALLOW) continue;
      codeOf(readFileSync(file, 'utf8')).forEach((line, i) => {
        if (EMOJI.test(line)) hits.push(`${rel}:${i + 1}: ${line.trim().slice(0, 100)}`);
      });
    }
    expect(hits, `System emoji in UI code (${hits.length}) — use Icon3D / badgeSrc art or plain words:\n${hits.join('\n')}`).toEqual([]);
  });

  it('every allowlisted file still exists (drop stale entries)', () => {
    for (const rel of Object.keys(ALLOW)) expect(() => statSync(join(ROOT, rel)), rel).not.toThrow();
  });
});
