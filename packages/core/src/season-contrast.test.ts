import { describe, expect, it } from 'vitest';
import registry from './season-registry.json';
import { contrastRatio, over, parseColor, type RGBA } from './contrast';

// Season palette tokens meet WCAG AA on the surfaces they are painted on (season-registry.json `_doc`),
// for EVERY season in the registry — a new season is checked with no edit here. The windows are
// translucent (card / hero at their opacity over the season wall), so each ink is checked over the
// window laid on every wall stop the season can show: the dark stops always, the light stops too
// unless the season's tone is 'dark' (which keeps the dark wall in every scheme).
// Ports: apps/web/lib/season-contrast.test.ts, iOS SeasonContrastTests, Android SeasonContrastTest.

interface Surfaces {
  tone?: 'dark' | 'light';
  card?: string;
  cardOpacity?: number;
  hero?: string;
  heroOpacity?: number;
  raised?: string;
  text?: string;
  textMuted?: string;
  textSecondary?: string;
  headline?: string[];
  /** The accent as INK on the light walls / under white (a11y review 10-16 #11: thanksgiving's #F0824A accent is 2.1-2.6:1 as text). */
  accentText?: string;
  /** Time of day (10-16): a `tone: "light"` entry flips only the ON-WALL chrome ink dark (never the card tone). */
  tod?: Partial<Record<'morning' | 'day' | 'evening', { tone?: 'dark' | 'light' }>>;
}
interface Season {
  id: string;
  palette: { accent: string; buttonTint: string; quietTint: string; wallLight: string[]; wallDark: string[] };
  surfaces?: Surfaces;
}

const SEASONS = (registry as unknown as { seasons: Season[] }).seasons;
/** The dark on-wall chrome ink (web --season-wall-ink, iOS SeasonSurface.wallInk, Android SeasonSurfaces.WALL_INK_DARK). */
const WALL_INK_DARK = '#1B1230';
const AA = 4.5;
const AA_LARGE = 3;

const rgba = (hex: string, a = 1): RGBA => {
  const c = parseColor(hex)!;
  return [c[0], c[1], c[2], a];
};

/** The window color over each wall stop it can sit on. */
function windowOver(fill: string, opacity: number, s: Season): { wall: string; bg: RGBA }[] {
  const walls = s.surfaces?.tone === 'dark' ? s.palette.wallDark : [...s.palette.wallDark, ...s.palette.wallLight];
  return walls.map((w) => ({ wall: w, bg: over(rgba(fill, opacity), rgba(w)) }));
}

describe('season palette tokens meet WCAG AA on their surfaces', () => {
  it('the registry has seasons to check', () => {
    expect(SEASONS.length).toBeGreaterThan(0);
  });

  for (const s of SEASONS) {
    const sf = s.surfaces;
    if (!sf) continue;
    describe(s.id, () => {
      const windows: { name: string; fill: string; opacity: number }[] = [];
      if (sf.card) windows.push({ name: 'card', fill: sf.card, opacity: sf.cardOpacity ?? 1 });
      if (sf.hero ?? sf.card) windows.push({ name: 'hero', fill: (sf.hero ?? sf.card)!, opacity: sf.hero ? sf.heroOpacity ?? 1 : sf.cardOpacity ?? 1 });
      if (sf.raised) windows.push({ name: 'raised', fill: sf.raised, opacity: 1 });

      const inks = (['text', 'textSecondary', 'textMuted'] as const).filter((k) => sf[k]);
      for (const w of windows) {
        for (const ink of inks) {
          it(`${ink} ${sf[ink]} on the ${w.name} (${w.fill} @${w.opacity}) clears ${AA}:1 over every wall stop`, () => {
            for (const { wall, bg } of windowOver(w.fill, w.opacity, s)) {
              const r = contrastRatio(sf[ink]!, bg);
              expect(r, `${ink} on ${w.name} over wall ${wall}`).toBeGreaterThanOrEqual(AA);
            }
          });
        }
      }

      // The hero greeting is display lettering (large): its top / nameTop faces clear 3:1 on the hero.
      if (sf.headline?.length === 5 && windows.some((w) => w.name === 'hero')) {
        const hero = windows.find((w) => w.name === 'hero')!;
        for (const [i, name] of [[0, 'top'], [3, 'nameTop']] as const) {
          it(`headline ${name} ${sf.headline[i]} clears ${AA_LARGE}:1 on the hero`, () => {
            for (const { wall, bg } of windowOver(hero.fill, hero.opacity, s)) {
              expect(contrastRatio(sf.headline![i], bg), `headline ${name} over wall ${wall}`).toBeGreaterThanOrEqual(AA_LARGE);
            }
          });
        }
      }

      // A season whose accent is not a text color names a darker accentText: body ink on every light wall, and a fill under white.
      if (sf.accentText) {
        it(`accentText ${sf.accentText} clears ${AA}:1 on the light walls and under white`, () => {
          for (const wall of s.palette.wallLight) expect(contrastRatio(sf.accentText!, wall), `accentText on wall ${wall}`).toBeGreaterThanOrEqual(AA);
          expect(contrastRatio('#ffffff', sf.accentText!), 'white on accentText').toBeGreaterThanOrEqual(AA);
        });
      }

      // Time of day: a time whose sky is light (tod.<t>.tone = "light") draws the on-wall chrome in WALL_INK_DARK. It must read on the
      // season's light wall stops (body 4.5:1); the REAL per-time wall pixels are checked by apps/web/lib/wall-ink-contrast.test.ts.
      const lightTimes = (['morning', 'day', 'evening'] as const).filter((t) => sf.tod?.[t]?.tone === 'light');
      if (lightTimes.length) {
        it(`WALL_INK_DARK ${WALL_INK_DARK} (used at ${lightTimes.join(' + ')}) clears ${AA}:1 on the light wall stops`, () => {
          for (const wall of s.palette.wallLight) expect(contrastRatio(WALL_INK_DARK, wall), `wall ink on ${wall}`).toBeGreaterThanOrEqual(AA);
        });
      }

      // The season's button tint is a filled control (non-text UI, 3:1) on the card; on a dark-tone
      // season the accent doubles as link / highlight ink on the card (large or bold → 3:1).
      if (sf.card) {
        for (const key of ['buttonTint', 'accent'] as const) {
          it(`palette ${key} ${s.palette[key]} clears ${AA_LARGE}:1 on the card`, () => {
            for (const { wall, bg } of windowOver(sf.card!, sf.cardOpacity ?? 1, s)) {
              expect(contrastRatio(s.palette[key], bg), `${key} on card over wall ${wall}`).toBeGreaterThanOrEqual(AA_LARGE);
            }
          });
        }
      }
    });
  }
});
