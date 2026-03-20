'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Trophy, Zap, Flame, Timer, Grid3x3, Grid2x2, User, LogOut, Swords } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { AuthModal } from '@/components/auth/auth-modal';
import { Button } from '@/components/ui/button';
import { initDictionary } from '@wordle-duel/core';
import allowedWords from '@/data/allowed.json';
import solutionWords from '@/data/solutions.json';

export default function HomePage() {
  const { user, profile, signOut } = useAuth();
  const [authModalOpen, setAuthModalOpen] = useState(false);

  useEffect(() => {
    initDictionary(allowedWords, solutionWords);
  }, []);

  const gameModes = [
    {
      id: 'practice',
      title: 'Classic',
      icon: Grid3x3,
      description: 'Solve one puzzle, 6 tries',
      color: 'from-blue-500 to-cyan-500',
      href: '/practice',
      difficulty: 'Easy',
    },
    {
      id: 'quordle',
      title: 'QuadWord',
      icon: Grid2x2,
      description: 'Solve 4 puzzles at once, 9 tries',
      color: 'from-purple-500 to-pink-500',
      href: '/quordle',
      difficulty: 'Hard',
    },
    {
      id: 'octordle',
      title: 'OctoWord',
      icon: Zap,
      description: 'Ultimate challenge! 8 boards, 13 tries',
      color: 'from-yellow-500 to-orange-500',
      href: '/octordle',
      difficulty: 'Extreme',
    },
    {
      id: 'sequence',
      title: 'Succession',
      icon: Flame,
      description: '4 puzzles, one at a time, 10 guesses total!',
      color: 'from-orange-500 to-red-500',
      href: '/sequence',
      difficulty: 'Medium',
    },
    {
      id: 'rescue',
      title: 'Deliverance',
      icon: Timer,
      description: 'Decode pre-filled clues, solve 4 boards',
      color: 'from-red-500 to-orange-500',
      href: '/rescue',
      difficulty: 'Intense',
    },
    {
      id: 'gauntlet',
      title: 'The Gauntlet',
      icon: Swords,
      description: '5 stages of escalating word challenges!',
      color: 'from-red-600 via-yellow-500 to-red-600',
      href: '/gauntlet',
      difficulty: 'Ultimate',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-pink-800 to-orange-700 relative overflow-hidden">
      <div className="absolute inset-0 opacity-30 pointer-events-none">
        <div className="absolute top-20 left-20 w-96 h-96 bg-yellow-400 rounded-full blur-3xl will-change-transform animate-blob" />
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-pink-500 rounded-full blur-3xl will-change-transform animate-blob-reverse" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <motion.div
            initial={{ x: -50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="flex items-center gap-2"
          >
            {profile && (
              <Link href="/profile">
                <Button className="bg-white/10 backdrop-blur-sm border-2 border-white/20 hover:bg-white/20 text-white">
                  <User className="w-4 h-4 mr-2" />
                  {profile.username}
                </Button>
              </Link>
            )}
          </motion.div>

          <motion.div
            initial={{ x: 50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="flex gap-2"
          >
            {user ? (
              <Button
                onClick={() => signOut()}
                className="bg-red-500/20 backdrop-blur-sm border-2 border-red-400/30 hover:bg-red-500/30 text-white"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            ) : (
              <Button
                onClick={() => setAuthModalOpen(true)}
                className="bg-gradient-to-r from-yellow-400 via-pink-500 to-purple-500 hover:from-yellow-500 hover:via-pink-600 hover:to-purple-600 text-white font-bold"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Sign In
              </Button>
            )}
          </motion.div>
        </div>

        <motion.div
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-12"
        >
          <div className="inline-block will-change-transform animate-title-pulse">
            <h1 className="text-5xl sm:text-7xl md:text-9xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-pink-400 to-purple-400 drop-shadow-2xl mb-4">
              SPELLSTRIKE
            </h1>
          </div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-2xl text-white font-bold drop-shadow-lg"
          >
            Choose Your Challenge
          </motion.p>
        </motion.div>

        {profile && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border-2 border-white/20 mb-8"
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-white/70 text-sm mb-1">Level</div>
                <div className="text-3xl font-black text-yellow-400">{profile.level}</div>
              </div>
              <div>
                <div className="text-white/70 text-sm mb-1">Wins</div>
                <div className="text-3xl font-black text-green-400">{profile.total_wins}</div>
              </div>
              <div>
                <div className="text-white/70 text-sm mb-1">Streak</div>
                <div className="text-3xl font-black text-orange-400 flex items-center justify-center gap-1">
                  <Flame className="w-6 h-6" fill="currentColor" />
                  {profile.current_streak}
                </div>
              </div>
              <div>
                <div className="text-white/70 text-sm mb-1">Best</div>
                <div className="text-3xl font-black text-purple-400">{profile.best_streak}</div>
              </div>
            </div>
          </motion.div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {gameModes.map((mode, index) => (
            <motion.div
              key={mode.id}
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 + index * 0.08 }}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
              className="relative group will-change-transform"
            >
              <Link href={mode.href}>
                <div
                  className={`
                    relative overflow-hidden rounded-3xl p-6 h-full
                    bg-gradient-to-br ${mode.color}
                    ring-4 ring-inset ring-white/20
                    shadow-2xl
                    transition-shadow duration-300
                    group-hover:shadow-yellow-400/40
                  `}
                >
                  <div className="absolute inset-0 bg-black/20" />

                  <div className="relative z-10 space-y-4">
                    <mode.icon className="w-16 h-16 text-white drop-shadow-lg transition-transform duration-300 group-hover:scale-110" />

                    <div>
                      <h2 className="text-4xl font-black text-white mb-2 drop-shadow-lg">
                        {mode.title}
                      </h2>
                      <p className="text-white/90 text-lg font-medium">
                        {mode.description}
                      </p>
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        {!user && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 1.2 }}
            className="text-center"
          >
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border-2 border-white/20 inline-block">
              <Trophy className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
              <h3 className="text-2xl font-black text-white mb-2">Track Your Progress!</h3>
              <p className="text-white/80 mb-4">
                Sign in to save your stats, track your streaks, and compete on leaderboards
              </p>
              <Button
                onClick={() => setAuthModalOpen(true)}
                className="bg-gradient-to-r from-yellow-400 via-pink-500 to-purple-500 hover:from-yellow-500 hover:via-pink-600 hover:to-purple-600 text-white font-bold text-lg px-8 py-6"
              >
                <Sparkles className="w-5 h-5 mr-2" />
                Get Started
              </Button>
            </div>
          </motion.div>
        )}
      </div>

      <AuthModal open={authModalOpen} onOpenChange={setAuthModalOpen} />
    </div>
  );
}
