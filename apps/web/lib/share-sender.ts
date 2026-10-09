'use client';

// The SENDER of a share image (FRIDAY-QUEUE item 46): the signed-in player's resolved avatar, kept here so every card
// renderer can draw their own mascot big and celebrating without each share button threading it through. A tiny
// provider component (components/providers/share-sender-sync.tsx) keeps it current from the profile; a guest has none,
// and a card then simply has no hero band.

import { avatarInitial } from './avatar-render';
import { shareAvatarFor, type ShareAvatar } from './share-avatar';
import type { AvatarRowFields } from './avatar-cast';

let sender: ShareAvatar | null = null;

export function setShareSender(avatar: ShareAvatar | null): void {
  sender = avatar;
}

export function getShareSender(): ShareAvatar | null {
  return sender;
}

/** The sender from a profile row (null when there is no username yet). */
export function shareSenderFromProfile(
  row: (AvatarRowFields & { username?: string | null; level?: number | null; is_pro?: boolean | null }) | null | undefined,
): ShareAvatar | null {
  const name = row?.username?.trim();
  if (!row || !name) return null;
  // `avatarInitial` keeps the same letter the in-app mascot wears.
  void avatarInitial(name);
  return shareAvatarFor(row, name, null, { level: row.level ?? null, pro: row.is_pro ?? null });
}
