import { getAdminSupabase } from '@/lib/supabase-admin';

/**
 * Stamp a cron job's heartbeat (system_heartbeats, service-role only). The
 * admin Ops page compares last_run_at against each job's schedule and turns a
 * stale heartbeat red — the difference between "the cron is quietly dead" and
 * knowing about it.
 *
 * MUST never break the job it instruments: swallow every failure, including
 * the table not existing yet (the manual migration may lag this deploy).
 */
export async function stampHeartbeat(job: string, ok: boolean, detail?: string): Promise<void> {
  try {
    await getAdminSupabase()
      .from('system_heartbeats')
      .upsert({ job, last_run_at: new Date().toISOString(), ok, detail: detail ?? null });
  } catch {
    // Instrumentation only — the job's own result matters more.
  }
}
