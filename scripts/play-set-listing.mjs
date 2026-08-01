#!/usr/bin/env node
// Set the Play store listing (en-US title/descriptions) via the publisher API.
//
//   node scripts/play-set-listing.mjs            # write the listing + commit
//   node scripts/play-set-listing.mjs --dry-run  # everything except the commit
//
// Copy is adapted from the LIVE iOS App Store description (asc.rb, 1.4
// localization) so the two stores tell the same story; Apple's subscription
// boilerplate is swapped for Play-appropriate phrasing. Graphics (icon,
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
const SHORT = 'Nine daily word puzzles, real-time VS battles, streaks and leaderboards.'; // 73 (max 80)
const FULL = `Wordocious is the word puzzle that goes way beyond five letters. Guess the daily word across NINE distinct modes, climb global leaderboards, earn medals, and battle friends in real time.

GAME MODES
• Classic — the daily five-letter challenge
• QuadWord — solve four boards at once
• OctoWord — eight boards, one set of guesses
• Succession — chain words one after another
• Deliverance — rescue the word from prefilled clues
• Six & Seven — six- and seven-letter twists with hints
• Gauntlet — five escalating stages in a single run
• ProperNoundle — guess famous names

PLAY EVERY DAY
A fresh puzzle in every mode, every day. Keep your daily streak alive, sweep all nine modes for bonus XP, and chase a Flawless Victory.

COMPETE
• Global daily leaderboards for every mode
• Real-time VS battles — race a live opponent on the same puzzle
• Private matches: invite friends by link or username
• All-time records and a Hall of Fame

PROGRESS
• Level up with XP and earn daily medals
• Build win streaks and protect them with streak shields
• Detailed per-mode stats and Pro insights

WORDOCIOUS PRO — OPTIONAL SUBSCRIPTION
Go ad-free, replay every mode unlimited, unlock VS on all nine modes, get streak shields, a Pro badge, and extended stats. Daily puzzles are always free to play without any purchase.
• Wordocious Pro Monthly and Yearly subscriptions renew automatically unless cancelled in your Google Play subscription settings.
• A one-time 24-hour Day Pass is also available.

Free to play — sign in to save your progress and compete. New puzzles every day. How many can you solve?

Privacy Policy: https://wordocious.com/privacy
Terms: https://wordocious.com/terms`;

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
