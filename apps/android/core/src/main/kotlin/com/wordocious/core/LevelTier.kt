package com.wordocious.core

// FINISH_SPEC V: the level tiers (the thresholds web Stats already used). 1:1 port of
// levelTier / levelTierLabel in packages/core/src/level-season.ts, pinned by
// level-season-fixtures.json (`levels`) so web, iOS and Android agree.

/** A level tier; [key] is the shared lowercase id ('bronze' …), [minLevel] where it starts. */
enum class LevelTier(val key: String, val minLevel: Int) {
    BRONZE("bronze", 1),
    SILVER("silver", 11),
    GOLD("gold", 26),
    PLATINUM("platinum", 51),
    DIAMOND("diamond", 100),
    ;

    /** The display name ("Gold"). */
    val label: String get() = key.replaceFirstChar { it.uppercaseChar() }
}

/**
 * Bronze 1–10 · Silver 11–25 · Gold 26–50 · Platinum 51–99 · Diamond 100+.
 * Levels below 1 count as Bronze.
 */
fun levelTier(level: Int): LevelTier = when {
    level >= 100 -> LevelTier.DIAMOND
    level >= 51 -> LevelTier.PLATINUM
    level >= 26 -> LevelTier.GOLD
    level >= 11 -> LevelTier.SILVER
    else -> LevelTier.BRONZE
}

/** The tier's display name ("Gold") — web levelTierLabel. */
fun levelTierLabel(tier: LevelTier): String = tier.label

/** True when going from [fromLevel] to [toLevel] lands in a different tier (the level-up popup's gate). */
fun levelTierChanged(fromLevel: Int, toLevel: Int): Boolean = levelTier(fromLevel) != levelTier(toLevel)
