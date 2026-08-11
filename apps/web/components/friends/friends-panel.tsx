'use client';

// FRIENDS (§207) — the Friends card on the OWN profile page: friends list
// with counts, incoming requests (Accept / Decline), and the Add-by-username
// field. Same card shell + type scale as the referral InvitePanel next to it.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Users, UserPlus, Check, X } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import {
  loadFriends,
  getFriends,
  getIncoming,
  getOutgoing,
  acceptFriend,
  declineFriend,
  requestFriend,
  onFriendsChange,
  type FriendProfile,
} from '@/lib/friends-service';

/** Accepted within the last 24h — wears the NEW chip (Tier 2, Aug 11). */
function isNewFriend(f: FriendProfile): boolean {
  if (!f.since) return false;
  const t = Date.parse(f.since);
  return Number.isFinite(t) && Date.now() - t < 24 * 60 * 60 * 1000;
}

function Avatar({ f }: { f: FriendProfile }) {
  return f.avatar_url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={f.avatar_url} alt={f.username} className="w-8 h-8 rounded-full object-cover" />
  ) : (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black"
      style={{ background: '#7c3aed22', color: '#7c3aed' }}
    >
      {f.username.charAt(0).toUpperCase()}
    </div>
  );
}

export function FriendsPanel() {
  const { user } = useAuth();
  const [, force] = useState(0);
  const [username, setUsername] = useState('');
  const [sending, setSending] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    loadFriends().then(() => force((v) => v + 1));
    return onFriendsChange(() => force((v) => v + 1));
  }, [user]);

  useEffect(() => {
    if (!note) return;
    const t = setTimeout(() => setNote(null), 2500);
    return () => clearTimeout(t);
  }, [note]);

  if (!user) return null;

  const friends = getFriends();
  const incoming = getIncoming();
  const outgoing = getOutgoing();

  const handleAdd = async () => {
    const name = username.trim();
    if (!name || sending) return;
    setSending(true);
    try {
      const r = await requestFriend({ username: name });
      if ('error' in r) {
        setNote(r.error);
      } else {
        setNote(r.status === 'accepted' ? 'You’re now friends! 🎉' : 'Request sent 🤝');
        setUsername('');
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className="p-5 space-y-4"
      style={{ background: 'var(--color-surface)', border: '1.5px solid #c4b5fd', borderRadius: '20px' }}
    >
      <div className="flex items-center gap-2">
        <Users className="w-5 h-5" style={{ color: '#7c3aed' }} />
        <h3
          className="text-base font-black tracking-tight text-transparent bg-clip-text"
          style={{ backgroundImage: 'linear-gradient(135deg, #7c3aed, #ec4899)' }}
        >
          FRIENDS
        </h3>
        {friends.length > 0 && (
          <span className="text-xs font-black" style={{ color: 'var(--color-text-muted)' }}>
            {friends.length}
          </span>
        )}
      </div>

      {/* Incoming requests first — they're the actionable part. */}
      {incoming.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-black uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
            Friend requests
          </p>
          {incoming.map((r) => (
            <div key={r.id} className="flex items-center gap-2.5">
              <Avatar f={r} />
              <Link
                href={`/profile/${r.id}`}
                className="flex-1 min-w-0 text-xs font-extrabold truncate hover:opacity-80 transition-opacity"
                style={{ color: 'var(--color-text)' }}
              >
                {r.username}
              </Link>
              <button
                onClick={() => acceptFriend(r.id)}
                aria-label={`Accept ${r.username}`}
                className="w-7 h-7 rounded-full flex items-center justify-center active:scale-95 transition-transform"
                style={{ background: '#7c3aed', color: '#ffffff' }}
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => declineFriend(r.id)}
                aria-label={`Decline ${r.username}`}
                className="w-7 h-7 rounded-full flex items-center justify-center active:scale-95 transition-transform"
                style={{ background: 'var(--color-surface-hover)', border: '1.5px solid var(--color-border)', color: 'var(--color-text-muted)' }}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Sent requests — the loop's missing feedback (Tier 1, Aug 11):
          sending a request now visibly puts something here, with a cancel. */}
      {outgoing.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-black uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
            Sent — waiting
          </p>
          {outgoing.map((r) => (
            <div key={r.id} className="flex items-center gap-2.5">
              <Avatar f={r} />
              <Link
                href={`/profile/${r.id}`}
                className="flex-1 min-w-0 text-xs font-extrabold truncate hover:opacity-80 transition-opacity"
                style={{ color: 'var(--color-text)' }}
              >
                {r.username}
              </Link>
              <button
                onClick={() => declineFriend(r.id)}
                aria-label={`Cancel request to ${r.username}`}
                className="text-[10px] font-bold px-2 py-1 rounded-lg"
                style={{ background: 'var(--color-surface-hover)', border: '1.5px solid var(--color-border)', color: 'var(--color-text-muted)' }}
              >
                Cancel
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Friends list — avatar rows into their profiles (H2H lives there). */}
      {friends.length > 0 ? (
        <div className="space-y-2">
          {friends.map((f) => (
            <Link key={f.id} href={`/profile/${f.id}`} className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
              <Avatar f={f} />
              <span className="flex-1 min-w-0 text-xs font-extrabold truncate" style={{ color: 'var(--color-text)' }}>
                {f.username}
                {isNewFriend(f) && (
                  <span
                    className="ml-1.5 text-[8px] font-black px-1 py-0.5 rounded align-middle"
                    style={{ background: '#7c3aed22', color: '#7c3aed' }}
                  >
                    NEW
                  </span>
                )}
              </span>
              <span className="text-[10px] font-bold" style={{ color: 'var(--color-text-muted)' }}>
                Lvl {f.level}
              </span>
            </Link>
          ))}
        </div>
      ) : (
        incoming.length === 0 && outgoing.length === 0 && (
          <div className="space-y-1.5 text-xs font-bold" style={{ color: 'var(--color-text-muted)' }}>
            <p>1. Add friends below by username, or from the <span style={{ color: '#7c3aed' }}>Add Friend</span> button on any player&apos;s profile.</p>
            <p>2. Requests you send and receive land right here.</p>
            <p>3. Once a friend accepts, flip the leaderboard to <span style={{ color: '#7c3aed' }}>FRIENDS</span> for your own private race.</p>
          </div>
        )
      )}

      {/* Add by username — exact match, same lookup as VS invites. */}
      <div className="flex items-center gap-2">
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="Add by username"
          className="flex-1 min-w-0 px-3 py-2 rounded-xl text-xs font-bold outline-none"
          style={{
            background: 'var(--color-surface-hover)',
            border: '1.5px solid var(--color-border)',
            color: 'var(--color-text)',
          }}
        />
        <button
          onClick={handleAdd}
          disabled={sending || !username.trim()}
          aria-label="Send friend request"
          className="px-3 py-2 rounded-xl text-xs font-black text-white btn-3d disabled:opacity-50 flex items-center gap-1.5"
          style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', boxShadow: '0 4px 0 #4c1d95' }}
        >
          <UserPlus className="w-3.5 h-3.5" /> Add
        </button>
      </div>
      {note && (
        <p className="text-xs font-extrabold" style={{ color: 'var(--color-text-muted)' }}>{note}</p>
      )}
    </div>
  );
}


/**
 * Compact "Friends (N) →" row for the profile page (Tier 3, Aug 11) — the
 * full card moved to /friends; this is the door, with the request badge.
 */
export function FriendsRowLink() {
  const { user } = useAuth();
  const [, force] = useState(0);
  useEffect(() => {
    if (!user) return;
    loadFriends().then(() => force((v) => v + 1));
    return onFriendsChange(() => force((v) => v + 1));
  }, [user]);
  if (!user) return null;
  const count = getFriends().length;
  const pending = getIncoming().length;
  return (
    <Link
      href="/friends"
      className="flex items-center gap-2.5 p-4 hover:opacity-90 transition-opacity"
      style={{ background: 'var(--color-surface)', border: '1.5px solid #c4b5fd', borderRadius: '20px' }}
    >
      <Users className="w-5 h-5" style={{ color: '#7c3aed' }} />
      <span
        className="text-base font-black tracking-tight text-transparent bg-clip-text"
        style={{ backgroundImage: 'linear-gradient(135deg, #7c3aed, #ec4899)' }}
      >
        FRIENDS
      </span>
      {count > 0 && (
        <span className="text-xs font-black" style={{ color: 'var(--color-text-muted)' }}>{count}</span>
      )}
      {pending > 0 && (
        <span
          className="text-[10px] font-black px-1.5 py-0.5 rounded-full"
          style={{ background: '#dc2626', color: '#fff' }}
          aria-label={`${pending} pending friend requests`}
        >
          {pending}
        </span>
      )}
      <span className="ml-auto text-sm font-black" style={{ color: '#7c3aed' }}>→</span>
    </Link>
  );
}
