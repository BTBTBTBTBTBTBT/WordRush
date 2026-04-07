'use client';

import { useState, useEffect } from 'react';
import { Sparkles, Flame, Swords, Grid3x3, Grid2x2, Zap, Timer, LogOut, Star, Users } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { AuthModal } from '@/components/auth/auth-modal';
import { AppHeader } from '@/components/ui/app-header';
import { BottomNav } from '@/components/ui/bottom-nav';
import { initDictionary } from '@wordle-duel/core';
import { getSecondsUntilMidnightUTC } from '@/lib/daily-service';
import allowedWords from '@/data/allowed.json';
import solutionWords from '@/data/solutions.json';

function DailyCountdown() {
  const [secs, setSecs] = useState(getSecondsUntilMidnightUTC());
  useEffect(() => {
    const i = setInterval(() => setSecs(getSecondsUntilMidnightUTC()), 1000);
    return () => clearInterval(i);
  }, []);
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return (
    <span style={{ color: 'rgba(255,255,255,0.65)' }} className="text-xs font-bold">
      Resets in {h.toString().padStart(2, '0')}:{m.toString().padStart(2, '0')}:{s.toString().padStart(2, '0')}
    </span>
  );
}

const MODE_CARDS = [
  {
    id: 'practice',
    title: 'Classic',
    icon: Grid3x3,
    desc: '1 word, 6 tries',
    gradient: 'linear-gradient(145deg, #7c3aed, #4f46e5)',
    shadow: '0 4px 0 #3730a3',
    href: '/practice',
    vsHref: '/practice/vs',
  },
  {
    id: 'quordle',
    title: 'QuadWord',
    icon: Grid2x2,
    desc: '4 words at once',
    gradient: 'linear-gradient(145deg, #be185d, #9d174d)',
    shadow: '0 4px 0 #831843',
    href: '/quordle',
    vsHref: '/quordle/vs',
    badge: 'HOT',
  },
  {
    id: 'vs',
    title: 'VS Battle',
    icon: Swords,
    desc: 'Real-time PvP',
    gradient: 'linear-gradient(145deg, #0d9488, #0f766e)',
    shadow: '0 4px 0 #115e59',
    href: '/practice/vs',
    vsHref: '/practice/vs',
    badge: 'NEW',
  },
  {
    id: 'gauntlet',
    title: 'Gauntlet',
    icon: Zap,
    desc: '5 escalating stages',
    gradient: 'linear-gradient(145deg, #b45309, #92400e)',
    shadow: '0 4px 0 #78350f',
    href: '/gauntlet',
    vsHref: '/gauntlet/vs',
  },
  {
    id: 'sequence',
    title: 'Succession',
    icon: Flame,
    desc: '4 words, one by one',
    gradient: 'linear-gradient(145deg, #1d4ed8, #1e40af)',
    shadow: '0 4px 0 #1e3a8a',
    href: '/sequence',
    vsHref: '/sequence/vs',
  },
  {
    id: 'octordle',
    title: 'OctoWord',
    icon: Timer,
    desc: '8 boards, 13 tries',
    gradient: 'linear-gradient(145deg, #7e22ce, #6b21a8)',
    shadow: '0 4px 0 #581c87',
    href: '/octordle',
    vsHref: '/octordle/vs',
    badge: 'PRO',
  },
];

