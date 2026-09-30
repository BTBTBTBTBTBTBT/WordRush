import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  // Recovery links must land on the set-new-password screen with the code
  // intact — exchanging it here would consume the one-time code before
  // /auth/reset can. (This route used to redirect to bare `origin`, dropping
  // every param.)
  if (searchParams.get('type') === 'recovery') {
    const dest = new URL('/auth/reset', origin);
    if (code) dest.searchParams.set('code', code);
    return NextResponse.redirect(dest);
  }

  if (code) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    await supabase.auth.exchangeCodeForSession(code);
  }

  // Honor a same-origin return path (e.g. /vs/join/CODE) instead of always
  // dumping on the home page. Only relative paths — never absolute URLs, so
  // this can't be used as an open redirect.
  const next = searchParams.get('next');
  const dest = next && next.startsWith('/') && !next.startsWith('//')
    ? new URL(next, origin)
    : new URL('/', origin);

  // OAuth errors (e.g. linking an Apple ID that already belongs to another
  // account — Settings › Linked sign-ins) arrive as query params; carry them
  // to the destination so the page can explain what happened. (The implicit
  // flow's #fragment copy survives the 302 on its own.)
  for (const k of ['error', 'error_code', 'error_description']) {
    const v = searchParams.get(k);
    if (v) dest.searchParams.set(k, v);
  }

  return NextResponse.redirect(dest);
}
