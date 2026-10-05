import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// "Preview in app" (/admin/art/preview) is an /admin page: middleware.ts must send anyone who is not an admin
// away before the page (and its art overrides) can load, and the dev-only bypass must never apply outside
// `next dev`.

const getUser = vi.fn();
const single = vi.fn();
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: { getUser: (...a: unknown[]) => getUser(...a) },
    from: () => ({ select: () => ({ eq: () => ({ single: () => single() }) }) }),
  }),
}));

import { middleware } from '@/middleware';

const URL_ = 'http://localhost/admin/art/preview?asset=seasons%2Fhalloween%2Fcast%2Fw-alt1&live=0';
const withToken = () => {
  const r = new NextRequest(URL_);
  r.cookies.set('wr-auth-token', JSON.stringify(['tok', 'refresh']));
  return r;
};

describe('admin gate on /admin/art/preview', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service');
    getUser.mockReset();
    single.mockReset();
  });
  afterEach(() => { vi.unstubAllEnvs(); });

  it('bounces a visitor without a session to the admin sign-in relay', async () => {
    const res = await middleware(new NextRequest(URL_));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/admin-auth');
    expect(getUser).not.toHaveBeenCalled();
  });

  it('sends a signed-in player (not an admin) home', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    single.mockResolvedValue({ data: { role: 'player' } });
    const res = await middleware(withToken());
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get('location')!).pathname).toBe('/');
  });

  it('lets an admin through', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'a1' } } });
    single.mockResolvedValue({ data: { role: 'admin' } });
    const res = await middleware(withToken());
    expect(res.headers.get('location')).toBeNull();
  });

  it('ignores the dev bypass outside next dev', async () => {
    vi.stubEnv('ART_LIBRARY_DEV_ADMIN', '1');
    for (const env of ['production', 'test']) {
      vi.stubEnv('NODE_ENV', env);
      const res = await middleware(new NextRequest(URL_));
      expect(res.headers.get('location')).toContain('/admin-auth');
    }
  });
});
