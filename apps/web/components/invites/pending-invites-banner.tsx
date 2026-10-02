'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CandyButton } from '@/components/ui/candy-button';
import { CandyBadge } from '@/components/ui/candy-badge';
import { LetterTileAvatar } from '@/components/ui/letter-tile-avatar';
import { SoftNum } from '@/components/ui/soft-number';
import { GREEN_CANDY, INVITE_BAR, SceneArt } from '@/components/friends/invite-screens';
import { SOFT_INK, cardBarStyle, softBackground, softBorder, softShadow } from '@/lib/soft-surface';
import { fetchPendingInvitesForUser, lookupUsernames, markInviteDeclined, type MatchInvite } from '@/lib/invite-service';
import { PROFILE_MODES } from '@/components/profile/mode-picker';

const ACCENT = '#ec4899';

interface Props {
  userId: string | undefined;
}

export function PendingInvitesBanner({ userId }: Props) {
  const router = useRouter();
  const [invites, setInvites] = useState<MatchInvite[]>([]);
  const [inviterNames, setInviterNames] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const list = await fetchPendingInvitesForUser(userId);
      if (cancelled) return;
      setInvites(list);
      // One batched lookup for all inviter usernames (was one query each).
      const names = await lookupUsernames(Array.from(new Set(list.map((i) => i.inviter_id))));
      if (!cancelled) setInviterNames(names);
    })();
    return () => { cancelled = true; };
  }, [userId]);

  if (invites.length === 0) return null;
  const top = invites[0];
  const name = inviterNames[top.inviter_id] ?? 'A friend';

  const handleAccept = () => router.push(`/vs/join/${top.invite_code}`);
  const handleDismiss = async () => {
    await markInviteDeclined(top.id);
    setInvites((prev) => prev.filter((i) => i.id !== top.id));
  };

  return (
    // K1 + T2 notice (docs/FINISH_SPEC.md): a pink-washed card with its top
    // bar, the inviter's letter tile, I tossing the invite envelope (A7: not
    // Home's W host), the headline in Nunito Black, green candy Accept and the
    // soft peach Decline; slides in with a spring (off with Reduce Motion).
    <div
      className="notice-in relative mb-3"
      style={{ background: softBackground(ACCENT, 0.12), border: softBorder(ACCENT, 0.12), borderRadius: 16, boxShadow: softShadow(ACCENT, 0.16) }}
      role="status"
    >
      <div aria-hidden="true" style={{ ...cardBarStyle(ACCENT, 6), background: INVITE_BAR, borderRadius: '14.5px 14.5px 0 0' }} />
      <div className="flex items-center gap-3 px-3 pt-2 pb-1.5">
        <span className="relative shrink-0 inline-flex">
          <LetterTileAvatar name={name} size={38} />
          {/* M: the waiting-invite candy badge (the headline says it). */}
          <CandyBadge count={invites.length} size={16} style={{ position: 'absolute', top: -6, right: -6 }} />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-black leading-snug" style={{ color: SOFT_INK.num }}>
            @{name} invited you to {PROFILE_MODES.find((m) => m.dbKey === top.game_mode)?.title ?? top.game_mode}
          </p>
          {invites.length > 1 && (
            <p className="text-[11px] font-extrabold" style={{ color: SOFT_INK.label }}>
              +<SoftNum size={11}>{invites.length - 1}</SoftNum> more pending
            </p>
          )}
        </div>
        <SceneArt name="art-scene-invite-sent" height={50} className="shrink-0" style={{ marginTop: -4 }} />
      </div>
      <div className="flex items-center justify-end gap-2 px-3 pb-2.5 -mt-1">
        <CandyButton size="sm" color="peach" onClick={handleDismiss} aria-label={`Decline @${name}'s invite`} className="shrink-0">Decline</CandyButton>
        <CandyButton size="sm" icon="check" onClick={handleAccept} aria-label={`Accept @${name}'s invite and play`} className="shrink-0" style={GREEN_CANDY}>Accept</CandyButton>
      </div>
    </div>
  );
}
