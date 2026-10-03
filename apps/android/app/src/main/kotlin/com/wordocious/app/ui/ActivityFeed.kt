package com.wordocious.app.ui

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.GridView
import androidx.compose.material.icons.filled.MilitaryTech
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.ModeGen
import com.wordocious.app.data.AuthService
import com.wordocious.app.data.FriendsService
import com.wordocious.app.data.ModeCoverage
import com.wordocious.app.todayLocalDate
import com.wordocious.app.ui.theme.Nunito
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.app.ui.friends.friendsCard
import com.wordocious.app.ui.friends.color
import kotlinx.coroutines.launch

// ACTIVITY (§290, Friends D3.2) — the Friends tab's feed: the last seven days
// of your circle's moments — Daily Sweeps, Flawless Victories, podium /
// perfect / streak medals, all-time records set, More Games Sweeps, shield
// gifts (§294) — newest
// first, each row a door to the profile. Read-only over the existing tables
// (GET /api/friends/feed). Twin of web components/friends/activity-feed.tsx.

private val PURPLE = Color(0xFF7C3AED)

/** One feed sentence + its icon (a vector, or the crown drawable for gold). */
private data class FeedLine(
    val text: String,
    val icon: ImageVector?,
    val crown: Boolean,
    val tint: Color,
    /** The 3D set's glyph where one exists (HEADER_SPEC §2). */
    val icon3d: Icon3DName? = null,
)

/** The sentence exactly as web describe() writes it. */
private fun describe(e: FriendsService.FeedEvent): FeedLine {
    val who = if (e.me) "You" else e.username
    return when (e.type) {
        "flawless" -> FeedLine("$who won every daily — Flawless Victory", null, false, Color(0xFFB45309), Icon3DName.TROPHY)
        "sweep" -> FeedLine("$who swept the dailies", Icons.Filled.AutoAwesome, false, PURPLE)
        // BJ12: the count comes from the catalog (the feed route counts the same set).
        "more_flawless" -> FeedLine(ModeCoverage.moreSweepMomentText(who, true, ModeCoverage.moreSweepKeys.size), Icons.Filled.GridView, false, Color(0xFFB45309))
        "more_sweep" -> FeedLine(ModeCoverage.moreSweepMomentText(who, false, ModeCoverage.moreSweepKeys.size), Icons.Filled.GridView, false, Color(0xFF4F46E5))
        // §294 (D3.4): a streak shield sent to a friend.
        "gift" -> FeedLine("$who sent ${e.otherName ?: "a friend"} a streak shield", null, false, Color(0xFF0D9488), Icon3DName.SHIELD)
        "record" -> {
            // BJ12: the shared headline — "Fewest Mistakes · 0 mistakes" for Sudocious, "1 guess" for Classic.
            val meta = e.gameMode?.let { ModeGen.byDbKey(it) }
            val value = if (e.kind != null && e.value != null) ModeCoverage.recordValueText(e.kind, e.value, meta?.guessSemantics, meta?.guessBase ?: 1) else null
            FeedLine(
                ModeCoverage.modeMomentHeadline("record", e.me, e.username, e.kind, e.gameMode, e.gameTitle, meta?.guessSemantics, value),
                Icons.Filled.Star, false, Color(0xFFD97706),
            )
        }
        else -> {
            // BJ12: the shared medal headline (ModeCoverage) — every game, every platform.
            val k = e.kind ?: ""
            val text = ModeCoverage.modeMomentHeadline(e.type, e.me, e.username, e.kind, e.gameMode, e.gameTitle, null, null)
            when {
                k == "gold" -> FeedLine(text, null, true, Color(0xFFD97706))
                k == "silver" -> FeedLine(text, Icons.Filled.MilitaryTech, false, Color(0xFF9CA3AF))
                k == "bronze" -> FeedLine(text, Icons.Filled.MilitaryTech, false, Color(0xFFB45309))
                k == "perfect" -> FeedLine(text, Icons.Filled.Star, false, PURPLE)
                k.startsWith("streak_") -> FeedLine(text, null, false, Color(0xFFF97316), Icon3DName.FLAME)
                else -> FeedLine(text, Icons.Filled.MilitaryTech, false, Color(0xFF9CA3AF))
            }
        }
    }
}

