import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

// The Art Library routes are admin-only: when verifyAdmin refuses, every
// handler must return that refusal before the service-role client is touched.
// The local dev bypass (ART_LIBRARY_DEV_ADMIN=1) must only ever apply under
// `next dev` (NODE_ENV === 'development').

const verifyAdmin = vi.fn();
const getAdminSupabase = vi.fn(() => {
  throw new Error('getAdminSupabase must not be called for a refused request');
});

vi.mock('@/lib/admin-auth', () => ({ verifyAdmin: (...a: unknown[]) => verifyAdmin(...a) }));
vi.mock('@/lib/supabase-admin', () => ({ getAdminSupabase: () => getAdminSupabase() }));

import { GET as listArt } from './route';
import { POST as signArt } from './sign/route';
import { POST as decideArt } from './decide/route';
import { GET as fileArt } from './file/route';
import { POST as reviewArt } from './review/route';
import { GET as listFeedback, POST as addFeedback } from './feedback/route';
import { POST as resolveFeedback } from './feedback/resolve/route';
import { artDevBypass, artDevReviewer, requireArtAdmin } from '@/lib/admin/art-auth';

const BASE = 'http://localhost/api/admin/art';
const post = (path: string, body: unknown) =>
  new NextRequest(`${BASE}${path}`, { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });

const calls: Array<[string, () => Promise<Response>]> = [
  ['GET /api/admin/art', () => listArt(new NextRequest(BASE))],
  ['POST /api/admin/art/sign', () => signArt(post('/sign', { ids: ['characters/hero/w'], variant: 'thumb' }))],
  ['POST /api/admin/art/decide', () => decideArt(post('/decide', { id: 'characters/hero/w', status: 'approved' }))],
  ['GET /api/admin/art/file', () => fileArt(new NextRequest(`${BASE}/file?id=animation/cast`))],
  ['POST /api/admin/art/review', () => reviewArt(post('/review', { asset_id: 'characters/hero/w', decision: 'approve' }))],
  ['GET /api/admin/art/feedback?asset_id', () => listFeedback(new NextRequest(`${BASE}/feedback?asset_id=characters/hero/w`))],
  ['GET /api/admin/art/feedback?scope', () => listFeedback(new NextRequest(`${BASE}/feedback?scope=season:halloween`))],
  ['GET /api/admin/art/feedback?open=1', () => listFeedback(new NextRequest(`${BASE}/feedback?open=1`))],
  ['POST /api/admin/art/feedback', () => addFeedback(post('/feedback', { asset_id: 'characters/hero/w', body: 'warmer' }))],
  ['POST /api/admin/art/feedback/resolve', () => resolveFeedback(post('/feedback/resolve', { id: '0f8fad5b-d9cb-469f-a165-70867728950e', note: 'done' }))],
];

beforeEach(() => {
  verifyAdmin.mockReset();
  getAdminSupabase.mockClear();
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe('art routes refuse non-admins', () => {
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

  it('still refuses with ART_LIBRARY_DEV_ADMIN=1 outside development', async () => {
    for (const env of ['production', 'test']) {
      vi.stubEnv('NODE_ENV', env);
      vi.stubEnv('ART_LIBRARY_DEV_ADMIN', '1');
      expect(artDevBypass()).toBe(false);
      for (const [, call] of calls) {
        verifyAdmin.mockResolvedValueOnce({ error: NextResponse.json({ error: 'no' }, { status: 401 }) });
        const res = await call();
        expect(res.status).toBe(401);
      }
    }
    expect(getAdminSupabase).not.toHaveBeenCalled();
  });
});

describe('dev bypass', () => {
  it('applies only in development with the flag set', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('ART_LIBRARY_DEV_ADMIN', '1');
    expect(artDevBypass()).toBe(true);
    expect(await requireArtAdmin(new NextRequest(BASE))).toEqual({ admin: { id: null } });
    expect(verifyAdmin).not.toHaveBeenCalled();

    vi.stubEnv('ART_LIBRARY_DEV_ADMIN', '0');
    expect(artDevBypass()).toBe(false);
  });

  it('acts as ART_LIBRARY_DEV_REVIEWER only under the bypass', async () => {
    const id = '39b57177-440f-42e7-bfd6-e70772356deb';
    vi.stubEnv('ART_LIBRARY_DEV_REVIEWER', id);
    vi.stubEnv('ART_LIBRARY_DEV_ADMIN', '1');
    vi.stubEnv('NODE_ENV', 'development');
    expect(artDevReviewer()).toBe(id);
    expect(await requireArtAdmin(new NextRequest(BASE))).toEqual({ admin: { id } });

    vi.stubEnv('ART_LIBRARY_DEV_REVIEWER', 'not-a-uuid');
    expect(artDevReviewer()).toBeNull();

    vi.stubEnv('ART_LIBRARY_DEV_REVIEWER', id);
    for (const env of ['production', 'test']) {
      vi.stubEnv('NODE_ENV', env);
      expect(artDevReviewer()).toBeNull();
      verifyAdmin.mockResolvedValueOnce({ error: NextResponse.json({ error: 'no' }, { status: 401 }) });
      expect((await reviewArt(post('/review', { asset_id: 'x', decision: 'approve' }))).status).toBe(401);
    }
    expect(getAdminSupabase).not.toHaveBeenCalled();
  });

  it('review and new feedback refuse a bypass session with no reviewer identity (403, no DB)', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('ART_LIBRARY_DEV_ADMIN', '1');
    vi.stubEnv('ART_LIBRARY_DEV_REVIEWER', '');
    expect((await reviewArt(post('/review', { asset_id: 'x', decision: 'approve' }))).status).toBe(403);
    expect((await addFeedback(post('/feedback', { asset_id: 'x', body: 'hi' }))).status).toBe(403);
    expect(getAdminSupabase).not.toHaveBeenCalled();
  });

  it('bad bodies are 400 before any database call', async () => {
    verifyAdmin.mockResolvedValue({ admin: { id: 'admin-uuid', role: 'admin' } });
    expect((await reviewArt(post('/review', { asset_id: 'x', decision: 'maybe' }))).status).toBe(400);
    expect((await listFeedback(new NextRequest(`${BASE}/feedback`))).status).toBe(400);
    expect((await addFeedback(post('/feedback', { body: 'no target' }))).status).toBe(400);
    expect((await resolveFeedback(post('/feedback/resolve', { id: 'nope' }))).status).toBe(400);
    expect(getAdminSupabase).not.toHaveBeenCalled();
  });

  it('passes the real admin id through when verified', async () => {
    verifyAdmin.mockResolvedValue({ admin: { id: 'admin-uuid', role: 'admin' } });
    expect(await requireArtAdmin(new NextRequest(BASE))).toEqual({ admin: { id: 'admin-uuid' } });
  });
});
