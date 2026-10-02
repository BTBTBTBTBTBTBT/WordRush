package com.wordocious.app.ui

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
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.State
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.ui.theme.WTheme
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlin.math.PI
import kotlin.math.sin

// The WORDOCIOUS cast in the app (founder-approved 2026-10-02; spec:
// docs/MASCOT_SPEC.md). One shared table of who lives where (§1), who hosts
// which game (§5, keyed by the mode db key), the `Mascot` image with its idle
// motions and the `CastRow` (the ten spelling WORDOCIOUS). Every mascot is
// decorative: no content description, hidden from TalkBack. Reduce motion (the
// in-app toggle OR the system "Remove animations", WTheme.reducedMotion) shows
// static art; any other system animator-duration scale stretches every tween
// below through Compose's MotionDurationScale. Mirrors web lib/mascots.ts and
// iOS Mascots.swift.

/** The ten cast members, in WORDOCIOUS order. */
enum class MascotId(@DrawableRes val res: Int, val letter: String) {
    W(com.wordocious.app.R.drawable.mascot_w, "W"),
    O1(com.wordocious.app.R.drawable.mascot_o1, "O"),
    R(com.wordocious.app.R.drawable.mascot_r, "R"),
    D(com.wordocious.app.R.drawable.mascot_d, "D"),
    O2(com.wordocious.app.R.drawable.mascot_o2, "O"),
    C(com.wordocious.app.R.drawable.mascot_c, "C"),
    I(com.wordocious.app.R.drawable.mascot_i, "I"),
    O3(com.wordocious.app.R.drawable.mascot_o3, "O"),
    U(com.wordocious.app.R.drawable.mascot_u, "U"),
    S(com.wordocious.app.R.drawable.mascot_s, "S"),
}

/** none = static; bob = idle float; pop = one-shot entrance; wave = a hello sway. */
enum class MascotMotion { NONE, BOB, POP, WAVE }

object Mascots {
    /** The cast in WORDOCIOUS order (the CastRow). */
    val cast: List<MascotId> = MascotId.entries.toList()

    // ── §1 Page hosts (one host per page) ─────────────────────────────────
    val home = MascotId.W
    val puzzles = MascotId.C
    val wordOfTheDay = MascotId.I
    val leaderboard = MascotId.O2
    val records = MascotId.O2
    val stats = MascotId.D
    val friends = MascotId.O1
    val vs = MascotId.S
    val empty = MascotId.R
    val allDone = MascotId.U
    val pocketWin = MascotId.O3

    // ── §6 Menu page titles ───────────────────────────────────────────────
    val settings = MascotId.R
    val pro = MascotId.W
    val help = MascotId.C
    val offline = MascotId.R

    // ── §3 Moments ────────────────────────────────────────────────────────
    val loss = MascotId.R
    val vsWin = MascotId.S
    val vsLoss = MascotId.R
    val vsDraw = MascotId.U

    /** §5 Every game has a host, keyed by the mode db key. */
    val gameHosts: Map<String, MascotId> = mapOf(
        "DUEL" to MascotId.W,            // Classic: the original, the leader
        "GAUNTLET" to MascotId.S,        // endurance and speed
        "QUORDLE" to MascotId.O1,        // four arms, four boards
        "OCTORDLE" to MascotId.D,        // big brain for eight boards
        "SEQUENCE" to MascotId.I,        // grows one step at a time
        "RESCUE" to MascotId.C,          // the explorer on a rescue mission
        "DUEL_6" to MascotId.O2,         // the star of the bigger stage
        "DUEL_7" to MascotId.U,          // calm under the longest words
        "SUDOKU" to MascotId.U,          // zen logic
        "SCRAMBLE" to MascotId.R,        // groggy, everything's muddled
        "HUB" to MascotId.O1,            // all the words at once
        "CROSSWORD" to MascotId.D,       // glasses and a pencil
        "GROUPS" to MascotId.O2,         // heart sunglasses, connections
        "LADDER" to MascotId.I,          // tall, climbing
        "CRYPTOGRAM" to MascotId.C,      // the detective
        "WORDSEARCH" to MascotId.O3,     // one big eye = a spyglass
        "REGIONS" to MascotId.S,         // the gold star
        "PROPERNOUNDLE" to MascotId.W,   // proper names, the leader
    )

