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

  if (!accessToken) {
    return NextResponse.redirect(new URL('/', request.url));
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
    return NextResponse.redirect(new URL('/', request.url));
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
