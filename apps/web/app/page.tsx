'use client';

import { useState, useEffect } from 'react';
import { Sparkles, Flame, Swords, Grid3x3, Grid2x2, Zap, Timer, LogOut, Star, Users, BookOpen, Shield, Crown, Lock } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { AuthModal } from '@/components/auth/auth-modal';
import { AppHeader } from '@/components/ui/app-header';
import { BottomNav } from '@/components/ui/bottom-nav';
import { ModeLimitModal } from '@/components/modals/mode-limit-modal';
import { initDictionary } from '@wordle-duel/core';
import { getSecondsUntilMidnightUTC } from '@/lib/daily-service';
import { hasPlayedModeToday, cleanupOldPlayData, getSecondsUntilMidnightUTC as getResetSeconds, formatCountdown } from '@/lib/play-limit-service';
import allowedWords from '@/data/allowed.json';
import solutionWords from '@/data/solutions.json';

function getDailyWord(): string {
  const now = new Date();
  const daysSinceEpoch = Math.floor(now.getTime() / 86400000);
  return solutionWords[daysSinceEpoch % solutionWords.length];
}

interface WordDefinition {
  word: string;
  phonetic?: string;
  partOfSpeech?: string;
  definition?: string;
}

function WordOfTheDay() {
  const [info, setInfo] = useState<WordDefinition | null>(null);

  useEffect(() => {
    const word = getDailyWord();
    setInfo({ word });
    fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word.toLowerCase()}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && data[0]) {
          const entry = data[0];
          const phonetic = entry.phonetics?.find((p: any) => p.text)?.text || entry.phonetic || '';
          const meaning = entry.meanings?.[0];
          const partOfSpeech = meaning?.partOfSpeech || '';
          const definition = meaning?.definitions?.[0]?.definition || '';
          setInfo({ word, phonetic, partOfSpeech, definition });
        }
      })
      .catch(() => {});
  }, []);

  if (!info) return null;

  const { word: dailyWord } = info;

  return (
    <div
      className="px-3 py-2"
      style={{
        background: '#ffffff',
        border: '1.5px solid #ede9f6',
        borderRadius: '14px',
      }}
    >
      <div className="flex items-center justify-between mb-0.5">
        <div className="flex items-center gap-1.5">
          <BookOpen className="w-3 h-3" style={{ color: '#9ca3af' }} />
          <span className="text-[10px] font-extrabold uppercase tracking-wider" style={{ color: '#9ca3af' }}>
            Word of the Day
          </span>
        </div>
        <span className="text-[10px] font-bold" style={{ color: '#c4b5fd' }}>
          A new word every day
        </span>
      </div>

      <div className="flex items-baseline gap-2">
        <span className="text-base font-black" style={{ color: '#1a1a2e' }}>
          {dailyWord.charAt(0) + dailyWord.slice(1).toLowerCase()}
        </span>
        {info.phonetic && (
          <span className="text-xs font-bold" style={{ color: '#9ca3af' }}>
            {info.phonetic}
          </span>
        )}
        {info.partOfSpeech && (
          <span className="text-[10px] font-extrabold italic" style={{ color: '#7c3aed' }}>
            {info.partOfSpeech}
          </span>
        )}
      </div>

      {info.definition && (
        <p className="mt-1 text-[11px] font-bold leading-snug" style={{ color: '#4b5563' }}>
          {info.definition}
        </p>
      )}
    </div>
  );
}