    /**
     * ART_SPEC §1 / §17 The host on each weekday's day-title art (`art_day_<weekday>`):
     * Monday Masters D, Tuesday Titans I, Wednesday Wizards U, Thursday Thunder S,
     * Friday's Finest O2, Saturday Stars O1, Sunday Superstars O3. The home-screen
     * widget's corner mascot.
     */
    fun dayHost(date: java.time.LocalDate): MascotId = when (date.dayOfWeek) {
        java.time.DayOfWeek.MONDAY -> MascotId.D
        java.time.DayOfWeek.TUESDAY -> MascotId.I
        java.time.DayOfWeek.WEDNESDAY -> MascotId.U
        java.time.DayOfWeek.THURSDAY -> MascotId.S
        java.time.DayOfWeek.FRIDAY -> MascotId.O2
        java.time.DayOfWeek.SATURDAY -> MascotId.O1
        else -> MascotId.O3 // Sunday
    }

    /** The game's host, or null for keys without one (VS, More, unknown). */
    fun hostFor(dbKey: String?): MascotId? = dbKey?.let { gameHosts[it] }

    /**
     * A cast member stable for the day: seeded by the local date + mode (the
     * victory fallback when a mode has no host). FNV-1a over the UTF-8 bytes of
     * "<date>|<mode>", the same pick as iOS Mascots.dailyPick.
     */
    fun dailyPick(date: String, mode: String): MascotId {
        var h = 0xcbf29ce484222325UL
        for (b in "$date|$mode".toByteArray(Charsets.UTF_8)) h = (h xor b.toUByte().toULong()) * 0x100000001b3UL
        return cast[(h % cast.size.toULong()).toInt()]
    }

    // ── §6 Voice (one short line each; American spelling, warm, never mean) ──
    const val nobodyOnLine = "Nobody's on yet. Wake the crew with an invite."
    const val addFriendLine = "Add a friend and the race begins."
    const val statsEmptyLine = "Play a game and I'll crunch the numbers."
    const val offlineLine = "Lost the connection. Give it a sec."
    val addFriends = MascotId.I

    /** §6 loading tips, voiced by D (rotate under the CastRow loader; iOS parity). */
    val loadingTips: List<String> = listOf(
        "Tip: start with a word that has three vowels.",
        "Tip: a letter in the wrong spot still belongs in the word.",
        "Tip: letters can repeat, so don't rule out doubles.",
        "Tip: hints cost points, so try a guess first.",
        "Tip: play a daily every day to keep your streak alive.",
    )
}

/** True when mascots should hold still (in-app toggle or system "Remove animations"). */
private val mascotStill: Boolean get() = WTheme.reducedMotion

/**
 * One cast member, square [size]. Decorative (hidden from screen readers).
 * Motions: BOB translateY 0 → −3 → 0 over 2.6 s forever; POP scale 0.6 → 1.08 →
 * 1 over 420 ms with a 12° wiggle, once; WAVE a hello sway, pivoting at the feet.
 * Reduce motion: static.
 */
@Composable
fun Mascot(
    id: MascotId,
    size: Dp,
    modifier: Modifier = Modifier,
    motion: MascotMotion = MascotMotion.NONE,
) {
    val still = mascotStill
    val hidden by LocalTabHidden.current
    val animated = if (still || hidden) MascotMotion.NONE else motion
    val layer: Modifier = when (animated) {
        MascotMotion.NONE -> Modifier
        MascotMotion.BOB -> Modifier.mascotBob()
        MascotMotion.POP -> Modifier.mascotPop()
        MascotMotion.WAVE -> Modifier.mascotWave()
    }
    Image(
        painterResource(id.res),
        contentDescription = null,
        modifier = modifier.size(size).clearAndSetSemantics { }.then(layer),
    )
}

@Composable
private fun Modifier.mascotBob(): Modifier {
    val t = rememberInfiniteTransition(label = "mascotBob")
    val y by t.animateFloat(
        initialValue = 0f, targetValue = -3f,
        animationSpec = infiniteRepeatable(tween(1300, easing = FastOutSlowInEasing), RepeatMode.Reverse),
        label = "y",
    )
    return graphicsLayer { translationY = y * density }
}

