'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { X as XIcon } from 'lucide-react';
import { CandyButton, CandyLink } from '@/components/ui/candy-button';
import { cardBarStyle, softCard } from '@/lib/soft-surface';
import { useAuth } from '@/lib/auth-context';
import {
  lookupInviteByCode,
  lookupInviterUsername,
  markInviteDeclined,
  vsHrefForMode,
  type MatchInvite,
} from '@/lib/invite-service';
import { MODE_BY_DBKEY } from '@/lib/modes.generated';
import { ArtScene } from '@/components/ui/art-scene';
import { PAGE_SCENES, poseSrc } from '@/lib/art';

// The invite's characters (decorative): W pointing you to the match; Ozzy
// sneaks into the sign-in card (FINISH_SPEC K1 / A7).
function InviteArt({ who }: { who: 'w' | 'o3' }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={who === 'w' ? poseSrc('w', 'point') : poseSrc('o3', 'sneak')} alt="" aria-hidden="true" width={76} height={76} draggable={false} className="mx-auto mb-2" style={{ width: 76, height: 76, objectFit: 'contain' }} />;
}
import { PageBackground } from '@/components/ui/page-background';

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
    <PageBackground tint="vs" className="min-h-screen-stable flex items-center justify-center px-5">
      {/* A1: a tinted VS-teal card with the game-card top bar (dark mode keeps its dark surface). */}
      <div className="w-full max-w-sm text-center overflow-hidden" style={softCard('#0d9488', { radius: 20 })}>
        <div aria-hidden="true" style={cardBarStyle('#0d9488')} />
        <div className="p-6 pt-5">{node}</div>
      </div>
    </PageBackground>
  );

  if (loading || status === 'loading') {
    return centered(<p className="text-sm font-bold animate-pulse" style={{ color: 'var(--color-text-muted)' }}>Loading invite…</p>);
  }

  if (!user) {
    return centered(
      <>
        <InviteArt who="o3" />
        <h1 className="text-lg font-black mb-1" style={{ color: 'var(--color-text)' }}>Sign in to accept</h1>
        <p className="text-xs font-bold mb-4" style={{ color: 'var(--color-text-muted)' }}>
          A friend invited you to a Wordocious match. Sign in (or create a free account) to join.
        </p>
        <CandyLink href={`/?returnTo=${encodeURIComponent(`/vs/join/${code}`)}`} color="teal" size="lg" block>Sign in</CandyLink>
      </>,
    );
  }

  if (status === 'notfound') return centered(<><ArtScene scene={PAGE_SCENES.notFound} className="mb-3" /><p className="text-sm font-black" style={{ color: '#dc2626' }}>Invite not found.</p></>);
  if (status === 'expired') return centered(<p className="text-sm font-black" style={{ color: '#dc2626' }}>This invite has expired.</p>);
  if (status === 'closed') return centered(<p className="text-sm font-black" style={{ color: 'var(--color-text-muted)' }}>This invite is no longer active.</p>);

  return centered(
    <>
      <InviteArt who="w" />
      <h1 className="text-lg font-black" style={{ color: 'var(--color-text)' }}>You're invited!</h1>
      <p className="text-xs font-bold mt-1 mb-4" style={{ color: 'var(--color-text-muted)' }}>
        {inviterName ? <>@{inviterName} </> : <>Someone </>}
        wants to play <span style={{ color: 'var(--color-text)' }}>{(invite && MODE_BY_DBKEY[invite.game_mode]?.title) ?? invite?.game_mode}</span> against you.
      </p>
      <div className="flex gap-2">
        <CandyButton color="peach" size="md" className="flex-1" onClick={handleDecline} icon={<XIcon className="w-4 h-4" aria-hidden="true" strokeWidth={3} />}>
          Decline
        </CandyButton>
        <CandyButton color="teal" size="md" className="flex-1" icon="play" onClick={handleAccept}>
          Play now
        </CandyButton>
      </div>
    </>,
  );
}
