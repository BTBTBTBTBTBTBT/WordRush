export interface GauntletStats {
  gamesPlayed: number;
  gamesWon: number;
  totalGuesses: number;
  totalTimeMs: number;
  bestTimeMs: number | null;
}

const STORAGE_KEY = 'gauntlet-stats';

const DEFAULT_STATS: GauntletStats = {
  gamesPlayed: 0,
  gamesWon: 0,
  totalGuesses: 0,
  totalTimeMs: 0,
  bestTimeMs: null,
};

export function getGauntletStats(): GauntletStats {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATS };
    return { ...DEFAULT_STATS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_STATS };
  }
}

export function getAverageTimeMs(stats: GauntletStats): number | null {
  if (stats.gamesPlayed === 0) return null;
  return stats.totalTimeMs / stats.gamesPlayed;
}

export function recordGauntletGame(
  won: boolean,
  guesses: number,
  timeMs: number,
): GauntletStats {
  const stats = getGauntletStats();

  stats.gamesPlayed += 1;
  stats.totalGuesses += guesses;
  stats.totalTimeMs += timeMs;

  if (won) {
    stats.gamesWon += 1;
    if (stats.bestTimeMs === null || timeMs < stats.bestTimeMs) {
      stats.bestTimeMs = timeMs;
    }
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  } catch {
    // storage full or unavailable
  }

  return stats;
}
