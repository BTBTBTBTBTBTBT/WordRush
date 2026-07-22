import { supabase } from './supabase-client';

/**
 * Share-event instrumentation (distribution memo: "measure share rate per
 * completed game from day one"). Fire-and-forget insert into share_events
 * (manual-migration 20260722000001) — guests log with user_id null (anon
 * policy allows it), signed-in users as themselves. Never throws, never
 * blocks the share UX. Read via scripts/weekly-five.sql.
 */
export function logShareEvent(
  kind: 'text' | 'image' | 'link_invite' | 'other',
  gameMode: string,
  surface: string,
): void {
  void (async () => {
    try {
      const { data } = await supabase.auth.getSession();
      const userId = data.session?.user?.id ?? null;
      await (supabase as any).from('share_events').insert({
        user_id: userId,
        platform: 'web',
        game_mode: (gameMode || '').slice(0, 32),
        kind,
        surface: (surface || '').slice(0, 32),
      });
    } catch {
      /* analytics must never break sharing */
    }
  })();
}