/** "today" / "yesterday" / "Mon" — the row's right edge. */
internal fun feedDayLabel(day: String, today: String): String {
    if (day == today) return "today"
    val d = runCatching { java.time.LocalDate.parse(day) }.getOrNull() ?: return day
    val t = runCatching { java.time.LocalDate.parse(today) }.getOrNull() ?: return day
    if (java.time.temporal.ChronoUnit.DAYS.between(d, t) == 1L) return "yesterday"
    return d.dayOfWeek.getDisplayName(java.time.format.TextStyle.SHORT, java.util.Locale.US)
}

/**
 * The four reactions + Rematch (§6) — keys MUST mirror /api/friends/react. Drawn as our
 * art via ReactionGlyph (FINISH_SPEC AM1), never as emoji.
 */
internal val REACTION_KEYS = listOf("clap", "fire", "wow", "grr")

/** A game moment's kind: the feed's `gameKind`, else its title ("Tic-Tac-Tile" → TTT). */
internal fun momentKind(e: FriendsService.FeedEvent): com.wordocious.core.FriendlyKind? =
    com.wordocious.core.FriendlyKind.from(e.gameKind)
        ?: com.wordocious.core.FRIENDLY_TITLES.entries.firstOrNull { it.value == e.gameTitle }?.key

/**
 * MOMENTS (§290 → Friends overhaul §6 → FINISH_SPEC K1): the last seven days of your
 * circle's moments — sweeps, medals, records, shield gifts and pocket-game wins and
 * draws — each a notice card tinted in the event's color with its top bar, the
 * player's letter tile, a small cast pose that fits the event (each pose once per
 * list, A7), the headline in Nunito Black with soft-number scores and a candy action
 * (Rematch on a game, View on a friend's moment). Reaction chips (clap, fire, wow, grr,
 * + Rematch on game moments; AM1 art, never emoji) show inside a moment only once it has
 * reactions; double-tap toggles clap, a hold opens the reaction tray (founder 2026-10-01). A
 * Rematch tap also opens the quick-play sheet with that game and friend ([onRematch]).
 */
