package com.wordocious.app.ui

import androidx.annotation.DrawableRes
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.keyframes
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.layout.requiredSize
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.State
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.composed
import androidx.compose.ui.geometry.isSpecified
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.unit.Dp
import kotlinx.coroutines.launch
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.app.R

// The art pass (founder 2026-10-02 night; spec docs/ART_SPEC.md): the Leaderboard
// day titles (§1), the whole-cast page titles (§2), the glossy 3D game icons (§3)
// and the W / L / ✓ completion badges (§4); second pass: moment lettering (§6),
// empty / error / done scenes (§7), WELCOME + holiday LEADERBOARD titles (§8) and
// the pocket game icons (§9); third pass: the game title art (§10), sized to fill the game header
// (§14), and the title art motion (§16). All art lives in res/drawable-nodpi as
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
    // FINISH_SPEC C6: each footer / info page shows its OWN title (same height, FooterHeadline).
    GUIDES(R.drawable.art_title_guides, "Guides"),
    STRATEGY(R.drawable.art_title_strategy, "Strategy"),
    WORDS(R.drawable.art_title_words, "Words"),
    FAQ(R.drawable.art_title_faq, "FAQ"),
    PRIVACY(R.drawable.art_title_privacy, "Privacy"),
    TERMS(R.drawable.art_title_terms, "Terms"),
    GOPRO(R.drawable.art_title_gopro, "Go Pro"),
    MOREGAMES(R.drawable.art_title_moregames, "More Games"),
    /** §8 the whole cast around WELCOME! at the top of sign-in / onboarding. */
    WELCOME(R.drawable.art_title_welcome, "Welcome"),
    /** §8 the whole cast around LEADERBOARD (holiday banner title slot). */
    LEADERBOARD(R.drawable.art_title_leaderboard, "Leaderboard"),
    /** §12 / §19.2 the whole cast around DAILIES (Home's daily games section). */
    DAILIES(R.drawable.art_title_dailies, "Dailies"),
    /** FINISH_SPEC O1 the VS BATTLE Home section title (lettering only). */
    VSBATTLE(R.drawable.art_title_vsbattle, "VS Battle"),
    /** Night art 10-03: the MENU lettering (the ? menu sheet; iOS InfoMenu parity). */
    MENU(R.drawable.art_title_menu, "Menu"),
}

/**
 * Title art's widest size. FINISH_SPEC A6: page titles are headlines — the full width
 * they are given (edge to edge on a phone); this cap only stops tablets ballooning.
 */
val TITLE_ART_MAX_WIDTH: Dp = 600.dp

/**
 * A page title image (§2), FINISH_SPEC N1: lettering only, a calm centered headline —
 * ≈62% of the width it is given, at most 300 dp wide (and [maxWidth]) and 64 dp tall,
 * aspect kept (HeadlineSize). TalkBack reads [contentDescription] (the title text) as a
 * heading. [alignment] places it in the row.
 */
@Composable
fun PageTitleArt(
    art: TitleArt,
    modifier: Modifier = Modifier,
    maxWidth: Dp = TITLE_ART_MAX_WIDTH,
    contentDescription: String = art.label,
    alignment: Alignment = Alignment.Center,
    /** FINISH_SPEC BH2: the compact DAILIES / PUZZLES titles (0.75). */
    scale: Float = 1f,
) {
    val painter = painterResource(art.res)
    val intrinsic = painter.intrinsicSize
    val aspect = if (intrinsic.height > 0f && intrinsic.width > 0f) intrinsic.width / intrinsic.height else 4f
    BoxWithConstraints(modifier.fillMaxWidth(), contentAlignment = alignment) {
        val (w0, _) = HeadlineSize.fit(this.maxWidth.value, aspect)
        val w = minOf(w0, maxWidth.value) * scale
        Image(
            painter,
            contentDescription = contentDescription,
            contentScale = ContentScale.Fit,
            modifier = Modifier.width(w.dp).height((w / aspect).dp).semantics { heading() }.titleArtMotion(float = false),
        )
    }
}

/** §19.2 Home section title art: ≈78% of the content width, at most this wide. */
val SECTION_TITLE_ART_MAX_WIDTH: Dp = 340.dp
const val SECTION_TITLE_ART_WIDTH_FRACTION = 0.78f

/** §19.2 The section title art's width for a content width of [available]. */
fun sectionTitleArtWidth(available: Dp): Dp =
    (available * SECTION_TITLE_ART_WIDTH_FRACTION).coerceAtMost(SECTION_TITLE_ART_MAX_WIDTH)

