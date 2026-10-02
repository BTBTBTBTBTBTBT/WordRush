package com.wordocious.app.ui

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.keyframes
import androidx.compose.animation.core.tween
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.ui.theme.Nunito
import com.wordocious.app.ui.theme.WTheme
import kotlinx.coroutines.delay

// FINISH_SPEC M (founder 10-02): the Friends tab notification badge — a glossy candy
// count (hot pink → coral, a 1.5 gold outline, a white top gloss, a darker lip, white
// Nunito Black "1"–"9", then "9+") on the Friends tab icon whenever something waits on
// the player: incoming friend requests, game invites / challenges awaiting them, and
// friendly games where it's their turn. It springs in (0 → 1.15 → 1) when a new item
// arrives and the tab icon wiggles (±8°, two swings); then a slow soft glow pulse every
// ~4 s while unseen (none with Reduce Motion). Opening Friends marks everything seen —
// the badge returns only for new items. The tab reads "Friends, N new".

/** M the pure badge rules (unit-tested). */
object FriendsBadge {
    /** The keys of everything waiting on the player right now. */
    fun waitingKeys(
        requestIds: List<String>,
        inviteIds: List<String>,
        challengeCodes: List<String>,
        yourTurnGames: List<Pair<String, String>>,
    ): Set<String> = buildSet {
        requestIds.forEach { add("req:$it") }
        inviteIds.forEach { add("inv:$it") }
        challengeCodes.forEach { add("ch:$it") }
        // A game counts again after each new move (its updatedAt changes).
        yourTurnGames.forEach { (id, updated) -> add("game:$id:$updated") }
    }

    /** How many waiting items the player hasn't seen yet. */
    fun unseen(waiting: Set<String>, seen: Set<String>): Int = waiting.count { it !in seen }

    /** "1"…"9", then "9+". */
    fun label(n: Int): String = if (n > 9) "9+" else "$n"

    /** The tab's spoken label: "Friends" or "Friends, 3 new". */
    fun tabLabel(n: Int): String = if (n > 0) "Friends, $n new" else "Friends"

    private const val SEEN_KEY = "friends-badge-seen"

    /** The seen set (persisted; pruned to what is still waiting when marked). */
    fun loadSeen(): Set<String> =
        com.wordocious.app.data.SettingsPref.get(SEEN_KEY, "").split('\n').filter { it.isNotBlank() }.toSet()

    /** Opening Friends: everything waiting now is seen. */
    fun markSeen(waiting: Set<String>) {
        com.wordocious.app.data.SettingsPref.set(SEEN_KEY, waiting.joinToString("\n"))
    }
}

private val BADGE_TOP = Color(0xFFFF5FA2)
private val BADGE_BOTTOM = Color(0xFFF0435F)
private val BADGE_GOLD = Color(0xFFF5C542)
private val BADGE_LIP = Color(0xFFB42344)

/**
 * M the candy count badge: min 18 dp round, a pill for "9+". [arrivals] bumps when a
 * new item arrives (spring in); [pulsing] = unseen (the slow soft glow pulse).
 */
