import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  // Only protect /admin routes
  if (!request.nextUrl.pathname.startsWith('/admin')) {
    return NextResponse.next();
  }

  // Allow /api/admin routes to pass through — they have their own verifyAdmin check
  if (request.nextUrl.pathname.startsWith('/api/admin')) {
    return NextResponse.next();
  }

  // Extract access token from Supabase auth cookie
  let accessToken: string | null = null;
  const cookies = request.cookies.getAll();
  for (const cookie of cookies) {
    if (cookie.name.includes('auth-token')) {
      try {
        const parsed = JSON.parse(cookie.value);
        if (Array.isArray(parsed) && parsed[0]) {
          accessToken = parsed[0];
        } else if (typeof parsed === 'string') {
          accessToken = parsed;
        }
      } catch {
        accessToken = cookie.value;
      }
      break;
    }
  }

  // No token, or a stale one (access tokens live 1h; supabase-js refreshes the
  // localStorage session client-side, which a server gate can't see): bounce
  // through /admin-auth, a public client page that refreshes the session,
  // rewrites the wr-auth-token cookie, and returns here. wr_retried=1 marks the
  // second pass so a genuinely signed-out visitor exits to home instead of
  // looping. Before this relay existed the gate redirected home on ANY cookie
  // miss — which, with no code ever setting the cookie, meant /admin bounced
  // every admin, always.
  const retried = request.nextUrl.searchParams.get('wr_retried') === '1';
  const bounce = () => {
    if (retried) return NextResponse.redirect(new URL('/', request.url));
    const relay = new URL('/admin-auth', request.url);
    relay.searchParams.set('next', request.nextUrl.pathname);
    return NextResponse.redirect(relay);
  };

  if (!accessToken) {
    return bounce();
  }

  // Verify session and check admin role using service role client
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: { user } } = await supabase.auth.getUser(accessToken);
  if (!user) {
    // Expired/invalid token — same relay: a fresh one usually exists client-side.
    return bounce();
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
