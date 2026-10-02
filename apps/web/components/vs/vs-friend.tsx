'use client';

/**
 * The Friend page, "Challenge" (VS overhaul §3) — Pro to send. RACE MY RUN:
 * pick friends (and/or a link), play the puzzle first, and they race your run
 * any time in the next 24 hours. LIVE NOW: the existing private-match invite
 * (link or @username) for when you are both online.
 */
import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Check, Link as LinkIcon, Loader2, User as UserIcon } from 'lucide-react';
import { Icon3D } from '@/components/ui/icon3d';
import { VS_MODE_ORDER } from '@wordle-duel/core';
import { useAuth } from '@/lib/auth-context';
import { vsHrefForMode } from '@/lib/invite-service';
import { getFriends, loadFriends, onFriendsChange, type FriendProfile } from '@/lib/friends-service';
import { VS, friendCta, friendLine, loadVsMode } from '@/lib/vs-lobby';
import { InviteModal } from '@/components/invites/invite-modal';
import { BottomNav } from '@/components/ui/bottom-nav';
import { InitialAvatar, ModeChip, SectionLabel, VsNav, vsCardStyle } from './vs-ui';
import { PAGE_HOSTS } from '@/lib/mascots';
import { ArtScene } from '@/components/ui/art-scene';
import { PAGE_SCENES } from '@/lib/art';
import { PageBackground } from '@/components/ui/page-background';

const MODES = VS_MODE_ORDER as readonly string[];

