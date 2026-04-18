'use client';

import { useEffect, useRef, useState } from 'react';
import { X as XIcon, Share2, Copy, Check, Link as LinkIcon, User as UserIcon, TrendingUp, Shield, Skull, Crown, Swords, ChevronDown } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { createInvite } from '@/lib/invite-service';
import { WordleGridIcon } from '@/components/ui/wordle-grid-icon';

interface ModeOption {
  id: string;
  label: string;
  color: string;
  icon?: React.ComponentType<{ className?: string }>;
  romanNumeral?: string;
}

const MODES: ModeOption[] = [
  { id: 'DUEL',          label: 'Classic',      color: '#7c3aed', icon: WordleGridIcon },
  { id: 'QUORDLE',       label: 'QuadWord',     color: '#ec4899', romanNumeral: 'IV' },
  { id: 'OCTORDLE',      label: 'OctoWord',     color: '#7e22ce', romanNumeral: 'VIII' },
  { id: 'SEQUENCE',      label: 'Succession',   color: '#2563eb', icon: TrendingUp },
  { id: 'RESCUE',        label: 'Deliverance',  color: '#059669', icon: Shield },
  { id: 'GAUNTLET',      label: 'Gauntlet',     color: '#d97706', icon: Skull },
  { id: 'PROPERNOUNDLE', label: 'ProperNoundle',color: '#dc2626', icon: Crown },
];

