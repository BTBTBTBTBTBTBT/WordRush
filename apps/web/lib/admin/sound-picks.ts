/**
 * Sound Library -> make-sounds.py PICKS (founder 10-06: "approved picks flow into make-sounds.py PICKS -> ship x3").
 * Pure: given the catalog and the candidates both reviewers approved (sound_assets.status = 'approved'), the PICKS
 * rows to paste into docs/design/brand/sounds/make-sounds.py, plus what each row means. A dry run only: nothing is
 * written. apps/web/scripts/sound-picks.ts prints it; ship-sounds.sh then ships the sounds x3.
 *
 * Naming (same rules as the shipped picks):
 * - The 'now' candidate keeps what ships: no row.
 * - An option that IS the shipped pick already ('same'): its existing row, unchanged.
 * - A name that already has a PICKS row (classic-win, intro, laugh-w ...): that row, with the new source.
 * - The app section ('Across the app') replaces the pack sound itself (tap, whoosh ...) at the jingle / UI level.
 * - A game section with a pack sound gets its own scoped name '<game>-<sound>' at the pack sound's loudness
 *   ('match:<sound>'), like the Classic picks; that game's sound scope must then play it (flagged as wiring).
 * - A silent event gets a new name '<game>-<event>' (or the event for the app section): flagged as wiring.
 */
import { SOUND_CATALOG, soundId, type SoundCandidate, type SoundCatalog, type SoundEvent } from './sound-library';

/** The pack's jingles (make-sounds.py JINGLE level); everything else is a small UI sound (UI level). */
const JINGLES = new Set(['win', 'lose', 'celebrate', 'streak', 'unlock', 'notify', 'vs', 'intro', 'levelup', 'pangram']);

export interface PickRow {
  /** The shipped name (make-sounds.py PICKS key). */
  name: string;
  /** options/<src>.m4a */
  src: string;
  /** Python literal: JINGLE, UI or 'match:<name>' (or a number kept from an existing row). */
  target: string;
  /** The comment after the row. */
  comment: string;
  /** 'same' = already ships; 'replace' = new source for an existing row; 'new' = a new row. */
  kind: 'same' | 'replace' | 'new';
  /** The game / app code must play this name (a new scoped or silent-event name). */
  wiring: boolean;
  /** The option is a shipped sound itself ('cur-win'): no PICKS row, the event just plays that sound. */
  alias?: string;
}

export interface PicksPlan {
  rows: PickRow[];
  /** Events whose approved pick is 'now' (keep what ships). */
  kept: string[];
  /** Approved ids that aren't in the catalog. */
  unknown: string[];
  /** Events with more than one approved candidate (both are listed; the founder decides). */
  conflicts: string[];
}

function targetLiteral(t: number | string, catalog: SoundCatalog): string {
  if (typeof t === 'string') return `'${t}'`;
  if (t === catalog.targets.jingle) return 'JINGLE';
  if (t === catalog.targets.ui) return 'UI';
  return String(t);
}

const levelFor = (sound: string) => (JINGLES.has(sound.replace(/^.*-/, '')) || JINGLES.has(sound) ? 'JINGLE' : 'UI');

/** One approved option -> its PICKS rows (one per grid cell). */
function rowsFor(section: string, sectionTitle: string, ev: SoundEvent, c: SoundCandidate, catalog: SoundCatalog): PickRow[] {
  const now = ev.candidates.find((x) => x.opt === 'now');
  const shipped = now?.shipped ?? null;
  const keys = c.keys ?? [];
  const label = `${sectionTitle} · ${ev.title}: ${c.letter} ${c.name}`;
  const one = (name: string, src: string, fallbackTarget: string, wiring: boolean): PickRow => {
    const existing = catalog.picks[name];
    if (existing) {
      return {
        name, src, target: targetLiteral(existing.target, catalog), comment: label,
        kind: existing.src === src ? 'same' : 'replace', wiring: false,
      };
    }
    return { name, src, target: fallbackTarget, comment: label, kind: 'new', wiring };
  };

  if (ev.grid) {
    // Grids pick a whole set: one row per cell, named after the shipped cells (laugh-w ...) or '<game>-<event>-<cell>'.
    const names = Array.isArray(shipped) && shipped.length === keys.length ? shipped : null;
    return keys.map((src, i) => {
      if (names) return one(names[i], src, 'UI', false);
      const cell = (ev.grid![i] ?? String(i + 1)).toLowerCase().replace(/[^a-z0-9]+/g, 'plus');
      const base = typeof shipped === 'string' ? shipped : null;
      return one(`${section === 'app' ? '' : `${section}-`}${ev.id}-${cell}`, src, base ? `'match:${base}'` : 'UI', true);
    });
  }

  const src = keys[0];
  if (!src) return [];
  if (src.startsWith('cur-')) {
    // An option that is a shipped sound itself (Pocket games' "The main win"): no new file, just play that sound.
    return [{ name: section === 'app' ? ev.id : `${section}-${ev.id}`, src, target: '', comment: label, kind: 'new', wiring: true, alias: src.slice(4) }];
  }
  const base = typeof shipped === 'string' ? shipped : null;
  if (base && catalog.picks[base]) return [one(base, src, 'UI', false)];
  if (section === 'app') {
    if (base) return [one(base, src, levelFor(base), false)];
    return [one(ev.id, src, levelFor(ev.id), true)];
  }
  if (base) return [one(`${section}-${base}`, src, `'match:${base}'`, true)];
  return [one(`${section}-${ev.id}`, src, 'UI', true)];
}

