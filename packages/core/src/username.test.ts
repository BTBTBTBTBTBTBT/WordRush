import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  validateUsername, normalizeUsername, containsBlockedTerm, pnGuessBlocked,
  USERNAME_BLOCKED_SUBSTRINGS, USERNAME_ALLOWED_CONTAINING, USERNAME_BLOCKED_TOKENS,
} from './username';

const REPO = path.resolve(__dirname, '../../..');
const read = (p: string) => fs.readFileSync(path.join(REPO, p), 'utf8');

describe('validateUsername — shape', () => {
  it('accepts ordinary names', () => {
    for (const n of ['Brian', 'doug<3brian'.replace(/[<>]/g, ''), 'Word_Master', 'player.one', 'A1b2', 'Wordocious4821']) {
      expect(validateUsername(n).ok, `${n} should be allowed`).toBe(true);
    }
  });

  it('rejects too short / too long', () => {
    expect(validateUsername('ab').ok).toBe(false);
    expect(validateUsername('a'.repeat(21)).ok).toBe(false);
  });

  it('rejects control characters and direction overrides used to spoof names', () => {
    expect(validateUsername('bri‮an').ok).toBe(false);   // RTL override
    expect(validateUsername('bri‍an').ok).toBe(false);   // zero-width joiner
    expect(validateUsername('brian').ok).toBe(false);   // bell
  });

  it('rejects a name with no alphanumerics at all', () => {
    expect(validateUsername('...').ok).toBe(false);
    expect(validateUsername('___').ok).toBe(false);
  });
});

describe('validateUsername — content', () => {
  it('rejects every blocked term on its own', () => {
    for (const term of USERNAME_BLOCKED_SUBSTRINGS) {
      expect(validateUsername(term).ok, `${term} should be rejected`).toBe(false);
    }
  });

  it('rejects leetspeak and separator evasions', () => {
    for (const n of ['n1gg3r', 'f-u-c-k', 'C U N T', 'p0rn', 'N4ZI', 'ph1sh_rape']) {
      expect(validateUsername(n).ok, `${n} should be rejected`).toBe(false);
    }
  });

  it('rejects a term embedded in a longer name', () => {
    expect(validateUsername('xXfuckerXx').ok).toBe(false);
    expect(validateUsername('TheNaziGuy').ok).toBe(false);
  });

  it('an allowlisted word does not become a shield for a real term', () => {
    // Stripping SCUNTHORPE must leave the bare CUNT behind, not swallow it.
    expect(validateUsername('ScunthorpeCunt').ok).toBe(false);
    expect(validateUsername('Scunthorpe_Fan').ok, 'compound should pass').toBe(true);
  });

  it('does NOT reject innocent names that merely contain letters of a term', () => {
    // The Scunthorpe problem. Every one of these has bitten a real filter.
    for (const n of [
      'Cassandra',   // ASS
      'Michelle',    // HELL
      'Scunthorpe',  // the original
      'Shitake',     // near-miss on a term we DO block — see note below
      'Analyst',     // ANAL
      'Cockburn',    // COCK
      'Penistone',   // a real town
      'Titan',       // TIT
      'Dickens',     // DICK — now a tier-1 term; carrier allowlisted
      'Hitchcock',   // COCK
      'Peacock42',   // COCK with a suffix
      'Swank',       // WANK
      'TitanFall',   // TIT token would need a bare token, TITAN isn't one
      'Bass Player', // ASS inside BASS, and BASS ≠ the ASS token
      'MassEffect',  // ASS substring, tokens MASS + EFFECT
    ]) {
      expect(validateUsername(n).ok, `${n} should be allowed`).toBe(true);
    }
  });

  it('rejects the 2026-07-31 incident name and its family (tier-1 additions)', () => {
    for (const n of [
      'DamnDickCockBallsAss', // the actual rename that got through
      'damndickcockballsass', // no camel boundaries — DICK/COCK still substring-match
      'BigD1ck69',            // leet
      'C-o-c-k_Lord',         // separators
      'xXPenisXx',
    ]) {
      expect(validateUsername(n).ok, `${n} should be rejected`).toBe(false);
    }
  });

  it('rejects tier-2 words as standalone tokens but not as substrings', () => {
    for (const n of ['Ass_Master', 'Big Balls', 'DamnGoodPlayer', 'Tit.For.Tat', 'PissBoy']) {
      expect(validateUsername(n).ok, `${n} should be rejected`).toBe(false);
    }
    // Same letters, no token boundary → allowed. The deliberate trade.
    for (const n of ['Cassidy', 'Titanic', 'Sassy_Sue', 'Bassett', 'Assisi_Pilgrim']) {
      expect(validateUsername(n).ok, `${n} should be allowed`).toBe(true);
    }
  });

  it('never echoes the matched term back to the user', () => {
    const err = validateUsername('nazi').error ?? '';
    for (const term of USERNAME_BLOCKED_SUBSTRINGS) {
      expect(err.toUpperCase()).not.toContain(term);
    }
  });
});

