'use client';

import { shareCaption } from '@wordle-duel/core';
import { useEffect, useState } from 'react';
import { Link as LinkIcon, User as UserIcon, TrendingUp, Shield, Skull, Crown, Swords, ChevronDown } from 'lucide-react';
import { HeaderBack } from '@/components/ui/page-header';
import { useAuth } from '@/lib/auth-context';
import { createInvite } from '@/lib/invite-service';
import { WordleGridIcon } from '@/components/ui/wordle-grid-icon';
import { SixIcon } from '@/components/ui/six-icon';
import { SevenIcon } from '@/components/ui/seven-icon';
import { DAILY_MODES } from '@/lib/modes.generated';
import { GameArt } from '@/components/ui/game-art';
import { Icon3D } from '@/components/ui/icon3d';
import { ArtScene } from '@/components/ui/art-scene';
import { PAGE_SCENES } from '@/lib/art';
import { CandyButton } from '@/components/ui/candy-button';
import { CastButton } from '@/components/ui/cast-button';
import { BRAND_ACCENT, cardBarStyle, softBackground, softBorder } from '@/lib/soft-surface';
import { InviteCodeTiles, InviteSentCard } from '@/components/friends/invite-screens';
import { codeFromInviteUrl } from '@/lib/invite-screens';
import { FeedbackPill } from '@/components/game/feedback-toast';
import { HeadingArt } from '@/components/ui/heading-art';
import { CandySegment } from '@/components/ui/candy-segment';
import { FamilyActionMenu, type FamilyMenuAction } from '@/components/ui/family-action-menu';

// The VS invite window (G5, docs/FINISH_SPEC.md): a lavender-washed sheet with
// the brand top bar (A1; the washes follow the theme's card base), I with the
// invite at the top (not the Home / VS host — A7), tinted tabs and fields, and
// candy buttons for every action (A8).

/** A tinted segmented option / field (A1): stronger wash + ring when selected. */
function tint(accent: string, selected = false): React.CSSProperties {
  return {
    background: softBackground(accent, selected ? 0.24 : 0.1),
    border: selected ? `2px solid ${accent}` : softBorder(accent, 0.1),
  };
}

interface ModeOption {
  id: string;
  label: string;
  color: string;
  icon?: React.ComponentType<{ className?: string }>;
  romanNumeral?: string;
  /** Catalog id, for the game's 3D art (docs/ART_SPEC.md §3). */
  artId: string;
}

// Icons stay web-native (keyed by dbKey); label/color/order from the single-source catalog.
const MODE_ICONS: Record<string, React.ComponentType<{ className?: string }> | undefined> = {
  DUEL: WordleGridIcon, SEQUENCE: TrendingUp, RESCUE: Shield,
  DUEL_6: SixIcon, DUEL_7: SevenIcon, GAUNTLET: Skull, PROPERNOUNDLE: Crown,
};

const MODES: ModeOption[] = DAILY_MODES.map((m) => ({
  id: m.dbKey as string,
  label: m.title,
  color: m.accentHex,
  icon: MODE_ICONS[m.dbKey as string],
  romanNumeral: m.romanNumeral ?? undefined,
  artId: m.id,
}));

/** The game's 3D art filling its 24 px chip; the old glyph only if the art is missing. */
function ModeGlyph({ mode, size = 16 }: { mode: ModeOption; size?: number }) {
  return <GameArt id={mode.artId} size={22} fallback={<OldModeGlyph mode={mode} size={size} />} />;
}

function OldModeGlyph({ mode, size = 16 }: { mode: ModeOption; size?: number }) {
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
  /** Preselect the mode (the VS Friend page's mode chip) and the tab. */
  initialMode?: string;
  initialTab?: 'link' | 'username';
}