/** The PICKS plan for `approvedIds` (sound_assets ids with status 'approved'). */
export function picksPlan(approvedIds: readonly string[], catalog: SoundCatalog = SOUND_CATALOG): PicksPlan {
  const plan: PicksPlan = { rows: [], kept: [], unknown: [], conflicts: [] };
  const want = new Set(approvedIds);
  const known = new Set<string>();
  for (const s of catalog.sections) {
    for (const ev of s.events) {
      const approved = ev.candidates.filter((c) => want.has(soundId(s.id, ev.id, c.opt)));
      for (const c of ev.candidates) known.add(soundId(s.id, ev.id, c.opt));
      if (!approved.length) continue;
      if (approved.length > 1) plan.conflicts.push(`${s.id}/${ev.id}`);
      for (const c of approved) {
        if (c.opt === 'now') { plan.kept.push(`${s.title} · ${ev.title}`); continue; }
        plan.rows.push(...rowsFor(s.id, s.title, ev, c, catalog));
      }
    }
  }
  plan.unknown = approvedIds.filter((id) => !known.has(id));
  // Two events can land on one name (Classic "Letter key" and "Enter" both play tap): keep the first, note the rest.
  const seen = new Map<string, PickRow>();
  const rows: PickRow[] = [];
  for (const r of plan.rows) {
    const prev = seen.get(r.name);
    if (prev) {
      if (prev.src !== r.src) plan.conflicts.push(`${r.name} (${prev.src} vs ${r.src})`);
      continue;
    }
    seen.set(r.name, r);
    rows.push(r);
  }
  plan.rows = rows;
  return plan;
}

/** The plan as text: PICKS rows ready to paste, then the notes. */
export function formatPicksPlan(plan: PicksPlan): string {
  const lines: string[] = [];
  const width = Math.max(0, ...plan.rows.map((r) => r.name.length));
  lines.push('# make-sounds.py PICKS rows from the Sound Library (dry run: paste the ones you want, then run ship-sounds.sh)');
  if (!plan.rows.length) lines.push('# (no approved options)');
  for (const r of plan.rows) {
    if (r.alias) continue;
    const key = `'${r.name}':`.padEnd(width + 3);
    const mark = r.kind === 'same' ? ' [already ships]' : r.kind === 'replace' ? ' [replaces the shipped pick]' : ' [new]';
    lines.push(`    ${key} ('${r.src}', ${r.target}),  # ${r.comment}${mark}`);
  }
  const wiring = plan.rows.filter((r) => r.wiring);
  if (wiring.length) {
    lines.push('', '# Needs wiring x3 (the game / app must play these names: lib/sound-map.ts, SoundManager.swift / .kt):');
    for (const r of wiring) lines.push(`#   ${r.name}${r.alias ? ` -> plays the shipped '${r.alias}' (no PICKS row)` : ''}`);
  }
  if (plan.kept.length) lines.push('', `# Keep what ships (approved "Now"): ${plan.kept.join('; ')}`);
  if (plan.conflicts.length) lines.push('', `# Decide (more than one approved): ${plan.conflicts.join('; ')}`);
  if (plan.unknown.length) lines.push('', `# Not in the catalog (re-run export-sound-catalog.py?): ${plan.unknown.join(', ')}`);
  return lines.join('\n');
}

/** Approved ids from the JSON the script reads: an array of ids, or rows with { id, status }. */
export function approvedIdsFrom(json: unknown): string[] {
  if (!Array.isArray(json)) throw new Error('expected a JSON array of ids or of { id, status } rows');
  return json.flatMap((x) => {
    if (typeof x === 'string') return [x];
    if (x && typeof x === 'object' && typeof (x as { id?: unknown }).id === 'string') {
      const st = (x as { status?: unknown }).status;
      return st === undefined || st === 'approved' ? [(x as { id: string }).id] : [];
    }
    return [];
  });
}