describe('normalizeUsername', () => {
  it('collapses repeats, strips separators, undoes leet', () => {
    expect(normalizeUsername('n1iiggg3r')).toBe(normalizeUsername('niger'));
    expect(normalizeUsername('f.u.c.k')).toBe('FUCK');
  });
});

describe('ProperNoundle guess screening', () => {
  it('blocks the 2026-07-31 incident guess', () => {
    expect(pnGuessBlocked('penispenisp', 'taylorswift')).toBe(true);
    expect(pnGuessBlocked('fuckfuckfuc', 'taylorswift')).toBe(true);
  });

  it('allows ordinary name guesses', () => {
    for (const g of ['taylorswift', 'harrystyles', 'niagarafalls', 'masseffect', 'jurassicpark']) {
      expect(pnGuessBlocked(g, 'taylorswift'), `${g} should be allowed`).toBe(false);
    }
  });

  it('skips screening entirely when the ANSWER itself trips the scan', () => {
    // "Ice Spice" contains SPIC — the correct answer must always be typeable,
    // and near-guesses in that letter-space are legitimate.
    expect(containsBlockedTerm('icespice')).toBe(true);
    expect(pnGuessBlocked('icespice', 'icespice')).toBe(false);
    expect(pnGuessBlocked('acespace', 'icespice')).toBe(false);
  });

  it('every current puzzle answer remains guessable', () => {
    const puzzles = JSON.parse(read('apps/web/data/propernoundle-puzzles.json')) as { answer: string }[];
    const blocked = puzzles.filter((p) => pnGuessBlocked(p.answer, p.answer));
    expect(blocked.map((p) => p.answer)).toEqual([]);
  });
});

describe('the DB mirror', () => {
  // The trigger is the enforcement; this module is only the friendly message.
  // If they drift, a name the app rejects still lands via a direct PostgREST
  // call — or worse, a name the app allows is rejected by the server with a
  // raw Postgres error.
  const SQL = 'supabase/manual-migrations/20260805000001_username_guard_db.sql';

  it('the migration lists every term this module blocks', () => {
    const sql = read(SQL);
    const missing = USERNAME_BLOCKED_SUBSTRINGS.filter((t) => !sql.includes(`'${t}'`));
    expect(missing, `missing from ${SQL}: ${missing.join(', ')}`).toEqual([]);
  });

  it('the migration lists every innocent word this module strips', () => {
    const sql = read(SQL);
    const missing = USERNAME_ALLOWED_CONTAINING.filter((t) => !sql.includes(`'${t}'`));
    expect(missing, `missing from ${SQL}: ${missing.join(', ')}`).toEqual([]);
  });

  it('the migration lists every tier-2 token this module blocks', () => {
    const sql = read(SQL);
    const missing = USERNAME_BLOCKED_TOKENS.filter((t) => !sql.includes(`'${t}'`));
    expect(missing, `missing from ${SQL}: ${missing.join(', ')}`).toEqual([]);
  });

  it('the trigger is actually attached to profiles', () => {
    const sql = read(SQL);
    expect(sql).toContain('create trigger enforce_username_policy_trg');
    expect(sql).toContain('on public.profiles');
  });

  it('the SQL leet table matches this module, character for character', () => {
    // translate() is positional: a mismatch silently maps the wrong letter.
    const sql = read(SQL);
    const m = sql.match(/translate\(upper\(raw\),\s*'([^']+)',\s*'([^']+)'\)/s);
    expect(m, 'translate() pair not found in the migration').toBeTruthy();
    expect(m![1].length, 'leet from/to lengths differ in SQL').toBe(m![2].length);
  });
});
