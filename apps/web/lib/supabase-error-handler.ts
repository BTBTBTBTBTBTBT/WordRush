import { toast } from '@/hooks/use-toast';
import * as Sentry from '@sentry/nextjs';

/**
 * A server-rejected write (RLS policy, guard trigger, CHECK constraint) is a
 * bug on OUR side, not the user's — supabase-js returns it as `{ error }`
 * without throwing, so it's invisible unless every call site checks. Route
 * those through here: logged for local debugging AND captured to Sentry so a
 * rejected write can never run silently in prod again (the gauntlet
 * total_boards>16 guard rejection ran unnoticed for 2 days, bible 140).
 * Safe to call with null/undefined — no-ops.
 */
export function reportRejectedWrite(context: string, error: any): void {
  if (!error) return;
  console.error(`${context} rejected:`, error);
  Sentry.captureMessage(
    `server write rejected: ${context} — ${error?.message ?? String(error)}`,
    'error',
  );
}

/**
 * Show a user-facing toast when a Supabase call fails due to
 * network errors or rate limiting. Safe to call with any error
 * (including null/undefined) — it no-ops for non-network issues.
 */
export function handleSupabaseError(error: any, context?: string): void {
  if (!error) return;

  const message: string = error?.message || error?.error_description || '';
  const status: number | undefined = error?.status || error?.statusCode || error?.code;

  if (status === 429 || /rate.?limit|too many/i.test(message)) {
    toast({
      title: 'Slow down',
      description: 'Too many requests. Please wait a moment and try again.',
      variant: 'destructive',
    });
  } else if (/failed to fetch|networkerror|network|ECONNREFUSED|ETIMEDOUT|ERR_NETWORK/i.test(message)) {
    toast({
      title: 'Connection issue',
      description: 'Check your internet connection and try again.',
      variant: 'destructive',
    });
  } else if (status === 503 || status === 502) {
    toast({
      title: 'Server unavailable',
      description: 'The server is temporarily unavailable. Please try again shortly.',
      variant: 'destructive',
    });
  }
}