@Composable
fun ActivityFeed(
    onOpenProfile: (String) -> Unit = {},
    onRematch: (com.wordocious.core.FriendlyKind, String) -> Unit = { _, _ -> },
) {
    val userId = AuthService.userId ?: return
    // null = loading (skeleton); empty = the quiet-week line.
    var events by remember { mutableStateOf<List<FriendsService.FeedEvent>?>(null) }
    var reactions by remember { mutableStateOf<Map<String, FriendsService.Reactions>>(emptyMap()) }
    var expanded by remember { mutableStateOf(false) }
    val hidden by LocalTabHidden.current
    LaunchedEffect(userId, hidden) {
        if (hidden && events != null) return@LaunchedEffect
        val r = FriendsService.fetchFeedWithReactions(todayLocalDate())
        events = r?.first ?: events ?: emptyList()
        if (r != null) reactions = r.second
    }
    val scope = androidx.compose.runtime.rememberCoroutineScope()
    val today = todayLocalDate()

    /** Open the quick-play sheet for a game moment: mine → the other player; theirs → them. */
    fun rematch(e: FriendsService.FeedEvent) {
        val kind = momentKind(e)
        val friend = if (e.me) e.otherId else e.userId
        if (kind != null && friend != null) onRematch(kind, friend)
    }

    fun toggle(e: FriendsService.FeedEvent, key: String) {
        val cur = reactions[e.id] ?: FriendsService.Reactions()
        val on = key !in cur.mine
        val n = (cur.counts[key] ?: 0) + if (on) 1 else -1
        reactions = reactions + (e.id to FriendsService.Reactions(
            counts = cur.counts + (key to n.coerceAtLeast(0)),
            mine = if (on) cur.mine + key else cur.mine - key,
        ))
        scope.launch { FriendsService.react(e.id, e.userId, key, on) }
        if (on && key == "rematch") rematch(e)
    }

    val pink = com.wordocious.app.ui.friends.FriendsPink
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Row(Modifier.padding(horizontal = 4.dp), verticalAlignment = Alignment.CenterVertically) {
            com.wordocious.app.ui.friends.FriendsLabel("MOMENTS")
            Spacer(Modifier.weight(1f))
            com.wordocious.app.ui.friends.FriendsLabel("LAST 7 DAYS · DOUBLE-TAP OR HOLD TO REACT")
        }
        val list = events
        when {
            list == null -> Column(
                Modifier.fillMaxWidth().friendsCard(16.dp).padding(12.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                // Reduce Motion: a still skeleton.
                val a = if (WTheme.reducedMotion) 0.6f else {
                    val pulse = rememberInfiniteTransition(label = "feed-skeleton")
                    val v by pulse.animateFloat(
                        initialValue = 0.35f, targetValue = 0.9f,
                        animationSpec = infiniteRepeatable(tween(800, easing = LinearEasing), RepeatMode.Reverse),
                        label = "feed-skeleton-alpha",
                    )
                    v
                }
                repeat(3) {
                    Box(
                        Modifier.fillMaxWidth().height(32.dp).alpha(a).clip(RoundedCornerShape(12.dp))
                            .background(com.wordocious.app.ui.friends.friendsWash(PURPLE, 0.14f)),
                    )
                }
            }
            list.isEmpty() -> Column(
                Modifier.fillMaxWidth().friendsCard(16.dp).padding(12.dp),
                horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                // An empty feed gets R asleep (ART_SPEC §7).
                SceneImage(SceneArt.ASLEEP, height = 110.dp)
                Text(
                    "Quiet week so far — a game, a sweep, a medal or a record from anyone in your circle shows up here.",
                    fontSize = 12.sp, fontWeight = FontWeight.Bold, color = pink.sub, fontFamily = Nunito,
                )
            }
            else -> Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                val shown = if (expanded) list else list.take(8)
                // A7: each pose at most once down the list.
                val poses = momentPoses(shown, userId)
                shown.forEachIndexed { i, e ->
                    MomentRow(
                        e, today, reactions[e.id] ?: FriendsService.Reactions(),
                        pose = poses[i],
                        onOpenProfile = onOpenProfile,
                        onToggle = { key -> toggle(e, key) },
                        onRematch = { if ("rematch" !in (reactions[e.id]?.mine ?: emptyList())) toggle(e, "rematch") else rematch(e) },
                    )
                }
                if (list.size > 8) {
                    CandyButton(
                        if (expanded) "Show less" else "Show all ${list.size}", onClick = { expanded = !expanded },
                        color = CandyColor.PEACH, size = CandySize.SMALL,
                        modifier = Modifier.align(Alignment.CenterHorizontally),
                    )
                }
            }
        }
    }
}

/** "You beat Doug at Tic-Tac-Tile (2–1)" / "Kate and you drew at Call It" (§6). */
internal fun gameMomentText(e: FriendsService.FeedEvent): String {
    val (head, score) = gameMomentParts(e)
    return head + when (score) { null -> ""; "by resignation" -> " by resignation"; else -> " ($score)" }
}

/** The game moment's headline and its score ("2–1", "by resignation" or null) apart, so the score reads as a soft number (K1). */
internal fun gameMomentParts(e: FriendsService.FeedEvent): Pair<String, String?> {
    val who = if (e.me) "You" else e.username
    val other = e.otherName ?: "a friend"
    val title = e.gameTitle ?: "a game"
    return if (e.kind == "draw") "$who and $other drew at $title" to null
    else "$who beat $other at $title" to e.score?.takeIf { it.isNotEmpty() }
}

