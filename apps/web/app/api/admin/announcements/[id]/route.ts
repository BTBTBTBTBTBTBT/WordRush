import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { verifyAdmin } from '@/lib/admin-auth';
import type { Database } from '@/lib/database.types';

export const dynamic = 'force-dynamic';

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await verifyAdmin(request);
  if ('error' in auth) return auth.error;

  const admin = getAdminSupabase();
  const body = await request.json();

  const updates: Database['public']['Tables']['announcements']['Update'] = {};
  if (body.title !== undefined) updates.title = body.title;
  if (body.body !== undefined) updates.body = body.body;
  if (body.type !== undefined) updates.type = body.type;
  if (body.active !== undefined) updates.active = body.active;
  if (body.expires_at !== undefined) updates.expires_at = body.expires_at;

  const { data, error } = await (admin as any)
    .from('announcements')
    .update(updates)
    .eq('id', params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ announcement: data });
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await verifyAdmin(request);
  if ('error' in auth) return auth.error;

  const admin = getAdminSupabase();
  const { error } = await admin.from('announcements').delete().eq('id', params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from('admin_audit_log').insert({
    admin_id: auth.admin.id,
    action: 'delete_announcement',
    details: { announcement_id: params.id },
  });

  return NextResponse.json({ success: true });
}
