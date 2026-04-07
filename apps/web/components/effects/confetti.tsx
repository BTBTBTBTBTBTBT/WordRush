'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface ConfettiPiece {
  id: number;
  x: number;
  color: string;
  delay: number;
  duration: number;
}

const DEFAULT_COLORS = [
  '#FFD700',
  '#FF6B9D',
  '#C084FC',
  '#60A5FA',
  '#34D399',
  '#FBBF24',
  '#F97316',
  '#EC4899',
];

export const CONFETTI_PALETTES: Record<string, string[]> = {
  fireworks: ['#FF0000', '#FFD700', '#FF6B00', '#FFFFFF', '#FF4500', '#FFA500'],
  rainbow: ['#FF0000', '#FF7F00', '#FFFF00', '#00FF00', '#0000FF', '#4B0082', '#9400D3'],
};

export function Confetti({ colors }: { colors?: string[] }) {
  const [pieces, setPieces] = useState<ConfettiPiece[]>([]);

  useEffect(() => {
    const palette = colors || DEFAULT_COLORS;

    const newPieces = Array.from({ length: 50 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      color: palette[Math.floor(Math.random() * palette.length)],
      delay: Math.random() * 0.5,
      duration: 2 + Math.random() * 2,
    }));

    setPieces(newPieces);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {pieces.map((piece) => (
        <motion.div
          key={piece.id}
          initial={{ y: -20, x: `${piece.x}vw`, opacity: 1, rotate: 0 }}
          animate={{
            y: '100vh',
            rotate: 720,
            opacity: 0,
          }}
          transition={{
            duration: piece.duration,
            delay: piece.delay,
            ease: 'linear',
          }}
          className="absolute w-3 h-3 rounded-sm"
          style={{ backgroundColor: piece.color }}
        />
      ))}
    </div>
  );
}