function DailyCountdown() {
  const [secs, setSecs] = useState<number | null>(null);
  useEffect(() => {
    setSecs(getSecondsUntilMidnightUTC());
    const i = setInterval(() => setSecs(getSecondsUntilMidnightUTC()), 1000);
    return () => clearInterval(i);
  }, []);
  if (secs === null) {
    return <span style={{ color: '#9ca3af' }} className="text-xs font-bold">Resets in --:--:--</span>;
  }
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return (
    <span style={{ color: '#9ca3af' }} className="text-xs font-bold">
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
    accentColor: '#7c3aed',
    href: '/practice',
    vsHref: '/practice/vs',
  },
  {
    id: 'vs',
    title: 'VS Battle',
    icon: Swords,
    desc: 'Real-time PvP',
    accentColor: '#0d9488',
    href: '/practice/vs',
    vsHref: '/practice/vs',
    badge: 'NEW',
  },
  {
    id: 'quordle',
    title: 'QuadWord',
    icon: Grid2x2,
    desc: '4 words at once',
    accentColor: '#ec4899',
    href: '/quordle',
    vsHref: '/quordle/vs',
    badge: 'HOT',
  },
  {
    id: 'octordle',
    title: 'OctoWord',
    icon: Timer,
    desc: '8 boards, 13 tries',
    accentColor: '#7e22ce',
    href: '/octordle',
    vsHref: '/octordle/vs',
    badge: 'PRO',
  },
  {
    id: 'sequence',
    title: 'Succession',
    icon: Flame,
    desc: '4 words, one by one',
    accentColor: '#2563eb',
    href: '/sequence',
    vsHref: '/sequence/vs',
  },
  {
    id: 'rescue',
    title: 'Deliverance',
    icon: Shield,
    desc: '4 prefilled boards',
    accentColor: '#059669',
    href: '/rescue',
    vsHref: '/rescue/vs',
  },
  {
    id: 'gauntlet',
    title: 'Gauntlet',
    icon: Zap,
    desc: '5 escalating stages',
    accentColor: '#d97706',
    href: '/gauntlet',
    vsHref: '/gauntlet/vs',
  },
  {
    id: 'propernoundle',
    title: 'ProperNoundle',
    icon: Crown,
    desc: 'Guess famous names',
    accentColor: '#dc2626',
    href: '/propernoundle',
    vsHref: '/propernoundle/vs',
  },
];