function ModeGlyph({ mode, size = 16 }: { mode: ModeOption; size?: number }) {
  if (mode.romanNumeral) {
    return (
      <span className="font-black" style={{ color: mode.color, fontSize: `${size - 2}px`, lineHeight: 1 }}>
        {mode.romanNumeral}
      </span>
    );
  }
  if (mode.icon) {
    const Icon = mode.icon;
    return <Icon className={`w-4 h-4`} />;
  }
  return <Swords className="w-4 h-4" />;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export function InviteModal({ open, onClose }: Props) {
  const { profile } = useAuth();
  const [tab, setTab] = useState<'link' | 'username'>('link');
  const [modeId, setModeId] = useState<string>('DUEL');
  const [modeOpen, setModeOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [sentToUser, setSentToUser] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const modeRef = useRef<HTMLDivElement>(null);
  const mode = MODES.find((m) => m.id === modeId) ?? MODES[0];

  // Close mode dropdown on outside click
  useEffect(() => {
    if (!modeOpen) return;
    const onClick = (e: MouseEvent) => {
      if (modeRef.current && !modeRef.current.contains(e.target as Node)) setModeOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [modeOpen]);

  if (!open) return null;

  const handleGenerateLink = async () => {
    if (!profile) return;
    setBusy(true); setError(''); setCopied(false);
    const { invite, error: e } = await createInvite({ inviterId: profile.id, gameMode: modeId });
    setBusy(false);
    if (e || !invite) { setError(e ?? 'Failed to create invite'); return; }
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    setInviteUrl(`${origin}/vs/join/${invite.invite_code}`);
  };

  const handleSendToUsername = async () => {
    if (!profile) return;
    const clean = username.trim().replace(/^@+/, '');
    if (!clean) { setError('Enter a username'); return; }
    setBusy(true); setError('');
    const { invite, error: e } = await createInvite({
      inviterId: profile.id,
      gameMode: modeId,
      inviteeUsername: clean,
    });
    setBusy(false);
    if (e || !invite) { setError(e ?? 'Failed to send invite'); return; }
    setSentToUser(clean);
  };

  const handleCopy = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const handleShare = async () => {
    if (!inviteUrl) return;
    const text = `Come play me on Wordocious — ${mode.label}.`;
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await (navigator as any).share({ title: 'Wordocious VS', text, url: inviteUrl });
        return;
      } catch {}
    }
    handleCopy();
  };

  const reset = () => {
    setInviteUrl(null);
    setSentToUser(null);
    setUsername('');
    setError('');
    setCopied(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(26,26,46,0.55)' }}>
      <div
        className="w-full max-w-sm p-5 relative"
        style={{ background: '#ffffff', border: '1.5px solid #ede9f6', borderRadius: '20px' }}
      >
        <button
          onClick={() => { reset(); onClose(); }}
          className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full"
          style={{ background: '#f8f7ff' }}
          aria-label="Close"
        >
          <XIcon className="w-4 h-4" style={{ color: '#9ca3af' }} />
        </button>

        {/* Branded title — matches the gradient treatment used for the
            site wordmark and mode headers. */}
        <h2
          className="text-2xl font-black text-transparent bg-clip-text mb-1"
          style={{ backgroundImage: 'linear-gradient(135deg, #a78bfa, #ec4899)' }}
        >
          Invite a friend
        </h2>
        <p className="text-xs font-bold mb-4" style={{ color: '#9ca3af' }}>
          Pick a mode, then send a link or a username invite.
        </p>

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => { setTab('link'); reset(); }}
            className="flex-1 py-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5"
            style={{
              background: tab === 'link' ? '#7c3aed' : '#f8f7ff',
              color: tab === 'link' ? '#ffffff' : '#9ca3af',
              border: tab === 'link' ? '1.5px solid #7c3aed' : '1.5px solid #ede9f6',
            }}
          >
            <LinkIcon className="w-3 h-3" />
            Share link
          </button>
          <button
            onClick={() => { setTab('username'); reset(); }}
            className="flex-1 py-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5"
            style={{
              background: tab === 'username' ? '#7c3aed' : '#f8f7ff',
              color: tab === 'username' ? '#ffffff' : '#9ca3af',
              border: tab === 'username' ? '1.5px solid #7c3aed' : '1.5px solid #ede9f6',
            }}
          >
            <UserIcon className="w-3 h-3" />
            Username
          </button>
        </div>

        {/* Body — fixed min-height so modal doesn't jump between tabs */}
        <div className="flex flex-col" style={{ minHeight: '220px' }}>
          {/* Mode picker — custom dropdown with brand color + icon */}
          <label className="block text-[10px] font-extrabold uppercase mb-1" style={{ color: '#9ca3af' }}>Mode</label>
          <div ref={modeRef} className="relative mb-3">
            <button
              onClick={() => setModeOpen((o) => !o)}
              className="w-full px-3 py-2 flex items-center justify-between outline-none"
              style={{
                background: '#ffffff',
                border: `1.5px solid ${mode.color}`,
                borderRadius: '10px',
                color: '#1a1a2e',
              }}
            >
              <span className="flex items-center gap-2">
                <span
                  className="w-6 h-6 flex items-center justify-center rounded-md"
                  style={{ background: `${mode.color}15`, color: mode.color }}
                >
                  <ModeGlyph mode={mode} />
                </span>
                <span className="text-sm font-black" style={{ color: mode.color }}>{mode.label}</span>
              </span>
              <ChevronDown className="w-4 h-4" style={{ color: mode.color }} />
            </button>
            {modeOpen && (
              <div
                className="absolute left-0 right-0 top-full mt-1 z-10 overflow-hidden"
                style={{ background: '#ffffff', border: '1.5px solid #ede9f6', borderRadius: '10px', boxShadow: '0 8px 24px rgba(26,26,46,0.12)' }}
              >
                {MODES.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => { setModeId(m.id); setModeOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left"
                    style={{
                      background: m.id === modeId ? `${m.color}0d` : '#ffffff',
                      borderLeft: `4px solid ${m.color}`,
                    }}
                  >
                    <span
                      className="w-6 h-6 flex items-center justify-center rounded-md flex-shrink-0"
                      style={{ background: `${m.color}15`, color: m.color }}
                    >
                      <ModeGlyph mode={m} />
                    </span>
                    <span className="text-sm font-black flex-1" style={{ color: m.color }}>{m.label}</span>
                    {m.id === modeId && <Check className="w-3.5 h-3.5" style={{ color: m.color }} />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {tab === 'link' && (
            <>
              {!inviteUrl ? (
                <button
                  onClick={handleGenerateLink}
                  disabled={busy}
                  className="w-full py-2.5 rounded-xl text-sm font-black text-white disabled:opacity-50"
                  style={{ background: '#7c3aed' }}
                >
                  {busy ? 'Creating…' : 'Generate invite link'}
                </button>
              ) : (
                <>
                  <div
                    className="p-3 mb-3 flex items-center gap-2"
                    style={{ background: '#f8f7ff', border: '1.5px solid #ede9f6', borderRadius: '10px' }}
                  >
                    <code className="flex-1 text-[11px] font-bold truncate" style={{ color: '#1a1a2e' }}>{inviteUrl}</code>
                    <button onClick={handleCopy} className="p-1.5 rounded" style={{ background: '#ffffff', border: '1.5px solid #ede9f6' }}>
                      {copied ? <Check className="w-3.5 h-3.5" style={{ color: '#16a34a' }} /> : <Copy className="w-3.5 h-3.5" style={{ color: '#7c3aed' }} />}
                    </button>
                  </div>
                  <button
                    onClick={handleShare}
                    className="w-full py-2.5 rounded-xl text-sm font-black text-white flex items-center justify-center gap-1.5"
                    style={{ background: '#7c3aed' }}
                  >
                    <Share2 className="w-4 h-4" />
                    Share
                  </button>
                  <p className="text-[10px] font-bold mt-2 text-center" style={{ color: '#9ca3af' }}>
                    Link expires in 24 hours.
                  </p>
                </>
              )}
            </>
          )}

          {tab === 'username' && (
            <>
              {!sentToUser ? (
                <>
                  <label className="block text-[10px] font-extrabold uppercase mb-1" style={{ color: '#9ca3af' }}>Username</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. wordmaster"
                    className="w-full px-3 py-2 text-sm font-bold mb-3 outline-none"
                    style={{ background: '#f8f7ff', border: '1.5px solid #ede9f6', borderRadius: '10px', color: '#1a1a2e' }}
                  />
                  <button
                    onClick={handleSendToUsername}
                    disabled={busy}
                    className="w-full py-2.5 rounded-xl text-sm font-black text-white disabled:opacity-50"
                    style={{ background: '#7c3aed' }}
                  >
                    {busy ? 'Sending…' : 'Send invite'}
                  </button>
                </>
              ) : (
                <div
                  className="p-4 text-center"
                  style={{ background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: '12px' }}
                >
                  <Check className="w-6 h-6 mx-auto mb-1.5" style={{ color: '#16a34a' }} />
                  <p className="text-sm font-black" style={{ color: '#166534' }}>Invite sent to @{sentToUser}</p>
                  <p className="text-[10px] font-bold mt-1" style={{ color: '#16a34a' }}>They'll see it the next time they open Wordocious.</p>
                </div>
              )}
            </>
          )}

          {error && <p className="text-xs font-bold text-red-500 text-center mt-3">{error}</p>}
        </div>
      </div>
    </div>
  );
}
