// Shared helpers for the content-audit fix scripts (2026-10-06, REPORT-CONTENT-FIXES.md).
import { readJSON } from '../more-games/lib.mjs';
import path from 'node:path';
import { DATA } from '../more-games/lib.mjs';

export const EPOCH = '2026-09-23';
const holidayDays = readJSON(path.join(DATA, 'holiday-days.json')).days;
const dayOf = (k) => new Date(Date.parse(`${EPOCH}T00:00:00Z`) + k * 86400000).toISOString().slice(0, 10);

/**
 * Every entry of an epoch bank that may still change: dailies dated on/after `from`, the whole
 * Unlimited pool, and holiday entries never served before `from` (entry k of a holiday is served
 * on that holiday's occurrences ≡ k mod n — the same rule as bankHolidayPick). Returns
 * { p, where, date } with `p` the live object (edit in place).
 */
export function liveFrom(bank, from) {
  const out = [];
  bank.daily.forEach((p, i) => { const date = dayOf(i); if (date >= from) out.push({ p, where: `daily#${i}`, date }); });
  (bank.extra ?? []).forEach((p, i) => out.push({ p, where: `unlimited#${i}`, date: null }));
  for (const [key, list] of Object.entries(bank.holiday ?? {})) {
    const days = Object.keys(holidayDays).filter((d) => holidayDays[d] === key).sort();
    list.forEach((p, i) => {
      const mine = days.filter((_, k) => k % list.length === i);
      if (mine.some((d) => d >= EPOCH && d < from)) return; // already served
      out.push({ p, where: `holiday:${key}#${i}`, date: mine.find((d) => d >= from) ?? null });
    });
  }
  return out;
}

/**
 * base64 → text. Offensive words are never written in plain text in these scripts (content-safety policy);
 * they are stored base64 and decoded here.
 */
export const dec = (x) => (Array.isArray(x) ? x.map(dec) : Buffer.from(x, 'base64').toString('utf8'));
/** A content-audit.json flag's word (masked in the file when offensive; the original rides in word_b64). */
export const flagWord = (f) => (f.word_b64 ? dec(f.word_b64) : f.word);
