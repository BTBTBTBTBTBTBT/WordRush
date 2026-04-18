'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, X as XIcon } from 'lucide-react';
import { fetchPendingInvitesForUser, lookupInviterUsername, markInviteDeclined, type MatchInvite } from '@/lib/invite-service';

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
      // Resolve inviter usernames in parallel.
      const names: Record<string, string> = {};
      await Promise.all(
        list.map(async (inv) => {
          const n = await lookupInviterUsername(inv.inviter_id);
          if (n) names[inv.inviter_id] = n;
        }),
      );
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
    <div
      className="flex items-center gap-3 p-3 mb-3"
      style={{
        background: 'linear-gradient(135deg, #fdf4ff, #fce7f3)',
        border: '1.5px solid #f5d0fe',
        borderRadius: '14px',
      }}
    >
      <div className="w-9 h-9 flex items-center justify-center rounded-full flex-shrink-0" style={{ background: '#ec4899' }}>
        <Mail className="w-4 h-4 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-black truncate" style={{ color: '#1a1a2e' }}>
          @{name} invited you to {top.game_mode}
        </p>
        {invites.length > 1 && (
          <p className="text-[10px] font-bold" style={{ color: '#a21caf' }}>
            +{invites.length - 1} more pending
          </p>
        )}
      </div>
      <button
        onClick={handleAccept}
        className="px-3 py-1.5 rounded-lg text-xs font-black text-white"
        style={{ background: '#ec4899' }}
      >
        Play
      </button>
      <button
        onClick={handleDismiss}
        className="w-7 h-7 flex items-center justify-center rounded-full"
        style={{ background: '#ffffff', border: '1.5px solid #f5d0fe', color: '#a21caf' }}
        aria-label="Dismiss"
      >
        <XIcon className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
