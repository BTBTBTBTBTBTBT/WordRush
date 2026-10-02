package com.wordocious.app.ui

import android.os.Handler
import android.os.Looper
import androidx.annotation.DrawableRes
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.keyframes
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.ColorMatrix
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.paneTitle
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.R
import com.wordocious.app.data.AchievementCatalog
import com.wordocious.app.data.AchievementService
import com.wordocious.app.ui.game.WIN_CAST_CONFETTI
import com.wordocious.app.ui.game.WinPopupMath
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.core.LevelTier
import com.wordocious.core.levelTier
import com.wordocious.core.levelTierChanged
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin

// docs/FINISH_SPEC.md V — the 3D achievement badges + level badges, one kit:
//  · the art (art_badge_<icon> per achievement `icon` key, art_badge_level_<tier>, the Pro mark),
//  · V1 the achievement tile (unlocked = full color + soft glow + name + date; locked =
//    grayscale, 45 % opacity, a small 3D lock, name + progress in soft numbers) and its
//    detail sheet (the big badge),
//  · V2 the unlock moment: a queue of popups in the R1 card language (the badge springs in
//    big with rays + confetti, "ACHIEVEMENT UNLOCKED", a candy "Nice!"), fed by
//    AchievementService.checkAchievements and the XP toast's tier-changing level-ups,
//  · V3 the level badge (tier badge + the level in soft numbers) and the Pro mark.
// Reduce Motion: no spring, rays or confetti — the popup simply appears.

// ── Pure bits (unit-tested: BadgeKitTest) ──────────────────────────────────

/** The badge art for an achievement `icon` key / a level tier. */
object BadgeArt {
    /** The 16 achievement icon slugs with art (web lucide names, '-' → '_'). */
    val ACHIEVEMENT_SLUGS = listOf(
        "star", "crown", "zap", "flame", "trophy", "sparkles", "grid", "swords", "target",
        "medal", "trending_up", "shuffle", "quote", "key_round", "group", "calendar",
    )

    /** "trending-up" → "trending_up"; unknown / missing → "star". */
    fun slug(icon: String?): String {
        val s = icon?.trim()?.lowercase(Locale.US)?.replace('-', '_')?.replace(' ', '_').orEmpty()
        return if (s in ACHIEVEMENT_SLUGS) s else "star"
    }

    @DrawableRes
    fun achievement(icon: String?): Int = when (slug(icon)) {
        "crown" -> R.drawable.art_badge_crown
        "zap" -> R.drawable.art_badge_zap
        "flame" -> R.drawable.art_badge_flame
        "trophy" -> R.drawable.art_badge_trophy
        "sparkles" -> R.drawable.art_badge_sparkles
        "grid" -> R.drawable.art_badge_grid
        "swords" -> R.drawable.art_badge_swords
        "target" -> R.drawable.art_badge_target
        "medal" -> R.drawable.art_badge_medal
        "trending_up" -> R.drawable.art_badge_trending_up
        "shuffle" -> R.drawable.art_badge_shuffle
        "quote" -> R.drawable.art_badge_quote
        "key_round" -> R.drawable.art_badge_key_round
        "group" -> R.drawable.art_badge_group
        "calendar" -> R.drawable.art_badge_calendar
        else -> R.drawable.art_badge_star
    }

    @DrawableRes
    fun level(tier: LevelTier): Int = when (tier) {
        LevelTier.BRONZE -> R.drawable.art_badge_level_bronze
        LevelTier.SILVER -> R.drawable.art_badge_level_silver
        LevelTier.GOLD -> R.drawable.art_badge_level_gold
        LevelTier.PLATINUM -> R.drawable.art_badge_level_platinum
        LevelTier.DIAMOND -> R.drawable.art_badge_level_diamond
    }

    /** The Pro member mark (crown on a purple gem). */
    @DrawableRes
    val PRO: Int = R.drawable.art_badge_level_pro
}

