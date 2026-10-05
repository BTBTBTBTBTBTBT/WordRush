import { createHash, randomBytes } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { requireArtAdmin } from '@/lib/admin/art-auth';
import { isProvider, PROVIDERS } from '@/lib/admin/studio';
import { PROVIDER_ADAPTERS, providerEnv, redirectUriFor } from '@/lib/social/adapters';

export const dynamic = 'force-dynamic';

/**
 * Start a provider's OAuth flow with the founder's own developer app (env vars per provider, see
 * docs/marketing/SOCIAL-CONNECT-CHECKLIST.md). Stores a one-time state (+ PKCE verifier for X) server side and
 * redirects to the platform's consent screen.
 */
export async function GET(request: NextRequest, { params }: { params: { provider: string } }) {
  const auth = await requireArtAdmin(request);
  if ('error' in auth) return auth.error;
  if (!isProvider(params.provider)) return NextResponse.json({ error: 'Unknown provider' }, { status: 404 });
  const provider = params.provider;

  const env = providerEnv(provider);
  if (!env) {
    return NextResponse.json({ error: `Not set up yet: add ${PROVIDERS[provider].env.join(' and ')} in Vercel, redeploy, then Connect.` }, { status: 400 });
  }

  const adapter = PROVIDER_ADAPTERS[provider];
  const state = randomBytes(24).toString('base64url');
  const verifier = adapter.pkce ? randomBytes(48).toString('base64url') : null;
  const challenge = verifier ? createHash('sha256').update(verifier).digest('base64url') : undefined;

  const admin = getAdminSupabase();
  // Old abandoned states go first (they are only useful for 15 minutes).
  await admin.from('social_oauth_states').delete().lt('created_at', new Date(Date.now() - 15 * 60_000).toISOString());
  const { error } = await admin.from('social_oauth_states').insert({ state, provider, code_verifier: verifier, created_by: auth.admin.id });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const url = adapter.authorizeUrl({ clientId: env.clientId, redirectUri: redirectUriFor(provider, request.nextUrl.origin), state, codeChallenge: challenge });
  return NextResponse.redirect(url, 302);
}
