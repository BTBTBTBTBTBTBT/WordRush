'use client';

import { useState, useEffect } from 'react';
import { Sparkles, Flame, Swords, Grid3x3, Grid2x2, Zap, Timer, LogOut, Star, Users, BookOpen } from 'lucide-react';
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
      className="px-4 py-3.5"
      style={{
        background: '#ffffff',
        border: '1.5px solid #ede9f6',
        borderRadius: '16px',
      }}
    >
      <div className="flex items-center gap-1.5 mb-2">
        <BookOpen className="w-3 h-3" style={{ color: '#9ca3af' }} />
        <span className="text-[10px] font-extrabold uppercase tracking-wider" style={{ color: '#9ca3af' }}>
          Word of the Day
        </span>
      </div>

      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-black" style={{ color: '#1a1a2e' }}>
          {dailyWord.charAt(0) + dailyWord.slice(1).toLowerCase()}
        </span>
        {info.phonetic && (
          <span className="text-sm font-bold" style={{ color: '#9ca3af' }}>
            {info.phonetic}
          </span>
        )}
      </div>

      {info.partOfSpeech && (
        <div className="mt-0.5">
          <span
            className="text-[10px] font-extrabold italic"
            style={{ color: '#7c3aed' }}
          >
            {info.partOfSpeech}
          </span>
        </div>
      )}

      {info.definition && (
        <p className="mt-1.5 text-xs font-bold leading-relaxed" style={{ color: '#4b5563' }}>
          {info.definition}
        </p>
      )}

      <div
        className="mt-2 pt-2"
        style={{ borderTop: '1px solid #ede9f6' }}
      >
        <span className="text-[10px] font-bold" style={{ color: '#c4b5fd' }}>
          A new word every day
        </span>
      </div>
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
    id: 'gauntlet',
    title: 'Gauntlet',
    icon: Zap,
    desc: '5 escalating stages',
    accentColor: '#d97706',
    href: '/gauntlet',
    vsHref: '/gauntlet/vs',
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
    id: 'octordle',
    title: 'OctoWord',
    icon: Timer,
    desc: '8 boards, 13 tries',
    accentColor: '#7e22ce',
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
    <div className="min-h-screen pb-20" style={{ backgroundColor: '#f8f7ff' }}>
      <AppHeader />

      <div className="max-w-lg mx-auto px-4 space-y-4">
        {/* Word of the Day */}
        <WordOfTheDay />

        {/* Streak Card */}
        {profile && streak > 0 && (
          <div
            className="flex items-center justify-between p-4"
            style={{
              background: 'linear-gradient(135deg, #fffbeb, #fff7ed)',
              border: '1.5px solid #fde68a',
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
                <div className="text-[10px] font-extrabold uppercase" style={{ color: '#92400e' }}>
                  Day Streak
                </div>
                <div className="text-[28px] font-black leading-none" style={{ color: '#1a1a2e' }}>{streak}</div>
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
              boxShadow: '0 5px 0 #4c1d95, 0 8px 20px rgba(109,40,217,0.25)',
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
                  className="relative p-[14px] cursor-pointer transition-transform active:scale-[0.96] overflow-hidden"
                  style={{
                    background: '#ffffff',
                    border: '1.5px solid #ede9f6',
                    borderRadius: '16px',
                    boxShadow: '0 4px 0 #ede9f6',
                  }}
                >
                  {/* Top accent bar */}
                  <div
                    className="absolute top-0 left-0 right-0 h-1"
                    style={{
                      background: `linear-gradient(90deg, ${mode.accentColor}, ${mode.accentColor}88)`,
                      borderRadius: '16px 16px 0 0',
                    }}
                  />

                  {/* Badge */}
                  {mode.badge && (
                    <div
                      className="absolute top-2.5 right-2 px-1.5 py-0.5 rounded-md text-[9px] font-black text-white"
                      style={{
                        background: mode.badge === 'HOT' ? '#ef4444' : mode.badge === 'NEW' ? '#22c55e' : '#a78bfa',
                      }}
                    >
                      {mode.badge}
                    </div>
                  )}

                  {/* Icon wrap */}
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center mb-2 mt-1"
                    style={{ background: `${mode.accentColor}15` }}
                  >
                    <Icon className="w-4 h-4" style={{ color: mode.accentColor }} />
                  </div>

                  <div className="text-[13px] font-black" style={{ color: '#1a1a2e' }}>{mode.title}</div>
                  <div className="text-[10px] font-bold" style={{ color: '#9ca3af' }}>
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
            background: '#ffffff',
            border: '1.5px solid #ede9f6',
            borderRadius: '16px',
          }}
        >
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="font-black text-sm" style={{ color: '#1a1a2e' }}>LIVE</span>
            </div>
            <div>
              <div className="text-[10px] font-bold" style={{ color: '#9ca3af' }}>Players online</div>
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
              background: '#ffffff',
              border: '1.5px solid #ede9f6',
              borderRadius: '16px',
            }}
          >
            <p className="text-sm font-bold mb-3" style={{ color: '#9ca3af' }}>Sign in to track stats & compete</p>
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
            className="w-full py-2 text-center text-xs font-bold hover:opacity-70 transition-colors"
            style={{ color: '#9ca3af' }}
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
