'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { BRANDED_INVITES_SWITCH } from '@wordle-duel/core';
import { CastButton } from '@/components/ui/cast-button';
import { Sheet } from '@/components/friends/friends-ui';
import { useFlags } from '@/hooks/use-flags';
import { fetchChallenge } from '@/lib/vs-challenges-client';
import { lookupInviteByCode, vsHrefForMode } from '@/lib/invite-service';
import { resolveTypedCode } from '@/lib/join-by-code';
import { SOFT_INK, softMix } from '@/lib/soft-surface';

/**
 * "Have a code?" (FRIDAY-QUEUE 9f): ONE obvious family button that opens a paste/type sheet. It takes a
 * bare code or any invite link and sends you to the screen that accepts it. Self-contained: the VS lobby
 * and the Friends tab each just place <HaveACodeButton />. `screen` picks the button's family color
 * ('blue' on VS pages, 'pink' on Friends). Hidden when the branded_invites switch is off.
 */
export function HaveACodeButton({ screen = 'blue', size = 'md', block = false, className }: {
  screen?: 'blue' | 'pink'; size?: 'sm' | 'md' | 'lg'; block?: boolean; className?: string;
}) {
  const { isLive } = useFlags();
  const [open, setOpen] = useState(false);
  if (!isLive(BRANDED_INVITES_SWITCH)) return null;
  return (
    <>
      <CastButton screen={screen} color={screen === 'pink' ? 'pink' : 'teal'} size={size} block={block} className={className} onClick={() => setOpen(true)}>
        Have a code?
      </CastButton>
      {open && <HaveACodeSheet screen={screen} onClose={() => setOpen(false)} />}
    </>
  );
}

export function HaveACodeSheet({ screen = 'blue', onClose }: { screen?: 'blue' | 'pink'; onClose: () => void }) {
  const router = useRouter();
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement | null>(null);
  useEffect(() => { input.current?.focus(); }, []);

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
    <Sheet onClose={onClose} label="Have a code?">
      <div className="space-y-3">
        <p className="text-[16px] font-black" style={{ color: SOFT_INK.num }}>HAVE A CODE?</p>
        <p className="text-[12.5px] font-bold" style={{ color: SOFT_INK.label }}>Paste the invite link or type the code your friend sent.</p>
        <input
          ref={input}
          value={typed}
          onChange={(e) => { setTyped(e.target.value); setError(null); }}
          onKeyDown={(e) => { if (e.key === 'Enter') void go(); }}
          placeholder="Link or CODE"
          aria-label="Invite link or code"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          className="w-full px-3 py-3 text-[15px] font-black outline-none"
          style={{ letterSpacing: 1, background: softMix('#8b5cf6', 0.12), borderRadius: 12, color: SOFT_INK.num }}
        />
        {error && <p className="text-[12.5px] font-bold" style={{ color: '#dc2626' }} role="alert">{error}</p>}
        <div className="flex gap-2">
          <CastButton screen={screen} color="peach" size="md" onClick={() => void paste()} className="shrink-0">Paste</CastButton>
          <CastButton screen={screen} color={screen === 'pink' ? 'pink' : 'teal'} size="md" block onClick={() => void go()} disabled={busy || typed.trim().length < 4}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" aria-label="Checking" /> : 'Join'}
          </CastButton>
        </div>
      </div>
    </Sheet>
  );
}
