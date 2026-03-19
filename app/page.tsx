'use client';

import { useState, useEffect } from 'react';
import { GameMode } from '@wordle-duel/core';
import { Button } from '@/components/ui/button';
import { PracticeGame } from '@/components/practice/practice-game';
import { PvPGame } from '@/components/pvp/pvp-game';
import { ArcadeHero } from '@/components/arcade/arcade-hero';
import { ModeTiles } from '@/components/arcade/mode-tiles';
import { HudBar } from '@/components/arcade/hud-bar';
import { DailyDuel } from '@/components/arcade/daily-duel';
import { SettingsDialog } from '@/components/settings-dialog';
import { Settings, Dumbbell, HelpCircle, Palette } from 'lucide-react';
import { motion } from 'framer-motion';

type Screen = 'home' | 'practice' | 'pvp';

export default function Home() {
  const [screen, setScreen] = useState<Screen>('home');
  const [selectedMode, setSelectedMode] = useState<GameMode>(GameMode.DUEL);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('preferredMode');
    if (stored) {
      setSelectedMode(stored as GameMode);
    }
  }, []);

  const handleModeSelect = (mode: GameMode) => {
    setSelectedMode(mode);
    localStorage.setItem('preferredMode', mode);
  };

  if (screen === 'practice') {
    return <PracticeGame mode={selectedMode} onBack={() => setScreen('home')} />;
  }

  if (screen === 'pvp') {
    return <PvPGame mode={selectedMode} onBack={() => setScreen('home')} />;
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="fixed inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 animate-gradient-slow" />

      <div className="fixed inset-0 opacity-30">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse-slow-delayed" />
        <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse-slow" />
      </div>

      <div className="fixed inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAwIDEwIEwgNDAgMTAgTSAxMCAwIEwgMTAgNDAgTSAwIDIwIEwgNDAgMjAgTSAyMCAwIEwgMjAgNDAgTSAwIDMwIEwgNDAgMzAgTSAzMCAwIEwgMzAgNDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjAzKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-20" />

      <div className="relative z-10">
        <div className="absolute top-4 right-4">
          <motion.button
            whileHover={{ scale: 1.1, rotate: 90 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setShowSettings(true)}
            className="p-3 bg-slate-900/80 backdrop-blur-sm border border-slate-700/50 rounded-lg hover:border-slate-600 transition-colors"
          >
            <Settings className="h-6 w-6 text-slate-400" />
          </motion.button>
        </div>

        <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
          <ArcadeHero onPlayNow={() => setScreen('pvp')} />

          <HudBar selectedMode={selectedMode} />

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="space-y-4"
          >
            <h2 className="text-2xl font-bold text-white text-center">Choose Your Mode</h2>
            <ModeTiles selectedMode={selectedMode} onSelectMode={handleModeSelect} />
          </motion.div>

          <DailyDuel />

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.0 }}
            className="flex flex-wrap items-center justify-center gap-3"
          >
            <Button
              variant="outline"
              className="bg-slate-900/50 border-slate-700 hover:bg-slate-800/50 hover:border-slate-600"
              onClick={() => setScreen('practice')}
            >
              <Dumbbell className="h-4 w-4 mr-2" />
              Warm up. Chase your PB.
            </Button>
            <Button
              variant="outline"
              className="bg-slate-900/50 border-slate-700 hover:bg-slate-800/50 hover:border-slate-600"
              onClick={() => {}}
            >
              <HelpCircle className="h-4 w-4 mr-2" />
              How to Play
            </Button>
            <Button
              variant="outline"
              className="bg-slate-900/50 border-slate-700 hover:bg-slate-800/50 hover:border-slate-600"
              onClick={() => setShowSettings(true)}
            >
              <Palette className="h-4 w-4 mr-2" />
              Locker
            </Button>
          </motion.div>
        </div>
      </div>

      <SettingsDialog open={showSettings} onOpenChange={setShowSettings} />
    </div>
  );
}