export default function HomePage() {
  const { user, profile, signOut } = useAuth();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [pendingVsHref, setPendingVsHref] = useState<string | null>(null);
  const [limitModal, setLimitModal] = useState<{ open: boolean; modeName: string }>({ open: false, modeName: '' });
  const [resetCountdown, setResetCountdown] = useState('');
  const router = useRouter();

  const isPro = (profile as any)?.is_pro ?? false;

  useEffect(() => {
    initDictionary(allowedWords, solutionWords);
    cleanupOldPlayData();
  }, []);

  // Countdown for locked cards
  useEffect(() => {
    const update = () => setResetCountdown(formatCountdown(getResetSeconds()));
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
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

  return (
    <div className="fixed inset-0 flex flex-col" style={{ backgroundColor: '#f8f7ff' }}>
      <AppHeader />

      <div className="px-4 flex-1 min-h-0 overflow-hidden pb-24" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {/* Daily Challenge CTA */}
        <Link href="/daily">
          <button
            className="w-full btn-3d flex flex-col items-center py-2 font-black relative"
            style={{
              background: 'linear-gradient(135deg, #f3f0ff, #ede5ff)',
              border: '1.5px solid #c4b5fd',
              borderRadius: '14px',
            }}
          >
            <div className="flex items-center gap-2 text-sm" style={{ color: '#5b21b6' }}>
              <Star className="w-3.5 h-3.5" style={{ color: '#7c3aed' }} />
              <span>Daily Challenge</span>
              <Star className="w-3.5 h-3.5" style={{ color: '#7c3aed' }} />
            </div>
            <DailyCountdown />
          </button>
        </Link>

        {/* Word of the Day */}
        <WordOfTheDay />

        {/* Game Mode Cards - 2 column grid */}
        <div className="section-header mt-1 mb-0.5">GAME MODES</div>
        <div className="grid grid-cols-2 gap-2">
          {MODE_CARDS.map((mode) => {
            const Icon = mode.icon;
            const isLocked = !isPro && user && hasPlayedModeToday(mode.id);

            const handleCardClick = (e: React.MouseEvent) => {
              if (isLocked) {
                e.preventDefault();
                setLimitModal({ open: true, modeName: mode.title });
              } else if (mode.id === 'vs') {
                e.preventDefault();
                handleVsClick(mode.href);
              }
            };

            return (
              <Link key={mode.id} href={mode.href} onClick={handleCardClick}>
                <div
                  className={`relative px-3 py-3 cursor-pointer transition-transform active:scale-[0.96] overflow-hidden ${isLocked ? 'opacity-60' : ''}`}
                  style={{
                    background: '#ffffff',
                    border: `1.5px solid ${isLocked ? '#d1d5db' : '#ede9f6'}`,
                    borderRadius: '14px',
                  }}
                >
                  {/* Top accent bar */}
                  <div
                    className="absolute top-0 left-0 right-0 h-1"
                    style={{
                      background: isLocked
                        ? '#d1d5db'
                        : `linear-gradient(90deg, ${mode.accentColor}, ${mode.accentColor}88)`,
                      borderRadius: '14px 14px 0 0',
                    }}
                  />

                  {/* Badge or Lock */}
                  {isLocked ? (
                    <div className="absolute top-2.5 right-2.5 flex items-center gap-1">
                      <Lock className="w-3 h-3" style={{ color: '#9ca3af' }} />
                    </div>
                  ) : mode.badge ? (
                    <div
                      className="absolute top-2.5 right-2.5 px-1.5 py-0.5 rounded-md text-[8px] font-black text-white"
                      style={{
                        background: mode.badge === 'HOT' ? '#ef4444' : mode.badge === 'NEW' ? '#22c55e' : '#a78bfa',
                      }}
                    >
                      {mode.badge}
                    </div>
                  ) : null}

                  {/* Icon */}
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center mb-1.5"
                    style={{ background: isLocked ? '#f3f4f6' : `${mode.accentColor}15` }}
                  >
                    {isLocked
                      ? <Lock className="w-4 h-4" style={{ color: '#9ca3af' }} />
                      : <Icon className="w-4 h-4" style={{ color: mode.accentColor }} />
                    }
                  </div>
                  <div className="text-[13px] font-black" style={{ color: isLocked ? '#9ca3af' : '#1a1a2e' }}>{mode.title}</div>
                  <div className="text-[10px] font-bold" style={{ color: '#9ca3af' }}>
                    {isLocked ? `Play again in ${resetCountdown}` : mode.desc}
                  </div>

                  {/* VS button — Pro only (not on the VS Battle card itself) */}
                  {!isLocked && isPro && mode.id !== 'vs' && (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleVsClick(mode.vsHref);
                      }}
                      className="absolute bottom-2.5 right-2.5 w-7 h-7 rounded-lg flex items-center justify-center active:scale-95"
                      style={{ background: `${mode.accentColor}15` }}
                      aria-label={`${mode.title} VS`}
                    >
                      <Swords className="w-3.5 h-3.5" style={{ color: mode.accentColor }} />
                    </button>
                  )}
                </div>
              </Link>
            );
          })}
        </div>

        {/* VS Live Banner */}
        <div
          className="flex items-center justify-between px-3 py-2"
          style={{
            background: '#ffffff',
            border: '1.5px solid #ede9f6',
            borderRadius: '14px',
          }}
        >
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="font-black text-xs" style={{ color: '#1a1a2e' }}>LIVE</span>
            </div>
            <div className="text-[9px] font-bold" style={{ color: '#9ca3af' }}>Players online</div>
          </div>
          <button
            onClick={() => handleVsClick('/practice/vs')}
            className="btn-3d px-3 py-1.5 text-white font-black text-[10px] rounded-md"
            style={{
              background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
              boxShadow: '0 2px 0 #3730a3',
            }}
          >
            <Swords className="w-3 h-3 inline mr-1" />
            VS
          </button>
        </div>

        {/* Sign in / Sign out */}
        {!user ? (
          <div
            className="flex items-center justify-between px-3 py-2"
            style={{
              background: '#ffffff',
              border: '1.5px solid #ede9f6',
              borderRadius: '14px',
            }}
          >
            <p className="text-xs font-bold" style={{ color: '#9ca3af' }}>Sign in to track stats & compete</p>
            <button
              onClick={() => setAuthModalOpen(true)}
              className="btn-3d px-4 py-1.5 text-white font-black text-[10px] rounded-lg"
              style={{
                background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                boxShadow: '0 3px 0 #4c1d95',
              }}
            >
              <Sparkles className="w-3 h-3 inline mr-1" />
              Sign In
            </button>
          </div>
        ) : (
          <button
            onClick={() => signOut()}
            className="w-full py-1 text-center text-[10px] font-bold hover:opacity-70 transition-colors"
            style={{ color: '#9ca3af' }}
          >
            <LogOut className="w-3 h-3 inline mr-1" />
            Sign Out
          </button>
        )}
      </div>

      <BottomNav />
      <AuthModal open={authModalOpen} onOpenChange={setAuthModalOpen} />
      <ModeLimitModal
        open={limitModal.open}
        onClose={() => setLimitModal({ open: false, modeName: '' })}
        modeName={limitModal.modeName}
      />
    </div>
  );
}
