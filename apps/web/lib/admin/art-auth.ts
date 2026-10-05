import type { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/admin-auth';

/** The admin behind an Art Library request. `id` is null only under the dev bypass. */
export interface ArtAdmin { id: string | null }

/**
 * Local-screenshot bypass for the Art Library: `next dev` with
 * ART_LIBRARY_DEV_ADMIN=1 skips the admin check on /admin/art and
 * /api/admin/art/*. The NODE_ENV comparison is written literally so Next
 * replaces it with `false` in production builds and the branch is compiled out;
 * under vitest NODE_ENV is 'test', so the bypass is off there too.
 */
export function artDevBypass(): boolean {
  return process.env.NODE_ENV === 'development' && process.env.ART_LIBRARY_DEV_ADMIN === '1';
}

/** verifyAdmin for the Art Library routes, plus the dev-only bypass above. */
export async function requireArtAdmin(request: NextRequest): Promise<{ admin: ArtAdmin } | { error: NextResponse }> {
  if (artDevBypass()) return { admin: { id: null } };
  const auth = await verifyAdmin(request);
  if ('error' in auth) return { error: auth.error };
  return { admin: { id: auth.admin.id } };
}
