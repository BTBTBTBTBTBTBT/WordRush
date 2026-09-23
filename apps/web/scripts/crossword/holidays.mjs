// Crosswordocious holiday calendar (founder, 2026-09-23: every major themed
// holiday and every US day off work gets its own themed puzzle ON its date).
// The daily scheduler in the real bank builder asks `holidayFor(day)` first;
// when it returns a key, that day's puzzle is drawn from the theme whose
// `holiday` field matches, otherwise from the evergreen rotation.
//
// Fixed-date and weekday-rule holidays are computed. Holidays that follow the
// Hebrew, lunar or Hindu calendars are TABLED for 2026–2030 (first full day in
// the US); the table must be checked against a published calendar before the
// bank is frozen and extended before 2031 (the runway test will fail first).
const pad = (n) => String(n).padStart(2, '0');
const ymd = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
const nthWeekday = (y, m, weekday, n) => { const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay(); const d = 1 + ((weekday - first + 7) % 7) + (n - 1) * 7; return ymd(y, m, d); };
const lastWeekday = (y, m, weekday) => { const last = new Date(Date.UTC(y, m, 0)); const back = (last.getUTCDay() - weekday + 7) % 7; return ymd(y, m, last.getUTCDate() - back); };
export function easter(y) { // Anonymous Gregorian computus
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1; return new Date(Date.UTC(y, month - 1, day));
}
const shift = (date, days) => { const d = new Date(date); d.setUTCDate(d.getUTCDate() + days); return ymd(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()); };

// Verify these five against a published calendar before freezing the bank.
const TABLED = {
  lunarnewyear: { 2026: '2026-02-17', 2027: '2027-02-06', 2028: '2028-01-26', 2029: '2029-02-13', 2030: '2030-02-03' },
  passover:     { 2026: '2026-04-02', 2027: '2027-04-22', 2028: '2028-04-11', 2029: '2029-03-31', 2030: '2030-04-18' },
  diwali:       { 2026: '2026-11-08', 2027: '2027-10-29', 2028: '2028-10-17', 2029: '2029-11-05', 2030: '2030-10-26' },
  hanukkah:     { 2026: '2026-12-05', 2027: '2027-12-25', 2028: '2028-12-13', 2029: '2029-12-02', 2030: '2030-12-21' },
};

/** Every holiday theme key → the dates it owns in year y (a key may own several consecutive days). */
export function holidayDays(y) {
  const E = easter(y), out = {};
  const add = (key, ...days) => { for (const d of days) out[d] = key; };
  add('newyear', ymd(y, 1, 1));
  add('mlkday', nthWeekday(y, 1, 1, 3));
  add('groundhog', ymd(y, 2, 2));
  add('valentines', ymd(y, 2, 14));
  add('presidents', nthWeekday(y, 2, 1, 3));
  add('mardigras', shift(E, -47));
  if (new Date(Date.UTC(y, 1, 29)).getUTCMonth() === 1) add('leapday', ymd(y, 2, 29));   // once in four years, so it outranks Mardi Gras (they collide in 2028)
  add('stpatricks', ymd(y, 3, 17));
  add('aprilfools', ymd(y, 4, 1));
  add('easter', shift(E, -2), shift(E, 0));           // Good Friday and Easter Sunday
  add('earthday', ymd(y, 4, 22));
  add('cincodemayo', ymd(y, 5, 5));
  add('mothersday', nthWeekday(y, 5, 0, 2));
  add('memorial', lastWeekday(y, 5, 1));
  add('fathersday', nthWeekday(y, 6, 0, 3));
  add('juneteenth', ymd(y, 6, 19));
  add('july4', ymd(y, 7, 4));
  add('labor', nthWeekday(y, 9, 1, 1));
  add('indigenous', nthWeekday(y, 10, 1, 2));
  add('halloween', ymd(y, 10, 30), ymd(y, 10, 31));
  add('veterans', ymd(y, 11, 11));
  const tg = nthWeekday(y, 11, 4, 4); add('thanksgiving', shift(new Date(tg), -1), tg);
  add('christmas', ymd(y, 12, 24), ymd(y, 12, 25), ymd(y, 12, 26));
  add('kwanzaa', ymd(y, 12, 27));                     // Kwanzaa runs Dec 26 – Jan 1; Boxing Day stays with Christmas
  add('newyear', ymd(y, 12, 31));
  for (const [key, table] of Object.entries(TABLED)) if (table[y]) add(key, table[y]);
  return out;
}
export const HOLIDAY_KEYS = ['newyear', 'mlkday', 'groundhog', 'valentines', 'presidents', 'leapday', 'mardigras', 'stpatricks', 'aprilfools', 'easter', 'earthday', 'cincodemayo', 'mothersday', 'memorial', 'fathersday', 'juneteenth', 'july4', 'labor', 'indigenous', 'halloween', 'veterans', 'thanksgiving', 'christmas', 'kwanzaa', 'lunarnewyear', 'passover', 'diwali', 'hanukkah'];
/** The holiday key that owns a YYYY-MM-DD day, or null. */
export function holidayFor(day) { return holidayDays(+day.slice(0, 4))[day] ?? null; }

if (process.argv[1] && process.argv[1].endsWith('holidays.mjs')) {
  const y = +(process.argv[2] || new Date().getFullYear());
  const days = holidayDays(y);
  for (const d of Object.keys(days).sort()) console.log(d, days[d]);
  console.log(`${Object.keys(days).length} holiday days in ${y} across ${new Set(Object.values(days)).size} themes`);
}
