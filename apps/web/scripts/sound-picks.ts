/**
 * Sound Library -> make-sounds.py PICKS rows (dry run: prints, writes nothing).
 *
 *   apps/server/node_modules/.bin/tsx apps/web/scripts/sound-picks.ts approved.json
 *   psql "$DB" -Atc "select json_agg(id) from public.sound_assets where status = 'approved'" | apps/server/node_modules/.bin/tsx apps/web/scripts/sound-picks.ts -
 *   apps/server/node_modules/.bin/tsx apps/web/scripts/sound-picks.ts docs/design/brand/sounds/approved.example.json   # the sample
 *
 * Input: a JSON array of sound_assets ids, or of { id, status } rows (only 'approved' ones count). Paste the rows
 * you want into docs/design/brand/sounds/make-sounds.py PICKS, then run ship-sounds.sh to ship them x3.
 */
import { readFileSync } from 'node:fs';
import { approvedIdsFrom, formatPicksPlan, picksPlan } from '../lib/admin/sound-picks';

const arg = process.argv[2];
if (!arg) {
  console.error('usage: apps/server/node_modules/.bin/tsx apps/web/scripts/sound-picks.ts <approved.json | ->');
  process.exit(2);
}
const text = arg === '-' ? readFileSync(0, 'utf8') : readFileSync(arg, 'utf8');
console.log(formatPicksPlan(picksPlan(approvedIdsFrom(JSON.parse(text.trim() || '[]')))));
