import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { verifyAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

/** Admin read of every flag row (admin > Ops > Feature flags). */
export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if ('error' in auth) return auth.error;

  const admin = getAdminSupabase();
  const { data, error } = await admin.from('app_flags').select('*').order('key');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ flags: data ?? [] });
}

/**
 * Upsert one flag: { key, enabled?, audience?, note? }. `audience` → 'all' is
 * the public launch of that gate; `enabled` → false is the kill switch. Every
 * change is written to admin_audit_log.
 */
export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if ('error' in auth) return auth.error;

  const body = (await request.json()) as { key?: string; enabled?: boolean; audience?: string; note?: string | null };
  const key = (body.key ?? '').trim();
  if (!key || !/^[a-z]+\.[a-z0-9_]+$/.test(key)) {
    return NextResponse.json({ error: 'key must look like menu.more or mode.sudoku' }, { status: 400 });
  }
  if (body.audience !== undefined && body.audience !== 'all' && body.audience !== 'testers') {
    return NextResponse.json({ error: "audience must be 'all' or 'testers'" }, { status: 400 });
  }

  const admin = getAdminSupabase();
  const { data: before } = await admin.from('app_flags').select('*').eq('key', key).maybeSingle();
  const row = {
    key,
    enabled: body.enabled ?? before?.enabled ?? false,
    audience: body.audience ?? before?.audience ?? 'testers',
    note: body.note === undefined ? (before?.note ?? null) : body.note,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await admin.from('app_flags').upsert(row).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from('admin_audit_log').insert({
    admin_id: auth.admin.id,
    action: 'set_app_flag',
    details: { key, before: before ? { enabled: before.enabled, audience: before.audience } : null, after: { enabled: row.enabled, audience: row.audience } },
  });

  return NextResponse.json({ flag: data });
}