/**
 * §12 / §19.2 A Home section header (DAILIES, PUZZLES, WORD OF THE DAY): the title art
 * centered horizontally at ≈78% of the width it is given (max
 * [SECTION_TITLE_ART_MAX_WIDTH]), with optional small [below] content centered under
 * it (WOTD's "Past words"). Every section header gets the same size and spacing.
 */
@Composable
fun SectionTitleArt(
    art: TitleArt,
    modifier: Modifier = Modifier,
    below: (@Composable () -> Unit)? = null,
    /** FINISH_SPEC BH2: DAILIES / PUZZLES sit ~25% smaller over the compact cards, with less air. */
    scale: Float = 1f,
) {
    // FINISH_SPEC N1: the Home section titles follow the page-title rule (≈62% / ≤ 300 × 64).
    Column(modifier.fillMaxWidth().padding(top = if (scale < 1f) 0.dp else 2.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        PageTitleArt(art, alignment = Alignment.Center, scale = scale)
        below?.invoke()
    }
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

/** §1 The day title art, centered — FINISH_SPEC N1: ≈58% of the width, at most [height] (150 dp) tall. */
@Composable
fun DayTitleArt(@DrawableRes res: Int, title: String, modifier: Modifier = Modifier, height: Dp = 150.dp) {
    val painter = painterResource(res)
    val intrinsic = painter.intrinsicSize
    val aspect = if (intrinsic.height > 0f && intrinsic.width > 0f) intrinsic.width / intrinsic.height else 1.5f
    BoxWithConstraints(modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
        val (w0, _) = HeadlineSize.fit(maxWidth.value, aspect, day = true)
        val w = minOf(w0, height.value * aspect)
        Image(
            painter,
            contentDescription = titleCaseLabel(title),
            contentScale = ContentScale.Fit,
            modifier = Modifier.width(w.dp).height((w / aspect).dp).semantics { heading() }.titleArtMotion(float = false),
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

/** §13 The W / L badge in Leaderboard / Records / recent-match rows (was a "Win" / "Loss" text chip). */
val ROW_RESULT_BADGE_SIZE: Dp = 18.dp

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

// ── Second pass (ART_SPEC §6–§9) ──────────────────────────────────────────

/**
 * §6 Moment lettering (≈900 wide, glossy): gold for wins, purple-pink for SO CLOSE /
 * DRAW, slate for YOU LOSE, fire for STREAK. [label] is the words TalkBack reads.
 */
enum class MomentArt(@DrawableRes val res: Int, val label: String) {
    VICTORY(R.drawable.art_moment_victory, "Victory!"),
    SO_CLOSE(R.drawable.art_moment_soclose, "So close!"),
    SWEEP(R.drawable.art_moment_sweep, "Sweep!"),
    FLAWLESS(R.drawable.art_moment_flawless, "Flawless!"),
    YOU_WIN(R.drawable.art_moment_youwin, "You win!"),
    YOU_LOSE(R.drawable.art_moment_youlose, "You lose"),
    DRAW(R.drawable.art_moment_draw, "Draw"),
    NEW_RECORD(R.drawable.art_moment_newrecord, "New record!"),
    STREAK(R.drawable.art_moment_streak, "Streak!"),
}

/**
 * §6 A moment headline image in place of the text headline: [widthFraction] of the
 * width it is given (~70% of the card), at most [maxHeight] tall, aspect kept.
 * TalkBack reads [contentDescription] (the words) as a heading.
 */
@Composable
fun MomentTitle(
    art: MomentArt,
    modifier: Modifier = Modifier,
    widthFraction: Float = 0.7f,
    maxHeight: Dp = 72.dp,
    contentDescription: String = art.label,
    alignment: Alignment = Alignment.Center,
) {
    Box(modifier.fillMaxWidth(), contentAlignment = alignment) {
        Image(
            // AQ2: decoded at about its shown width, cached across screens.
            artPainter(art.res, androidx.compose.ui.platform.LocalConfiguration.current.screenWidthDp.dp * widthFraction),
            contentDescription = contentDescription,
            contentScale = ContentScale.Fit,
            modifier = Modifier.fillMaxWidth(widthFraction).heightIn(max = maxHeight).semantics { heading() },
        )
    }
}

/** §7 Scenes for empty / error / done states (≈600 wide, one character with a prop). */
enum class SceneArt(@DrawableRes val res: Int) {
    /** Empty lists / boards ("nobody's on yet", empty leaderboard / friends feeds). */
    ASLEEP(R.drawable.art_scene_r_asleep),
    /** Offline / failed-to-load / error screens. */
    UNPLUGGED(R.drawable.art_scene_r_unplugged),
    /** All dailies done / played-today limit / "fresh puzzles in …". */
    ALL_DONE(R.drawable.art_scene_u_alldone),
    /** Profile-not-found, missing-item states. */
    NOT_FOUND(R.drawable.art_scene_o3_notfound),
    /** Empty Friends ("add a friend") states and the invite sheet header. */
    INVITE(R.drawable.art_scene_i_invite),
    /** Stats empty ("play a game and I'll crunch the numbers"). */
    NO_STATS(R.drawable.art_scene_d_nostats),
}

/**
 * §7 A scene image, [height] tall (~140), never wider than [maxWidthFraction] of the
 * width it is given, aspect kept. Decorative (hidden from TalkBack).
 */
@Composable
fun SceneImage(scene: SceneArt, modifier: Modifier = Modifier, height: Dp = 140.dp, maxWidthFraction: Float = 0.6f) {
    BoxWithConstraints(modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
        Image(
            artPainter(scene.res, maxOf(height * 1.6f, maxWidth * maxWidthFraction)),
            contentDescription = null,
            contentScale = ContentScale.Fit,
            modifier = Modifier.heightIn(max = height).widthIn(max = maxWidth * maxWidthFraction).clearAndSetSemantics { },
        )
    }
}

/**
 * §7 The empty-state component (MASCOT_SPEC §6 with its scene): the [scene] above
 * one short line in the host's voice. [content] adds the screen's existing action.
 */
@Composable
fun SceneEmptyState(
    scene: SceneArt,
    says: String,
    modifier: Modifier = Modifier,
    height: Dp = 140.dp,
    color: Color = WTheme.textSecondary,
    content: (@Composable () -> Unit)? = null,
) {
    Column(
        modifier.fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        SceneImage(scene, height = height)
        Text(says, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = color, textAlign = TextAlign.Center)
        content?.invoke()
    }
}

/**
 * §8 The holiday Leaderboard title: the whole-cast LEADERBOARD art with the holiday
 * title (`<HOLIDAY> HEROES`) as a small caps subtitle under it. One heading for
 * TalkBack ("Leaderboard, Halloween Heroes").
 */
@Composable
fun HolidayLeaderboardTitle(holidayTitle: String, modifier: Modifier = Modifier, artHeight: Dp = 96.dp, subtitleColor: Color = WTheme.textSecondary) {
    Column(
        modifier.fillMaxWidth().clearAndSetSemantics {
            contentDescription = "Leaderboard, ${titleCaseLabel(holidayTitle)}"
            heading()
        },
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        Image(
            painterResource(R.drawable.art_title_leaderboard),
            contentDescription = null,
            contentScale = ContentScale.Fit,
            modifier = Modifier.widthIn(max = TITLE_ART_MAX_WIDTH).fillMaxWidth().heightIn(max = artHeight).titleArtMotion(float = true),
        )
        Text(
            holidayTitle.uppercase(), fontSize = 12.sp, fontWeight = FontWeight.Black, letterSpacing = 1.4.sp,
            color = subtitleColor, maxLines = 1, textAlign = TextAlign.Center,
        )
    }
}

/**
 * §9 The glossy 3D pocket game icon for a friendly-game kind (256 sq):
 * rock fist, X+O, star coin, puzzle piece, little ghost, chain links.
 */
@DrawableRes
fun pocketArtRes(kind: com.wordocious.core.FriendlyKind): Int = when (kind) {
    com.wordocious.core.FriendlyKind.RPS -> R.drawable.game_pocket_rps
    com.wordocious.core.FriendlyKind.TTT -> R.drawable.game_pocket_ttt
    com.wordocious.core.FriendlyKind.COIN -> R.drawable.game_pocket_coin
    com.wordocious.core.FriendlyKind.PASS -> R.drawable.game_pocket_pass
    com.wordocious.core.FriendlyKind.GHOST -> R.drawable.game_pocket_ghost
    com.wordocious.core.FriendlyKind.CHAIN -> R.drawable.game_pocket_chain
}

// ── Third pass (ART_SPEC §10): game title art ─────────────────────────────

/**
 * §10 The game's name lettered in its accent color with its host on the end
 * (`art_game_<id>.webp`, ≈900 wide) for a catalog mode id, or null for an id
 * without one (VS, More, unknown): callers keep today's text + host.
 */
@DrawableRes
fun gameTitleArtRes(modeId: String?): Int? = when (modeId) {
    "practice" -> R.drawable.art_game_practice
    "gauntlet" -> R.drawable.art_game_gauntlet
    "quordle" -> R.drawable.art_game_quordle
    "octordle" -> R.drawable.art_game_octordle
    "sequence" -> R.drawable.art_game_sequence
    "rescue" -> R.drawable.art_game_rescue
    "six" -> R.drawable.art_game_six
    "seven" -> R.drawable.art_game_seven
    "propernoundle" -> R.drawable.art_game_propernoundle
    "sudoku" -> R.drawable.art_game_sudoku
    "scramble" -> R.drawable.art_game_scramble
    "hub" -> R.drawable.art_game_hub
    "crossword" -> R.drawable.art_game_crossword
    "groups" -> R.drawable.art_game_groups
    "ladder" -> R.drawable.art_game_ladder
    "cryptogram" -> R.drawable.art_game_cryptogram
    "wordsearch" -> R.drawable.art_game_wordsearch
    "regions" -> R.drawable.art_game_regions
    else -> null
}

/** §10 [gameTitleArtRes] for a mode db key (DUEL, DUEL_6, CROSSWORD, …). */
@DrawableRes
fun gameTitleArtResForKey(dbKey: String?): Int? =
    gameTitleArtRes(dbKey?.let { com.wordocious.app.ModeGen.byDbKey(it)?.id })

/** §10 The game title's accessibility label: the catalog title ("Letter Ladder"), else the key. */
fun gameTitleLabelForKey(dbKey: String): String = com.wordocious.app.ModeGen.byDbKey(dbKey)?.title ?: dbKey

/**
 * §19.3 Game screen header title art: below the corner-button row, spanning the
 * content width minus 32 dp, height following the aspect ratio, capped at 120 dp
 * (84 dp on short screens, height < [GAME_TITLE_SHORT_SCREEN]); never under 44 dp.
 */
val GAME_TITLE_ART_HEADER_MAX: Dp = 120.dp
val GAME_TITLE_ART_HEADER_MAX_SHORT: Dp = 56.dp // BA1 (was 84): short screens give the board the height
val GAME_TITLE_SHORT_SCREEN: Dp = 700.dp
val GAME_TITLE_ART_HEADER_MIN: Dp = 44.dp
/** §19.3 The title art's side inset (content width minus 32). */
val GAME_TITLE_ART_SIDE_INSET: Dp = 16.dp

/** §19.3 The header title's height cap for a screen [screenHeight] tall. */
fun gameHeaderTitleMax(screenHeight: Dp): Dp =
    if (screenHeight < GAME_TITLE_SHORT_SCREEN) GAME_TITLE_ART_HEADER_MAX_SHORT else GAME_TITLE_ART_HEADER_MAX

/** §14 Guide sheet top art cap (was ≈56; full sheet width minus 32). */
val GAME_TITLE_ART_GUIDE_HEIGHT: Dp = 72.dp
/** §14 Leaderboard / Records Play card art cap (was ≈40; fills the space left of Play). */
val GAME_TITLE_ART_CARD_HEIGHT: Dp = 52.dp
/**
 * §19.3 / FINISH_SPEC B4 / AX The controls row of a game header (48 dp tap area + 4 dp
 * inset, tucked right under the status bar): the title art starts below it.
 */
val GAME_CORNER_ROW: Dp = 52.dp

/** The game title art's height / width when the drawable can't say (≈900 × 210). */
private const val GAME_TITLE_ART_FALLBACK_RATIO = 0.235f

/**
 * §14 The title art's height for [availableWidth] at the art's [ratio] (height /
 * width): the full width, height following the aspect ratio, capped at [max] and
 * raised to [min] (a short name then overflows its box a little and centers).
 */
fun gameTitleArtHeight(availableWidth: Dp, ratio: Float, min: Dp, max: Dp): Dp =
    (availableWidth * ratio).coerceAtMost(max).coerceAtLeast(min)

/**
 * §10 / §14 A game's title art filling the width it is given (height following the
 * aspect ratio, between [minHeight] and [maxHeight]), never stretched. TalkBack reads
 * [label] (the game title), as a heading when [heading]. §16: pops in once (no idle
 * float: this art sits in game headers and cards).
 */
@Composable
fun FittedGameTitleArt(
    @DrawableRes res: Int,
    label: String,
    modifier: Modifier = Modifier,
    maxHeight: Dp,
    minHeight: Dp = 0.dp,
    alignment: Alignment = Alignment.Center,
    heading: Boolean = true,
) {
    // AQ2: the ~900 px title decoded once at about screen width and shared (mode switches re-use it).
    val painter = artPainter(res, androidx.compose.ui.platform.LocalConfiguration.current.screenWidthDp.dp)
    val intrinsic = painter.intrinsicSize
    val ratio = if (intrinsic.isSpecified && intrinsic.width > 0f && intrinsic.height > 0f) intrinsic.height / intrinsic.width
        else GAME_TITLE_ART_FALLBACK_RATIO
    BoxWithConstraints(modifier.fillMaxWidth(), contentAlignment = alignment) {
        val h = gameTitleArtHeight(maxWidth, ratio, minHeight, maxHeight)
        Image(
            painter,
            contentDescription = label,
            contentScale = ContentScale.Fit,
            modifier = Modifier.requiredSize(h / ratio, h)
                .semantics { if (heading) heading() }
                .titleArtMotion(float = false),
        )
    }
}

/**
 * §10 A game's title art at a fixed [height], width following the aspect ratio and
 * shrinking (never stretching) to the width it is given. §16: pops in once.
 */
@Composable
fun GameTitleArt(
    @DrawableRes res: Int,
    label: String,
    modifier: Modifier = Modifier,
    height: Dp = GAME_TITLE_ART_HEADER_MIN,
    heading: Boolean = true,
) {
    Image(
        painterResource(res),
        contentDescription = label,
        contentScale = ContentScale.Fit,
        modifier = modifier.height(height).semantics { if (heading) heading() }.titleArtMotion(float = false),
    )
}

/**
 * §10 / §19.3 A game screen header's title art for [dbKey]: the corner Home / ? /
 * sound buttons keep their own top row ([GAME_CORNER_ROW]) and the art sits below
 * it, spanning the width minus 32 dp, 44–120 dp tall (84 cap on short screens); the
 * header's status line follows under it. [fallback] (today's text + host, between
 * the corner buttons) when the key has no art. [maxHeight] lowers the cap (Muddle's
 * one-screen compact layout keeps the short-screen cap).
 */
@Composable
fun GameHeaderTitle(dbKey: String, modifier: Modifier = Modifier, maxHeight: Dp? = null, fallback: @Composable () -> Unit) {
    val res = gameTitleArtResForKey(dbKey)
    if (res == null) {
        fallback()
        return
    }
    val screenHeight = androidx.compose.ui.platform.LocalConfiguration.current.screenHeightDp.dp
    FittedGameTitleArt(
        res, gameTitleLabelForKey(dbKey),
        modifier.fillMaxWidth().padding(top = GAME_CORNER_ROW).padding(horizontal = GAME_TITLE_ART_SIDE_INSET),
        maxHeight = minOf(gameHeaderTitleMax(screenHeight), maxHeight ?: GAME_TITLE_ART_HEADER_MAX), minHeight = GAME_TITLE_ART_HEADER_MIN,
    )
}

// ── §16 Title art motion ──────────────────────────────────────────────────

/**
 * §16 Title art motion: a one-time pop-in when the art first appears (scale 0.94 →
 * 1.03 → 1.0, opacity 0 → 1, 420 ms, spring-ish ease-out), then — page and day
 * titles only ([float]) — a very slow idle float (translateY 0 → −2 → 0 over 4 s,
 * forever; paused while its tab is hidden). Reduce Motion (the in-app toggle or the
 * system "Remove animations"): static. The pop plays once per page, not again when
 * a list scrolls the art back into view.
 */
@Composable
fun Modifier.titleArtMotion(float: Boolean): Modifier {
    if (WTheme.reducedMotion) return this
    var played by rememberSaveable { mutableStateOf(false) }
    val scale = remember { Animatable(if (played) 1f else 0.94f) }
    val alpha = remember { Animatable(if (played) 1f else 0f) }
    LaunchedEffect(Unit) {
        if (!played) {
            launch { alpha.animateTo(1f, tween(260, easing = FastOutSlowInEasing)) }
            scale.animateTo(
                1f,
                keyframes {
                    durationMillis = 420
                    0.94f at 0 using FastOutSlowInEasing
                    1.03f at 260 using FastOutSlowInEasing
                    1f at 420
                },
            )
            played = true
        }
    }
    // FINISH_SPEC A6: titles are headlines right on the wallpaper — no idle float any more
    // (the one-time pop-in stays). [float] is kept for call-site compatibility.
    @Suppress("UNUSED_VARIABLE") val noFloat = float
    return this.graphicsLayer {
        scaleX = scale.value
        scaleY = scale.value
        this.alpha = alpha.value
    }
}