/** One queued unlock moment (V2). */
sealed interface BadgeMoment {
    val id: String

    data class Achievement(val key: String) : BadgeMoment {
        override val id: String get() = "ach:$key"
    }

    data class LevelUp(val level: Int) : BadgeMoment {
        override val id: String get() = "lvl:$level"
    }
}

/** What a locked achievement's progress bar can read off the profile. */
data class AchievementProgressInputs(
    val dailyStreak: Int = 0,
    val totalMedals: Int = 0,
    val goldMedals: Int = 0,
    val totalWins: Int = 0,
    val totalGames: Int = 0,
    val level: Int = 1,
    val bestWinStreak: Int = 0,
)

object BadgeMath {
    /** The moments of [incoming] still to append: not already queued, not shown this session, no repeats. */
    fun toEnqueue(queued: List<BadgeMoment>, seen: Set<String>, incoming: List<BadgeMoment>): List<BadgeMoment> {
        val taken = HashSet<String>(queued.map { it.id }).apply { addAll(seen) }
        return incoming.filter { taken.add(it.id) }
    }

    /**
     * The level-up popup's gate: a level-up whose new level sits in a different tier than
     * the level before it (one game is worth < 1,000 XP, so the previous level is N − 1).
     */
    fun tierChangedOnLevelUp(leveledUp: Boolean, newLevel: Int): Boolean =
        leveledUp && newLevel > 1 && levelTierChanged(newLevel - 1, newLevel)

    /**
     * A locked achievement's progress as (current, target), read off the profile counters;
     * null when the profile can't tell, or once the target is reached.
     */
    fun progress(key: String, p: AchievementProgressInputs): Pair<Int, Int>? {
        val m = when (key) {
            "streak_7" -> p.dailyStreak to 7
            "streak_30" -> p.dailyStreak to 30
            "streak_master" -> p.dailyStreak to 50
            "year_one" -> p.dailyStreak to 365
            "medal_10" -> p.totalMedals to 10
            "medal_50" -> p.totalMedals to 50
            "medal_wall" -> p.totalMedals to 100
            "golden_touch" -> p.goldMedals to 10
            "gold_rush" -> p.goldMedals to 50
            "diamond_hands" -> p.goldMedals to 100
            "century_club" -> p.totalWins to 100
            "wordsmith" -> p.totalWins to 500
            "thousand_words" -> p.totalWins to 1000
            "dedicated" -> p.totalGames to 500
            "endurance" -> p.totalGames to 1000
            "obsessed" -> p.totalGames to 2000
            "rising_star" -> p.level to 10
            "elite" -> p.level to 50
            "unstoppable" -> p.bestWinStreak to 5
            "unbreakable" -> p.bestWinStreak to 25
            else -> null
        } ?: return null
        val cur = m.first.coerceAtLeast(0)
        return if (cur < m.second) cur to m.second else null
    }

    /** The bar's fill (0..1). */
    fun fraction(current: Int, target: Int): Float =
        if (target <= 0) 0f else (current.toFloat() / target).coerceIn(0f, 1f)

    /** "Oct 2, 2026" from the row's `unlocked_at` (ISO timestamp or date), in the device zone; null when unreadable. */
    fun unlockDate(iso: String?, zone: ZoneId = ZoneId.systemDefault()): String? {
        val s = iso?.trim()?.takeIf { it.isNotEmpty() } ?: return null
        val day: LocalDate = runCatching {
            OffsetDateTime.parse(if (s.endsWith("Z") || s.contains('+') || s.lastIndexOf('-') > 9) s else s + "Z")
                .atZoneSameInstant(zone).toLocalDate()
        }.getOrNull()
            ?: runCatching { LocalDate.parse(s.take(10)) }.getOrNull()
            ?: return null
        return day.format(DateTimeFormatter.ofPattern("MMM d, yyyy", Locale.US))
    }

