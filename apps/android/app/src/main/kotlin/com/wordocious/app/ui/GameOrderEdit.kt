package com.wordocious.app.ui

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Stable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.size
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.input.pointer.positionChange
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInRoot
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.platform.LocalViewConfiguration
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.data.GameOrderStore
import com.wordocious.app.ui.theme.Nunito
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.core.GameOrder
import com.wordocious.core.GameOrderSection
import kotlinx.coroutines.withTimeoutOrNull

/**
 * FRIDAY-QUEUE item 35 (Android): the designed edit mode for a Home game list. Long-press a tile (or tap
 * the pencil built into the section title) to enter it: tiles wiggle, the dragged tile lifts, the drop
 * target glows, the family Done / Reset bar appears. Classic (pinned) neither wiggles nor moves. Moves
 * persist when the finger lifts (GameOrderStore). iOS: GameOrderStore.swift; web: components/home/reorder.tsx.
 */
@Stable
class GameOrderEditState {
    /** The section being edited, null = normal Home. */
    var editing by mutableStateOf<GameOrderSection?>(null)
    var dragId by mutableStateOf<String?>(null)
    var targetId by mutableStateOf<String?>(null)
    /** Tile bounds in the root, from layout BEFORE any lift transform. */
    val bounds = mutableStateMapOf<String, Rect>()
    private var grab = Offset.Zero
    var pointer by mutableStateOf(Offset.Zero)

    fun start(id: String, localGrab: Offset) {
        val r = bounds[id] ?: return
        dragId = id; targetId = id
        grab = localGrab
        pointer = r.topLeft + localGrab
    }

    /** Where the lifted tile's top-left sits now. */
    fun liftedTopLeft(): Offset = pointer - grab

    fun dragBy(delta: Offset, section: GameOrderSection, ids: List<String>, tick: () -> Unit) {
        val id = dragId ?: return
        pointer += delta
        val over = bounds.entries.firstOrNull { (k, r) -> k != id && r.contains(pointer) }?.key
        targetId = over ?: id
        val pinned = GameOrder.pinned(section)
        if (over != null && over != pinned && over in ids) {
            val from = ids.indexOf(id)
            val to = ids.indexOf(over)
            if (from >= 0 && to >= 0 && from != to) {
                GameOrderStore.set(section, GameOrder.move(ids, from, to, pinned), persist = false)
                tick()
            }
        }
    }

    fun drop() {
        if (dragId != null) GameOrderStore.commit()
        dragId = null; targetId = null
    }

    fun done() { drop(); GameOrderStore.commit(); editing = null }
}

/** The Home tile modifier: long-press to enter edit mode; in edit mode wiggle + drag-to-reorder. */
fun Modifier.reorderTile(state: GameOrderEditState, id: String, section: GameOrderSection, ids: List<String>, indexHint: Int): Modifier = composed {
    val editing = state.editing == section
    val pinned = id == GameOrder.pinned(section)
    val haptic = LocalHapticFeedback.current
    val slop = LocalViewConfiguration.current.touchSlop
    val longPress = LocalViewConfiguration.current.longPressTimeoutMillis
    val currentIds by rememberUpdatedState(ids)
    val canEdit = GameOrderStore.canEdit
    val still = WTheme.reducedMotion
    val wiggle = rememberInfiniteTransition(label = "order-wiggle").animateFloat(
        initialValue = -1.4f, targetValue = 1.4f,
        animationSpec = infiniteRepeatable(tween(150 + (indexHint % 3) * 25, easing = LinearEasing), RepeatMode.Reverse),
        label = "wig",
    )
    val lifted = state.dragId == id
    val target = state.targetId == id && state.dragId != null && state.dragId != id
    this
        .onGloballyPositioned { state.bounds[id] = Rect(it.positionInRoot(), Size(it.size.width.toFloat(), it.size.height.toFloat())) }
        .graphicsLayer {
            if (lifted) {
                val b = state.bounds[id]
                val top = state.liftedTopLeft()
                translationX = if (b != null) top.x - b.left else 0f
                translationY = if (b != null) top.y - b.top else 0f
                scaleX = 1.06f; scaleY = 1.06f
                alpha = 0.92f
            } else if (editing && !pinned && !still) {
                rotationZ = wiggle.value
            }
        }
        .then(if (lifted) Modifier.shadow(14.dp, androidx.compose.foundation.shape.RoundedCornerShape(16.dp)) else Modifier)
        .then(
            if (target) Modifier.shadow(12.dp, androidx.compose.foundation.shape.RoundedCornerShape(16.dp), ambientColor = Color(0xFFA78BFA), spotColor = Color(0xFFA78BFA))
            else Modifier,
        )
        .pointerInput(editing, id, canEdit, pinned) {
            if (!canEdit) return@pointerInput
            awaitEachGesture {
                val down = awaitFirstDown(requireUnconsumed = false, pass = PointerEventPass.Initial)
                if (!editing) {
                    // Not editing: a still press held long enough enters edit mode; anything shorter is left to the tile's tap.
                    val timedOut = withTimeoutOrNull(longPress) {
                        while (true) {
                            val ev = awaitPointerEvent(PointerEventPass.Initial)
                            val c = ev.changes.firstOrNull { it.id == down.id } ?: return@withTimeoutOrNull true
                            if (!c.pressed || (c.position - down.position).getDistance() > slop) return@withTimeoutOrNull true
                        }
                    } == null
                    if (timedOut) {
                        haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                        state.editing = section
                        // Swallow the rest of this press so the tile does not also open its game.
                        while (true) {
                            val ev = awaitPointerEvent(PointerEventPass.Initial)
                            ev.changes.forEach { it.consume() }
                            if (ev.changes.none { it.pressed }) break
                        }
                    }
                } else {
                    // Editing: taps never open a game; a drag past the slop lifts the tile (not Classic).
                    down.consume()
                    var total = Offset.Zero
                    var started = false
                    while (true) {
                        val ev = awaitPointerEvent(PointerEventPass.Initial)
                        val c = ev.changes.firstOrNull { it.id == down.id } ?: break
                        c.consume()
                        if (!c.pressed) break
                        if (pinned) continue
                        val delta = c.positionChange()
                        total += delta
                        if (!started && total.getDistance() > slop) {
                            started = true
                            haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                            state.start(id, down.position)
                            state.dragBy(total, section, currentIds) { haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove) }
                        } else if (started) {
                            state.dragBy(delta, section, currentIds) { haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove) }
                        }
                    }
                    if (started) state.drop()
                }
            }
        }
}

