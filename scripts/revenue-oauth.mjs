#!/usr/bin/env node
// One-time OAuth grant for the admin Revenue page's ad-network cards.
//
// WHY THIS EXISTS: Google's AdMob and AdSense reporting APIs only accept
// USER OAuth credentials — service accounts are explicitly unsupported — so
// live earnings on /admin/revenue require one interactive consent from the
// Google account that owns AdMob/AdSense. This script runs that consent
// locally, catches the code on a localhost loopback, and prints the three
// env values to add to Vercel. Run it once; the refresh token is long-lived.
//
// PREREQUISITE (one-time, Cloud Console UI — cannot be scripted):
//   In project spellstrike-490819 → APIs & Services → Credentials, create an
//   OAuth client of type "Web application" with redirect URI
//   http://localhost:8765/callback, and enable the "AdMob API" and
//   "AdSense Management API". Pass its id/secret via env:
//     REVENUE_GOOGLE_CLIENT_ID=... REVENUE_GOOGLE_CLIENT_SECRET=... \
//       node scripts/revenue-oauth.mjs
//
// Then (the founder pastes secrets himself):
//   vercel env add REVENUE_GOOGLE_CLIENT_ID production
//   vercel env add REVENUE_GOOGLE_CLIENT_SECRET production
//   vercel env add REVENUE_GOOGLE_REFRESH_TOKEN production
// and redeploy the web app.

import http from 'node:http';
import { execFileSync } from 'node:child_process';

const CLIENT_ID = process.env.REVENUE_GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.REVENUE_GOOGLE_CLIENT_SECRET;
const PORT = 8765;
const REDIRECT = `http://localhost:${PORT}/callback`;
const SCOPES = [
  'https://www.googleapis.com/auth/admob.readonly',
  'https://www.googleapis.com/auth/adsense.readonly',
].join(' ');

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Set REVENUE_GOOGLE_CLIENT_ID and REVENUE_GOOGLE_CLIENT_SECRET first (see header).');
  process.exit(1);
}

const authUrl =
  'https://accounts.google.com/o/oauth2/v2/auth?' +
  new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT,
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline', // refresh token
    prompt: 'consent',      // force refresh token even on re-grant
  });

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (url.pathname !== '/callback') { res.writeHead(404).end(); return; }
  const code = url.searchParams.get('code');
  if (!code) {
    res.end('No code — consent denied or errored. Check the terminal.');
    console.error('Consent returned no code:', url.searchParams.get('error'));
    process.exit(1);
  }
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT,
      grant_type: 'authorization_code',
    }),
  });
  const tokens = await tokenRes.json();
  if (!tokens.refresh_token) {
    res.end('Token exchange failed — see terminal.');
    console.error('No refresh_token in response:', tokens);
    process.exit(1);
  }
  res.end('Granted. You can close this tab — the refresh token is in the terminal.');
  console.log('\n✓ Refresh token obtained. Add these to Vercel (production) and redeploy:\n');
  console.log('  REVENUE_GOOGLE_CLIENT_ID     =', CLIENT_ID);
  console.log('  REVENUE_GOOGLE_CLIENT_SECRET = (the client secret)');
  console.log('  REVENUE_GOOGLE_REFRESH_TOKEN =', tokens.refresh_token);
  console.log('\nThen /admin/revenue shows live AdMob + AdSense numbers.');
  server.close();
  process.exit(0);
});

server.listen(PORT, () => {
  console.log('Opening Google consent — approve with the account that owns AdMob/AdSense…');
  if (process.env.NO_OPEN) console.log('AUTH_URL=' + authUrl);
  else try { execFileSync('open', [authUrl]); } catch { console.log('Open this URL manually:\n' + authUrl); }
});