export function InviteModal({ open, onClose, initialMode, initialTab }: Props) {
  const { profile, isProActive } = useAuth();
  const [tab, setTab] = useState<'link' | 'username'>('link');
  const [modeId, setModeId] = useState<string>('DUEL');
  const [modeOpen, setModeOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [sentToUser, setSentToUser] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const mode = MODES.find((m) => m.id === modeId) ?? MODES[0];

  // Each open starts from the caller's mode/tab.
  useEffect(() => {
    if (!open) return;
    if (initialMode && MODES.some((m) => m.id === initialMode)) setModeId(initialMode);
    if (initialTab) setTab(initialTab);
  }, [open, initialMode, initialTab]);

  if (!open) return null;

  // Sending an invite is Pro on every platform (VS overhaul parity); answering one stays free.
  const proOnly = () => {
    if (isProActive) return false;
    setError('Inviting a friend is a Pro feature. Answering an invite stays free.');
    return true;
  };

  const handleGenerateLink = async () => {
    if (!profile || proOnly()) return;
    setBusy(true); setError(''); setCopied(false);
    const { invite, error: e } = await createInvite({ inviterId: profile.id, gameMode: modeId });
    setBusy(false);
    if (e || !invite) { setError(e ?? 'Failed to create invite'); return; }
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    setInviteUrl(`${origin}/vs/join/${invite.invite_code}`);
  };

  const handleSendToUsername = async () => {
    if (!profile || proOnly()) return;
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
    // FINISH_SPEC S4: the shared invite copy; the link stays (it is the point).
    const text = shareCaption('vsInvite', { date: new Date().toISOString().slice(0, 10), game: mode.label, url: inviteUrl });
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await (navigator as any).share({ text });
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
        role="dialog"
        aria-modal="true"
        aria-label="Invite a friend"
        className="w-full max-w-sm relative"
        style={{ background: softBackground(BRAND_ACCENT, 0.1), border: softBorder(BRAND_ACCENT, 0.1), borderRadius: '20px', boxShadow: '0 18px 40px rgba(60,30,110,0.28)' }}
      >
        {/* The top bar follows the corners itself (no overflow clip: the mode menu drops below the sheet). */}
        <div aria-hidden="true" style={{ ...cardBarStyle(BRAND_ACCENT), borderRadius: '18.5px 18.5px 0 0' }} />
        <div className="p-5 pt-4 relative">
        <HeaderBack kind="close" onClick={() => { reset(); onClose(); }} size={32} className="absolute top-3 right-3 z-10" />

        {sentToUser ? (
          // T1 (docs/FINISH_SPEC.md): the invite-sent screen — I tossing the
          // envelope springs in, INVITE SENT!, the friend on a glossy pill,
          // candy Send another / Done.
          <InviteSentCard
            framed={false}
            name={`@${sentToUser}`}
            note="They'll see it the next time they open Wordocious."
            onSendAnother={reset}
            onDone={() => { reset(); onClose(); }}
          />
        ) : (
        <>
        {/* I with the invite (docs/ART_SPEC.md §7), kept a little short so the sheet fits small screens. */}
        <ArtScene scene={PAGE_SCENES.addFriend} height={100} className="mb-2" />

        {/* Branded title — matches the gradient treatment used for the
            site wordmark and mode headers. */}
        {/* BJ16: the INVITE A FRIEND lettering, not plain text. */}
        <HeadingArt slug="invite" as="h2" height={34} maxWidth={260} align="left" className="mb-1" />
        <p className="text-xs font-bold mb-4" style={{ color: 'var(--color-text-muted)' }}>
          Pick a mode, then send a link or a username invite.
        </p>

        {/* Tabs */}
        {/* Button family §4: the candy segmented (iOS SoftSegmented parity). */}
        <CandySegment label="Invite by" className="mb-4" height={36}
          options={[
            { key: 'link', label: <><LinkIcon className="w-3 h-3" aria-hidden="true" /> Share link</> },
            { key: 'username', label: <><UserIcon className="w-3 h-3" aria-hidden="true" /> Username</> },
          ]}
          value={tab} onChange={(k) => { if (k !== tab) { setTab(k); reset(); } }} />

        {/* Body — fixed min-height so modal doesn't jump between tabs */}
        <div className="flex flex-col" style={{ minHeight: '220px' }}>
          {/* Mode picker — custom dropdown with brand color + icon */}
          <label className="block text-[10px] font-extrabold uppercase mb-1" style={{ color: 'var(--color-text-muted)' }}>Mode</label>
          <div className="relative mb-3">
            <button
              onClick={() => setModeOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={modeOpen}
              className="w-full px-3 py-2 flex items-center justify-between outline-none"
              style={{
                background: softBackground(mode.color, 0.12),
                border: `1.5px solid ${mode.color}`,
                boxShadow: `inset 0 4px 0 ${mode.color}`,
                borderRadius: '12px',
                color: 'var(--color-text)',
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
            {/* The mode picker — the family action menu (founder 10-05: no plain-text menus). */}
            {modeOpen && (
              <FamilyActionMenu
                title="Pick a game"
                subtitle="The mode for your invite"
                label="Invite mode"
                onClose={() => setModeOpen(false)}
                actions={MODES.map((m): FamilyMenuAction => ({
                  id: m.id, title: m.label, icon: <ModeGlyph mode={m} />, tint: m.color, selected: m.id === modeId,
                  label: m.id === modeId ? `${m.label}, selected` : m.label,
                  run: () => setModeId(m.id),
                }))}
              />
            )}
          </div>

          {tab === 'link' && (
            <>
              {!inviteUrl ? (
                <CastButton screen="pink" size="md" color="purple" block icon="arrow" onClick={handleGenerateLink} disabled={busy}>
                  {busy ? 'Creating…' : 'Generate invite link'}
                </CastButton>
              ) : (
                <>
                  {/* T1: the invite code on glossy letter tiles with a copy candy (copies the link). */}
                  <div className="p-2.5 mb-3" style={{ ...tint(BRAND_ACCENT), borderRadius: '14px' }}>
                    <InviteCodeTiles code={codeFromInviteUrl(inviteUrl) ?? ''} tile={28} copied={copied} onCopy={handleCopy} copyLabel="Copy invite link" />
                    <code className="block mt-1.5 text-[10px] font-bold truncate text-center" style={{ color: 'var(--color-text-muted)' }}>{inviteUrl}</code>
                  </div>
                  <CastButton screen="pink" size="md" color="purple" block icon={<Icon3D name="share" size={20} />} onClick={handleShare}>
                    Share
                  </CastButton>
                  <p className="text-[10px] font-bold mt-2 text-center" style={{ color: 'var(--color-text-muted)' }}>
                    Link expires in 24 hours.
                  </p>
                </>
              )}
            </>
          )}

          {tab === 'username' && (
            <>
              {!sentToUser && (
                <>
                  <label className="block text-[10px] font-extrabold uppercase mb-1" style={{ color: 'var(--color-text-muted)' }}>Username</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. wordmaster"
                    aria-label="Username"
                    className="w-full px-3 py-2 text-sm font-bold mb-3 outline-none"
                    style={{ ...tint(BRAND_ACCENT), borderRadius: '12px', color: 'var(--color-text)' }}
                  />
                  <CastButton screen="pink" size="md" color="purple" block icon="arrow" onClick={handleSendToUsername} disabled={busy}>
                    {busy ? 'Sending…' : 'Send invite'}
                  </CastButton>
                </>
              )}
            </>
          )}

          {error && <div className="flex justify-center mt-3" role="alert"><FeedbackPill key={error} message={error} tone="error" /></div>}
        </div>
        </>
        )}
        </div>
      </div>
    </div>
  );
}
