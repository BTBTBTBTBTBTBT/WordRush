export declare function generateSolutionsFromSeed(seed: string, count: number): string[];
export declare function generateSolutionsFromSeedForLength(seed: string, count: number, wordLength: number): string[];
export declare function generateMatchSeed(): string;
/**
 * Generate a deterministic daily seed for a given date and game mode.
 * Everyone playing the same mode on the same day gets the same seed.
 */
export declare function generateDailySeed(date: string, gameMode: string): string;
/**
 * Check if a seed is a daily seed.
 */
export declare function isDailySeed(seed: string): boolean;
/**
 * Extract the date from a daily seed string.
 */
export declare function getDailySeedDate(seed: string): string | null;
//# sourceMappingURL=seed.d.ts.map