export function VsFriend() {
  const router = useRouter();
  const params = useSearchParams();
  const { profile, isProActive, loading } = useAuth();
  const [mode, setMode] = useState('DUEL');
  const [tab, setTab] = useState<'race' | 'live'>('race');
  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [friendsLoaded, setFriendsLoaded] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(() => new Set(params?.get('friend') ? [params.get('friend') as string] : []));
  const [link, setLink] = useState(false);
  const [invite, setInvite] = useState<'link' | 'username' | null>(null);

  useEffect(() => {
    const m = params?.get('mode');
    setMode(m && MODES.includes(m) ? m : loadVsMode(isProActive, MODES));
  }, [params, isProActive]);

  useEffect(() => {
    if (!profile?.id) return;
    const sync = () => { setFriends([...getFriends()]); setFriendsLoaded(true); };
    const off = onFriendsChange(sync);
    loadFriends().then(sync).catch(() => setFriendsLoaded(true));
    return off;
  }, [profile?.id]);

  // Rivals / CHALLENGE BACK preselect a friend; keep them on top of the list.
  const ordered = useMemo(() => {
    const pre = params?.get('friend');
    return pre ? [...friends].sort((a, b) => (a.id === pre ? -1 : b.id === pre ? 1 : 0)) : friends;
  }, [friends, params]);

  const toggle = (id: string) => setPicked((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  // Only accepted friends can be sent to (the server drops anyone else).
  const pickedFriends = friends.filter((f) => picked.has(f.id)).map((f) => f.id);
  const canSend = pickedFriends.length > 0 || link;
  const start = () => {
    if (!canSend) return;
    const q = new URLSearchParams({ send: '1' });
    if (pickedFriends.length) q.set('friends', pickedFriends.join(','));
    if (link) q.set('link', '1');
    router.push(`${vsHrefForMode(mode)}?${q.toString()}`);
  };

  const segment = (key: 'race' | 'live', title: string, sub: string) => {
    const on = tab === key;
    return (
      <button
        type="button"
        onClick={() => setTab(key)}
        aria-pressed={on}
        className="flex-1 flex flex-col items-center py-2 transition-colors"
        style={{ borderRadius: 10, background: on ? '#ffffff' : 'transparent', boxShadow: on ? VS.cardShadow : undefined }}
      >
        <span className="text-[12px] font-black" style={{ color: on ? VS.deep : VS.ink, letterSpacing: 0.6 }}>{title}</span>
        <span className="text-[10px] font-bold" style={{ color: on ? '#4b5563' : VS.ink }}>{sub}</span>
      </button>
    );
  };

  const checkCircle = (on: boolean) => (
    <span className="flex items-center justify-center shrink-0 rounded-full" style={{ width: 22, height: 22, background: on ? VS.ink : '#ffffff', boxShadow: on ? undefined : 'inset 0 0 0 2px #d1d5db' }}>
      {on && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
    </span>
  );

  return (
    <PageBackground tint="vs" scheme="light" className="min-h-screen pb-24">
      <InviteModal open={invite !== null} onClose={() => setInvite(null)} initialMode={mode} initialTab={invite ?? 'link'} />
      <div className="max-w-md mx-auto px-4 pt-2 space-y-3.5">
        <VsNav title="CHALLENGE" host={PAGE_HOSTS.vs} onBack={() => router.push('/vs')} right={<ModeChip mode={mode} />} />

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin" style={{ color: VS.ink }} /></div>
        ) : !isProActive ? (
          // Sending is Pro; answering a challenge stays free (from the lobby or a link).
          <div className="p-4 space-y-3 text-center" style={vsCardStyle}>
            <Icon3D name="crown" size={28} className="mx-auto" />
            <div className="text-[15px] font-black" style={{ color: VS.deep }}>Challenging friends is Pro</div>
            <p className="text-[12.5px] font-bold" style={{ color: '#4b5563' }}>Answering a challenge is free. Go Pro to send your own runs and invite friends live.</p>
            <button type="button" onClick={() => router.push('/pro')} className="w-full py-3 text-[14px] font-black text-white" style={{ background: '#7c3aed', borderRadius: 12 }}>SEE PRO</button>
          </div>
        ) : (
          <>
            <div className="flex p-1" style={{ background: VS.soft, borderRadius: 12 }} role="group" aria-label="Race my run or live now">
              {segment('race', 'RACE MY RUN', 'they play any time in 24 h')}
              {segment('live', 'LIVE NOW', 'both online')}
            </div>

            {tab === 'race' ? (
              <>
                <SectionLabel>Friends</SectionLabel>
                <div className="space-y-2">
                  {!friendsLoaded ? (
                    <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin" style={{ color: VS.ink }} /></div>
                  ) : ordered.length === 0 ? (
                    <div className="p-3 flex flex-col items-center gap-2 text-center text-[12.5px] font-bold" style={{ ...vsCardStyle, color: '#4b5563' }}>
                      <ArtScene scene={PAGE_SCENES.addFriend} />
                      No friends yet. Send a link, or add friends from the Friends tab.
                    </div>
                  ) : ordered.map((f) => {
                    const on = picked.has(f.id);
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => toggle(f.id)}
                        aria-pressed={on}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
                        style={{ ...vsCardStyle, boxShadow: on ? `0 0 0 2px ${VS.ink}, ${VS.cardShadow}` : VS.cardShadow }}
                      >
                        <InitialAvatar name={f.username} url={f.avatar_url} emoji={f.avatar_emoji} size={34} />
                        <span className="flex-1 min-w-0">
                          <span className="block text-[13px] font-black truncate" style={{ color: '#1f2937' }}>@{f.username}</span>
                          <span className="block text-[11px] font-bold truncate" style={{ color: (f.h2hW ?? 0) > (f.h2hL ?? 0) ? VS.ink : VS.label }}>
                            {friendLine(f.h2hW ?? 0, f.h2hL ?? 0)}
                          </span>
                        </span>
                        {checkCircle(on)}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => setLink((v) => !v)}
                    aria-pressed={link}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
                    style={{ ...vsCardStyle, boxShadow: link ? `0 0 0 2px ${VS.ink}, ${VS.cardShadow}` : VS.cardShadow }}
                  >
                    <span className="flex items-center justify-center shrink-0 rounded-full" style={{ width: 34, height: 34, background: VS.soft }}>
                      <LinkIcon className="w-4 h-4" style={{ color: VS.ink }} />
                    </span>
                    <span className="flex-1 text-[13px] font-black" style={{ color: '#1f2937' }}>Send a link instead</span>
                    {checkCircle(link)}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={start}
                  disabled={!canSend}
                  className="w-full py-3.5 text-[14px] font-black text-white transition-transform active:scale-[0.98] disabled:opacity-40"
                  style={{ background: VS.ink, borderRadius: 14, letterSpacing: 0.6 }}
                >
                  {friendCta(pickedFriends.length, link)}
                </button>
                <p className="text-center text-[11.5px] font-bold" style={{ color: VS.label }}>They get a notification with your time to beat.</p>
              </>
            ) : (
              <div className="p-4 space-y-3" style={vsCardStyle}>
                <p className="text-[12.5px] font-bold" style={{ color: '#4b5563' }}>
                  Play at the same time: send a private match link or invite by @username. The match starts when your friend joins.
                </p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setInvite('link')} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[12px] font-black text-white" style={{ background: VS.ink, borderRadius: 11 }}>
                    <LinkIcon className="w-3.5 h-3.5" /> SHARE A LINK
                  </button>
                  <button type="button" onClick={() => setInvite('username')} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[12px] font-black" style={{ background: VS.soft, color: VS.ink, borderRadius: 11 }}>
                    <UserIcon className="w-3.5 h-3.5" /> @USERNAME
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
      <BottomNav />
    </PageBackground>
  );
}