@Composable
private fun Modifier.mascotPop(): Modifier {
    val scale = remember { Animatable(0.6f) }
    val rot = remember { Animatable(0f) }
    LaunchedEffect(Unit) {
        coroutineScope {
            launch {
                scale.animateTo(1f, keyframes {
                    durationMillis = 420
                    0.6f at 0
                    1.08f at 260
                    1f at 420
                })
            }
            launch {
                rot.animateTo(0f, keyframes {
                    durationMillis = 420
                    0f at 0
                    -12f at 140
                    8f at 280
                    0f at 420
                })
            }
        }
    }
    return graphicsLayer {
        scaleX = scale.value; scaleY = scale.value; rotationZ = rot.value
        transformOrigin = TransformOrigin(0.5f, 0.9f)
    }
}

@Composable
private fun Modifier.mascotWave(): Modifier {
    // A hello sway (−9° … +8°, easing out) for ~1.1 s, then a rest, every 2.4 s.
    val t = rememberInfiniteTransition(label = "mascotWave")
    val ms by t.animateFloat(
        initialValue = 0f, targetValue = 2400f,
        animationSpec = infiniteRepeatable(tween(2400, easing = LinearEasing), RepeatMode.Restart),
        label = "t",
    )
    return graphicsLayer {
        val sway = if (ms < 1100f) (1f - ms / 1100f) else 0f
        rotationZ = -9f * sway * sin(2.0 * PI * ms / 440.0).toFloat()
        transformOrigin = TransformOrigin(0.5f, 0.95f)
    }
}

/**
 * The ten in order, spelling WORDOCIOUS, [size] per tile. [motion] WAVE makes
 * each tile hop [hop] with a [staggerMs] stagger: [repeats] = null loops every
 * [loopMs] (the loader: 8 dp hop, 70 ms, 1.1 s), a number plays that many waves
 * then rests (the sweep celebration: 14 dp, 60 ms, twice). BOB floats the row.
 * [crown] puts the 3D `crown` (HEADER_SPEC §2) on W's top edge, [crownWidth] of
 * W's width (Flawless 0.58, the Pro header 0.45). A negative [gap] overlaps the
 * tiles (the home header's cast title, ~8%). Decorative.
 */
@Composable
fun CastRow(
    size: Dp,
    modifier: Modifier = Modifier,
    motion: MascotMotion = MascotMotion.NONE,
    hop: Dp = 8.dp,
    staggerMs: Int = 70,
    loopMs: Int = 1100,
    repeats: Int? = null,
    crown: Boolean = false,
    gap: Dp = 2.dp,
    crownWidth: Float = 0.58f,
) {
    val still = mascotStill
    val hidden by LocalTabHidden.current
    val waving = motion == MascotMotion.WAVE && !still && !hidden
    val hopMs = 380
    val period = if (repeats == null) loopMs else staggerMs * (Mascots.cast.size - 1) + hopMs + 40
    val clock: State<Float> = if (!waving) remember { mutableStateOf(-1f) } else if (repeats == null) {
        rememberInfiniteTransition(label = "castWave").animateFloat(
            initialValue = 0f, targetValue = period.toFloat(),
            animationSpec = infiniteRepeatable(tween(period, easing = LinearEasing), RepeatMode.Restart),
            label = "t",
        )
    } else {
        val a = remember { Animatable(0f) }
        LaunchedEffect(repeats, period) {
            a.snapTo(0f)
            a.animateTo((period * repeats).toFloat(), tween(period * repeats, easing = LinearEasing))
        }
        a.asState()
    }
    val bobMod = if (motion == MascotMotion.BOB && !still && !hidden) Modifier.mascotBob() else Modifier
    Row(
        modifier.clearAndSetSemantics { }.then(bobMod).padding(top = if (crown) size * crownWidth * 0.62f else 0.dp),
        horizontalArrangement = Arrangement.spacedBy(gap),
        verticalAlignment = Alignment.Bottom,
    ) {
        Mascots.cast.forEachIndexed { i, id ->
            Box(
                Modifier.size(size).graphicsLayer {
                    val now = clock.value
                    if (now >= 0f) {
                        val local = (now % period) - i * staggerMs
                        if (local in 0f..hopMs.toFloat()) {
                            translationY = -hop.toPx() * sin(PI * local / hopMs).toFloat()
                        }
                    }
                },
            ) {
                Image(painterResource(id.res), null, Modifier.size(size))
                if (crown && id == MascotId.W) {
                    Icon3D(
                        Icon3DName.CROWN, size * crownWidth,
                        Modifier.align(Alignment.TopCenter).offset(y = -size * crownWidth * 0.62f),
                    )
                }
            }
        }
    }
}

