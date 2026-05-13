import { toast } from '@/hooks/use-toast';

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
