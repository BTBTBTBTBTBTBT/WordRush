import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAdminSupabase } from '@/lib/supabase-admin';

export async function POST(req: NextRequest) {
  try {
    // Verify the user's session from the Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');

    // Create a client with the user's token to verify identity
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const userClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error: authError } = await userClient.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const userId = user.id;
    const admin = getAdminSupabase();

    // Delete user data in order (respecting foreign key constraints)
    // 1. Delete user stats
    await admin.from('user_stats').delete().eq('user_id', userId);

    // 2. Delete matches where user is a participant
    await admin.from('matches').delete().or(`player1_id.eq.${userId},player2_id.eq.${userId}`);

    // 3. Delete daily results
    await admin.from('daily_results').delete().eq('user_id', userId);

    // 4. Delete medals
    await admin.from('daily_medals').delete().eq('user_id', userId);

    // 5. Delete achievements
    await admin.from('user_achievements').delete().eq('user_id', userId);

    // 6. Delete purchases / subscriptions
    await admin.from('purchases').delete().eq('user_id', userId);

    // 7. Delete profile
    await admin.from('profiles').delete().eq('id', userId);

    // 8. Delete the auth user
    const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
    if (deleteError) {
      console.error('Failed to delete auth user:', deleteError);
      return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Account deletion error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
