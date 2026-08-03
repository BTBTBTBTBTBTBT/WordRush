import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { verifyAdmin } from '@/lib/admin-auth';
import { broadcastPush, resolveSegment, type PushSegment } from '@/lib/push/broadcast';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // batches over every token; needs Pro headroom
export const runtime = 'nodejs'; // APNs uses node:http2 — unavailable on edge

const SEGMENTS: PushSegment[] = ['everyone', 'lapsed7d', 'pro', 'streak'];

/** Segment sizes for the composer + recent campaign history (audit log). */
export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if ('error' in auth) return auth.error;

  const admin = getAdminSupabase();
  const counts: Record<string, number> = {};
  for (const seg of SEGMENTS) {
    const ids = await resolveSegment(seg);
    if (ids === null) {
      // "everyone" = anyone reachable on any channel.
      const [{ count: subs }, { data: devices }] = await Promise.all([
        admin.from('push_subscriptions').select('user_id', { count: 'exact', head: true }),
        admin.from('device_tokens').select('user_id'),
      ]);
      counts[seg] = new Set((devices ?? []).map((d: any) => d.user_id)).size + (subs ?? 0);
    } else {
      counts[seg] = ids.size;
    }
  }

  const { data: history } = await admin
    .from('admin_audit_log')
    .select('created_at, details')
    .eq('action', 'push_campaign')
    .order('created_at', { ascending: false })
    .limit(10);

  return NextResponse.json({ counts, history: history ?? [] });
}

/**
 * Send a campaign (or a test to the requesting admin only).
 * Body: { title, body, segment, test? }
 */
export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if ('error' in auth) return auth.error;

  const { title, body, segment, test } = await request.json().catch(() => ({}));
  if (!title?.trim() || !body?.trim()) {
    return NextResponse.json({ error: 'Title and message are required' }, { status: 400 });
  }
  if (!test && !SEGMENTS.includes(segment)) {
    return NextResponse.json({ error: 'Unknown segment' }, { status: 400 });
  }
  if (String(title).length > 60 || String(body).length > 240) {
    return NextResponse.json({ error: 'Title ≤60 chars, message ≤240' }, { status: 400 });
  }

  // Test mode targets exactly one person: the admin pressing the button.
  const userIds = test ? new Set<string>([auth.admin.id]) : await resolveSegment(segment);

  const result = await broadcastPush({ title: title.trim(), body: body.trim() }, userIds);

  const admin = getAdminSupabase();
  await admin.from('admin_audit_log').insert({
    admin_id: auth.admin.id,
    action: 'push_campaign',
    details: { title: title.trim(), body: body.trim(), segment: test ? 'test' : segment, ...result },
  });

  return NextResponse.json(result);
}
