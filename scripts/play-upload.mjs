#!/usr/bin/env node
// Build + upload the Android bundle to a Google Play testing track.
//
// Replaces the drag-and-drop dance in Play Console. Uploading by hand was the
// only option for a long time because the browser tooling caps file uploads at
// 10 MB and our bundle is ~21 MB.
//
//   node scripts/play-upload.mjs                       # build, upload to internal
//   node scripts/play-upload.mjs --track alpha         # a different testing track
//   node scripts/play-upload.mjs --no-build            # use the existing .aab
//   node scripts/play-upload.mjs --notes "..."         # en-US release notes
//   node scripts/play-upload.mjs --dry-run             # everything except the commit
//
// PRODUCTION IS NOT REACHABLE from here, by design: the service account holds
// only "Release apps to testing tracks" + "Manage testing tracks", so a slip of
// the --track flag gets a 403 from Google rather than shipping to everyone.
// Promoting to production stays a deliberate click in Play Console.
//
// Credentials: the service-account JSON for
// play-publisher@spellstrike-490819.iam.gserviceaccount.com, kept OUTSIDE the
// repo next to the keystore. Override with PLAY_SERVICE_ACCOUNT.
//
// The bundle must be signed with the upload key (apps/android/key.properties);
// `gradlew bundleRelease` does that automatically.

import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ANDROID = path.join(REPO, 'apps/android');
const AAB = path.join(ANDROID, 'app/build/outputs/bundle/release/app-release.aab');
const PACKAGE = 'com.wordocious.app';
const KEY_FILE =
  process.env.PLAY_SERVICE_ACCOUNT ||
  path.join(os.homedir(), '.android-keys/play-publisher.json');

const SCOPE = 'https://www.googleapis.com/auth/androidpublisher';
const API = 'https://androidpublisher.googleapis.com/androidpublisher/v3';
const UPLOAD_API = 'https://androidpublisher.googleapis.com/upload/androidpublisher/v3';

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : (process.argv[i + 1] ?? true);
}
const has = (name) => process.argv.includes(`--${name}`);

const track = arg('track', 'internal');
const dryRun = has('dry-run');

// Guard rather than trust the flag: "production" here would be a 403 anyway,
// but failing locally makes the reason obvious instead of cryptic.
if (track === 'production') {
  console.error(
    'Refusing --track production. This service account can only reach testing\n' +
      'tracks; promote a tested build from Play Console instead.',
  );
  process.exit(1);
}

function readServiceAccount() {
  if (!fs.existsSync(KEY_FILE)) {
    console.error(
      `No service-account key at ${KEY_FILE}\n\n` +
        'Create one in Google Cloud console -> IAM & Admin -> Service Accounts ->\n' +
        'play-publisher@spellstrike-490819.iam.gserviceaccount.com -> Keys ->\n' +
        'Add key -> JSON, then move it there (or set PLAY_SERVICE_ACCOUNT).',
    );
    process.exit(1);
  }
  const sa = JSON.parse(fs.readFileSync(KEY_FILE, 'utf8'));
  if (!sa.client_email || !sa.private_key) {
    console.error(`${KEY_FILE} is missing client_email/private_key.`);
    process.exit(1);
  }
  return sa;
}

/** Signed JWT assertion -> OAuth2 access token. Same shape as lib/push/fcm.ts. */
async function getAccessToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const input = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({
    iss: sa.client_email,
    scope: SCOPE,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  })}`;
  const sig = crypto
    .createSign('RSA-SHA256')
    .update(input)
    .sign(sa.private_key.replace(/\\n/g, '\n'))
    .toString('base64url');

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${input}.${sig}`,
    }),
  });
  const json = await res.json();
  if (!res.ok || !json.access_token) {
    throw new Error(`Token exchange failed (${res.status}): ${JSON.stringify(json)}`);
  }
  return json.access_token;
}

async function api(token, method, url, body, contentType = 'application/json') {
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': contentType,
    },
    body,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${method} ${url}\n  ${res.status}: ${text}`);
  }
  return text ? JSON.parse(text) : {};
}

function versionCodeFromGradle() {
  const gradle = fs.readFileSync(path.join(ANDROID, 'app/build.gradle.kts'), 'utf8');
  const code = gradle.match(/versionCode\s*=\s*(\d+)/)?.[1];
  const name = gradle.match(/versionName\s*=\s*"([^"]+)"/)?.[1];
  if (!code) throw new Error('Could not read versionCode from build.gradle.kts');
  return { code: Number(code), name };
}

function build() {
  const javaHome =
    process.env.JAVA_HOME || '/Applications/Android Studio.app/Contents/jbr/Contents/Home';
  const androidHome =
    process.env.ANDROID_HOME || path.join(os.homedir(), 'Library/Android/sdk');
  console.log('Building release bundle...');
  execFileSync('./gradlew', [':app:bundleRelease'], {
    cwd: ANDROID,
    stdio: 'inherit',
    env: { ...process.env, JAVA_HOME: javaHome, ANDROID_HOME: androidHome },
  });
}

const main = async () => {
  const { code: versionCode, name: versionName } = versionCodeFromGradle();
  const notes = arg('notes', null);

  if (!has('no-build')) build();
  if (!fs.existsSync(AAB)) {
    console.error(`No bundle at ${AAB}. Drop --no-build, or run gradlew bundleRelease.`);
    process.exit(1);
  }
  const bytes = fs.readFileSync(AAB);
  console.log(
    `Bundle ${versionCode} (${versionName}) — ${(bytes.length / 1e6).toFixed(1)} MB`,
  );

  const token = await getAccessToken(readServiceAccount());

  const edit = await api(token, 'POST', `${API}/applications/${PACKAGE}/edits`);
  console.log(`Edit ${edit.id} opened`);

  // Google validates signature + versionCode here; a duplicate versionCode or a
  // bundle signed with the wrong key fails at this step, before anything else
  // is touched.
  const uploaded = await api(
    token,
    'POST',
    `${UPLOAD_API}/applications/${PACKAGE}/edits/${edit.id}/bundles?uploadType=media`,
    bytes,
    'application/octet-stream',
  );
  console.log(`Uploaded versionCode ${uploaded.versionCode}`);

  await api(
    token,
    'PUT',
    `${API}/applications/${PACKAGE}/edits/${edit.id}/tracks/${track}`,
    JSON.stringify({
      track,
      releases: [
        {
          name: `${versionCode} (${versionName})`,
          versionCodes: [String(uploaded.versionCode)],
          status: 'completed',
          ...(notes ? { releaseNotes: [{ language: 'en-US', text: notes }] } : {}),
        },
      ],
    }),
  );
  console.log(`Assigned to the ${track} track`);

  if (dryRun) {
    await api(token, 'DELETE', `${API}/applications/${PACKAGE}/edits/${edit.id}`);
    console.log('Dry run — edit discarded, nothing published.');
    return;
  }

  await api(token, 'POST', `${API}/applications/${PACKAGE}/edits/${edit.id}:commit`);
  console.log(`Committed. ${versionCode} (${versionName}) is live on ${track}.`);
};

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
