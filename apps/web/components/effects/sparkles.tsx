'use client';

import { motion } from 'framer-motion';
import { Sparkles as SparklesIcon } from 'lucide-react';

interface SparklesProps {
  count?: number;
  className?: string;
}

export function Sparkles({ count = 5, className = '' }: SparklesProps) {
  return (
    <div className={`relative ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute"
          initial={{ opacity: 0, scale: 0 }}
          animate={{
            opacity: [0, 1, 0],
            scale: [0, 1, 0],
            rotate: [0, 180, 360],
          }}
          transition={{
            duration: 1.5,
            delay: i * 0.2,
            repeat: Infinity,
            repeatDelay: 1,
          }}
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
          }}
        >
          <SparklesIcon className="w-4 h-4 text-yellow-400" fill="currentColor" />
        </motion.div>
      ))}
    </div>
  );
}
