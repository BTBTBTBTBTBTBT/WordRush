import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { verifyAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if ('error' in auth) return auth.error;

  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from('announcements')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ announcements: data || [] });
}

export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if ('error' in auth) return auth.error;

  const admin = getAdminSupabase();
  const body = await request.json();

  const { data, error } = await admin
    .from('announcements')
    .insert({
      title: body.title,
      body: body.body,
      type: body.type || 'info',
      active: body.active !== false,
      expires_at: body.expires_at || null,
      created_by: auth.admin.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from('admin_audit_log').insert({
    admin_id: auth.admin.id,
    action: 'create_announcement',
    details: { title: body.title },
  });

  return NextResponse.json({ announcement: data });
}
