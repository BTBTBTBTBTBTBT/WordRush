'use client';

import * as React from 'react';
import type { AvatarConfig, AvatarPart } from '@wordle-duel/core';
import { CastButton } from '@/components/ui/cast-button';
import { QuietButton } from '@/components/ui/family-button';
import { POPUP_DIM, POPUP_SHADOW, PopupBar, popupCard } from '@/components/ui/soft-popup';
import { openGoProPopup } from '@/lib/payment/go-pro-popup';
import { avatarOptionLabel, type BuilderField } from '@/lib/avatar-render';
import { MascotAvatar } from './mascot-avatar';

/**
 * "Unlock with Pro" (FRIDAY-QUEUE 5b, behind the `pro_try_on` switch): every Pro mascot item can be TRIED ON live on the Stage;
 * saving a look that wears one opens this instead of the Go Pro wall. Your mascot keeps wearing it. Go Pro, Keep trying
 * on, or save the look without it. `buy` is the slot for a future per-item purchase ("Buy $1.99"): pass a node and it
 * shows beside Go Pro. ART: `data-art-slot` marks where the ChatGPT-designed frame / header art goes.
 */
export function ProTryOnPopup({ config, initial, parts, onKeepTrying, onSaveWithout, buy }: {
  config: AvatarConfig;
  initial: string;
  parts: readonly AvatarPart[];
  onKeepTrying: () => void;
  onSaveWithout: () => void;
  buy?: React.ReactNode;
}) {
  const names = parts.map((p) => avatarOptionLabel(p.field as BuilderField, p.id));
  const accent = '#f5a524';
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: POPUP_DIM }} role="dialog" aria-modal="true" aria-label="Unlock with Pro">
      <div className="w-full max-w-sm overflow-hidden" style={{ ...popupCard(accent), boxShadow: POPUP_SHADOW }}>
        <PopupBar accent={accent} gradient="linear-gradient(90deg, #ffd166, #f5a524 55%, #f97316)" />
        <div className="px-5 pt-4 pb-5 text-center space-y-3" data-art-slot="art-pro-try-on">
          <MascotAvatar config={{ ...config, display: 'mascot' }} initial={initial} size={132} cutout className="mx-auto" />
          <h2 className="text-[22px] font-black leading-tight" style={{ color: '#7c2d12' }}>UNLOCK WITH PRO</h2>
          <p className="text-[13px] font-bold" style={{ color: '#9a3412' }}>
            {names.length === 1 ? `${names[0]} looks great on you.` : `${names.slice(0, 2).join(' and ')}${names.length > 2 ? ` + ${names.length - 2} more` : ''} look great on you.`}
            {' '}Go Pro to keep {names.length === 1 ? 'it' : 'them'}.
          </p>
          <div className="space-y-2 pt-1">
            <CastButton color="gold" size="md" block onClick={() => openGoProPopup({ reason: 'Pro mascot styles' })}>Go Pro</CastButton>
            {buy}
            <CastButton color="peach" size="md" block onClick={onKeepTrying}>Keep trying on</CastButton>
            <QuietButton size="sm" block onClick={onSaveWithout}>
              Save without {names.length === 1 ? 'it' : 'them'}
            </QuietButton>
          </div>
        </div>
      </div>
    </div>
  );
}