    /** "first_win" → "First Win" (when the catalog hasn't loaded). */
    fun fallbackName(key: String): String =
        key.split('_').filter { it.isNotEmpty() }.joinToString(" ") { w -> w.replaceFirstChar { it.uppercaseChar() } }
}

/** The achievement categories (web achievement-service.ts) with their accents. */
object AchievementInk {
    data class Category(val key: String, val label: String, val accent: Color)

    val CATEGORIES = listOf(
        Category("beginner", "Getting Started", Color(0xFF7C3AED)),
        Category("consistency", "Consistency", Color(0xFFF97316)),
        Category("skill", "Skill", Color(0xFF2563EB)),
        Category("social", "Social", Color(0xFF0D9488)),
        Category("collection", "Collection", Color(0xFFD97706)),
    )

    fun accent(category: String?): Color = CATEGORIES.firstOrNull { it.key == category }?.accent ?: Color(0xFF7C3AED)
    fun label(category: String?): String? = CATEGORIES.firstOrNull { it.key == category }?.label
}

/** The tier inks (glow / labels) for the level badges. */
object TierInk {
    fun accent(tier: LevelTier): Color = when (tier) {
        LevelTier.BRONZE -> Color(0xFFD9844A)
        LevelTier.SILVER -> Color(0xFF64748B)
        LevelTier.GOLD -> Color(0xFFF59E0B)
        LevelTier.PLATINUM -> Color(0xFF7C3AED)
        LevelTier.DIAMOND -> Color(0xFF2563EB)
    }
}

// ── V2 the unlock queue ────────────────────────────────────────────────────

/**
 * V2 the app-wide queue of unlock moments. [AchievementService.checkAchievements] posts
 * the keys it just unlocked; the XP toast posts a tier-changing level-up. Each moment
 * shows once per app session (re-composed toasts never re-queue it); several queue one
 * after another. [AchievementUnlockHost] shows the head.
 */
object BadgeMoments {
    private val items = mutableStateListOf<BadgeMoment>()
    private val seen = HashSet<String>()
    private val main by lazy { Handler(Looper.getMainLooper()) }

    /** The moment on screen (null = none). */
    val current: BadgeMoment? get() = items.firstOrNull()
    /** How many are waiting, the current one included. */
    val count: Int get() = items.size

    fun achievements(keys: List<String>) {
        if (keys.isNotEmpty()) post(keys.map { BadgeMoment.Achievement(it) })
    }

    fun levelUp(level: Int) = post(listOf(BadgeMoment.LevelUp(level)))

    private fun post(incoming: List<BadgeMoment>) {
        main.post {
            val add = BadgeMath.toEnqueue(items, seen, incoming)
            seen.addAll(add.map { it.id })
            items.addAll(add)
        }
    }

    /** "Nice!" — the next one (if any) takes its place. */
    fun dismiss() {
        if (items.isNotEmpty()) items.removeAt(0)
    }
}

// ── V3 level badge + Pro mark ──────────────────────────────────────────────

/** The tier badge for [level] alone, [size] square (decorative unless [contentDescription]). */
@Composable
fun TierBadge(level: Int, size: Dp, modifier: Modifier = Modifier, contentDescription: String? = null) {
    Image(
        artPainter(BadgeArt.level(levelTier(level)), size),
        contentDescription = contentDescription,
        contentScale = ContentScale.Fit,
        modifier = modifier.size(size),
    )
}

/**
 * V3 the level badge: the tier badge ([size], 16–64 dp by context) with the level number
 * in soft numbers beside it ([numberSize] defaults to ~45 % of the badge). [prefix] adds
 * a small caps word before the number ("LVL"); [showTier] adds the tier name after it.
 * Read as one: "Level N, Tier".
 */