@Composable
fun FriendsCountBadge(count: Int, arrivals: Int, pulsing: Boolean, modifier: Modifier = Modifier, height: Dp = 18.dp) {
    val still = WTheme.reducedMotion
    val pop = remember { Animatable(if (still) 1f else 0f) }
    val glow = remember { Animatable(0f) }
    val feedbackView = androidx.compose.ui.platform.LocalView.current
    LaunchedEffect(arrivals) {
        // Spec U: a new Friends item = notify · light (once per arrival, not on re-entry).
        if (arrivals > 0 && arrivals != BadgeNotify.lastArrival) {
            BadgeNotify.lastArrival = arrivals
            com.wordocious.app.data.SoundManager.fire(com.wordocious.app.data.FeedbackEvent.NOTIFY, feedbackView)
        }
        if (still) { pop.snapTo(1f); return@LaunchedEffect }
        pop.snapTo(0f)
        pop.animateTo(1f, keyframes { durationMillis = 420; 1.15f at 260 })
    }
    LaunchedEffect(pulsing, still) {
        if (!pulsing || still) { glow.snapTo(0f); return@LaunchedEffect }
        while (true) {
            delay(4000)
            glow.animateTo(1f, tween(600))
            glow.animateTo(0f, tween(900))
        }
    }
    val label = FriendsBadge.label(count)
    Box(
        modifier
            .graphicsLayer { scaleX = pop.value; scaleY = pop.value }
            .clearAndSetSemantics { }
            .height(height + 2.dp)
            .widthIn(min = height)
            .drawBehind {
                val h = height.toPx()
                val r = CornerRadius(h / 2f)
                val lip = 2.dp.toPx()
                val g = glow.value
                if (g > 0.01f) {
                    for (k in 3 downTo 1) {
                        val grow = 3.dp.toPx() * k
                        drawRoundRect(
                            BADGE_BOTTOM.copy(alpha = 0.22f * g / k), topLeft = Offset(-grow, -grow),
                            size = Size(size.width + grow * 2, h + grow * 2), cornerRadius = CornerRadius(h / 2f + grow),
                        )
                    }
                }
                // The darker lip, then the gradient face, the gloss and the gold outline.
                drawRoundRect(BADGE_LIP, topLeft = Offset(0f, lip), size = Size(size.width, h), cornerRadius = r)
                drawRoundRect(Brush.verticalGradient(listOf(BADGE_TOP, BADGE_BOTTOM), endY = h), size = Size(size.width, h), cornerRadius = r)
                drawRoundRect(
                    Brush.verticalGradient(listOf(Color.White.copy(alpha = 0.5f), Color.White.copy(alpha = 0f)), endY = h * 0.5f),
                    topLeft = Offset(size.width * 0.18f, h * 0.08f), size = Size(size.width * 0.64f, h * 0.4f),
                    cornerRadius = CornerRadius(h * 0.2f),
                )
                val sw = 1.5.dp.toPx()
                drawRoundRect(
                    BADGE_GOLD, topLeft = Offset(sw / 2, sw / 2), size = Size(size.width - sw, h - sw),
                    cornerRadius = CornerRadius((h - sw) / 2f), style = Stroke(sw),
                )
            }
            .padding(horizontal = if (label.length > 1) 5.dp else 0.dp),
        contentAlignment = Alignment.TopCenter,
    ) {
        Box(Modifier.height(height).widthIn(min = height), contentAlignment = Alignment.Center) {
            Text(
                label, fontSize = (height.value * 0.6f).sp, lineHeight = (height.value * 0.6f).sp,
                fontWeight = FontWeight.Black, fontFamily = Nunito, color = Color.White, maxLines = 1,
                style = androidx.compose.ui.text.TextStyle(
                    shadow = androidx.compose.ui.graphics.Shadow(Color(0x66820A2E), Offset(0f, 1f), 1.5f),
                ),
            )
        }
    }
}

/** M the Friends tab icon's happy wiggle (±8°, two swings) when a new item arrives. */
@Composable
fun Modifier.friendsWiggle(arrivals: Int): Modifier {
    val still = WTheme.reducedMotion
    val rot = remember { Animatable(0f) }
    LaunchedEffect(arrivals) {
        if (still || arrivals == 0) return@LaunchedEffect
        rot.animateTo(0f, keyframes {
            durationMillis = 640
            8f at 110; -8f at 270; 6f at 420; -4f at 540
        })
    }
    return this.graphicsLayer { rotationZ = rot.value }
}

/** Corner shape helper for the row badges inside Friends. */
val FRIENDS_BADGE_SHAPE = RoundedCornerShape(50)

/** Spec U: the last badge arrival that already sounded (the badge can leave and re-enter composition). */
private object BadgeNotify { var lastArrival = 0 }
