import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/admin-auth';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { grantItems, revokeItems, sanitizeKeys, type OwnedRow } from '@/lib/owned-items-server';

export const dynamic = 'force-dynamic';

/**
 * Owned mascot items for one player (admin user page, "Grant items"). GET lists the ledger (active + revoked);
 * POST { keys: string[] } grants; DELETE { keys: string[] } revokes. Keys are access-table keys ("head:crown").
 * Every grant / revoke is logged to owned_items_log AND admin_audit_log. The ledger has no client write path.
 */
async function target(userId: string) {
  const admin = getAdminSupabase();
  const { data: profile } = await admin.from('profiles').select('id').eq('id', userId).maybeSingle();
  return { admin, found: !!profile };
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await verifyAdmin(request);
  if ('error' in auth) return auth.error;
  const { admin, found } = await target(params.id);
  if (!found) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  const { data, error } = await admin.from('owned_items')
    .select('item_key, source, granted_by, acquired_at, revoked_at').eq('user_id', params.id).order('acquired_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: (data ?? []) as OwnedRow[] });
}

async function change(request: NextRequest, userId: string, action: 'grant' | 'revoke') {
  const auth = await verifyAdmin(request);
  if ('error' in auth) return auth.error;
  const body = (await request.json().catch(() => ({}))) as { keys?: unknown };
  const { keys, unknown } = sanitizeKeys(body.keys);
  if (keys.length === 0) return NextResponse.json({ error: 'No valid item keys', unknown }, { status: 400 });
  const { admin, found } = await target(userId);
  if (!found) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  try {
    const result = action === 'grant'
      ? await grantItems(admin, userId, keys, auth.admin.id)
      : { revoked: await revokeItems(admin, userId, keys, auth.admin.id) };
    await admin.from('admin_audit_log').insert({
      admin_id: auth.admin.id,
      action: action === 'grant' ? 'grant_items' : 'revoke_items',
      target_user_id: userId,
      details: { keys, result },
    });
    return NextResponse.json({ ...result, unknown });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  return change(request, params.id, 'grant');
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  return change(request, params.id, 'revoke');
}
