package com.wordocious.app.ui

import androidx.annotation.DrawableRes
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.widthIn
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.wordocious.app.R

// The art pass (founder 2026-10-02 night; spec docs/ART_SPEC.md): the Leaderboard
// day titles (§1), the whole-cast page titles (§2), the glossy 3D game icons (§3)
// and the W / L / ✓ completion badges (§4). All art lives in res/drawable-nodpi as
// WebP. Mirrors the web /art/ assets and the iOS image sets of the same names.

/** §2 page titles: lettering with the whole cast perched on it (≈1080 wide). */
enum class TitleArt(@DrawableRes val res: Int, val label: String) {
    FRIENDS(R.drawable.art_title_friends, "Friends"),
    STATS(R.drawable.art_title_stats, "Stats"),
    RECORDS(R.drawable.art_title_records, "All-Time Records"),
    VS(R.drawable.art_title_vs, "VS Battle"),
    PUZZLES(R.drawable.art_title_puzzles, "Puzzles"),
    WOTD(R.drawable.art_title_wotd, "Word of the Day"),
    SETTINGS(R.drawable.art_title_settings, "Settings"),
    HOWTO(R.drawable.art_title_howto, "How to Play"),
    GOPRO(R.drawable.art_title_gopro, "Go Pro"),
    MOREGAMES(R.drawable.art_title_moregames, "More Games"),
}

/** Title art's widest size (§2: fill the content width up to ~420). */
val TITLE_ART_MAX_WIDTH: Dp = 420.dp

/**
 * A page title image (§2): fills the width it is given up to [maxWidth], height
 * follows the aspect ratio (never stretched). TalkBack reads [contentDescription]
 * (the title text) as a heading.
 */
@Composable
fun PageTitleArt(
    art: TitleArt,
    modifier: Modifier = Modifier,
    maxWidth: Dp = TITLE_ART_MAX_WIDTH,
    contentDescription: String = art.label,
    alignment: Alignment = Alignment.Center,
) {
    Image(
        painterResource(art.res),
        contentDescription = contentDescription,
        contentScale = ContentScale.Fit,
        alignment = alignment,
        modifier = modifier.widthIn(max = maxWidth).fillMaxWidth().semantics { heading() },
    )
}

/**
 * §1 The day-title art for a board's local yyyy-MM-dd [day], or null on a holiday
 * ([holiday] non-blank keeps the `<HOLIDAY> HEROES` text) or an unparseable day.
 * Same weekday source as core `leaderboardTitle`.
 */
@DrawableRes
fun dayTitleArtRes(day: String, holiday: String?): Int? {
    if (!holiday.isNullOrBlank()) return null
    val dow = runCatching { java.time.LocalDate.parse(day).dayOfWeek }.getOrNull() ?: return null
    return when (dow) {
        java.time.DayOfWeek.MONDAY -> R.drawable.art_day_monday
        java.time.DayOfWeek.TUESDAY -> R.drawable.art_day_tuesday
        java.time.DayOfWeek.WEDNESDAY -> R.drawable.art_day_wednesday
        java.time.DayOfWeek.THURSDAY -> R.drawable.art_day_thursday
        java.time.DayOfWeek.FRIDAY -> R.drawable.art_day_friday
        java.time.DayOfWeek.SATURDAY -> R.drawable.art_day_saturday
        java.time.DayOfWeek.SUNDAY -> R.drawable.art_day_sunday
    }
}

/** "FRIDAY’S FINEST" → "Friday’s Finest": the day art's accessibility label. */
fun titleCaseLabel(caps: String): String =
    caps.lowercase().split(' ').joinToString(" ") { w -> w.replaceFirstChar { it.uppercase() } }

/** §1 The day title art, centered at [height] (≈96–120), labeled with the title text. */
@Composable
fun DayTitleArt(@DrawableRes res: Int, title: String, modifier: Modifier = Modifier, height: Dp = 110.dp) {
    Box(modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
        Image(
            painterResource(res),
            contentDescription = titleCaseLabel(title),
            contentScale = ContentScale.Fit,
            modifier = Modifier.height(height).semantics { heading() },
        )
    }
}

/**
 * §3 The glossy 3D game icon for a catalog mode id (`game_<id>.webp`, 256 sq, in the
 * game's color), or null for an id without art — callers fall back to the old glyph.
 */
@DrawableRes
fun gameArtRes(modeId: String?): Int? = when (modeId) {
    "practice" -> R.drawable.game_practice
    "vs" -> R.drawable.game_vs
    "quordle" -> R.drawable.game_quordle
    "octordle" -> R.drawable.game_octordle
    "sequence" -> R.drawable.game_sequence
    "rescue" -> R.drawable.game_rescue
    "six" -> R.drawable.game_six
    "seven" -> R.drawable.game_seven
    "gauntlet" -> R.drawable.game_gauntlet
    "propernoundle" -> R.drawable.game_propernoundle
    "more" -> R.drawable.game_more
    "sudoku" -> R.drawable.game_sudoku
    "scramble" -> R.drawable.game_scramble
    "hub" -> R.drawable.game_hub
    "crossword" -> R.drawable.game_crossword
    "groups" -> R.drawable.game_groups
    "ladder" -> R.drawable.game_ladder
    "cryptogram" -> R.drawable.game_cryptogram
    "wordsearch" -> R.drawable.game_wordsearch
    "regions" -> R.drawable.game_regions
    else -> null
}

/**
 * §4 A daily result badge: W (won) / L (lost) / ✓ (done, result unknown — [won]
 * null). 26 dp on the home cards. Decorative unless [contentDescription] is given.
 */
@Composable
fun ResultBadge(won: Boolean?, size: Dp = 26.dp, modifier: Modifier = Modifier, contentDescription: String? = null) {
    Icon3D(
        when (won) {
            true -> Icon3DName.BADGE_W
            false -> Icon3DName.BADGE_L
            null -> Icon3DName.BADGE_CHECK
        },
        size, modifier, contentDescription = contentDescription,
    )
}
