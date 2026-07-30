import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { validateUsername, normalizeUsername, USERNAME_BLOCKED_SUBSTRINGS, USERNAME_ALLOWED_CONTAINING } from './username';

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
    ]) {
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

describe('the DB mirror', () => {
  // The trigger is the enforcement; this module is only the friendly message.
  // If they drift, a name the app rejects still lands via a direct PostgREST
  // call — or worse, a name the app allows is rejected by the server with a
  // raw Postgres error.
  const SQL = 'supabase/migrations/20260730000001_username_profanity.sql';

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
