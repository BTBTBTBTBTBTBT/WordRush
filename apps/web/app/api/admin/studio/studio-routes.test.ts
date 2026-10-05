import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

// Social Studio routes are admin-only: when verifyAdmin refuses, every handler must return that refusal before
// the service-role client is touched. The publisher cron needs the CRON_SECRET bearer token.

const verifyAdmin = vi.fn();
const getAdminSupabase = vi.fn(() => {
  throw new Error('getAdminSupabase must not be called for a refused request');
});

vi.mock('@/lib/admin-auth', () => ({ verifyAdmin: (...a: unknown[]) => verifyAdmin(...a) }));
vi.mock('@/lib/supabase-admin', () => ({ getAdminSupabase: () => getAdminSupabase() }));

import { GET as list } from './route';
import { POST as review } from './review/route';
import { POST as edit } from './edit/route';
import { POST as schedule } from './schedule/route';
import { POST as pause } from './pause/route';
import { POST as disconnect } from './disconnect/route';
import { POST as media } from './media/route';
import { GET as connect } from './connect/[provider]/route';
import { GET as callback } from './callback/[provider]/route';
import { GET as cron } from '../../cron/social-publish/route';

const BASE = 'http://localhost/api/admin/studio';
const ID = '5a0c1a11-0001-4c00-9000-000000000001';
const post = (path: string, body: unknown) =>
  new NextRequest(`${BASE}${path}`, { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });

const calls: Array<[string, () => Promise<Response>]> = [
  ['GET /api/admin/studio', () => list(new NextRequest(BASE))],
  ['POST /review', () => review(post('/review', { post_id: ID, decision: 'approve' }))],
  ['POST /edit', () => edit(post('/edit', { post_id: ID, caption: { platform: 'x', text: 'hi' } }))],
  ['POST /schedule', () => schedule(post('/schedule', { post_id: ID, scheduled_at: '2026-10-09T17:00:00Z' }))],
  ['POST /pause', () => pause(post('/pause', { paused: true }))],
  ['POST /disconnect', () => disconnect(post('/disconnect', { provider: 'x' }))],
  ['POST /media', () => media(new NextRequest(`${BASE}/media`, { method: 'POST', body: new FormData() }))],
  ['GET /connect/x', () => connect(new NextRequest(`${BASE}/connect/x`), { params: { provider: 'x' } })],
  ['GET /callback/x', () => callback(new NextRequest(`${BASE}/callback/x?code=c&state=s`), { params: { provider: 'x' } })],
];

beforeEach(() => {
  verifyAdmin.mockReset();
  getAdminSupabase.mockClear();
});
afterEach(() => { vi.unstubAllEnvs(); });

describe('social studio routes refuse non-admins', () => {
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

  it('the dev bypass and fixture mode stay off outside development', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('ART_LIBRARY_DEV_ADMIN', '1');
    vi.stubEnv('SOCIAL_STUDIO_FIXTURE', '1');
    verifyAdmin.mockResolvedValue({ error: NextResponse.json({ error: 'no' }, { status: 401 }) });
    expect((await list(new NextRequest(BASE))).status).toBe(401);
    expect(getAdminSupabase).not.toHaveBeenCalled();
  });

  it('an admin with a bad body gets 400 before any DB call', async () => {
    verifyAdmin.mockResolvedValue({ admin: { id: 'b0000000-0000-4000-8000-000000000001' } });
    expect((await review(post('/review', { post_id: 'x', decision: 'approve' }))).status).toBe(400);
    expect((await edit(post('/edit', { post_id: ID }))).status).toBe(400);
    expect((await schedule(post('/schedule', { post_id: ID }))).status).toBe(400);
    expect((await pause(post('/pause', { paused: 'yes' }))).status).toBe(400);
    expect((await connect(new NextRequest(`${BASE}/connect/myspace`), { params: { provider: 'myspace' } })).status).toBe(404);
    expect(getAdminSupabase).not.toHaveBeenCalled();
  });

  it('Connect without the app keys explains which env vars to add (no DB call)', async () => {
    verifyAdmin.mockResolvedValue({ admin: { id: 'b0000000-0000-4000-8000-000000000001' } });
    vi.stubEnv('X_CLIENT_ID', '');
    vi.stubEnv('X_CLIENT_SECRET', '');
    const res = await connect(new NextRequest(`${BASE}/connect/x`), { params: { provider: 'x' } });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('X_CLIENT_ID');
    expect(getAdminSupabase).not.toHaveBeenCalled();
  });
});

describe('publisher cron', () => {
  it('refuses without the CRON_SECRET bearer', async () => {
    vi.stubEnv('CRON_SECRET', 'right');
    const res = await cron(new NextRequest('http://localhost/api/cron/social-publish', { headers: { authorization: 'Bearer wrong' } }));
    expect(res.status).toBe(401);
    expect(getAdminSupabase).not.toHaveBeenCalled();
  });
});
