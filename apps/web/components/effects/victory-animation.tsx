'use client';

import { motion } from 'framer-motion';
import { Trophy, Star, Zap } from 'lucide-react';
import { Confetti, CONFETTI_PALETTES } from './confetti';
import { useCosmetics } from '@/lib/cosmetics/cosmetic-context';

interface VictoryAnimationProps {
  onComplete?: () => void;
}

const VARIANT_MAP: Record<string, string> = {
  victory_fireworks: 'fireworks',
  victory_rainbow: 'rainbow',
};

export function VictoryAnimation({ onComplete }: VictoryAnimationProps) {
  const { victoryAnimationId } = useCosmetics();
  const paletteKey = victoryAnimationId ? VARIANT_MAP[victoryAnimationId] : undefined;
  const confettiColors = paletteKey ? CONFETTI_PALETTES[paletteKey] : undefined;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}
      onClick={onComplete}
    >
      <Confetti colors={confettiColors} />

      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
        className="relative"
      >
        <motion.div
          animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          className="relative"
        >
          <div
            className="absolute inset-0 rounded-full blur-3xl opacity-60 animate-pulse-slow"
            style={{ background: 'linear-gradient(135deg, #fbbf24, #ec4899, #a78bfa)' }}
          />

          <div
            className="relative p-12 rounded-3xl shadow-2xl"
            style={{ background: 'linear-gradient(135deg, #fbbf24, #f97316, #ec4899)' }}
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
              className="absolute -top-6 -right-6"
            >
              <Star className="w-12 h-12" style={{ color: '#fde68a' }} fill="currentColor" />
            </motion.div>

            <motion.div
              animate={{ rotate: -360 }}
              transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
              className="absolute -bottom-6 -left-6"
            >
              <Zap className="w-12 h-12" style={{ color: '#c4b5fd' }} fill="currentColor" />
            </motion.div>

            <Trophy className="w-32 h-32 text-white drop-shadow-2xl" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="text-center mt-8"
        >
          <h2
            className="text-6xl font-black text-transparent bg-clip-text drop-shadow-lg"
            style={{ backgroundImage: 'linear-gradient(135deg, #fbbf24, #ec4899, #a78bfa)' }}
          >
            VICTORY!
          </h2>
          <p className="text-lg mt-2 font-bold" style={{ color: 'rgba(255,255,255,0.6)' }}>
            Tap anywhere to continue
          </p>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
