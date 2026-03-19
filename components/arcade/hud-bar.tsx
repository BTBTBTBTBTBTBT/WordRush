'use client';

import { useEffect, useState } from 'react';
import { Flame, Trophy } from 'lucide-react';
import { motion } from 'framer-motion';

interface HudBarProps {
  selectedMode?: string;
}

export function HudBar({ selectedMode = 'DUEL' }: HudBarProps) {
  const [stats, setStats] = useState({
    level: 1,
    xp: 0,
    xpToNextLevel: 100,
    streak: 0,
    personalBest: 0
  });

  useEffect(() => {
    const stored = localStorage.getItem('playerStats');
    if (stored) {
      setStats(JSON.parse(stored));
    }
  }, []);

  const xpPercentage = (stats.xp / stats.xpToNextLevel) * 100;

  return (
    <div className="bg-slate-900/80 backdrop-blur-sm border border-slate-700/50 rounded-lg p-4 shadow-xl">
      <div className="flex items-center justify-between gap-6">
        <div className="flex-1 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400 font-medium">Level {stats.level}</span>
            <span className="text-slate-400">{stats.xp} / {stats.xpToNextLevel} XP</span>
          </div>
          <div className="relative h-2 bg-slate-800 rounded-full overflow-hidden">
            <motion.div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${xpPercentage}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
          </div>
        </div>

        <div className="flex items-center gap-6">
          <motion.div
            className="flex items-center gap-2"
            whileHover={{ scale: 1.05 }}
            transition={{ type: 'spring', stiffness: 400 }}
          >
            <Flame className={`h-5 w-5 ${stats.streak > 0 ? 'text-orange-500' : 'text-slate-600'}`} />
            <div className="text-center">
              <div className="text-lg font-bold text-white">{stats.streak}</div>
              <div className="text-xs text-slate-400">Streak</div>
            </div>
          </motion.div>

          <div className="h-10 w-px bg-slate-700" />

          <motion.div
            className="flex items-center gap-2"
            whileHover={{ scale: 1.05 }}
            transition={{ type: 'spring', stiffness: 400 }}
          >
            <Trophy className="h-5 w-5 text-yellow-500" />
            <div className="text-center">
              <div className="text-lg font-bold text-white">{stats.personalBest || '--'}</div>
              <div className="text-xs text-slate-400">Best</div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
