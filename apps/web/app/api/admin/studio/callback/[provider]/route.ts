import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { requireArtAdmin } from '@/lib/admin/art-auth';
import { isProvider } from '@/lib/admin/studio';
import { PROVIDER_ADAPTERS, providerEnv, redirectUriFor, scrub } from '@/lib/social/adapters';

export const dynamic = 'force-dynamic';

/**
 * The OAuth redirect each developer app lists: https://wordocious.com/api/admin/studio/callback/<provider>.
 * Admin-gated (the founder's browser carries the admin session back), checks the one-time state, exchanges the
 * code, stores tokens server side only (social_accounts, service role), and returns to the Studio. Tokens are
 * never logged, returned or put in the redirect.
 */
export async function GET(request: NextRequest, { params }: { params: { provider: string } }) {
  const auth = await requireArtAdmin(request);
  if ('error' in auth) return auth.error;
  if (!isProvider(params.provider)) return NextResponse.json({ error: 'Unknown provider' }, { status: 404 });
  const provider = params.provider;
  const back = (msg: string, ok: boolean) => {
    const url = new URL('/admin/studio', request.nextUrl.origin);
    url.searchParams.set(ok ? 'connected' : 'connect_error', ok ? provider : msg.slice(0, 200));
    return NextResponse.redirect(url, 302);
  };

  const sp = request.nextUrl.searchParams;
  const state = sp.get('state') ?? '';
  const code = sp.get('code') ?? '';
  if (sp.get('error')) return back(`${provider}: ${sp.get('error_description') ?? sp.get('error')}`, false);
  if (!state || !code) return back(`${provider}: missing code`, false);

  const env = providerEnv(provider);
  if (!env) return back(`${provider}: app keys are not set in Vercel`, false);

  const admin = getAdminSupabase();
  const { data: row } = await admin.from('social_oauth_states').select('state, provider, code_verifier, created_at').eq('state', state).maybeSingle();
  await admin.from('social_oauth_states').delete().eq('state', state);
  const st = row as { provider: string; code_verifier: string | null; created_at: string } | null;
  if (!st || st.provider !== provider || Date.now() - new Date(st.created_at).getTime() > 15 * 60_000) {
    return back(`${provider}: the sign-in expired, click Connect again`, false);
  }

  try {
    const accounts = await PROVIDER_ADAPTERS[provider].exchange({
      code, redirectUri: redirectUriFor(provider, request.nextUrl.origin), codeVerifier: st.code_verifier, clientId: env.clientId, clientSecret: env.clientSecret,
    });
    const now = new Date().toISOString();
    for (const a of accounts) {
      const { error } = await admin.from('social_accounts').upsert({
        ...a, meta: a.meta ?? {}, connected_by: auth.admin.id, connected_at: now, last_error: null, updated_at: now,
      });
      if (error) throw new Error(error.message);
    }
    return back('', true);
  } catch (e) {
    return back(scrub(`${provider}: ${e instanceof Error ? e.message : String(e)}`, [code, env.clientSecret]), false);
  }
}
