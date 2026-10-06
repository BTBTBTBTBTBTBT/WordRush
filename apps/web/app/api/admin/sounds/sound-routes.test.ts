import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

// The Sound Library routes are admin-only (like the Art Library's): when verifyAdmin refuses, every handler
// returns that refusal before the service-role client is touched; bad bodies are 400 before any database call.

const verifyAdmin = vi.fn();
const getAdminSupabase = vi.fn(() => {
  throw new Error('getAdminSupabase must not be called for a refused request');
});

vi.mock('@/lib/admin-auth', () => ({ verifyAdmin: (...a: unknown[]) => verifyAdmin(...a) }));
vi.mock('@/lib/supabase-admin', () => ({ getAdminSupabase: () => getAdminSupabase() }));

import { GET as listSounds } from './route';
import { POST as reviewSound } from './review/route';
import { POST as batchReviewSounds } from './review/batch/route';
import { GET as listFeedback, POST as addFeedback } from './feedback/route';
import { POST as resolveFeedback } from './feedback/resolve/route';

const BASE = 'http://localhost/api/admin/sounds';
const post = (p: string, body: unknown) =>
  new NextRequest(`${BASE}${p}`, { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });

const calls: Array<[string, () => Promise<Response>]> = [
  ['GET /api/admin/sounds', () => listSounds(new NextRequest(BASE))],
  ['POST /api/admin/sounds/review', () => reviewSound(post('/review', { asset_id: 'classic/win/a', decision: 'approve' }))],
  ['POST /api/admin/sounds/review (with feedback)', () => reviewSound(post('/review', { asset_id: 'classic/win/a', decision: 'reject', note: 'too loud', feedback: true }))],
  ['POST /api/admin/sounds/review/batch', () => batchReviewSounds(post('/review/batch', { asset_ids: ['classic/win/now'], decision: 'approve' }))],
  ['GET /api/admin/sounds/feedback?open=1', () => listFeedback(new NextRequest(`${BASE}/feedback?open=1`))],
  ['GET /api/admin/sounds/feedback?scope', () => listFeedback(new NextRequest(`${BASE}/feedback?scope=game:classic`))],
  ['POST /api/admin/sounds/feedback', () => addFeedback(post('/feedback', { scope: 'game:classic', body: 'softer taps' }))],
  ['POST /api/admin/sounds/feedback/resolve', () => resolveFeedback(post('/feedback/resolve', { id: '0f8fad5b-d9cb-469f-a165-70867728950e' }))],
];

beforeEach(() => {
  verifyAdmin.mockReset();
  getAdminSupabase.mockClear();
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe('sound routes refuse non-admins', () => {
  for (const status of [401, 403]) {
    for (const [name, call] of calls) {
      it(`${name} returns ${status} without touching the service-role client`, async () => {
        verifyAdmin.mockResolvedValue({ error: NextResponse.json({ error: 'no' }, { status }) });
        const res = await call();
        expect(res.status).toBe(status);
        expect(verifyAdmin).toHaveBeenCalledTimes(1);
        expect(getAdminSupabase).not.toHaveBeenCalled();
      });
    }
  }

  it('the dev bypass never applies outside development', async () => {
    for (const env of ['production', 'test']) {
      vi.stubEnv('NODE_ENV', env);
      vi.stubEnv('ART_LIBRARY_DEV_ADMIN', '1');
      for (const [, call] of calls) {
        verifyAdmin.mockResolvedValueOnce({ error: NextResponse.json({ error: 'no' }, { status: 401 }) });
        expect((await call()).status).toBe(401);
      }
    }
    expect(getAdminSupabase).not.toHaveBeenCalled();
  });

  it('reviews and new notes need a reviewer identity (403, no DB) under the dev bypass', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('ART_LIBRARY_DEV_ADMIN', '1');
    vi.stubEnv('ART_LIBRARY_DEV_REVIEWER', '');
    expect((await reviewSound(post('/review', { asset_id: 'x', decision: 'approve' }))).status).toBe(403);
    expect((await batchReviewSounds(post('/review/batch', { asset_ids: ['x'], decision: 'approve' }))).status).toBe(403);
    expect((await addFeedback(post('/feedback', { scope: 'game:classic', body: 'hi' }))).status).toBe(403);
    expect(getAdminSupabase).not.toHaveBeenCalled();
  });

  it('bad bodies are 400 before any database call', async () => {
    verifyAdmin.mockResolvedValue({ admin: { id: 'admin-uuid', role: 'admin' } });
    expect((await reviewSound(post('/review', { asset_id: 'x', decision: 'maybe' }))).status).toBe(400);
    expect((await reviewSound(post('/review', { asset_id: 'x', decision: 'reject', feedback: true }))).status).toBe(400);
    expect((await batchReviewSounds(post('/review/batch', { asset_ids: [], decision: 'approve' }))).status).toBe(400);
    expect((await batchReviewSounds(post('/review/batch', { asset_ids: ['x'], decision: 'reject' }))).status).toBe(400);
    expect((await listFeedback(new NextRequest(`${BASE}/feedback`))).status).toBe(400);
    expect((await addFeedback(post('/feedback', { body: 'no target' }))).status).toBe(400);
    expect((await resolveFeedback(post('/feedback/resolve', { id: 'nope' }))).status).toBe(400);
    expect(getAdminSupabase).not.toHaveBeenCalled();
  });
});

describe('before the SQL is applied', () => {
  it('GET answers the setup note with empty lists, so the page still plays every sound', async () => {
    verifyAdmin.mockResolvedValue({ admin: { id: 'admin-uuid', role: 'admin' } });
    const missing = { data: null, error: { code: 'PGRST205', message: "Could not find the table 'public.sound_assets' in the schema cache" } };
    const chain: Record<string, unknown> = {};
    for (const m of ['select', 'order', 'range', 'in']) chain[m] = () => chain;
    (chain as { then: unknown }).then = (res: (v: unknown) => void) => res(missing);
    const reviewersChain: Record<string, unknown> = {};
    reviewersChain.select = () => reviewersChain;
    reviewersChain.order = () => Promise.resolve({ data: [], error: null });
    getAdminSupabase.mockImplementation((() => ({ from: (t: string) => (t === 'art_reviewers' ? reviewersChain : chain) })) as never);
    const res = await listSounds(new NextRequest(BASE));
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.setup).toMatch(/20261010-sound-library\.sql/);
    expect(j.assets).toEqual([]);
  });
});
