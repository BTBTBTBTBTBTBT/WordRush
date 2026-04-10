import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from './supabase-admin';
import type { Database } from './database.types';

type Profile = Database['public']['Tables']['profiles']['Row'];

interface AdminAuthSuccess {
  admin: Profile;
}

interface AdminAuthError {
  error: NextResponse;
}

/**
 * Verifies that the request is from an authenticated admin user.
 * Reads the Supabase access token from the Authorization header or cookie,
 * validates it, and checks that the user has role = 'admin'.
 *
 * Usage in API route handlers:
 *   const auth = await verifyAdmin(request);
 *   if ('error' in auth) return auth.error;
 *   const { admin } = auth;
 */
export async function verifyAdmin(
  request: NextRequest
): Promise<AdminAuthSuccess | AdminAuthError> {
  const supabase = getAdminSupabase();

  // Extract access token from Authorization header or Supabase auth cookie
  let accessToken: string | null = null;

  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    accessToken = authHeader.slice(7);
  }

  if (!accessToken) {
    // Try to get token from Supabase auth cookies (sb-*-auth-token)
    const cookies = request.cookies.getAll();
    for (const cookie of cookies) {
      if (cookie.name.includes('auth-token')) {
        try {
          // Supabase stores the token as a JSON array: [accessToken, refreshToken]
          const parsed = JSON.parse(cookie.value);
          if (Array.isArray(parsed) && parsed[0]) {
            accessToken = parsed[0];
          } else if (typeof parsed === 'string') {
            accessToken = parsed;
          }
        } catch {
          // Not JSON, try as plain string
          accessToken = cookie.value;
        }
        break;
      }
    }
  }

  if (!accessToken) {
    return {
      error: NextResponse.json({ error: 'Not authenticated' }, { status: 401 }),
    };
  }

  // Verify the token and get the user
  const { data: { user }, error: userError } = await supabase.auth.getUser(accessToken);

  if (userError || !user) {
    return {
      error: NextResponse.json({ error: 'Invalid session' }, { status: 401 }),
    };
  }

  // Check that the user is an admin
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    return {
      error: NextResponse.json({ error: 'Profile not found' }, { status: 404 }),
    };
  }

  if (profile.role !== 'admin') {
    return {
      error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    };
  }

  return { admin: profile };
}