export default function HomePage() {
  const { user, profile, signOut } = useAuth();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [pendingVsHref, setPendingVsHref] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    initDictionary(allowedWords, solutionWords);
  }, []);

  useEffect(() => {
    if (user && pendingVsHref) {
      router.push(pendingVsHref);
      setPendingVsHref(null);
    }
  }, [user, pendingVsHref, router]);

  const handleVsClick = (vsHref: string) => {
    if (user) {
      router.push(vsHref);
    } else {
      setPendingVsHref(vsHref);
      setAuthModalOpen(true);
    }
  };

  const streak = profile?.current_streak ?? 0;

  return (
    <div className="min-h-screen pb-20" style={{ backgroundColor: '#0d0a1a' }}>
      <AppHeader />

      <div className="max-w-lg mx-auto px-4 space-y-4">
        {/* Streak Card */}
        {profile && streak > 0 && (
          <div
            className="flex items-center justify-between p-4"
            style={{
              background: 'linear-gradient(135deg, rgba(251,191,36,0.18), rgba(234,88,12,0.12))',
              border: '1px solid rgba(251,191,36,0.25)',
              borderRadius: '16px',
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #f97316, #ef4444)' }}
              >
                <Flame className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="text-[10px] font-extrabold uppercase" style={{ color: '#fbbf24' }}>
                  Day Streak
                </div>
                <div className="text-[28px] font-black text-white leading-none">{streak}</div>
              </div>
            </div>
            <div
              className="px-3 py-1.5 rounded-lg text-white font-black text-xs"
              style={{
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                boxShadow: '0 3px 0 #92400e',
              }}
            >
              ON FIRE
            </div>
          </div>
        )}

        {/* Daily Challenge CTA */}
        <Link href="/daily">
          <button
            className="w-full btn-3d flex flex-col items-center py-[13px] text-white font-black relative"
            style={{
              background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
              borderRadius: '14px',
              boxShadow: '0 5px 0 #4c1d95, 0 8px 20px rgba(109,40,217,0.4)',
            }}
          >
            <div className="flex items-center gap-2 text-base">
              <Star className="w-4 h-4" style={{ color: '#fbbf24' }} />
              <span>Daily Challenge</span>
              <Star className="w-4 h-4" style={{ color: '#fbbf24' }} />
            </div>
            <DailyCountdown />
          </button>
        </Link>

        {/* Game Mode Cards - 2 column grid */}
        <div className="section-header mt-6 mb-2">GAME MODES</div>
        <div className="grid grid-cols-2 gap-3">
          {MODE_CARDS.map((mode) => {
            const Icon = mode.icon;
            return (
              <Link key={mode.id} href={mode.href}>
                <div
                  className="relative p-[14px] cursor-pointer transition-transform active:scale-[0.96]"
                  style={{
                    background: mode.gradient,
                    borderRadius: '16px',
                    boxShadow: mode.shadow,
                  }}
                >
                  {/* Shine circle */}
                  <div
                    className="absolute top-0 right-0 w-16 h-16 rounded-full"
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      transform: 'translate(25%, -25%)',
                    }}
                  />

                  {/* Badge */}
                  {mode.badge && (
                    <div
                      className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md text-[9px] font-black text-white"
                      style={{
                        background: mode.badge === 'HOT' ? '#ef4444' : mode.badge === 'NEW' ? '#22c55e' : '#a78bfa',
                      }}
                    >
                      {mode.badge}
                    </div>
                  )}

                  {/* Icon wrap */}
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center mb-2"
                    style={{ background: 'rgba(255,255,255,0.15)' }}
                  >
                    <Icon className="w-4 h-4 text-white" />
                  </div>

                  <div className="text-[13px] font-black text-white">{mode.title}</div>
                  <div className="text-[10px] font-bold" style={{ color: 'rgba(255,255,255,0.65)' }}>
                    {mode.desc}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* VS Live Banner */}
        <div
          className="flex items-center justify-between p-4 mt-2"
          style={{
            background: 'linear-gradient(135deg, #0f172a, #1e1b4b)',
            border: '1px solid rgba(99,102,241,0.3)',
            borderRadius: '16px',
          }}
        >
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-white font-black text-sm">LIVE</span>
            </div>
            <div>
              <div className="text-white/60 text-[10px] font-bold">Players online</div>
            </div>
          </div>
          <button
            onClick={() => handleVsClick('/practice/vs')}
            className="btn-3d px-4 py-2 text-white font-black text-xs rounded-lg"
            style={{
              background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
              boxShadow: '0 3px 0 #3730a3',
            }}
          >
            <Swords className="w-3.5 h-3.5 inline mr-1" />
            VS
          </button>
        </div>

        {/* Sign in / Sign out */}
        {!user ? (
          <div
            className="text-center p-6"
            style={{
              background: '#13102a',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '16px',
            }}
          >
            <p className="text-white/60 text-sm font-bold mb-3">Sign in to track stats & compete</p>
            <button
              onClick={() => setAuthModalOpen(true)}
              className="btn-3d px-6 py-2.5 text-white font-black text-sm rounded-xl"
              style={{
                background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                boxShadow: '0 4px 0 #4c1d95',
              }}
            >
              <Sparkles className="w-4 h-4 inline mr-1.5" />
              Sign In
            </button>
          </div>
        ) : (
          <button
            onClick={() => signOut()}
            className="w-full py-2 text-center text-white/30 text-xs font-bold hover:text-white/50 transition-colors"
          >
            <LogOut className="w-3 h-3 inline mr-1" />
            Sign Out
          </button>
        )}
      </div>

      <BottomNav />
      <AuthModal open={authModalOpen} onOpenChange={setAuthModalOpen} />
    </div>
  );
}
