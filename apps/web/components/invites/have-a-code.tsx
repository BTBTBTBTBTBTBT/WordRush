'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { BRANDED_INVITES_SWITCH } from '@wordle-duel/core';
import { CastButton } from '@/components/ui/cast-button';
import { FamIcon, QuietButton } from '@/components/ui/family-button';
import { ArtScene } from '@/components/ui/art-scene';
import { BubbleText } from '@/components/ui/bubble-text';
import { Sheet } from '@/components/friends/friends-ui';
import { useFlags } from '@/hooks/use-flags';
import { fetchChallenge } from '@/lib/vs-challenges-client';
import { lookupInviteByCode, vsHrefForMode } from '@/lib/invite-service';
import { resolveTypedCode } from '@/lib/join-by-code';
import { FR_LOOK } from '@/lib/friends-look';

/**
 * "Have a code?" (FRIDAY-QUEUE 9f): a button that opens a paste/type sheet. It takes a bare code or any
 * invite link and sends you to the screen that accepts it. Self-contained: the VS lobby places the full-width
 * <HaveACodeButton block />; the Friends tab places the small `quiet` pill beside Add a friend (2.8 TestFlight:
 * it must not lead the page). `screen` picks the button's family color ('blue' on VS pages, 'pink' on Friends).
 * Hidden when the branded_invites switch is off.
 */
export function HaveACodeButton({ screen = 'blue', size = 'md', block = false, quiet = false, className }: {
  screen?: 'blue' | 'pink'; size?: 'sm' | 'md' | 'lg'; block?: boolean;
  /** A small family QUIET pill instead of the cast button. */
  quiet?: boolean; className?: string;
}) {
  const { isLive } = useFlags();
  const [open, setOpen] = useState(false);
  if (!isLive(BRANDED_INVITES_SWITCH)) return null;
  return (
    <>
      {quiet ? (
        <QuietButton size="sm" icon="link" className={className} onClick={() => setOpen(true)}>Have a code?</QuietButton>
      ) : (
        <CastButton screen={screen} color={screen === 'pink' ? 'pink' : 'teal'} size={size} block={block} className={className} onClick={() => setOpen(true)}>
          Have a code?
        </CastButton>
      )}
      {open && <HaveACodeSheet screen={screen} onClose={() => setOpen(false)} />}
    </>
  );
}

/**
 * The paste / type sheet: sized to its content, I waving the invite beside the bubble title, the Friends wall
 * behind it when a season is on, a soft rounded field, PASTE (family quiet) and JOIN (primary, dimmed until
 * there is input). It rides above the on-screen keyboard (Sheet).
 */
export function HaveACodeSheet({ screen = 'blue', onClose }: { screen?: 'blue' | 'pink'; onClose: () => void }) {
  const router = useRouter();
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [focused, setFocused] = useState(false);
  const input = useRef<HTMLInputElement | null>(null);
  useEffect(() => { input.current?.focus(); }, []);
  const canJoin = !busy && typed.trim().length >= 4;

  const go = useCallback(async () => {
    if (busy || typed.trim().length < 4) return;
    setBusy(true);
    setError(null);
    const r = await resolveTypedCode(typed, { challenge: fetchChallenge, invite: lookupInviteByCode, vsHref: vsHrefForMode });
    setBusy(false);
    if ('error' in r) { setError(r.error); return; }
    onClose();
    router.push(r.href);
  }, [busy, typed, onClose, router]);

  const paste = async () => {
    try { setTyped((await navigator.clipboard.readText()).trim().slice(0, 120)); setError(null); } catch { /* clipboard blocked: type it */ }
  };

  return (
    <Sheet onClose={onClose} label="Have a code?" wall>
      <div className="flex flex-col gap-3.5 pt-1">
        <div className="flex items-center gap-1.5">
          <ArtScene scene="i-invite" height={92} center={false} priority maxWidthPct={100} />
          <div className="min-w-0 flex-1 flex flex-col gap-1">
            <BubbleText text="HAVE A CODE?" palette="friends" maxSize={32} minSize={20} align="left" level={2} className="w-full" />
            <p className="text-[12.5px] font-bold" style={{ color: FR_LOOK.sub }}>Paste an invite link or type the code your friend sent.</p>
          </div>
        </div>
        <label
          className="flex items-center gap-2 px-3.5"
          style={{ height: 52, borderRadius: 16, background: `rgba(124, 58, 237, ${focused ? 0.2 : 0.13})`, transition: 'background-color 160ms ease-out' }}
        >
          <FamIcon name="link" size={16} ink={FR_LOOK.sub} />
          <input
            ref={input}
            value={typed}
            onChange={(e) => { setTyped(e.target.value); setError(null); }}
            onKeyDown={(e) => { if (e.key === 'Enter') void go(); }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Paste a link or type a code"
            aria-label="Invite link or code"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="go"
            className="min-w-0 flex-1 bg-transparent text-[16px] font-extrabold outline-none"
            style={{ letterSpacing: 0.8, color: FR_LOOK.ink }}
          />
        </label>
        {error && <p className="text-[12.5px] font-bold" style={{ color: '#dc2626' }} role="alert">{error}</p>}
        <div className="flex items-center gap-2.5">
          <QuietButton size="md" className="shrink-0" onClick={() => void paste()}>Paste</QuietButton>
          <CastButton screen={screen} color={screen === 'pink' ? 'pink' : 'teal'} size="md" block onClick={() => void go()} disabled={!canJoin}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" aria-label="Checking" /> : 'Join'}
          </CastButton>
        </div>
      </div>
    </Sheet>
  );
}
