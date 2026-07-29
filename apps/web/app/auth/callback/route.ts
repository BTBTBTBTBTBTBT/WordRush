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
  if (next && next.startsWith('/') && !next.startsWith('//')) {
    return NextResponse.redirect(new URL(next, origin));
  }

  return NextResponse.redirect(origin);
}