@Composable
fun LevelBadge(
    level: Int,
    size: Dp,
    modifier: Modifier = Modifier,
    numberSize: TextUnit = (size.value * 0.45f).coerceIn(10f, 28f).sp,
    prefix: String? = null,
    showTier: Boolean = false,
    labelColor: Color? = null,
) {
    val tier = levelTier(level)
    val ink = labelColor ?: if (WTheme.isDark) WTheme.textSecondary else FinishInk.label
    Row(
        modifier.semantics(mergeDescendants = true) { contentDescription = "Level $level, ${tier.label}" },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy((size.value * 0.14f).coerceIn(3f, 8f).dp),
    ) {
        TierBadge(level, size)
        if (prefix != null) {
            Text(
                prefix, fontSize = (numberSize.value * 0.62f).sp, fontWeight = FontWeight.Black,
                letterSpacing = 0.6.sp, color = ink, maxLines = 1,
            )
        }
        SoftNumber("$level", numberSize)
        if (showTier) {
            Text(
                tier.label.uppercase(Locale.US), fontSize = (numberSize.value * 0.62f).sp, fontWeight = FontWeight.Black,
                letterSpacing = 0.6.sp, color = ink, maxLines = 1,
            )
        }
    }
}

/** V3 the small Pro member mark (art_badge_level_pro) next to a Pro player's name. */
@Composable
fun ProMark(size: Dp = 20.dp, modifier: Modifier = Modifier) {
    Image(
        artPainter(BadgeArt.PRO, size),
        contentDescription = "Pro member",
        contentScale = ContentScale.Fit,
        modifier = modifier.size(size),
    )
}

// ── V1 achievement badge, tile and detail sheet ────────────────────────────

private val GRAYSCALE = ColorFilter.colorMatrix(ColorMatrix().apply { setToSaturation(0f) })

/**
 * V1 an achievement badge: unlocked = full color on a soft [glow] (the category accent);
 * locked = grayscale at 45 % with a small 3D lock in the corner. Decorative.
 */
@Composable
fun AchievementBadge(icon: String?, size: Dp, unlocked: Boolean, modifier: Modifier = Modifier, glow: Color? = null) {
    Box(modifier.size(size).clearAndSetSemantics { }, contentAlignment = Alignment.Center) {
        if (unlocked && glow != null) {
            Box(
                Modifier.matchParentSize().drawBehind {
                    val r = size.toPx() * 0.62f
                    drawCircle(
                        Brush.radialGradient(
                            listOf(glow.copy(alpha = 0.42f), glow.copy(alpha = 0.14f), glow.copy(alpha = 0f)),
                            center = center, radius = r,
                        ),
                        radius = r,
                    )
                },
            )
        }
        Image(
            artPainter(BadgeArt.achievement(icon), size),
            contentDescription = null,
            contentScale = ContentScale.Fit,
            colorFilter = if (unlocked) null else GRAYSCALE,
            alpha = if (unlocked) 1f else 0.45f,
            modifier = Modifier.fillMaxSize(),
        )
        if (!unlocked) {
            Icon3D(
                Icon3DName.LOCK, (size.value * 0.30f).coerceIn(12f, 28f).dp,
                Modifier.align(Alignment.BottomEnd),
            )
        }
    }
}

/** A thin progress bar in [accent] (track = the accent at 16 %). */
@Composable
private fun BadgeProgressBar(fraction: Float, accent: Color, height: Dp, modifier: Modifier = Modifier) {
    Box(modifier.fillMaxWidth().height(height).clip(RoundedCornerShape(50)).background(accent.copy(alpha = 0.16f))) {
        Box(Modifier.fillMaxWidth(fraction).fillMaxHeight().clip(RoundedCornerShape(50)).background(accent))
    }
}

/**
 * V1 one achievement in the grid: a tinted tile in the category [accent] (stronger once
 * unlocked), the badge, the name, then the unlock [date] (unlocked) or the [progress] bar
 * with "37/50" in soft numbers (locked; the description when there's nothing to count).
 * Tap = [onClick] (the detail sheet).
 */
