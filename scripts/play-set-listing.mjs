#!/usr/bin/env node
// Set the Play store listing (en-US title/descriptions) via the publisher API.
//
//   node scripts/play-set-listing.mjs            # write the listing + commit
//   node scripts/play-set-listing.mjs --dry-run  # everything except the commit
//   node scripts/play-set-listing.mjs --print    # print the parsed text + lengths, no network
//
// The short + full description are read from docs/store/listing-2.7.md (the same text the
// App Store uses), so the two stores tell the same story. Graphics (icon,
// feature graphic, screenshots) are NOT set here — the console upload UI is
// fine for one-time assets and screenshots should come from a real device.
//
// Whether the service account may edit listings depends on its Play Console
// permissions ("Manage store presence"); a 403 here means do it by hand in
// Play Console -> Store presence -> Main store listing with the same text.

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';

const PACKAGE = 'com.wordocious.app';
const KEY_FILE =
  process.env.PLAY_SERVICE_ACCOUNT || `${os.homedir()}/.android-keys/play-publisher.json`;
const SCOPE = 'https://www.googleapis.com/auth/androidpublisher';
const API = 'https://androidpublisher.googleapis.com/androidpublisher/v3';

const dryRun = process.argv.includes('--dry-run');

const TITLE = 'Wordocious: Daily Word Games'; // 28 chars (max 30)

// SHORT + FULL come from the store listing doc (the single source of truth for both stores).
// Override with LISTING_DOC=path. The doc hard-wraps prose at ~120 columns; those wraps are
// joined back into paragraphs here (bullets, ALL-CAPS headings and blank lines stay as lines).
const LISTING_DOC = process.env.LISTING_DOC
  || new URL('../docs/store/listing-2.7.md', import.meta.url).pathname;

function section(md, heading) {
  const lines = md.split('\n');
  const i = lines.findIndex((l) => l.startsWith('## ') && l.includes(heading));
  if (i < 0) fail(`listing doc: no "## ${heading}" section`);
  const out = [];
  for (const l of lines.slice(i + 1)) {
    if (l.startsWith('## ')) break;
    out.push(l);
  }
  return out;
}

export function unwrapListing(lines) {
  const isHeading = (l) => /^[A-Z0-9 &()'!.,-]+$/.test(l.trim()) && /[A-Z]/.test(l);
  const isBullet = (l) => l.trim().startsWith('\u2022 ');
  const out = [];
  for (const raw of lines) {
    const l = raw.replace(/\s+$/, '');
    const prev = out.length ? out[out.length - 1] : '';
    const continuation = l.trim() !== '' && prev.trim() !== '' && !isBullet(l) && !isHeading(l) && !/https?:/.test(l)
      && (/^\s+/.test(l) || (!isBullet(prev) && !isHeading(prev)));
    if (continuation) out[out.length - 1] = `${prev} ${l.trim()}`;
    else out.push(l.trim() === '' ? '' : l.trim());
  }
  return out.join('\n').replace(/^\n+|\n+$/g, '');
}

const doc = fs.readFileSync(LISTING_DOC, 'utf8');
const shortLine = section(doc, 'Short description').find((l) => l.includes('Play short'));
const SHORT = shortLine?.match(/`([^`]+)`/)?.[1];
if (!SHORT) fail('listing doc: no "Play short: `...`" line');
const FULL = unwrapListing(section(doc, 'Full description'));
if (process.argv.includes('--print')) {
  console.log(`SHORT (${SHORT.length}/80): ${SHORT}\n\nFULL (${FULL.length}/4000):\n${FULL}`);
  process.exit(0);
}

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

const sa = JSON.parse(fs.readFileSync(KEY_FILE, 'utf8'));

async function token() {
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const input = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({
    iss: sa.client_email, scope: SCOPE,
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
  })}`;
  const sig = crypto.createSign('RSA-SHA256').update(input).sign(sa.private_key, 'base64url');
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${input}.${sig}`,
  });
  const j = await r.json();
  if (!j.access_token) fail(`token exchange failed: ${JSON.stringify(j)}`);
  return j.access_token;
}

const t = await token();
const call = async (method, path, body) => {
  const r = await fetch(`${API}/applications/${PACKAGE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) fail(`${method} ${path} -> ${r.status}: ${JSON.stringify(j).slice(0, 300)}`);
  return j;
};

if (TITLE.length > 30 || SHORT.length > 80 || FULL.length > 4000) {
  fail(`limits: title ${TITLE.length}/30, short ${SHORT.length}/80, full ${FULL.length}/4000`);
}

const edit = await call('POST', '/edits', {});
console.log(`Edit ${edit.id} opened`);
await call('PUT', `/edits/${edit.id}/listings/en-US`, {
  language: 'en-US',
  title: TITLE,
  shortDescription: SHORT,
  fullDescription: FULL,
  video: '',
});
console.log(`Listing written (title ${TITLE.length}/30, short ${SHORT.length}/80, full ${FULL.length}/4000)`);
if (dryRun) {
  console.log('Dry run — edit NOT committed.');
  await call('DELETE', `/edits/${edit.id}`).catch(() => {});
} else {
  // KNOWN LIMIT: this commit 403s ("caller does not have permission") even
  // though play-publisher DOES hold "Manage store presence" (verified in the
  // console 2026-08-01) — because committing a listing edit automatically
  // SENDS THE CHANGES FOR REVIEW, and this account is deliberately scoped to
  // testing tracks only (see play-upload.mjs). changesNotSentForReview is
  // rejected too ("Changes are sent for review automatically"). Granting the
  // permission that would make this work is the same permission that lets the
  // account publish to production — which is the guardrail we want to keep.
  // So the text above is the source of truth; paste it into Play Console ->
  // Store presence -> Main store listing (or run with --dry-run to validate
  // lengths after an edit).
  await call('POST', `/edits/${edit.id}:commit`, undefined);
  console.log('Committed. en-US store listing is set.');
}