/** The pencil glyph built into a Home section title (trailing edge); hidden while that list is being edited. */
@Composable
fun GameOrderPencil(state: GameOrderEditState, section: GameOrderSection, modifier: Modifier = Modifier) {
    if (!GameOrderStore.canEdit || state.editing == section) return
    // Founder 10-09 ("brown ... an eyesore"): a quiet frosted coin with the soft clay shuffle mark, not the season helper pill:
    // present, but it never competes with the section art. 30 dp coin, 44 dp hit area, 80% opacity.
    val dark = com.wordocious.app.ui.theme.WTheme.isDark
    val ink = if (dark) androidx.compose.ui.graphics.Color(0xFFC4B5FD) else androidx.compose.ui.graphics.Color(0xFF7C3AED)
    val fill = if (dark) androidx.compose.ui.graphics.Color.White.copy(alpha = 0.10f) else androidx.compose.ui.graphics.Color(0xFF7C3AED).copy(alpha = 0.08f)
    val hair = if (dark) androidx.compose.ui.graphics.Color.White.copy(alpha = 0.16f) else androidx.compose.ui.graphics.Color(0xFF7C3AED).copy(alpha = 0.14f)
    androidx.compose.foundation.layout.Box(
        modifier.size(44.dp).alpha(0.8f)
            .squishClickable(
                label = if (section == GameOrderSection.DAILIES) "Reorder Dailies" else "Reorder Puzzles",
                role = androidx.compose.ui.semantics.Role.Button,
            ) { state.editing = section },
        contentAlignment = Alignment.Center,
    ) {
        androidx.compose.foundation.layout.Box(
            Modifier.size(30.dp)
                .background(fill, androidx.compose.foundation.shape.CircleShape)
                .border(1.dp, hair, androidx.compose.foundation.shape.CircleShape),
            contentAlignment = Alignment.Center,
        ) { FamIconImage(FamIcon.REFRESH, ink, 15.dp) }   // circular arrows (shuffle is Muddle's icon)
    }
}

/** The family Done / Reset bar shown under a title while its list is being reordered. */
@Composable
fun GameOrderEditBar(state: GameOrderEditState, section: GameOrderSection) {
    if (state.editing != section) return
    val saved by GameOrderStore.prefs.collectAsState()
    val atDefault = GameOrder.isDefault(
        if (section == GameOrderSection.DAILIES) GameOrder.DEFAULT_DAILIES else GameOrder.DEFAULT_PUZZLES,
        saved?.let { if (section == GameOrderSection.DAILIES) it.dailies else it.puzzles },
        GameOrder.pinned(section),
    )
    Row(
        Modifier.fillMaxWidth().padding(vertical = 2.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            "DRAG TO REORDER", color = Color(0xFF7C3AED).copy(alpha = 0.85f),
            fontFamily = Nunito, fontWeight = FontWeight.Black, fontSize = 11.5.sp, letterSpacing = 0.5.sp,
        )
        QuietButton("Reset", onClick = { GameOrderStore.reset(section) }, size = CandySize.SMALL, icon = FamIcon.REFRESH, enabled = !atDefault)
        HelperButton("Done", onClick = { state.done() }, icon = FamIcon.CHECK, selected = true)
    }
}
