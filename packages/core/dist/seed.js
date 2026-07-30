import { getSolutionPoolForDate, getSolutionPoolForLengthAndDate } from './dictionary';
function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash);
}
export function generateSolutionsFromSeed(seed, count) {
    const solutions = [];
    // Answer pool is chosen by the DATE embedded in the seed (never wall clock),
    // so every client resolves the same seed to the same pool: pre-cutover daily
    // dates → legacy list, post-cutover dailies + all non-daily seeds → curated.
    const pool = getSolutionPoolForDate(getDailySeedDate(seed));
    const solutionCount = pool.length;
    const used = new Set();
    for (let i = 0; i < count; i++) {
        const seedWithIndex = `${seed}-${i}`;
        let hash = simpleHash(seedWithIndex);
        let attempts = 0;
        while (used.has(hash % solutionCount) && attempts < solutionCount) {
            hash = simpleHash(`${seedWithIndex}-${attempts}`);
            attempts++;
        }
        const index = hash % solutionCount;
        used.add(index);
        solutions.push(pool[index % solutionCount]);
    }
    return solutions;
}
export function generateSolutionsFromSeedForLength(seed, count, wordLength) {
    const solutions = [];
    // Same date-gate as the 5-letter path — pre-cutover Six/Seven dailies keep
    // their legacy words; new dailies + non-daily seeds use the curated list.
    const pool = getSolutionPoolForLengthAndDate(wordLength, getDailySeedDate(seed));
    const solutionCount = pool.length;
    const used = new Set();
    for (let i = 0; i < count; i++) {
        const seedWithIndex = `${seed}-${i}`;
        let hash = simpleHash(seedWithIndex);
        let attempts = 0;
        while (used.has(hash % solutionCount) && attempts < solutionCount) {
            hash = simpleHash(`${seedWithIndex}-${attempts}`);
            attempts++;
        }
        const index = hash % solutionCount;
        used.add(index);
        solutions.push(pool[index % solutionCount]);
    }
    return solutions;
}
export function generateMatchSeed() {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}
/**
 * Generate a deterministic daily seed for a given date and game mode.
 * Everyone playing the same mode on the same day gets the same seed.
 */
export function generateDailySeed(date, gameMode) {
    return `daily-${date}-${gameMode}`;
}
/**
 * Check if a seed is a daily seed.
 */
export function isDailySeed(seed) {
    return seed.startsWith('daily-');
}
/**
 * Extract the date from a daily seed string.
 */
export function getDailySeedDate(seed) {
    if (!isDailySeed(seed))
        return null;
    const parts = seed.split('-');
    // daily-YYYY-MM-DD-MODE → date is parts[1]-parts[2]-parts[3]
    if (parts.length >= 4) {
        return `${parts[1]}-${parts[2]}-${parts[3]}`;
    }
    return null;
}