/** K1 the event's color: a game's own color, else the moment's tint. */
private fun momentAccent(e: FriendsService.FeedEvent): Color {
    if (e.type == "game") return momentKind(e)?.color ?: PURPLE
    return when (e.type) {
        "flawless", "more_flawless" -> Color(0xFFF59E0B)
        "sweep" -> PURPLE
        "more_sweep" -> Color(0xFF4F46E5)
        "gift" -> Color(0xFF0D9488)
        "record" -> Color(0xFFD97706)
        else -> {
            val k = e.kind ?: ""
            when {
                k == "gold" -> Color(0xFFF59E0B)
                k == "silver" -> Color(0xFF94A3B8)
                k == "bronze" -> Color(0xFFD9844A)
                k.startsWith("streak_") -> Color(0xFFF97316)
                else -> PURPLE
            }
        }
    }
}

/**
 * K1 the cast pose that fits a moment (pure): a friend beating you → O2 gasping, your
 * win → W proud, a draw → U in lotus, someone else's win → O3 laughing, sweeps → S
 * sliding, flawless → O2 twirling, records → D's eureka, medals → C cheering, streaks →
 * S flexing, shield gifts → U with tea (drawn as the shield-guard art, T4). O1 (the banner
 * host) never appears here (A7).
 */
internal fun momentPose(e: FriendsService.FeedEvent, myId: String): Pair<MascotId, String> = when (e.type) {
    "game" -> when {
        e.kind == "draw" -> MascotId.U to "lotus"
        e.me -> MascotId.W to "proud"
        e.otherId == myId -> MascotId.O2 to "gasp"
        else -> MascotId.O3 to "laugh"
    }
    "flawless", "more_flawless" -> MascotId.O2 to "twirl"
    "sweep", "more_sweep" -> MascotId.S to "slide"
    "gift" -> MascotId.U to "tea"
    "record" -> MascotId.D to "eureka"
    else -> if ((e.kind ?: "").startsWith("streak_")) MascotId.S to "flex" else MascotId.C to "cheer"
}

/** A7: the poses down a list, each image at most once (a repeat gets none). */
internal fun momentPoses(events: List<FriendsService.FeedEvent>, myId: String): List<Pair<MascotId, String>?> {
    val used = HashSet<Pair<MascotId, String>>()
    return events.map { e -> momentPose(e, myId).takeIf { used.add(it) } }
}

