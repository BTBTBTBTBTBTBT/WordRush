'use client';

import { motion } from 'framer-motion';
import { Swords, Users, Trophy, Clock, Zap } from 'lucide-react';
import { GameMode } from '@wordle-duel/core';

interface ModeTile {
  mode: GameMode;
  icon: React.ReactNode;
  title: string;
  description: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  estimatedTime: string;
  gradient: string;
}

const modes: ModeTile[] = [
  {
    mode: GameMode.DUEL,
    icon: <Swords className="h-8 w-8" />,
    title: 'DUEL',
    description: 'One board. Six tries. First to solve wins.',
    difficulty: 'Easy',
    estimatedTime: '45-90s',
    gradient: 'from-cyan-500 to-blue-600'
  },
  {
    mode: GameMode.MULTI_DUEL,
    icon: <Users className="h-8 w-8" />,
    title: 'MULTI DUEL',
    description: 'Two boards at once. Solve either to claim victory.',
    difficulty: 'Medium',
    estimatedTime: '90-120s',
    gradient: 'from-purple-500 to-pink-600'
  },
  {
    mode: GameMode.GAUNTLET,
    icon: <Trophy className="h-8 w-8" />,
    title: 'GAUNTLET',
    description: 'Three boards in sequence. Survive them all.',
    difficulty: 'Hard',
    estimatedTime: '2-3min',
    gradient: 'from-orange-500 to-red-600'
  }
];

interface ModeTilesProps {
  selectedMode: GameMode;
  onSelectMode: (mode: GameMode) => void;
}

export function ModeTiles({ selectedMode, onSelectMode }: ModeTilesProps) {
  return (
    <div className="grid md:grid-cols-3 gap-4">
      {modes.map((mode, index) => {
        const isSelected = selectedMode === mode.mode;
        return (
          <motion.button
            key={mode.mode}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            whileHover={{ scale: 1.02, y: -4 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelectMode(mode.mode)}
            className={`relative overflow-hidden rounded-xl border-2 transition-all ${
              isSelected
                ? 'border-cyan-400 shadow-lg shadow-cyan-500/50'
                : 'border-slate-700 hover:border-slate-600'
            }`}
          >
            <div className="relative bg-slate-900/90 backdrop-blur-sm p-6 text-left">
              {isSelected && (
                <motion.div
                  className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-transparent"
                  layoutId="selectedMode"
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                />
              )}

              <div className="relative space-y-4">
                <div className="flex items-start justify-between">
                  <div className={`bg-gradient-to-br ${mode.gradient} p-3 rounded-lg text-white`}>
                    {mode.icon}
                  </div>
                  <div className="flex flex-col gap-1">
                    <span
                      className={`text-xs font-bold px-2 py-1 rounded ${
                        mode.difficulty === 'Easy'
                          ? 'bg-green-500/20 text-green-400'
                          : mode.difficulty === 'Medium'
                          ? 'bg-yellow-500/20 text-yellow-400'
                          : 'bg-red-500/20 text-red-400'
                      }`}
                    >
                      {mode.difficulty}
                    </span>
                  </div>
                </div>

                <div>
                  <h3 className="text-xl font-bold text-white mb-2">{mode.title}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">{mode.description}</p>
                </div>

                <div className="flex items-center gap-2 text-slate-500">
                  <Clock className="h-4 w-4" />
                  <span className="text-xs">{mode.estimatedTime}</span>
                </div>

                {isSelected && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute top-2 right-2"
                  >
                    <div className="bg-cyan-400 rounded-full p-1">
                      <Zap className="h-4 w-4 text-slate-900" />
                    </div>
                  </motion.div>
                )}
              </div>
            </div>

            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-slate-700 to-transparent" />
          </motion.button>
        );
      })}
    </div>
  );
}
