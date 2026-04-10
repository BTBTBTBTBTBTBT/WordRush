import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _adminSupabase: SupabaseClient | null = null;

/**
 * Creates a Supabase client using the service role key.
 * This bypasses Row Level Security — use ONLY in server-side API route handlers.
 * NEVER import this in client components.
 * Untyped (no Database generic) for flexibility with admin operations on all tables.
 */
export function getAdminSupabase(): SupabaseClient {
  if (_adminSupabase) return _adminSupabase;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL');
  }

  _adminSupabase = createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return _adminSupabase;
}
