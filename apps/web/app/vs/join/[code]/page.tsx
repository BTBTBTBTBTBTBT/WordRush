'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Swords, X as XIcon } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import {
  lookupInviteByCode,
  lookupInviterUsername,
  markInviteDeclined,
  vsHrefForMode,
  type MatchInvite,
} from '@/lib/invite-service';

export default function JoinInvitePage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading } = useAuth();
  const code = (params?.code as string) || '';

  const [invite, setInvite] = useState<MatchInvite | null>(null);
  const [inviterName, setInviterName] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'notfound' | 'expired' | 'closed'>('loading');

  useEffect(() => {
    if (loading) return;
    (async () => {
      const i = await lookupInviteByCode(code);
      if (!i) { setStatus('notfound'); return; }
      if (i.status !== 'pending') { setStatus('closed'); return; }
      if (new Date(i.expires_at).getTime() < Date.now()) { setStatus('expired'); return; }
      setInvite(i);
      setInviterName(await lookupInviterUsername(i.inviter_id));
      setStatus('ready');
    })();
  }, [code, loading]);

  const handleAccept = () => {
    if (!invite) return;
    // Navigate into the VS mode with the invite code attached — the VS
    // game wires it into the matchmaking handshake.
    router.push(`${vsHrefForMode(invite.game_mode)}?inviteCode=${invite.invite_code}`);
  };

  const handleDecline = async () => {
    if (!invite) return;
    await markInviteDeclined(invite.id);
    router.push('/');
  };

  const centered = (node: React.ReactNode) => (
    <div className="min-h-screen-stable flex items-center justify-center px-5" style={{ backgroundColor: '#f8f7ff' }}>
      <div className="w-full max-w-sm text-center p-6" style={{ background: '#ffffff', border: '1.5px solid #ede9f6', borderRadius: '20px' }}>
        {node}
      </div>
    </div>
  );

  if (loading || status === 'loading') {
    return centered(<p className="text-sm font-bold animate-pulse" style={{ color: '#9ca3af' }}>Loading invite…</p>);
  }

  if (!user) {
    return centered(
      <>
        <Swords className="w-8 h-8 mx-auto mb-2" style={{ color: '#7c3aed' }} />
        <h1 className="text-lg font-black mb-1" style={{ color: '#1a1a2e' }}>Sign in to accept</h1>
        <p className="text-xs font-bold mb-4" style={{ color: '#9ca3af' }}>
          A friend invited you to a Wordocious match. Sign in (or create a free account) to join.
        </p>
        <Link href={`/?returnTo=${encodeURIComponent(`/vs/join/${code}`)}`}>
          <button className="w-full py-2.5 rounded-xl text-sm font-black text-white" style={{ background: '#7c3aed' }}>
            Sign in
          </button>
        </Link>
      </>,
    );
  }

  if (status === 'notfound') return centered(<p className="text-sm font-black" style={{ color: '#dc2626' }}>Invite not found.</p>);
  if (status === 'expired') return centered(<p className="text-sm font-black" style={{ color: '#dc2626' }}>This invite has expired.</p>);
  if (status === 'closed') return centered(<p className="text-sm font-black" style={{ color: '#9ca3af' }}>This invite is no longer active.</p>);

  return centered(
    <>
      <Swords className="w-10 h-10 mx-auto mb-2" style={{ color: '#7c3aed' }} />
      <h1 className="text-lg font-black" style={{ color: '#1a1a2e' }}>You're invited!</h1>
      <p className="text-xs font-bold mt-1 mb-4" style={{ color: '#9ca3af' }}>
        {inviterName ? <>@{inviterName} </> : <>Someone </>}
        wants to play <span style={{ color: '#1a1a2e' }}>{invite?.game_mode}</span> against you.
      </p>
      <div className="flex gap-2">
        <button
          onClick={handleDecline}
          className="flex-1 py-2.5 rounded-xl text-sm font-black flex items-center justify-center gap-1"
          style={{ background: '#f8f7ff', border: '1.5px solid #ede9f6', color: '#1a1a2e' }}
        >
          <XIcon className="w-4 h-4" />
          Decline
        </button>
        <button
          onClick={handleAccept}
          className="flex-1 py-2.5 rounded-xl text-sm font-black text-white"
          style={{ background: '#7c3aed' }}
        >
          Play now
        </button>
      </div>
    </>,
  );
}
