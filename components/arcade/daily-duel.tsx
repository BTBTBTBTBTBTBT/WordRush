'use client';

import { motion } from 'framer-motion';
import { Calendar, Users, Trophy } from 'lucide-react';
import { Card } from '@/components/ui/card';

export function DailyDuel() {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.9 }}
    >
      <Card className="relative overflow-hidden bg-gradient-to-br from-amber-500/10 via-orange-500/10 to-red-500/10 border-amber-500/30">
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-amber-500/20 to-transparent rounded-bl-full" />

        <div className="relative p-6 space-y-4">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-amber-400" />
                <span className="text-sm font-medium text-slate-400">{today}</span>
              </div>
              <h3 className="text-2xl font-bold text-white">Daily Duel</h3>
              <p className="text-sm text-slate-400">Race today&apos;s seed. Everyone gets the same puzzle.</p>
            </div>
            <motion.div
              animate={{
                rotate: [0, 5, -5, 0]
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'easeInOut'
              }}
            >
              <Trophy className="h-8 w-8 text-amber-400" />
            </motion.div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Users className="h-4 w-4" />
              <span>1,247 played today</span>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold rounded-lg shadow-lg hover:shadow-amber-500/50 transition-shadow"
            >
              Play Daily
            </motion.button>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
