'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Flame, HelpCircle } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { ProBadge } from '@/components/ui/pro-badge';
import { HelpModal } from '@/components/modals/help-modal';
import { StatPopover } from '@/components/ui/stat-popover';

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 2L3 5.5V10C3 14.5 6 17.5 10 19C14 17.5 17 14.5 17 10V5.5L10 2Z" fill="#A78BFA" stroke="#8B5CF6" strokeWidth="1"/>
      <path d="M8.5 10.5L9.5 11.5L12 9" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export function AppHeader() {
  const { profile } = useAuth();
  const [helpOpen, setHelpOpen] = useState(false);
  const [streakOpen, setStreakOpen] = useState(false);
  const [shieldOpen, setShieldOpen] = useState(false);

  const shields = (profile as any)?.streak_shields ?? 0;
  const streak = profile?.current_streak ?? 0;
  const bestStreak = (profile as any)?.best_streak ?? 0;
  const isPro = (profile as any)?.is_pro ?? false;

  const openStreak = () => {
    setShieldOpen(false);
    setStreakOpen((prev) => !prev);
  };

  const openShield = () => {
    setStreakOpen(false);
    setShieldOpen((prev) => !prev);
  };

  return (
    <>
      <header className="flex items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-1.5">
          <span
            className="text-xl font-black bg-clip-text text-transparent"
            style={{
              backgroundImage: 'linear-gradient(135deg, #a78bfa, #ec4899)',
            }}
          >
            SPELLSTRIKE
          </span>
          {isPro && <ProBadge size="sm" />}
        </Link>

        <div className="flex items-center gap-2 relative">
          {/* Help button — always visible */}
          <button
            onClick={() => setHelpOpen(true)}
            className="flex items-center justify-center w-8 h-8 rounded-full transition-colors"
            style={{
              background: '#f3f4f6',
              border: '1.5px solid #e5e7eb',
              color: '#9ca3af',
            }}
            aria-label="How to play"
          >
            <HelpCircle className="w-4 h-4" />
          </button>

          {profile && (
            <>
              {/* Streak pill */}
              {streak > 0 && (
                <button
                  onClick={openStreak}
                  className="flex items-center gap-1 px-2.5 py-1.5 font-extrabold text-sm transition-transform active:scale-95"
                  style={{
                    background: 'linear-gradient(135deg, #fffbeb, #fff7ed)',
                    border: '1.5px solid #fde68a',
                    borderRadius: '20px',
                    color: '#92400e',
                  }}
                >
                  <Flame className="w-3.5 h-3.5" style={{ color: '#f97316' }} />
                  <span>{streak}</span>
                </button>
              )}
              {/* Shield pill */}
              <button
                onClick={openShield}
                className="flex items-center gap-1.5 px-3 py-1.5 font-extrabold text-sm transition-transform active:scale-95"
                style={{
                  background: '#f3f0ff',
                  border: '1.5px solid #c4b5fd',
                  borderRadius: '20px',
                  color: '#5b21b6',
                }}
              >
                <ShieldIcon className="w-4 h-4" />
                <span>{shields}</span>
              </button>

              {/* Streak Popover */}
              <StatPopover open={streakOpen} onClose={() => setStreakOpen(false)}>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Flame className="w-5 h-5" style={{ color: '#f97316' }} />
                    <span className="text-sm font-black" style={{ color: '#1a1a2e' }}>Daily Streak</span>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold" style={{ color: '#9ca3af' }}>Current</span>
                      <span className="text-sm font-black" style={{ color: '#1a1a2e' }}>{streak} {streak === 1 ? 'day' : 'days'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold" style={{ color: '#9ca3af' }}>Best</span>
                      <span className="text-sm font-black" style={{ color: '#1a1a2e' }}>{bestStreak} {bestStreak === 1 ? 'day' : 'days'}</span>
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid #f0f0f0' }} className="pt-2.5">
                    <p className="text-[11px] leading-relaxed" style={{ color: '#6b7280' }}>
                      Play any daily puzzle each day to keep your streak going. Miss a day and it resets — unless you use a streak shield.
                    </p>
                  </div>
                </div>
              </StatPopover>

              {/* Shield Popover */}
              <StatPopover open={shieldOpen} onClose={() => setShieldOpen(false)}>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <ShieldIcon className="w-5 h-5" />
                    <span className="text-sm font-black" style={{ color: '#1a1a2e' }}>Streak Shields</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold" style={{ color: '#9ca3af' }}>Available</span>
                    <span className="text-sm font-black" style={{ color: '#5b21b6' }}>{shields} {shields === 1 ? 'shield' : 'shields'}</span>
                  </div>

                  <div style={{ borderTop: '1px solid #f0f0f0' }} className="pt-2.5">
                    <p className="text-[11px] leading-relaxed" style={{ color: '#6b7280' }}>
                      Shields protect your streak if you miss a day. Earn a free shield every 7-day streak milestone. PRO members get 4 shields each billing period.
                    </p>
                  </div>
                </div>
              </StatPopover>
            </>
          )}
        </div>
      </header>

      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
    </>
  );
}
