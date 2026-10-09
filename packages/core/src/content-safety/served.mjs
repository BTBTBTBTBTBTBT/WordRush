// Which entries of a content file have ALREADY been served (or bundled in shipped store builds) before
// `from` (CONTENT_RELEASE_DATE): those must never change. Shared by apps/web/scripts/content-snapshot.mjs
// (writes served-snapshot.json) and content-check.test.ts (compares against it). Mirrors the date math in
// bank.ts (epoch index, holiday k-th outing ≡ entry k mod n) and ProperNoundle's category rotation
// (apps/web/components/propernoundle/puzzle-service.ts).
import { createHash } from 'node:crypto';

export const BANK_EPOCH = '2026-09-23';
const DAY = 86400000;
const dayOf = (epoch, k) => new Date(Date.parse(`${epoch}T00:00:00Z`) + k * DAY).toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY);
export const sha = (v) => createHash('sha256').update(JSON.stringify(v)).digest('hex').slice(0, 16);

function holidayServed(holiday, days, from, since) {
  const out = [];
  for (const [key, list] of Object.entries(holiday ?? {})) {
    const dates = Object.keys(days).filter((d) => days[d] === key).sort();
    list.forEach((p, i) => {
      const served = dates.filter((_, k) => k % list.length === i).filter((d) => d >= since && d < from);
      if (served.length) out.push({ key: `holiday:${key}#${i}`, first: served[0], value: p });
    });
  }
  return out;
}
/** [{ key, first, value }] of served entries for a registered file, by schema. */
export function servedEntries(schema, json, { from, holidayDays }) {
  if (schema === 'epoch-bank') {
    const n = Math.max(0, Math.min(json.daily.length, daysBetween(BANK_EPOCH, from)));
    return [...json.daily.slice(0, n).map((p, i) => ({ key: `daily#${i}`, first: dayOf(BANK_EPOCH, i), value: p })),
      ...holidayServed(json.holiday, holidayDays, from, BANK_EPOCH)];
  }
  if (schema === 'pool' || schema === 'pool-frozen') return [{ key: 'pool', first: null, value: json }];
  if (schema === 'propernoundle') {
    const PN_EPOCH = '2024-01-01';
    const pool = json.filter((p) => p.answer.length <= 15);
    const cats = new Map(); for (const p of pool) { const c = p.themeCategory || 'general'; if (!cats.has(c)) cats.set(c, []); cats.get(c).push(p); }
    const cycle = [...cats.keys()].sort();
    const first = new Map();
    for (let n = 0, d = PN_EPOCH; d < from; n++, d = dayOf(PN_EPOCH, n)) {
      if (holidayDays[d] && holidayDays.__pnHoliday?.has(holidayDays[d])) continue;
      const list = cats.get(cycle[n % cycle.length]); const p = list[Math.floor(n / cycle.length) % list.length];
      if (!first.has(p.id)) first.set(p.id, d);
    }
    return json.filter((p) => first.has(p.id)).map((p) => ({ key: p.id, first: first.get(p.id), value: p }));
  }
  if (schema === 'propernoundle-holidays') return holidayServed(json.holiday, holidayDays, from, BANK_EPOCH);
  return [];
}