@OptIn(androidx.compose.foundation.ExperimentalFoundationApi::class)
@Composable
private fun MomentRow(
    e: FriendsService.FeedEvent,
    today: String,
    rx: FriendsService.Reactions,
    pose: Pair<MascotId, String>?,
    onOpenProfile: (String) -> Unit,
    onToggle: (String) -> Unit,
    onRematch: () -> Unit,
) {
    val isGame = e.type == "game"
    val gameKind = if (isGame) momentKind(e) else null
    val line = if (isGame) null else describe(e)
    var bar by remember { mutableStateOf(false) }
    val haptic = androidx.compose.ui.platform.LocalHapticFeedback.current
    val pink = com.wordocious.app.ui.friends.FriendsPink
    val keys = REACTION_KEYS + if (isGame) listOf("rematch") else emptyList()
    val accent = momentAccent(e)
    val interaction = remember { androidx.compose.foundation.interaction.MutableInteractionSource() }
    Box {
        // Tap = profile (friends' rows); double-tap = toggle clap; hold = the reaction tray.
        Column(
            Modifier.fillMaxWidth()
                .pressSquish(interaction)
                .friendsCard(16.dp, accent = accent, bar = accent, barHeight = 5.dp)
                .combinedClickable(
                    interactionSource = interaction,
                    indication = null,
                    onClick = { if (!e.me) onOpenProfile(e.userId) },
                    onDoubleClick = {
                        haptic.performHapticFeedback(androidx.compose.ui.hapticfeedback.HapticFeedbackType.LongPress)
                        onToggle("clap")
                    },
                    onLongClick = {
                        haptic.performHapticFeedback(androidx.compose.ui.hapticfeedback.HapticFeedbackType.LongPress)
                        bar = true
                    },
                )
                .padding(start = 10.dp, end = 8.dp, top = 10.dp, bottom = 8.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            // BJ7: one top line — avatar, headline and the small pose top-aligned; the
            // day line 4 under the headline.
            Row(
                verticalAlignment = Alignment.Top,
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                modifier = Modifier.fillMaxWidth(),
            ) {
                FriendAvatar(
                    FriendsService.FriendProfile(
                        id = e.userId, username = e.username,
                        avatarUrl = e.avatarUrl, avatarEmoji = e.avatarEmoji,
                    ),
                )
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    if (isGame) {
                        val (head, score) = gameMomentParts(e)
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            Text(
                                head, fontSize = 12.sp, fontWeight = FontWeight.Black, color = INK, fontFamily = Nunito,
                                lineHeight = 15.sp, modifier = Modifier.weight(1f, fill = false),
                            )
                            when (score) {
                                null -> {}
                                "by resignation" -> Text("by resignation", fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, color = INK_MUTED, fontFamily = Nunito)
                                else -> Text(score, style = softNumberStyle(14.sp, FinishInk.softNumber), maxLines = 1)
                            }
                        }
                    } else {
                        Text(line!!.text, fontSize = 12.sp, fontWeight = FontWeight.Black, color = INK, fontFamily = Nunito, lineHeight = 15.sp)
                    }
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                        when {
                            gameKind != null -> com.wordocious.app.ui.friends.FriendlyGameIcon(gameKind, 18.dp)
                            line?.crown == true -> Icon3D(Icon3DName.CROWN, 18.dp)
                            line?.icon3d != null -> Icon3D(line.icon3d, 18.dp)
                            line?.icon != null -> Icon(line.icon, null, tint = line.tint, modifier = Modifier.size(14.dp))
                        }
                        Text(feedDayLabel(e.day, today), fontSize = 10.sp, fontWeight = FontWeight.Bold, color = INK_MUTED, fontFamily = Nunito)
                    }
                }
                // T4: a shield gift wears the shield-guard art small (once down the list, like the poses).
                if (pose != null) {
                    if (e.type == "gift") ShieldGuardArt(36.dp) else CastPose(pose.first, pose.second, 36.dp)
                }
            }
            // Reaction chips only when the moment has reactions (mine ringed), and the candy action.
            val counted = keys.filter { key -> (rx.counts[key] ?: 0) > 0 }
            val action: Pair<String, () -> Unit>? = when {
                isGame && gameKind != null -> "Rematch" to onRematch
                // AS5 (founder 10-02): no "View" button — tapping the row opens the profile.
                else -> null
            }
            if (counted.isNotEmpty() || action != null) {
                Row(
                    Modifier.fillMaxWidth().padding(start = 46.dp),
                    verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    counted.forEach { key ->
                        ReactionCountChip(key, rx.counts[key] ?: 0, mine = key in rx.mine, accent = accent, ink = INK) { onToggle(key) }
                    }
                    Spacer(Modifier.weight(1f))
                    if (action != null) {
                        CandyButton(
                            action.first, onClick = action.second,
                            color = if (action.first == "Rematch") CandyColor.PINK else CandyColor.PURPLE, size = CandySize.SMALL,
                            icon = if (action.first == "Rematch") CandyIcon.PLAY else CandyIcon.EYE,
                            contentDescription = if (action.first == "Rematch") "Rematch ${e.gameTitle ?: ""}" else "View ${e.username}'s profile",
                        )
                    }
                }
            }
        }
        // Hold: the floating reaction tray (AM1) above the card; tap outside to dismiss.
        if (bar) {
            val lift = with(androidx.compose.ui.platform.LocalDensity.current) { 52.dp.roundToPx() }
            androidx.compose.ui.window.Popup(
                alignment = Alignment.TopCenter,
                offset = androidx.compose.ui.unit.IntOffset(0, -lift),
                onDismissRequest = { bar = false },
                properties = androidx.compose.ui.window.PopupProperties(focusable = true),
            ) {
                ReactionTray(
                    keys = keys, counts = rx.counts, mine = rx.mine, accent = PINK, ink = pink.solid,
                    onPick = { key -> onToggle(key) }, onDone = { bar = false },
                )
            }
        }
    }
}

/** Fixed-light feed inks (the Friends tab). */
private val INK = Color(0xFF2A1650)
private val INK_MUTED = Color(0xFF6F5F8F)
private val PINK = Color(0xFFEC4899)
