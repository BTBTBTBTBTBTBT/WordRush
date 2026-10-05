package com.wordocious.app.ui

import com.wordocious.app.BuildConfig
import com.wordocious.app.data.AuthService
import com.wordocious.app.data.Profile
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.JsonObject

/**
 * DEBUG only (iOS `-storeDemo -storeShot stage|titles|room-<tab>` parity): opens Edit Profile — the Stage, the
 * Dressing Room on a tab, or the Title Shelves — for a local demo player (WordWiz, iOS StoreDemo.me), so the
 * screens can be checked on the emulator without signing in. No session, no network reads or writes:
 *   adb shell am start -n com.wordocious.app/.MainActivity --es dressDemo stage      (or titles, room-hats, room-eyes…)
 *   adb shell am start -n com.wordocious.app/.MainActivity --es dressDemo settings   (Settings as an admin: Season preview)
 * MainActivity renders only Edit Profile for it; release builds ignore the extra (BuildConfig.DEBUG).
 */
object DressDemo {
    var active = false
        private set

    /** The door for a `dressDemo` extra (null = not a demo launch, or a release build). */
    fun door(extra: String?): DressDoor? {
        if (!BuildConfig.DEBUG || extra.isNullOrBlank()) return null
        return when {
            extra == "stage" -> DressDoor.Stage
            extra == "titles" -> DressDoor.Titles
            extra.startsWith("room-") -> {
                val t = extra.removePrefix("room-").lowercase()
                DressDoor.Room(BuilderTab.entries.firstOrNull { it.name.lowercase() == t || it.label.lowercase() == t } ?: BuilderTab.BODY)
            }
            else -> null
        }
    }

    /** WordWiz's earned titles, newest first (iOS StoreDemo.earnedTitles): a realistic mix of earned + locked. */
    private val earned = listOf(
        "gauntlet_god", "octo_boss", "dress_up", "speed_demon", "streak_7", "streak_30", "daily_sweep", "first_win",
        "daily_debut", "all_modes", "centurion", "century_club", "thousand_words", "flawless_victory", "rising_star",
        "linguist", "wordsmith", "best_buds", "cheerleader", "hive_mind", "crossword_first", "sudoku_first",
        "self_portrait", "early_bird", "night_owl", "medal_10", "golden_touch", "rival", "vs_veteran", "three_in_a_row",
        "called_it", "wake_up_call", "meet_the_cast", "spooky_season", "classic_master", "lucky_seven", "six_shooter",
    )
    val unlockedDates: Map<String, String> by lazy {
        val now = java.time.Instant.now()
        earned.mapIndexed { i, k -> k to now.minusSeconds((i + 1) * 3L * 86_400).toString() }.toMap()
    }

    /** `--es dressDemo settings`: Settings for the same demo player as an admin (the DEVELOPER Season preview picker). */
    fun isSettings(extra: String?): Boolean = BuildConfig.DEBUG && extra == "settings"

    fun start(door: DressDoor, admin: Boolean = false) {
        if (!BuildConfig.DEBUG) return
        active = true
        val look = mapOf(
            "v" to "1", "body" to "classic", "color" to "purple", "pattern" to "sparkle", "patternColor" to "lilac",
            "eyes" to "sparkly", "nose" to "button", "cheeks" to "blush", "mouth" to "grin", "head" to "wizard",
            "face" to "none", "neck" to "cape", "accColor" to "default", "frame" to "gold", "bg" to "cottoncandy", "display" to "mascot",
        )
        AuthService.debugDemoProfile(
            Profile(
                id = "5d0e0000-0000-4000-8000-000000000001", username = "WordWiz", level = 24, isPro = true,
                bio = "Daily Sweep or bust.", favoriteMode = "CLASSIC", isAdmin = admin,
                avatarConfig = JsonObject(look.mapValues { JsonPrimitive(it.value) }),
            ),
        )
        DressUp.pendingDoor = door
    }
}