/**
 * The CastRow loader that replaces a spinner (§3): 22 dp tiles in a looping
 * staggered wave over [label] (e.g. "LOADING CLASSIC"), with an optional rotating
 * tip voiced by D underneath.
 */
@Composable
fun CastLoader(
    label: String?,
    modifier: Modifier = Modifier,
    labelColor: Color = WTheme.textSecondary,
    tips: Boolean = false,
) {
    Column(modifier, horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        CastRow(22.dp, motion = MascotMotion.WAVE, hop = 8.dp, staggerMs = 70, loopMs = 1100)
        if (label != null) {
            Text(label, fontSize = 13.sp, fontWeight = FontWeight.Black, letterSpacing = 1.5.sp, color = labelColor)
        }
        if (tips) {
            var tip by remember { mutableIntStateOf((System.currentTimeMillis() / 1000L % Mascots.loadingTips.size).toInt()) }
            LaunchedEffect(Unit) {
                while (true) { delay(3500); tip = (tip + 1) % Mascots.loadingTips.size }
            }
            Row(
                Modifier.padding(horizontal = 24.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Mascot(MascotId.D, 24.dp)
                Text(
                    Mascots.loadingTips[tip], fontSize = 12.sp, fontWeight = FontWeight.SemiBold,
                    color = labelColor, textAlign = TextAlign.Start,
                )
            }
        }
    }
}

// Empty states draw their ART_SPEC §7 scene: SceneEmptyState in ArtKit.kt.

/**
 * A game screen's title with its host (MASCOT_SPEC §5). ART_SPEC §10 / §19.3: a game
 * with title art shows `art_game_<id>` (lettering + host, below the corner-button row,
 * up to 120 dp tall: [GameHeaderTitle]) instead; [art] = false keeps the text
 * (Gauntlet's stage name).
 * Otherwise the 30 dp host stands at the left of [title], static (no motion during
 * play); keys without a host render the title alone.
 */
@Composable
fun HostedGameTitle(dbKey: String?, modifier: Modifier = Modifier, art: Boolean = true, title: @Composable () -> Unit) {
    if (art && dbKey != null && gameTitleArtResForKey(dbKey) != null) {
        GameHeaderTitle(dbKey, modifier, fallback = title)
        return
    }
    val host = Mascots.hostFor(dbKey)
    if (host == null) {
        Box(modifier) { title() }
        return
    }
    Row(modifier, verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        Mascot(host, 30.dp)
        title()
    }
}

/**
 * A solo result card with its host standing on the card's top edge (MASCOT_SPEC
 * §3, §5): a win pops the game's host (or the day's cast pick when the mode has
 * none) at 88 dp above VICTORY; a loss shows R at 80 dp, static, above the result.
 * [content] receives the top inset the card must leave (its own padding) so the
 * host's feet rest on the card, clear of the headline.
 */
@Composable
fun ResultHostBox(
    won: Boolean,
    dbKey: String?,
    modifier: Modifier = Modifier,
    content: @Composable (topInset: Dp) -> Unit,
) {
    val id = if (won) Mascots.hostFor(dbKey) ?: Mascots.dailyPick(com.wordocious.app.todayLocalDate(), dbKey ?: "") else Mascots.loss
    val size = if (won) 88.dp else 80.dp
    Box(modifier, contentAlignment = Alignment.TopCenter) {
        content(size - RESULT_HOST_OVERLAP)
        Mascot(id, size, motion = if (won) MascotMotion.POP else MascotMotion.NONE)
    }
}

/** How far a result host stands into the card (its accent bar and top padding). */
private val RESULT_HOST_OVERLAP = 22.dp

/**
 * A menu page's host beside its title (MASCOT_SPEC §6): 40 dp, idle bob (these
 * pages are never a game).
 */
@Composable
fun TitleHost(id: MascotId, modifier: Modifier = Modifier, size: Dp = 40.dp) {
    Mascot(id, size, modifier, motion = MascotMotion.BOB)
}

/** The idle bob for a group (a host plus something it wears); static under reduce motion. */
@Composable
fun Modifier.mascotGroupBob(): Modifier {
    val hidden by LocalTabHidden.current
    return if (mascotStill || hidden) this else this.then(Modifier.mascotBob())
}
