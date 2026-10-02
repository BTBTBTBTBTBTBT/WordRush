package com.wordocious.app.ui

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.data.SoundManager
import com.wordocious.app.ui.friends.friendsLine
import com.wordocious.app.ui.friends.friendsWash
import com.wordocious.app.ui.theme.Nunito
import com.wordocious.app.ui.theme.WTheme
import kotlinx.coroutines.launch
import kotlin.math.cos
import kotlin.math.sin

// FINISH_SPEC AM1: reactions keep their stored KEYS (clap, fire, wow, grr, rematch,
// heart — /api/friends/react) but are never drawn as emoji. Each renders as our art
// `art_react_<key>` once it ships (looked up by name; res/raw/keep_react.xml keeps the
// files through resource shrinking), until then fire → the 3D flame and the others →
// their word ("Clap!", "Wow!", "Grr!", "Rematch", "Love!") in a tinted pill.

/** AM1 the words for each reaction key (the art's fallback and TalkBack's name). */
object ReactionArt {
    /** The pill word shown while a reaction has no art. */
    fun word(key: String): String = when (key) {
        "clap" -> "Clap!"
        "fire" -> "Fire!"
        "wow" -> "Wow!"
        "grr" -> "Grr!"
        "rematch" -> "Rematch"
        "heart" -> "Love!"
        else -> key.replaceFirstChar { it.uppercase() }
    }

    /** What TalkBack says for the reaction. */
    fun spoken(key: String): String = word(key).removeSuffix("!")
}

/** The `art_react_<key>` drawable, or 0 while that art hasn't shipped. */
@Composable
fun reactionArtRes(key: String): Int {
    val ctx = LocalContext.current
    return remember(key) {
        @Suppress("DiscouragedApi")
        ctx.resources.getIdentifier("art_react_$key", "drawable", ctx.packageName)
    }
}

/** One reaction drawn our way (never the emoji): its art, the 3D flame, or its word. Decorative. */
@Composable
fun ReactionGlyph(key: String, size: Dp, ink: Color, fontSize: TextUnit = 12.sp) {
    val res = reactionArtRes(key)
    when {
        res != 0 -> Image(painterResource(res), null, Modifier.size(size))
        key == "fire" -> Icon3D(Icon3DName.FLAME, size)
        else -> Text(
            ReactionArt.word(key), fontSize = fontSize, fontWeight = FontWeight.Black,
            fontFamily = Nunito, color = ink, maxLines = 1,
        )
    }
}

/** AM1 a reaction chip inside a moment: the reaction + its soft-number count, tinted, squishy (mine ringed). */
@Composable
fun ReactionCountChip(key: String, count: Int, mine: Boolean, accent: Color, ink: Color, onClick: () -> Unit) {
    val shape = RoundedCornerShape(50)
    Row(
        Modifier
            .squishClickable(label = "${ReactionArt.spoken(key)}, $count${if (mine) ", yours" else ""}", onClick = onClick)
            .clip(shape).background(friendsWash(accent, if (mine) 0.26f else 0.14f))
            .border(if (mine) 2.dp else 1.5.dp, if (mine) accent else friendsLine(accent), shape)
            .padding(horizontal = 8.dp, vertical = 2.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        ReactionGlyph(key, 16.dp, ink, 11.sp)
        Text("$count", style = softNumberStyle(12.sp, FinishInk.softNumber), maxLines = 1)
    }
}

/**
 * AM1 the reaction tray: a tinted candy tray, each reaction a squishy button with its
 * count in soft numbers. Picking one pops it, plays the press sound with a light haptic
 * and throws a small burst; [onPick] fires at once (the count updates in place) and
 * [onDone] after the pop (or at once with Reduce Motion) so the caller can close the tray.
 */
@Composable
fun ReactionTray(
    keys: List<String>,
    counts: Map<String, Int>,
    mine: Collection<String>,
    accent: Color,
    ink: Color,
    onPick: (String) -> Unit,
    onDone: () -> Unit,
) {
    val scope = rememberCoroutineScope()
    val haptic = LocalHapticFeedback.current
    val still = WTheme.reducedMotion || WTheme.calmMotion
    var picked by remember { mutableStateOf<String?>(null) }
    val pop = remember { Animatable(1f) }
    val burst = remember { Animatable(0f) }
    val shape = RoundedCornerShape(50)
    Row(
        Modifier
            .shadow(8.dp, shape, ambientColor = Color(0x334C1D95), spotColor = Color(0x334C1D95))
            .clip(shape).background(friendsWash(accent, 0.16f))
            .border(1.5.dp, friendsLine(accent), shape)
            .padding(horizontal = 6.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        keys.forEach { key ->
            val isMine = key in mine
            val n = counts[key] ?: 0
            val btn = RoundedCornerShape(50)
            Box(contentAlignment = Alignment.Center) {
                if (picked == key && !still) {
                    Canvas(Modifier.matchParentSize()) {
                        val t = burst.value
                        if (t in 0.001f..0.999f) {
                            val r0 = size.minDimension * 0.35f
                            val reach = r0 + size.minDimension * 0.55f * t
                            val c = Offset(size.width / 2f, size.height / 2f)
                            val colors = listOf(accent, Color(0xFFF59E0B), Color(0xFF7C3AED))
                            for (i in 0 until 8) {
                                val a = (i / 8f) * 2f * Math.PI.toFloat()
                                drawCircle(
                                    colors[i % colors.size].copy(alpha = 1f - t),
                                    radius = 3.dp.toPx() * (1f - t * 0.5f),
                                    center = Offset(c.x + cos(a) * reach, c.y + sin(a) * reach),
                                )
                            }
                        }
                    }
                }
                Row(
                    Modifier
                        .scale(if (picked == key) pop.value else 1f)
                        .squishClickable(label = "React ${ReactionArt.spoken(key)}", role = Role.Button) {
                            if (picked != null) return@squishClickable
                            picked = key
                            SoundManager.playPress()
                            haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                            onPick(key)
                            if (still) { onDone(); return@squishClickable }
                            scope.launch {
                                launch { burst.snapTo(0f); burst.animateTo(1f, tween(420, easing = FastOutSlowInEasing)) }
                                pop.animateTo(1.35f, tween(110))
                                pop.animateTo(1f, spring(dampingRatio = Spring.DampingRatioMediumBouncy, stiffness = Spring.StiffnessMedium))
                                onDone()
                            }
                        }
                        .clip(btn)
                        .then(if (isMine) Modifier.background(friendsWash(accent, 0.30f)).border(1.5.dp, accent, btn) else Modifier)
                        .padding(horizontal = 7.dp, vertical = 3.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(3.dp),
                ) {
                    ReactionGlyph(key, 26.dp, ink, 13.sp)
                    if (n > 0) Text("$n", style = softNumberStyle(12.sp, FinishInk.softNumber), maxLines = 1)
                }
            }
        }
    }
}
