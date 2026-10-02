'use client';

import { useAuth } from '@/lib/auth-context';
import { CandyButton } from '@/components/ui/candy-button';
import { ART_SIZE, artSrc, badgeSrc } from '@/lib/art';
import { proRenewalLabel } from '@/lib/pro-crown';
import { memberSince, proPlanLine } from '@/lib/pro-identity';
import { openGoProPopup } from '@/lib/payment/go-pro-popup';
import { softBackground, softBorder, softShadow } from '@/lib/soft-surface';

// FINISH_SPEC AA3: the slot at the top of Settings. Pro members get a
// gold-tinted "WORDOCIOUS PRO" member card — the level-pro badge, "Member
// since <month year>" (profiles.created_at), the plan, the renewal date when
// one is on file, and a candy "Manage subscription" (the Settings ›
// Subscription path, passed in as `onManage`). Free players and guests see the
// same slot as the G1 upsell card (W with the pro crown, "Go Pro") that opens
// the redesigned Go Pro popup. Android parity: ui/ProIdentity.kt ProSettingsCard.

const GOLD = '#f5a524';
const GOLD_BAR = 'linear-gradient(90deg, #ffd166, #f5a524 55%, #f97316)';
const SCENE = 'art-scene-pro-crown' as const;

const inkVars = { ['--ink-l' as string]: '#92400e', ['--ink-d' as string]: '#ffd66b' } as React.CSSProperties;

export function ProMemberCard({ onManage, onGoPro, manageBusy = false, webBilling = false }: {
  onManage: () => void;
  /** Free players: open the Go Pro popup (a host dialog closes itself first). Defaults to openGoProPopup(). */
  onGoPro?: () => void;
  manageBusy?: boolean;
  /** A web (Stripe) purchase is on file — the plan line names it. */
  webBilling?: boolean;
}) {
  const { profile, isProActive, loading } = useAuth();
  const pro = !loading && isProActive;
  const p = profile as unknown as { created_at?: string | null; pro_expires_at?: string | null } | null;
  const since = pro ? memberSince(p?.created_at) : null;
  const renewal = pro ? proRenewalLabel(p?.pro_expires_at ?? null) : null;
  const [sw, sh] = ART_SIZE[SCENE];

  return (
    <section
      className="overflow-hidden"
      aria-label={pro ? 'Wordocious Pro membership' : 'Go Pro'}
      style={{ background: softBackground(GOLD, 0.16), border: softBorder(GOLD, 0.16), borderRadius: 18, boxShadow: softShadow(GOLD, 0.16) }}
    >
      <div aria-hidden="true" style={{ height: 6, background: GOLD_BAR }} />
      <div className="p-3 space-y-2.5">
        <div className="flex items-center gap-3">
          {pro ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={badgeSrc('level-pro')}
              alt=""
              aria-hidden="true"
              width={64}
              height={64}
              draggable={false}
              className="shrink-0 select-none pointer-events-none"
              style={{ width: 64, height: 64, filter: 'drop-shadow(0 3px 5px rgba(180, 83, 9, 0.25))' }}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={artSrc(SCENE)}
              alt=""
              aria-hidden="true"
              width={sw}
              height={sh}
              draggable={false}
              className="shrink-0 select-none pointer-events-none"
              style={{ height: 76, width: 'auto', aspectRatio: `${sw} / ${sh}`, filter: 'drop-shadow(0 3px 5px rgba(180, 83, 9, 0.25))' }}
            />
          )}
          <div className="flex-1 min-w-0 space-y-0.5">
            <h3 className="m-0 text-[15px] font-black soft-ink" style={{ letterSpacing: 1, ...inkVars }}>
              {pro ? 'WORDOCIOUS PRO' : 'GO PRO'}
            </h3>
            {pro ? (
              <>
                {since && <p className="m-0 text-xs font-black" style={{ color: 'var(--color-text)' }}>{since}</p>}
                <p className="m-0 text-[11px] font-bold" style={{ color: 'var(--color-text-muted)' }}>{proPlanLine({ webBilling })}</p>
                {renewal && <p className="m-0 text-[11px] font-bold" style={{ color: 'var(--color-text-muted)' }}>Renews or ends {renewal}</p>}
              </>
            ) : (
              <p className="m-0 text-xs font-bold" style={{ color: 'var(--color-text-muted)' }}>
                Every game unlimited, no ads, VS on every mode.
              </p>
            )}
          </div>
        </div>
        {pro ? (
          <CandyButton color="amber" size="md" block onClick={onManage} disabled={manageBusy}>
            {manageBusy ? 'Opening…' : 'Manage subscription'}
          </CandyButton>
        ) : (
          <CandyButton
            color="amber"
            size="md"
            block
            icon={(
              // eslint-disable-next-line @next/next/no-img-element
              <img src={badgeSrc('pro-crown-sprite')} alt="" aria-hidden="true" width={22} height={22} draggable={false} style={{ width: 22, height: 22 }} />
            )}
            onClick={() => (onGoPro ? onGoPro() : openGoProPopup())}
          >
            Go Pro
          </CandyButton>
        )}
      </div>
    </section>
  );
}
