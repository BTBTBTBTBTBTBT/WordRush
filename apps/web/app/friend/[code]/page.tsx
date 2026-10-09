import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cleanInviteCode, isFriendCode } from '@wordle-duel/core';
import { InviteLanding } from '@/components/invites/invite-landing';
import { loadInvitePage } from '@/lib/invite-page';

// wordocious.com/friend/<CODE> — the branded link for a friend / gift invite (the referral code,
// FRIDAY-QUEUE 9f). Accept continues in the existing /join/<CODE> referral flow.
export const dynamic = 'force-dynamic';

function codeOf(raw: string): string | null {
  const code = cleanInviteCode(raw);
  return isFriendCode(code) ? code : null;
}

export async function generateMetadata({ params }: { params: { code: string } }): Promise<Metadata> {
  const code = codeOf(params.code);
  if (!code) return {};
  return (await loadInvitePage('friend', code)).metadata;
}

export default async function FriendInvitePage({ params }: { params: { code: string } }) {
  const code = codeOf(params.code);
  if (!code) notFound();
  const { preview } = await loadInvitePage('friend', code);
  return <InviteLanding preview={preview} />;
}
