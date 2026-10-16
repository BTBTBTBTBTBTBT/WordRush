package com.wordocious.app.debug

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import com.wordocious.app.data.LeaderboardShare
import com.wordocious.app.data.ShareBreakdown
import com.wordocious.app.data.ShareImage
import com.wordocious.core.BoardState
import com.wordocious.core.GameMode
import com.wordocious.core.GameState
import com.wordocious.core.GameStatus
import java.io.File
import kotlin.concurrent.thread

/**
 * DEBUG ONLY: `adb shell am broadcast -n com.wordocious.app/.debug.ShareRenderReceiver -a com.wordocious.app.RENDER_SHARES`
 * renders sample share cards to PNGs under getExternalFilesDir(null)/share-renders (pull them with adb) so the night style can be
 * checked without a signed-in session. Not part of release.
 */
class ShareRenderReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val pending = goAsync()
        thread {
            try {
                val dir = File(context.getExternalFilesDir(null), "share-renders").apply { mkdirs() }
                var suffix = ""
                fun save(name: String, b: Bitmap) = File(dir, "android-$name$suffix.png").outputStream().use { b.compress(Bitmap.CompressFormat.PNG, 100, it) }
                fun attempt(name: String, f: () -> Bitmap) = runCatching { save(name, f()) }.onFailure { android.util.Log.e("ShareRender", name, it) }

                for (season in listOf("halloween", "standard")) {
                    // halloween = the admin preview; standard = seasons OFF (this player opts out of the calendar season).
                    runCatching {
                        com.wordocious.app.data.SettingsPref.set(
                            com.wordocious.app.ui.SeasonSkins.OPT_OUT_KEY,
                            if (season == "standard") com.wordocious.app.data.ThemeChoiceRules.optOutKey("halloween", java.time.LocalDate.now().toString()) else "",
                        )
                    }
                    com.wordocious.app.ui.SeasonSkins.pick(if (season == "halloween") "halloween" else null)
                    suffix = "-$season"
                    android.util.Log.i("ShareRender", "season=$season current=${com.wordocious.app.ui.SeasonSkins.current()}")
                val date = "Oct 16, 2026 · #193 · as of 9:53 AM"
                fun row(rank: Int, name: String, score: String, sub: String?, you: Boolean = false) =
                    LeaderboardShare.RowInput(rank, name, score, sub, you)
                fun card(rows: List<LeaderboardShare.RowInput>, you: LeaderboardShare.RowInput? = null, youLine: String? = null) =
                    LeaderboardShare.CardInput(
                        variant = LeaderboardShare.Variant.SOLO, shareMode = "Starsweep", gameModeLower = "regions", accent = 0xFFCA8A04.toInt(),
                        modeChip = "Starsweep", dateChip = date, rows = rows, you = you, youRankLine = youLine,
                        footer = "Can you beat them? Play free at wordocious.com", day = "2026-10-16",
                    )
                attempt("lb-two-open") {
                    LeaderboardShare.render(context, card(listOf(
                        row(1, "MJT", "2,320", "0 mistakes · no hints · 55s"),
                        row(2, "BMT", "2,319", "0 mistakes · no hints · 56s", you = true),
                    )))
                }
                attempt("lb-six-you-out") {
                    LeaderboardShare.render(context, card(
                        listOf(
                            row(1, "MJT", "2,320", "0 mistakes · 55s"), row(2, "Doug", "2,319", "0 mistakes · 56s"),
                            row(3, "VowelMaven", "2,260", "1 mistake · 1:01"), row(4, "QuillQueen", "2,201", "1 mistake · 1:12"),
                            row(5, "Tile Tom", "2,150", "1 mistake · 1:20"),
                        ),
                        you = row(9, "BMT", "1,980", "2 mistakes · 1:48", you = true), youLine = "#9 of 87",
                    ))
                }
                attempt("lb-three") {
                    LeaderboardShare.render(context, card(listOf(
                        row(1, "MJT", "2,320", "0 mistakes · 55s"), row(2, "Doug", "2,319", "0 mistakes · 56s"), row(3, "BMT", "2,260", "1 mistake · 1:01", you = true),
                    )))
                }

                // Starsweep 8x8
                val seeds = listOf(0 to 0, 0 to 4, 2 to 2, 3 to 6, 5 to 1, 5 to 4, 7 to 0, 7 to 6)
                val regions = buildString {
                    for (r in 0 until 8) for (c in 0 until 8) append(seeds.indices.minByOrNull { Math.abs(seeds[it].first - r) + Math.abs(seeds[it].second - c) }!!)
                }
                val board = buildString { for (r in 0 until 8) for (c in 0 until 8) append(if (c == (r * 3 + 1) % 8) '*' else '.') }
                attempt("starsweep-finished") {
                    ShareImage.renderRegions(context, 8, regions, board, "0".repeat(64), true, "#24 · 8 × 8 · 0 mistakes · 0:56",
                        score = ShareBreakdown.Input(GameMode.REGIONS, true, 1, 56, 1, 1, 0, day = "2026-10-16"))
                }
                attempt("classic-finished") {
                    val state = GameState(
                        GameMode.DUEL, "daily-2026-10-16-DUEL", 0.0,
                        listOf(BoardState("CRANE", listOf("ADIEU", "STORY", "BRAKE", "CRANE"), 6, GameStatus.WON)), 0, GameStatus.WON,
                    )
                    ShareImage.render(context, state, GameMode.DUEL, "Classic", 134, reveal = true)
                }
                attempt("classic-lost") {
                    val state = GameState(
                        GameMode.DUEL, "daily-2026-10-16-DUEL", 0.0,
                        listOf(BoardState("CRANE", listOf("ADIEU", "STORY", "BLOOM", "PIZZA", "FUDGE", "LUNGS"), 6, GameStatus.LOST)), 0, GameStatus.LOST,
                    )
                    ShareImage.render(context, state, GameMode.DUEL, "Classic", 241, reveal = true)
                }
                attempt("kindred-finished") {
                    ShareImage.renderGroups(context, listOf(1, 2, 3, 4), 1, 4, true, "#24 · 4/4 groups · 1 mistake · 2:10",
                        score = ShareBreakdown.Input(GameMode.GROUPS, true, 5, 130, 4, 4, 0, day = "2026-10-16"))
                }
                attempt("hubbub-finished") {
                    ShareImage.renderHub(context, "Genius", 72, true, "#24 · Genius · 72% · 31 words · 2 pangrams",
                        score = ShareBreakdown.Input(GameMode.HUB, true, 31, 300, 1, 1, 0, day = "2026-10-16"))
                }
                }
                android.util.Log.i("ShareRender", "done -> ${dir.absolutePath}")
            } finally {
                pending.finish()
            }
        }
    }
}
