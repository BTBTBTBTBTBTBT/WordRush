import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import { makeAuthResilientFetch } from './auth-session-policy';

let _supabase: SupabaseClient<Database> | null = null;

export function getSupabase(): SupabaseClient<Database> {
  if (_supabase) return _supabase;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase environment variables are not set');
  }

  _supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
    // Outage fix (2026-10-03): auth-js deletes the stored session (and fires
    // SIGNED_OUT) on any refresh failure it doesn't consider retryable — which
    // includes a 500, a Cloudflare 52x, a 429 or an HTML error page. This
    // wrapper rethrows those as network errors so only a real revocation can
    // sign the player out (lib/auth-session-policy.ts). Non-auth requests pass
    // straight through. `fetch` is resolved per call, not captured at import.
    global: {
      fetch: makeAuthResilientFetch((input, init) => fetch(input, init)),
    },
  });

  return _supabase;
}

// Lazy proxy — safe to import at module scope during SSG
export const supabase = new Proxy({} as SupabaseClient<Database>, {
  get(_target, prop) {
    return (getSupabase() as any)[prop];
  },
});
