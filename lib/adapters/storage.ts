export interface GameStats {
  gamesPlayed: number;
  gamesWon: number;
  currentStreak: number;
  maxStreak: number;
  guessDistribution: Record<number, number>;
  personalBest: number | null;
}

export interface IStorage {
  getStats(mode: string): GameStats;
  saveStats(mode: string, stats: GameStats): void;
  addGame(mode: string, won: boolean, guesses: number): void;
}

export class LocalStorageAdapter implements IStorage {
  private getKey(mode: string): string {
    return `wordle-duel-stats-${mode}`;
  }

  getStats(mode: string): GameStats {
    const key = this.getKey(mode);
    const stored = localStorage.getItem(key);

    if (stored) {
      return JSON.parse(stored);
    }

    return {
      gamesPlayed: 0,
      gamesWon: 0,
      currentStreak: 0,
      maxStreak: 0,
      guessDistribution: {},
      personalBest: null
    };
  }

  saveStats(mode: string, stats: GameStats): void {
    const key = this.getKey(mode);
    localStorage.setItem(key, JSON.stringify(stats));
  }

  addGame(mode: string, won: boolean, guesses: number): void {
    const stats = this.getStats(mode);

    stats.gamesPlayed++;

    if (won) {
      stats.gamesWon++;
      stats.currentStreak++;
      stats.maxStreak = Math.max(stats.maxStreak, stats.currentStreak);

      stats.guessDistribution[guesses] = (stats.guessDistribution[guesses] || 0) + 1;

      if (stats.personalBest === null || guesses < stats.personalBest) {
        stats.personalBest = guesses;
      }
    } else {
      stats.currentStreak = 0;
    }

    this.saveStats(mode, stats);
  }
}
