'use client';

import { Sparkles, Play } from 'lucide-react';

interface ArcadeHeroProps {
  onPlayNow: () => void;
}

export function ArcadeHero({ onPlayNow }: ArcadeHeroProps) {
  return (
    <div className="relative text-center space-y-8">
      <div className="animate-fade-in-up space-y-4">
        <div className="inline-block animate-pulse-subtle">
          <h1 className="text-6xl md:text-8xl font-black bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent">
            WORDLE DUEL
          </h1>
        </div>

        <p
          className="text-xl md:text-2xl text-slate-300 font-medium animate-fade-in"
          style={{ animationDelay: '0.3s' }}
        >
          Matched instantly. Same puzzle. <span className="text-cyan-400 font-bold">First to finish wins.</span>
        </p>
      </div>

      <div
        className="flex justify-center animate-fade-in-scale"
        style={{ animationDelay: '0.5s' }}
      >
        <button
          onClick={onPlayNow}
          className="group relative px-12 py-6 rounded-2xl font-black text-2xl overflow-hidden shadow-2xl hover:scale-105 active:scale-95 transition-transform"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 animate-gradient-x" />

          <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity" />

          <div className="absolute inset-0 opacity-50">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent animate-shimmer" />
          </div>

          <div className="relative flex items-center gap-3 text-white">
            <Play className="h-8 w-8 fill-current" />
            <span>DUEL LIVE</span>
            <Sparkles className="h-6 w-6" />
          </div>

          <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 rounded-2xl opacity-0 group-hover:opacity-75 blur-xl transition-opacity" />
        </button>
      </div>

      <div
        className="flex items-center justify-center gap-4 text-sm animate-fade-in"
        style={{ animationDelay: '0.7s' }}
      >
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-slate-400">Live matchmaking</span>
        </div>
        <div className="h-4 w-px bg-slate-700" />
        <span className="text-slate-400">Rematch in one tap</span>
      </div>
    </div>
  );
}
