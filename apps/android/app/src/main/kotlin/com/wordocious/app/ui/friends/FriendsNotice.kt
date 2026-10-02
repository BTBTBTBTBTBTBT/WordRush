package com.wordocious.app.ui.friends

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.annotation.DrawableRes
import com.wordocious.app.R
import com.wordocious.app.ui.CastPose
import com.wordocious.app.ui.MascotId
import com.wordocious.app.ui.squishClickable
import com.wordocious.app.ui.theme.WTheme
import kotlinx.coroutines.launch
import kotlin.math.abs

// FINISH_SPEC K1 (founder 10-02: "the notifications (x beat you)"): the Friends tab's
// in-app notice — the note that confirms a challenge, a nudge, a request or a shield
// gift — as a tinted card in the event's color with its top bar, a small cast pose that
// fits the event, the line in Nunito Black; it slides in with a spring (Reduce Motion:
// a plain fade), squishes on tap (tap = dismiss) and swipes away sideways.

/**
 * The note's marker for a shield gift: the notice swaps it for the shield-guard art (T4).
 * An invisible tag (never shown — always stripped), not an emoji (AL addendum 2).
 */
const val FRIENDS_SHIELD_NOTE = "\u2063shield\u2063"

/**
 * K1 a note's event (pure): its color and the cast pose that fits it (A7: never O1, the
 * banner's host), or a small scene in its place ([scene], e.g. T4's shield-guard art on
 * a shield gift).
 */
internal data class NoticeStyle(val accent: Color, val pose: Pair<MascotId, String>?, @DrawableRes val scene: Int? = null)

internal fun noticeStyle(note: String): NoticeStyle = when {
    // T4: a shield gift wears the shield-guard art (U guarding the flame), small.
    note.startsWith(FRIENDS_SHIELD_NOTE) -> NoticeStyle(Color(0xFF0D9488), null, R.drawable.art_scene_shield_guard)
    note.startsWith("Challenge sent") -> NoticeStyle(Color(0xFF7C3AED), MascotId.S to "ready")
    note.startsWith("Nudged") || note.startsWith("Everyone already nudged") -> NoticeStyle(Color(0xFFF59E0B), MascotId.R to "wake")
    note.startsWith("You're now friends") || note.startsWith("Request sent") -> NoticeStyle(Color(0xFFEC4899), MascotId.W to "cheer")
    else -> NoticeStyle(Color(0xFFEC4899), null)
}

/**
 * K1 the Friends notice for [note] (null = hidden). [onDismiss] clears it — on a tap,
 * on a sideways swipe, or by the caller's timer.
 */
@Composable
fun FriendsNotice(note: String?, onDismiss: () -> Unit, modifier: Modifier = Modifier) {
    // Hold the last text so the card can animate out after the note clears.
    val last = remember { arrayOfNulls<String>(1) }
    if (note != null) last[0] = note
    val still = WTheme.reducedMotion
    AnimatedVisibility(
        visible = note != null,
        modifier = modifier,
        enter = if (still) fadeIn(tween(120))
        else slideInVertically(spring(dampingRatio = Spring.DampingRatioMediumBouncy, stiffness = Spring.StiffnessMediumLow)) { -it } + fadeIn(),
        exit = if (still) fadeOut(tween(120)) else slideOutVertically(tween(200)) { -it } + fadeOut(tween(200)),
    ) {
        val text = last[0] ?: return@AnimatedVisibility
        val style = noticeStyle(text)
        val drag = remember { Animatable(0f) }
        val scope = rememberCoroutineScope()
        Row(
            Modifier.fillMaxWidth()
                .graphicsLayer { translationX = drag.value; alpha = 1f - (abs(drag.value) / 600f).coerceIn(0f, 0.6f) }
                .pointerInput(text) {
                    detectHorizontalDragGestures(
                        onDragEnd = {
                            scope.launch {
                                if (abs(drag.value) > 120.dp.toPx()) onDismiss()
                                else if (still) drag.snapTo(0f) else drag.animateTo(0f, spring(dampingRatio = 0.6f))
                            }
                        },
                        onDragCancel = { scope.launch { drag.snapTo(0f) } },
                    ) { _, dx -> scope.launch { drag.snapTo(drag.value + dx) } }
                }
                .squishClickable(label = "${text.removePrefix(FRIENDS_SHIELD_NOTE)}. Dismiss") { onDismiss() }
                .friendsCard(16.dp, accent = style.accent, bar = style.accent, barHeight = 5.dp)
                .padding(start = 12.dp, end = 8.dp, top = 9.dp, bottom = 4.dp)
                .semantics { liveRegion = LiveRegionMode.Polite },
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text(
                text.removePrefix(FRIENDS_SHIELD_NOTE), fontSize = 13.sp, fontWeight = FontWeight.Black,
                color = FriendsPink.heading, modifier = Modifier.weight(1f).padding(vertical = 6.dp),
            )
            style.pose?.let { (id, pose) -> CastPose(id, pose, 36.dp) }
            if (style.pose == null) style.scene?.let { scene ->
                androidx.compose.foundation.Image(
                    androidx.compose.ui.res.painterResource(scene), contentDescription = null,
                    modifier = Modifier.height(36.dp).widthIn(max = 44.dp).clearAndSetSemantics { },
                )
            }
        }
    }
}
