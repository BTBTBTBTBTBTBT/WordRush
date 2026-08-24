import type { Metadata } from 'next';

// §235: the "Share invite link" unfurl read "Profile · wordocious.com" in
// iMessage — the parent layout's generic title. A friend invite should say
// who is inviting you, so this fetches the username server-side (public
// column, anon key) and titles the card with it. noindex is inherited from
// the parent (§229) — link scrapers read og tags regardless.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
// Server-only: profiles RLS blocks ANON reads (verified — the anon query
// returns [] and every unfurl fell back to "Player Profile"), so this
// metadata lookup uses the service key. It runs exclusively in
// generateMetadata on the server and exposes only the username, which is
// public on every leaderboard already.
const LOOKUP_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

async function usernameFor(id: string): Promise<string | null> {
  if (!SUPABASE_URL || !LOOKUP_KEY || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${id}&select=username`,
      { headers: { apikey: LOOKUP_KEY, Authorization: `Bearer ${LOOKUP_KEY}` }, next: { revalidate: 3600 } },
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as Array<{ username?: string }>;
    return rows[0]?.username ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata(
  { params }: { params: { id: string } },
): Promise<Metadata> {
  const name = await usernameFor(params.id);
  const title = name ? `${name} on Wordocious` : 'Player Profile — Wordocious';
  const description = name
    ? `Add ${name} as a friend and race the daily word puzzles — 9 modes, one leaderboard.`
    : 'Add friends and race the daily word puzzles — 9 modes, one leaderboard.';
  return {
    title,
    description,
    openGraph: { title, description },
    twitter: { title, description },
  };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
