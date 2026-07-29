import { NextRequest } from 'next/server';
import { createClient, User } from '@supabase/supabase-js';

/**
 * Resolve the calling user from an `Authorization: Bearer <access_token>`
 * header (the pattern account/delete established). Returns null when the
 * header is missing or the token doesn't verify.
 */
export async function verifyUser(req: NextRequest): Promise<User | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.replace('Bearer ', '');

  const userClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  const { data: { user }, error } = await userClient.auth.getUser(token);
  return error ? null : user;
}
