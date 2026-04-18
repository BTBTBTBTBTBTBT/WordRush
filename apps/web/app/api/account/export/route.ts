import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAdminSupabase } from '@/lib/supabase-admin';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.replace('Bearer ', '');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const userClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error: authError } = await userClient.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const userId = user.id;
    const admin = getAdminSupabase();

    const [profile, stats, matches, dailyResults, medals, achievements] = await Promise.all([
      admin.from('profiles').select('*').eq('id', userId).maybeSingle(),
      admin.from('user_stats').select('*').eq('user_id', userId),
      admin.from('matches').select('*').or(`player1_id.eq.${userId},player2_id.eq.${userId}`),
      admin.from('daily_results').select('*').eq('user_id', userId),
      admin.from('daily_medals').select('*').eq('user_id', userId),
      admin.from('user_achievements').select('*').eq('user_id', userId),
    ]);

    const payload = {
      exported_at: new Date().toISOString(),
      user_id: userId,
      email: user.email ?? null,
      profile: profile.data ?? null,
      user_stats: stats.data ?? [],
      matches: matches.data ?? [],
      daily_results: dailyResults.data ?? [],
      daily_medals: medals.data ?? [],
      user_achievements: achievements.data ?? [],
    };

    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="wordocious-export-${userId}.json"`,
      },
    });
  } catch (error) {
    console.error('Account export error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
