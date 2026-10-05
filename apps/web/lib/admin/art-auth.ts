import type { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/admin-auth';

/**
 * The admin behind an Art Library request. Under the dev bypass `id` is
 * ART_LIBRARY_DEV_REVIEWER (a profile id, so local screenshots can review and
 * post feedback as that person), or null when it is not set.
 */
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

/** The dev bypass identity: ART_LIBRARY_DEV_REVIEWER, honored only while the bypass is on. */
export function artDevReviewer(): string | null {
  if (!artDevBypass()) return null;
  const id = (process.env.ART_LIBRARY_DEV_REVIEWER ?? '').trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ? id : null;
}

/** verifyAdmin for the Art Library routes, plus the dev-only bypass above. */
export async function requireArtAdmin(request: NextRequest): Promise<{ admin: ArtAdmin } | { error: NextResponse }> {
  if (artDevBypass()) return { admin: { id: artDevReviewer() } };
  const auth = await verifyAdmin(request);
  if ('error' in auth) return { error: auth.error };
  return { admin: { id: auth.admin.id } };
}
