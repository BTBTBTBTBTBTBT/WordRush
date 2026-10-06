'use client';

import * as React from 'react';
import { Lock } from 'lucide-react';
import { avatarAccessKey, avatarPartAccess, avatarPriceLabel, avatarRouteLine, type AvatarAccessContext, type AvatarConfig, type AvatarPart } from '@wordle-duel/core';

import { CastButton } from '@/components/ui/cast-button';
import { POPUP_DIM } from '@/components/ui/soft-popup';
import { openGoProPopup } from '@/lib/payment/go-pro-popup';
import { buyAvatarItem } from '@/lib/avatar-access';
import { avatarOptionLabel, type BuilderField } from '@/lib/avatar-render';
import { MascotAvatar } from './mascot-avatar';

const ROUTE_ORDER = { earn: 0, pro: 1, buy: 2, season: 3 } as const;

/**
 * Mascot item gating (docs/cloud-prompts/11, behind itemGating — OFF): the "Locked" card the maker shows when Done
 * is tapped wearing parts the player can't save yet. The mascot keeps wearing them (try-on), and each locked part
 * lists the routes that apply (core avatarLockedCardLines): Earn (with progress) · Included with Pro · Buy $X.
 * Purchases are a stub; "Save without it" saves the look with the locked parts taken off (enforceAvatarAccess).
 */
export function LockedItemCard({ config, initial, locked, ctx, onSaveWithout, onClose }: {
  config: AvatarConfig;
  initial: string;
  locked: readonly AvatarPart[];
  ctx: AvatarAccessContext;
  onSaveWithout: () => void;
  onClose: () => void;
}) {
  const [note, setNote] = React.useState<string | null>(null);
  const buy = async (part: AvatarPart) => {
    const r = await buyAvatarItem(avatarAccessKey(part.field, part.id));
    setNote(r.ok ? null : 'Purchases are coming soon.');
  };
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4" style={{ background: POPUP_DIM }} role="dialog" aria-modal="true" aria-label="Locked">
      <div className="w-full max-w-sm rounded-3xl p-5 max-h-[90vh] overflow-y-auto" style={{ background: '#ffffff', boxShadow: '0 18px 50px rgba(30,15,60,0.35)' }}>
        <div className="flex items-center gap-3">
          {/* TODO(art): ChatGPT lock art `art-lock-card` (a cast member peeking at the item behind a velvet rope). */}
          <span className="shrink-0 w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: '#ede9fe' }} data-art-slot="art-lock-card">
            <Lock size={28} color="#7c3aed" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-black" style={{ color: '#4c1d95' }}>Locked</h2>
            <p className="text-xs font-bold" style={{ color: 'var(--color-text-muted)' }}>You can try {locked.length > 1 ? 'these' : 'it'} on. Unlock to save.</p>
          </div>
          <span className="ml-auto shrink-0"><MascotAvatar config={{ ...config, display: 'mascot' }} initial={initial} size={72} cutout /></span>
        </div>
        <ul className="mt-4 flex flex-col gap-3">
          {locked.map((part) => {
            const access = avatarPartAccess(part, ctx);
            // the locked card's order (core avatarLockedCardLines): earn (play beats pay) · Pro · buy · season
            const routes = [...access.routes].sort((a, b) => ROUTE_ORDER[a.kind] - ROUTE_ORDER[b.kind]);
            return (
              <li key={`${part.field}:${part.id}`} className="rounded-2xl p-3" style={{ background: '#f6f0ff' }}>
                <div className="text-sm font-black" style={{ color: '#4c1d95' }}>{avatarOptionLabel(part.field as BuilderField, part.id)}</div>
                <div className="mt-2 flex flex-col gap-2">
                  {routes.length === 0 ? (
                    <p className="text-xs font-bold" style={{ color: 'var(--color-text-muted)' }}>Not available right now.</p>
                  ) : null}
                  {routes.map((route) => {
                    const line = avatarRouteLine(route);
                    if (route.kind === 'earn') {
                      const pct = Math.round((route.progress.current / route.progress.target) * 100);
                      return (
                        <div key="earn">
                          <div className="text-xs font-extrabold" style={{ color: '#5b21b6' }}>{line}</div>
                          {route.progress.target > 1 && (
                            <div className="mt-1 h-2 rounded-full overflow-hidden" style={{ background: '#e9d5ff' }} role="progressbar" aria-valuemin={0} aria-valuemax={route.progress.target} aria-valuenow={route.progress.current}>
                              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: '#7c3aed' }} />
                            </div>
                          )}
                        </div>
                      );
                    }
                    if (route.kind === 'pro') return <CastButton key="pro" color="purple" size="s" onClick={() => openGoProPopup({ reason: 'Pro mascot styles' })}>{line}</CastButton>;
                    if (route.kind === 'buy') return <CastButton key="buy" color="gold" size="s" onClick={() => void buy(part)} aria-label={`Buy for ${avatarPriceLabel(route.price)}`}>{line}</CastButton>;
                    return <div key="season" className="text-xs font-bold" style={{ color: '#c2410c' }}>{line}</div>;
                  })}
                </div>
              </li>
            );
          })}
        </ul>
        {note && <p role="status" className="text-xs font-bold mt-3 text-center" style={{ color: '#6d28d9' }}>{note}</p>}
        <div className="mt-4 flex flex-col gap-2">
          <CastButton color="purple" size="s" block onClick={onSaveWithout}>Save without {locked.length > 1 ? 'them' : 'it'}</CastButton>
          <button type="button" onClick={onClose} className="text-sm font-black py-2 border-0 bg-transparent cursor-pointer" style={{ color: '#6d28d9' }}>Keep trying on</button>
        </div>
      </div>
    </div>
  );
}
