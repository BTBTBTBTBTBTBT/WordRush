import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { VS_RESERVED_SEGMENTS, cleanInviteCode, isVsCode } from '@wordle-duel/core';
import { InviteLanding } from '@/components/invites/invite-landing';
import { loadInvitePage } from '@/lib/invite-page';

// wordocious.com/vs/<CODE> — the ONE branded link for a live VS invite or a race-my-run challenge
// (FRIDAY-QUEUE 9f). Server-rendered so iMessage / WhatsApp / SMS scrapers get the per-invite preview
// image (/api/invite-og). The old /vs/join/<CODE> and /vs/challenge/<CODE> links keep working.
// Static siblings (bots, live, join, challenge, friend) win over this dynamic segment.
export const dynamic = 'force-dynamic';

function codeOf(raw: string): string | null {
  if ((VS_RESERVED_SEGMENTS as readonly string[]).includes(raw.toLowerCase())) return null;
  const code = cleanInviteCode(raw);
  return isVsCode(code) ? code : null;
}

export async function generateMetadata({ params }: { params: { code: string } }): Promise<Metadata> {
  const code = codeOf(params.code);
  if (!code) return {};
  return (await loadInvitePage('vs', code)).metadata;
}

export default async function VsInvitePage({ params }: { params: { code: string } }) {
  const code = codeOf(params.code);
  if (!code) notFound();
  const { preview } = await loadInvitePage('vs', code);
  return <InviteLanding preview={preview} />;
}
