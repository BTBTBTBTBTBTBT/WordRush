'use client';

import { Sparkles as SparklesIcon } from 'lucide-react';

interface SparklesProps {
  count?: number;
  className?: string;
}

export function Sparkles({ count = 5, className = '' }: SparklesProps) {
  return (
    <div className={`relative ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="absolute"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animation: `sparkle 1.5s ease-in-out ${i * 0.2}s infinite`,
          }}
        >
          <SparklesIcon className="w-4 h-4 text-yellow-400" fill="currentColor" />
        </div>
      ))}
    </div>
  );
}
