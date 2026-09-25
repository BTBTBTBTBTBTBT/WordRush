// Collects CANDIDATE vintage single-panel cartoons from Wikimedia Commons for
// the Muddle sample round. Records, per image: the file page, the license
// Commons states, the date and artist it records, and a thumbnail URL. NOTHING
// is downloaded — the review gallery links to Commons — and nothing here is a
// legal determination: a human confirms each keeper's status (US: published
// before 1931 as of 2026; UK works also need the artist dead 70+ years).
//   node scripts/muddle/collect-vintage.mjs
import { writeSample } from '../more-games/lib.mjs';
const UA = 'WordociousPhase0/1.0 (https://wordocious.com; bt@showloud.com)';
const CATS = ['Punch magazine cartoons', 'Puck, 1900s', 'Puck, 1910s', 'Prehistoric Peeps'];
const api = async (params) => (await fetch('https://commons.wikimedia.org/w/api.php?' + new URLSearchParams({ format: 'json', origin: '*', ...params }), { headers: { 'User-Agent': UA } })).json();
const strip = (h) => (h || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
const out = [];
for (const cat of CATS) {
  const r = await api({ action: 'query', generator: 'categorymembers', gcmtitle: `Category:${cat}`, gcmtype: 'file', gcmlimit: '60',
    prop: 'imageinfo', iiprop: 'url|extmetadata|size|mime', iiurlwidth: '480' });
  for (const p of Object.values(r.query?.pages || {})) {
    const ii = p.imageinfo?.[0]; if (!ii || !/image\/(jpeg|png)/.test(ii.mime)) continue;
    const m = ii.extmetadata || {}, lic = strip(m.LicenseShortName?.value), date = strip(m.DateTimeOriginal?.value);
    const year = Number((date.match(/\b(1[6-9]\d\d)\b/) || [])[1]) || null;
    const ratio = ii.width / ii.height;
    out.push({ category: cat, title: p.title, page: ii.descriptionurl, thumb: ii.thumburl, width: ii.width, height: ii.height,
      licence: lic, year, artist: strip(m.Artist?.value).slice(0, 80), description: strip(m.ImageDescription?.value).slice(0, 200),
      // First-pass screen only: stated public-domain license, dated before 1931, roughly landscape or squarish single panel.
      passesFirstScreen: /public domain|PD/i.test(lic) && year !== null && year < 1931 && ratio > 0.7 && ratio < 2.2 && ii.width >= 600 });
  }
}
const pass = out.filter((x) => x.passesFirstScreen);
console.log(`collected ${out.length} files from ${CATS.length} categories; ${pass.length} pass the first screen (PD license stated, dated < 1931, single-panel shape)`);
const byLic = {}; for (const x of out) byLic[x.licence || '(none)'] = (byLic[x.licence || '(none)'] || 0) + 1; console.log('licenses seen:', byLic);
for (const x of pass.slice(0, 8)) console.log(`  ${x.year} ${x.licence} — ${x.title.slice(0, 70)}`);
console.log('wrote', writeSample('muddle-vintage-candidates.json', { generatedBy: 'apps/web/scripts/muddle/collect-vintage.mjs', note: 'Candidates only. License text is what Commons states; verify each keeper before use.', candidates: pass, screenedOut: out.length - pass.length }));
