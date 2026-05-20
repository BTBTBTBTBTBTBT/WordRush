'use client';

import { Calendar, Users, Trophy } from 'lucide-react';
import { Card } from '@/components/ui/card';

export function DailyDuel() {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });

  return (
    <div
      className="animate-fade-in-up"
      style={{ animationDelay: '0.9s' }}
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
            <div className="animate-pulse">
              <Trophy className="h-8 w-8 text-amber-400" />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Users className="h-4 w-4" />
              <span>1,247 played today</span>
            </div>
            <button
              className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold rounded-lg shadow-lg hover:shadow-amber-500/50 hover:scale-105 active:scale-95 transition-all"
            >
              Play Daily
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}