@Composable
fun AchievementTile(
    def: AchievementService.AchievementDef,
    unlocked: Boolean,
    date: String?,
    progress: Pair<Int, Int>?,
    accent: Color,
    modifier: Modifier = Modifier,
    onClick: () -> Unit,
) {
    val dark = WTheme.isDark
    val shape = RoundedCornerShape(14.dp)
    val status = when {
        unlocked -> "unlocked" + (date?.let { " $it" } ?: "")
        progress != null -> "locked, ${progress.first} of ${progress.second}"
        else -> "locked"
    }
    Column(
        modifier
            .squishClickable("${def.name}, $status. ${def.description}") { onClick() }
            .then(
                if (unlocked) Modifier.shadow(4.dp, shape, clip = false, ambientColor = accent.copy(alpha = 0.25f), spotColor = accent.copy(alpha = 0.35f))
                else Modifier,
            )
            .clip(shape)
            .background(accentWash(accent, if (unlocked) 0.16f else 0.07f))
            .drawBehind { if (unlocked) drawRect(accent, Offset.Zero, androidx.compose.ui.geometry.Size(size.width, 4.dp.toPx())) }
            .border(1.5.dp, accentLine(accent, if (unlocked) 0.42f else 0.24f), shape)
            .padding(start = 6.dp, end = 6.dp, top = 10.dp, bottom = 8.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        AchievementBadge(def.icon, 54.dp, unlocked, glow = accent)
        Text(
            def.name, fontSize = 10.sp, fontWeight = FontWeight.Black,
            color = if (dark) WTheme.text else if (unlocked) FinishInk.heading else FinishInk.muted,
            maxLines = 2, overflow = TextOverflow.Ellipsis, textAlign = TextAlign.Center, lineHeight = 12.sp,
        )
        when {
            unlocked -> Text(
                date ?: "Unlocked", fontSize = 9.sp, fontWeight = FontWeight.ExtraBold,
                color = if (dark) WTheme.textSecondary else darkenInk(accent), maxLines = 1,
            )
            progress != null -> {
                BadgeProgressBar(BadgeMath.fraction(progress.first, progress.second), accent, 4.dp, Modifier.padding(top = 1.dp))
                SoftNumber("${progress.first}/${progress.second}", 11.sp)
            }
            else -> Text(
                def.description, fontSize = 8.sp, fontWeight = FontWeight.Bold,
                color = if (dark) WTheme.textMuted else FinishInk.muted,
                maxLines = 2, overflow = TextOverflow.Ellipsis, textAlign = TextAlign.Center, lineHeight = 10.sp,
            )
        }
    }
}

/**
 * V1 the detail sheet: a tinted sheet in the category [accent] with the big badge (glow +
 * rays when unlocked), the category, name, description, and the date / progress.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AchievementDetailSheet(
    def: AchievementService.AchievementDef,
    unlocked: Boolean,
    date: String?,
    progress: Pair<Int, Int>?,
    onDismiss: () -> Unit,
) {
    val accent = AchievementInk.accent(def.category)
    val dark = WTheme.isDark
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val scope = androidx.compose.runtime.rememberCoroutineScope()
    val close: () -> Unit = { scope.launch { sheetState.hide() }.invokeOnCompletion { onDismiss() } }
    ModalBottomSheet(
        onDismissRequest = onDismiss, sheetState = sheetState,
        containerColor = accentWash(accent, 0.10f), dragHandle = null,
    ) {
        Column(
            Modifier.fillMaxWidth().navigationBarsPadding().padding(start = 24.dp, end = 24.dp, top = 6.dp, bottom = 20.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            BadgeStage(def.icon, 150.dp, accent, unlocked = unlocked, spring = false)
            AchievementInk.label(def.category)?.let {
                Text(
                    it.uppercase(Locale.US), fontSize = 11.sp, fontWeight = FontWeight.Black, letterSpacing = 1.sp,
                    color = if (dark) WTheme.textSecondary else darkenInk(accent),
                )
            }
            Text(
                def.name, fontSize = 24.sp, fontWeight = FontWeight.Black, textAlign = TextAlign.Center,
                color = if (dark) WTheme.text else FinishInk.heading,
                modifier = Modifier.semantics { heading() },
            )
            Text(
                def.description, fontSize = 14.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center,
                color = if (dark) WTheme.textSecondary else FinishInk.muted,
            )
            when {
                unlocked -> Row(
                    Modifier.padding(top = 4.dp).tintedPill(accent).padding(start = 12.dp, end = 12.dp, top = 7.dp, bottom = 5.dp),
                    verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    Icon3D(Icon3DName.BADGE_CHECK, 16.dp)
                    Text(
                        date?.let { "Unlocked $it" } ?: "Unlocked", fontSize = 12.sp, fontWeight = FontWeight.Black,
                        color = if (dark) WTheme.text else darkenInk(accent),
                    )
                }
                progress != null -> Column(
                    Modifier.fillMaxWidth(0.8f).padding(top = 4.dp),
                    horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    BadgeProgressBar(BadgeMath.fraction(progress.first, progress.second), accent, 8.dp)
                    SoftNumber("${progress.first}/${progress.second}", 20.sp)
                }
                else -> Row(
                    Modifier.padding(top = 4.dp).tintedPill(Color(0xFF64748B)).padding(start = 12.dp, end = 12.dp, top = 7.dp, bottom = 5.dp),
                    verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    Icon3D(Icon3DName.LOCK, 14.dp)
                    Text("Not unlocked yet", fontSize = 12.sp, fontWeight = FontWeight.Black, color = if (dark) WTheme.textSecondary else FinishInk.muted)
                }
            }
            Spacer(Modifier.height(4.dp))
            CandyButton("Close", onClick = close, color = CandyColor.PEACH, size = CandySize.MEDIUM)
        }
    }
}

// ── The stage (big badge + rays) ───────────────────────────────────────────

/**
 * The big badge on its stage: a soft radial glow and slow-turning rays in [accent]
 * behind it (unlocked only), and — when [spring] — a spring-in with a 1.08 overshoot.
 * [res] overrides the achievement art (the level-up popup's tier badge). Decorative.
 */
@Composable
private fun BadgeStage(
    icon: String?,
    size: Dp,
    accent: Color,
    unlocked: Boolean = true,
    spring: Boolean = true,
    @DrawableRes res: Int? = null,
) {
    val still = WTheme.reducedMotion
    val pop = remember { Animatable(if (still || !spring) 1f else 0.3f) }
    LaunchedEffect(still, spring) {
        if (still || !spring) { pop.snapTo(1f); return@LaunchedEffect }
        delay(140)
        pop.animateTo(1f, keyframes {
            durationMillis = 620
            0.3f at 0 using FastOutSlowInEasing
            1.08f at 400 using FastOutSlowInEasing
            1f at 620
        })
    }
    // FINISH_SPEC AD: the rays are ambient — off under Battery Saver too (the pop stays).
    val spin = if (still || !unlocked || WTheme.calmMotion) null else rememberInfiniteTransition(label = "badgeRays").animateFloat(
        initialValue = 0f, targetValue = 360f,
        animationSpec = infiniteRepeatable(tween(24_000, easing = LinearEasing), RepeatMode.Restart),
        label = "rays",
    )
    val stage = size * 1.45f
    Box(Modifier.size(stage).clearAndSetSemantics { }, contentAlignment = Alignment.Center) {
        if (unlocked) {
            Canvas(Modifier.matchParentSize()) {
                val c = center
                val r = this.size.minDimension / 2f
                val rays = Path()
                var deg = 0f
                while (deg < 360f) {
                    val a0 = deg * PI.toFloat() / 180f
                    val a1 = (deg + 10f) * PI.toFloat() / 180f
                    rays.moveTo(c.x, c.y)
                    rays.lineTo(c.x + r * cos(a0), c.y + r * sin(a0))
                    rays.lineTo(c.x + r * cos(a1), c.y + r * sin(a1))
                    rays.close()
                    deg += 24f
                }
                rotate(spin?.value ?: 0f, c) {
                    drawPath(
                        rays,
                        Brush.radialGradient(
                            0f to accent.copy(alpha = 0.16f), 0.45f to accent.copy(alpha = 0.14f), 1f to accent.copy(alpha = 0f),
                            center = c, radius = r,
                        ),
                    )
                }
                val g = r * 0.75f
                drawCircle(
                    Brush.radialGradient(0f to accent.copy(alpha = 0.34f), 0.7f to accent.copy(alpha = 0f), center = c, radius = g),
                    radius = g, center = c,
                )
            }
        }
        Box(
            Modifier.size(size).graphicsLayer {
                scaleX = pop.value; scaleY = pop.value
                alpha = ((pop.value - 0.3f) / 0.35f).coerceIn(0f, 1f)
                transformOrigin = TransformOrigin.Center
            },
            contentAlignment = Alignment.Center,
        ) {
            if (res != null) {
                Image(painterResource(res), null, contentScale = ContentScale.Fit, modifier = Modifier.fillMaxSize())
            } else {
                AchievementBadge(icon, size, unlocked)
            }
        }
    }
}

// ── V2 the popup ───────────────────────────────────────────────────────────

/** The rainbow top bar (the R1 card's). */
private val BADGE_BAR = Brush.horizontalGradient(listOf(Color(0xFFA78BFA), Color(0xFFEC4899), Color(0xFFFBBF24)))

/**
 * V2 the app-wide host: shows the head of [BadgeMoments] as a popup over everything
 * (place it once, above the app's content). The first one waits a beat so a win popup
 * lands first; each plays the `unlock` sound + success haptic as it springs in.
 */
@Composable
fun AchievementUnlockHost() {
    val moment = BadgeMoments.current
    var ready by remember { mutableStateOf(false) }
    LaunchedEffect(moment == null) {
        if (moment == null) ready = false
        else { delay(900); ready = true }
    }
    if (moment == null || !ready) return
    androidx.activity.compose.BackHandler { BadgeMoments.dismiss() }
    key(moment.id) {
        when (moment) {
            is BadgeMoment.Achievement -> AchievementUnlockPopup(moment.key, BadgeMoments.count - 1) { BadgeMoments.dismiss() }
            is BadgeMoment.LevelUp -> LevelUpPopup(moment.level, BadgeMoments.count - 1) { BadgeMoments.dismiss() }
        }
    }
}

@Composable
private fun AchievementUnlockPopup(key: String, waiting: Int, onNice: () -> Unit) {
    val catalog by produceState(AchievementCatalog.cached(), key) {
        if (value.none { it.key == key }) value = AchievementCatalog.load()
    }
    val def = catalog.firstOrNull { it.key == key }
    val accent = AchievementInk.accent(def?.category)
    val name = def?.name ?: BadgeMath.fallbackName(key)
    BadgePopupFrame(accent, paneTitle = "Achievement unlocked: $name", waiting = waiting, onNice = onNice) {
        BadgeStage(def?.icon, 132.dp, accent)
        Text(
            "ACHIEVEMENT UNLOCKED", style = softNumberStyle(15.sp), letterSpacing = 1.2.sp,
            textAlign = TextAlign.Center, maxLines = 1,
        )
        Text(
            name, fontSize = 24.sp, fontWeight = FontWeight.Black, textAlign = TextAlign.Center,
            color = if (WTheme.isDark) WTheme.text else FinishInk.heading,
        )
        def?.description?.let {
            Text(
                it, fontSize = 14.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center,
                color = if (WTheme.isDark) WTheme.textSecondary else FinishInk.muted,
            )
        }
    }
}

@Composable
private fun LevelUpPopup(level: Int, waiting: Int, onNice: () -> Unit) {
    val tier = levelTier(level)
    val accent = TierInk.accent(tier)
    BadgePopupFrame(accent, paneTitle = "Level up: level $level, ${tier.label}", waiting = waiting, onNice = onNice) {
        BadgeStage(null, 132.dp, accent, res = BadgeArt.level(tier))
        Text("LEVEL UP!", style = softNumberStyle(15.sp), letterSpacing = 1.2.sp, textAlign = TextAlign.Center, maxLines = 1)
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Level", fontSize = 22.sp, fontWeight = FontWeight.Black, color = if (WTheme.isDark) WTheme.text else FinishInk.heading)
            SoftNumber("$level", 26.sp)
        }
        Text(
            "You reached ${tier.label} tier", fontSize = 14.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center,
            color = if (WTheme.isDark) WTheme.textSecondary else FinishInk.muted,
        )
    }
}

