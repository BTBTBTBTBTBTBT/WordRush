import type { Metadata } from 'next';
import { inviteShareLine, inviteSubline, inviteTitle, type InviteCopyInput, type InviteLinkKind } from '@wordle-duel/core';
import { resolveInvitePreview, type InvitePreview } from '@/lib/invite-preview';

/** Shared by app/vs/[code]/page.tsx and app/friend/[code]/page.tsx: the preview + the share-card metadata. */
export async function loadInvitePage(kind: InviteLinkKind, code: string): Promise<{ preview: InvitePreview; metadata: Metadata }> {
  const preview = await resolveInvitePreview(kind, code);
  const path = `/${kind}/${preview.code}`;
  const url = `https://wordocious.com${path}`;
  const copy: InviteCopyInput = { variant: preview.variant, sender: preview.sender, game: preview.gameTitle, raceLine: preview.raceLine };
  const ok = preview.status === 'ok';
  const title = ok ? inviteTitle(copy) : 'Wordocious invite';
  const description = ok ? `${inviteShareLine(copy)}. ${inviteSubline(copy)}` : 'Daily word games, played with friends.';
  const image = `https://wordocious.com/api/invite-og?k=${kind}&c=${preview.code}`;
  return {
    preview,
    metadata: {
      title,
      description,
      // The page is a private-ish landing (codes are not content): keep it out of search results.
      robots: { index: false, follow: false },
      // Smart App Banner "Open" routes into the installed app through universal links.
      itunes: { appId: '6775966055', appArgument: url },
      openGraph: { title, description, url, siteName: 'Wordocious', type: 'website', images: [{ url: image, width: 1200, height: 630, alt: title, type: 'image/png' }] },
      twitter: { card: 'summary_large_image', title, description, images: [image] },
    },
  };
}