/**
 * The R1 card language for the unlock moments: the scrim (tap = [onNice]), one confetti
 * burst, the accent card over the warm cream with the rainbow bar, 28 dp corners and an
 * accent glow, scaling in; [content] then the candy "Nice!" (and "N more" when queued).
 */
@Composable
private fun BadgePopupFrame(
    accent: Color,
    paneTitle: String,
    waiting: Int,
    onNice: () -> Unit,
    content: @Composable androidx.compose.foundation.layout.ColumnScope.() -> Unit,
) {
    val still = WTheme.reducedMotion
    val view = LocalView.current
    val enter = remember { Animatable(if (still) 1f else 0f) }
    LaunchedEffect(Unit) {
        com.wordocious.app.data.SoundManager.achievementUnlocked(view)
        if (!still) enter.animateTo(1f, tween(260, easing = FastOutSlowInEasing))
    }
    val dark = WTheme.isDark
    val a = accent.copy(alpha = 1f).toArgb()
    val base = if (dark) WTheme.surface.toArgb() else WinPopupMath.CREAM
    val top = Color(WinPopupMath.cardWash(a, if (dark) 0.24f else 0.12f, base))
    val bottom = Color(WinPopupMath.cardWash(a, if (dark) 0.12f else 0.04f, base))
    val shape = RoundedCornerShape(28.dp)
    PopupScrim(onNice) {
        PopupConfetti(WIN_CAST_CONFETTI)
        Column(
            Modifier.padding(horizontal = 28.dp).widthIn(max = 360.dp).fillMaxWidth()
                .graphicsLayer {
                    val s = 0.85f + 0.15f * enter.value
                    scaleX = s; scaleY = s; alpha = enter.value
                }
                .semantics { this.paneTitle = paneTitle }
                .shadow(22.dp, shape, clip = false, ambientColor = accent.copy(alpha = 0.45f), spotColor = accent.copy(alpha = 0.6f))
                .clip(shape)
                .background(Brush.verticalGradient(listOf(top, bottom)))
                .border(1.5.dp, accent.copy(alpha = if (dark) 0.35f else 0.24f), shape)
                // The card swallows taps (only the dim dismisses).
                .pointerInput(Unit) { detectTapGestures { } },
        ) {
            Box(Modifier.fillMaxWidth().height(10.dp).background(BADGE_BAR))
            Column(
                Modifier.fillMaxWidth().padding(start = 20.dp, end = 20.dp, top = 4.dp, bottom = 20.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                content()
                Spacer(Modifier.height(6.dp))
                CandyButton("Nice!", onClick = onNice, color = CandyColor.PURPLE, size = CandySize.MEDIUM)
                if (waiting > 0) {
                    Text(
                        "$waiting more", fontSize = 11.sp, fontWeight = FontWeight.ExtraBold,
                        color = if (dark) WTheme.textMuted else FinishInk.muted,
                        modifier = Modifier.offset(y = 2.dp),
                    )
                }
            }
        }
    }
}
