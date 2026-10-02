package com.wordocious.app.ui.game

import androidx.compose.foundation.layout.Box
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.EaseOut
import androidx.compose.animation.core.keyframes
import androidx.compose.animation.core.tween
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.core.TileState
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/** Spoken name for a tile's evaluation (TalkBack). */
fun tileStateName(state: TileState): String = when (state) {
    TileState.CORRECT -> "correct"
    TileState.PRESENT -> "wrong position"
    TileState.ABSENT -> "not in word"
    TileState.HINT_USED -> "revealed by hint"
    else -> ""
}

/** B3 a tile's one-shot celebration after its row lands: the win hop or the loss sink. */
enum class TileCelebration { HOP, SINK }

private val SPRING_SOFT = CubicBezierEasing(0.34f, 1.45f, 0.64f, 1f)
private val FLIP_EASE = CubicBezierEasing(0.37f, 0f, 0.63f, 1f)
private val HOP_EASE = CubicBezierEasing(0.3f, 1.5f, 0.5f, 1f)

/**
 * One board tile in the FINISH_SPEC game kit (B1): a rounded square with a thick
 * bottom lip, a gloss and white Nunito Black letters — right spot purple, wrong spot
 * gold, not in word slate grey; empty = frosted glass; typed = white face + purple
 * ring + dark purple letter. B3 motion: typing swells the tile in (300 ms soft
 * spring); [flipDelay] (ms) turns the tile over (720 ms, the color swapping at the
 * half — it shows the typed face until then) and lands it with a soft color glow
 * (900 ms); [isInvalid] = red letters, red ring and a red glow; [celebrate] plays the
 * win hop / loss sink after [celebrateDelay]; [hintGlow] pulses a gold glow twice.
 * Reduce Motion: the flip is a quick crossfade, everything else is off.
 *
 * Every size (corner 22%, lip 7%, ring, letter) derives from the measured tile, so a
 * 10 dp OctoWord tile and a 70 dp Classic tile share one look ([cornerRadius] and
 * [borderWidth] are accepted for call-site compatibility and no longer used).
 */
@Composable
fun TileView(
    letter: String,
    state: TileState,
    flipDelay: Int? = null,   // ms; null = no animation
    flipDuration: Int = TileMotion.FLIP_MS,
    isInvalid: Boolean = false,
    @Suppress("UNUSED_PARAMETER") cornerRadius: Dp? = null,
    @Suppress("UNUSED_PARAMETER") borderWidth: Dp? = null,
    /**
     * Explicit letter size as a DP COUNT, or null to derive it from the tile
     * (0.56 × the shorter side). Converted through density, NOT multiplied by the
     * user's fontScale: the tile box it must fit does not font-scale.
     */
    fontSize: Float? = null,
    // square=true forces a 1:1 tile (single-board). false = fill the cell
    // (multi-board in-play, the grid sizes the cells).
    square: Boolean = true,
    // Sequence locked-board mask: a frosted tile with a "•".
    masked: Boolean = false,
    // Mini (multi-board) tile — same colors (the colorblind swap included).
    @Suppress("UNUSED_PARAMETER") mini: Boolean = false,
    modifier: Modifier = Modifier,
    celebrate: TileCelebration? = null,
    celebrateDelay: Int = 0,
    hintGlow: Boolean = false,
    /** Not-a-word clear (B3): 0 = shown … 1 = shrunk away; drawn by the board's clear pass. */
    clearProgress: Float = 0f,
) {
    val reduced = WTheme.reducedMotion
    val hasLetter = letter.isNotBlank()
    val finalFace = TileLooks.faceFor(state, hasLetter, isInvalid, masked)

    // ── Reveal flip (B3): typed face → turn over → final face at the half → glow. ──
    val animateFlip = flipDelay != null
    var showFinal by remember(flipDelay) { mutableStateOf(!animateFlip) }
    val flip = remember(flipDelay) { Animatable(0f) }      // 0..1 over the whole turn
    val fade = remember(flipDelay) { Animatable(1f) }      // reduced-motion crossfade
    val bloom = remember(flipDelay) { Animatable(0f) }     // 0..1 glow intensity
    val feedbackView = androidx.compose.ui.platform.LocalView.current
    LaunchedEffect(flipDelay) {
        if (!animateFlip) return@LaunchedEffect
        delay(flipDelay!!.toLong())
        // Spec U: each tile of a reveal = flip · selection tick (simultaneous boards play once).
        com.wordocious.app.data.SoundManager.fire(com.wordocious.app.data.FeedbackEvent.FLIP, feedbackView)
        if (reduced) {
            fade.animateTo(0.4f, tween(TileMotion.REDUCED_FLIP_MS / 2))
            showFinal = true
            fade.animateTo(1f, tween(TileMotion.REDUCED_FLIP_MS / 2))
            return@LaunchedEffect
        }
        flip.animateTo(0.5f, tween(flipDuration / 2, easing = FLIP_EASE))
        showFinal = true
        flip.animateTo(1f, tween(flipDuration / 2, easing = FLIP_EASE))
        bloom.animateTo(1f, tween((TileMotion.BLOOM_MS * 0.35f).toInt(), easing = EaseOut))
        bloom.animateTo(0f, tween((TileMotion.BLOOM_MS * 0.65f).toInt(), easing = EaseOut))
    }

    // ── Type (B3): the letter fades in as the tile swells 1.07 and eases back. ──
    var lastLetter by remember { mutableStateOf(letter) }
    val pop = remember { Animatable(1f) }
    val popAlpha = remember { Animatable(1f) }
    LaunchedEffect(letter) {
        val typedNow = state == TileState.EMPTY && hasLetter && lastLetter.isBlank() && !masked
        lastLetter = letter
        if (typedNow && !reduced) {
            coroutineScope {
                launch {
                    pop.snapTo(0.9f)
                    pop.animateTo(1f, keyframes {
                        durationMillis = TileMotion.TYPE_MS
                        0.9f at 0 using SPRING_SOFT
                        1.07f at (TileMotion.TYPE_MS * 0.55f).toInt() using SPRING_SOFT
                        1f at TileMotion.TYPE_MS
                    })
                }
                launch {
                    popAlpha.snapTo(0.6f)
                    popAlpha.animateTo(1f, tween((TileMotion.TYPE_MS * 0.55f).toInt()))
                }
            }
        }
    }

    // ── Not a word (B3): the red glow (1 s). ──
    val bad = remember { Animatable(0f) }
    LaunchedEffect(isInvalid) {
        if (!isInvalid || reduced) { bad.snapTo(0f); return@LaunchedEffect }
        bad.snapTo(0f)
        bad.animateTo(1f, keyframes {
            durationMillis = TileMotion.BAD_MS
            0f at 0
            1f at 350
            0.6f at 700
            0f at TileMotion.BAD_MS
        })
    }

    // ── Hint (B3): flips in, then a gold glow pulses twice. ──
    val hint = remember { Animatable(0f) }
    LaunchedEffect(hintGlow) {
        if (!hintGlow || reduced) return@LaunchedEffect
        repeat(2) {
            hint.animateTo(1f, tween(TileMotion.HINT_PULSE_MS / 2))
            hint.animateTo(0f, tween(TileMotion.HINT_PULSE_MS / 2))
        }
    }

    // ── Win hop / loss sink (B3). ──
    val celY = remember(celebrate) { Animatable(0f) }   // fraction of the tile height
    val celSX = remember(celebrate) { Animatable(1f) }
    val celSY = remember(celebrate) { Animatable(1f) }
    val celRot = remember(celebrate) { Animatable(0f) }
    LaunchedEffect(celebrate) {
        if (celebrate == null) return@LaunchedEffect
        if (reduced) {
            // Spec U: the correct row still "lands" (light haptic) without the motion.
            if (celebrate == TileCelebration.HOP) {
                delay(celebrateDelay.toLong() + TileMotion.HOP_MS)
                com.wordocious.app.data.SoundManager.fire(com.wordocious.app.data.FeedbackEvent.ROW_LAND, feedbackView)
            }
            return@LaunchedEffect
        }
        if (celebrate == TileCelebration.HOP) launch {
            // Spec U: correct-row land = light haptic as the first tile comes down (once per row).
            delay(celebrateDelay.toLong() + TileMotion.HOP_MS)
            com.wordocious.app.data.SoundManager.fire(com.wordocious.app.data.FeedbackEvent.ROW_LAND, feedbackView)
        }
        delay(celebrateDelay.toLong())
        coroutineScope {
            when (celebrate) {
                TileCelebration.HOP -> {
                    val d = TileMotion.HOP_MS
                    launch {
                        celY.animateTo(0f, keyframes {
                            durationMillis = d
                            0f at 0 using HOP_EASE
                            -0.34f at (d * 0.35f).toInt() using HOP_EASE
                            0.04f at (d * 0.60f).toInt() using HOP_EASE
                        })
                    }
                    launch {
                        celSX.animateTo(1f, keyframes {
                            durationMillis = d
                            1f at 0; 1.06f at (d * 0.35f).toInt(); 0.97f at (d * 0.60f).toInt()
                        })
                    }
                    launch {
                        celSY.animateTo(1f, keyframes {
                            durationMillis = d
                            1f at 0; 0.96f at (d * 0.35f).toInt(); 1.04f at (d * 0.60f).toInt()
                        })
                    }
                }
                TileCelebration.SINK -> {
                    val d = TileMotion.SINK_MS
                    launch {
                        celRot.animateTo(0f, keyframes {
                            durationMillis = d
                            0f at 0 using EaseOut; -4f at (d * 0.4f).toInt() using EaseOut; 3f at (d * 0.7f).toInt() using EaseOut
                        })
                    }
                    launch {
                        celY.animateTo(0.02f, keyframes {
                            durationMillis = d
                            0f at 0 using EaseOut; 0f at (d * 0.4f).toInt() using EaseOut; 0.03f at (d * 0.7f).toInt() using EaseOut
                        })
                    }
                }
            }
        }
    }

    // AU4 (founder 10-02: "tile flips look choppy"): both faces are precomputed here and the
    // half-turn swap ([showFinal]) is read ONLY in the draw pass (the tile paint + the glyph's
    // ColorProducer), so a flip never recomposes — the turn itself is graphicsLayer rotationX
    // with a camera distance (GPU only, no layout change mid-flip).
    val colorblind = WTheme.colorblind
    val dark = WTheme.isDark
    val startFace = if (hasLetter) TileFace.TYPED else TileFace.EMPTY
    val startLook = remember(startFace, colorblind, dark) { TileLooks.of(startFace, colorblind, dark) }
    val endLook = remember(finalFace, colorblind, dark) { TileLooks.of(finalFace, colorblind, dark) }
    val glyphText = if (masked) "•" else letter.uppercase()
    val glyphFor: (Boolean) -> Color = { fin -> if (masked) Color(0xFF8A78AD) else (if (fin) endLook else startLook).glyph }
    // The shadow can't swap in the draw pass; the landed face's is used through the turn.
    val glyphShadow = endLook.glyphShadow

    TileBox(
        fontSize = fontSize,
        modifier = modifier
            .then(if (square) Modifier.aspectRatio(1f) else Modifier.fillMaxSize())
            .graphicsLayer {
                val f = flip.value
                // rotateX 0 → −90 (scale 1.05) → 0 across the turn.
                val half = if (f <= 0.5f) f * 2f else (1f - f) * 2f
                rotationX = -90f * half
                val turnScale = 1f + 0.05f * half
                scaleX = turnScale * pop.value * celSX.value
                scaleY = turnScale * pop.value * celSY.value
                translationY = celY.value * size.height
                rotationZ = celRot.value
                alpha = popAlpha.value * fade.value
                cameraDistance = 12f * density
                transformOrigin = TransformOrigin(0.5f, if (celebrate != null) 1f else 0.5f)
            }
            .drawBehind {
                val look = if (showFinal) endLook else startLook
                val glowAlpha: Float
                val glowColor: Color
                when {
                    bad.value > 0f -> { glowColor = TileLooks.BAD.glow; glowAlpha = bad.value }
                    hint.value > 0f -> { glowColor = Color(0xB3F5C542); glowAlpha = hint.value }
                    else -> { glowColor = look.glow; glowAlpha = bloom.value }
                }
                drawGameTile(look, glowColor, glowAlpha)
            }
            // TalkBack reads the letter plus its evaluation instead of a bare glyph.
            .then(if (hasLetter && !masked) Modifier.semantics {
                contentDescription = if (state != TileState.EMPTY) "$letter, ${tileStateName(state)}" else letter
            } else Modifier),
    ) { s ->
        if (glyphText.isNotEmpty()) {
            val clearScale = 1f - 0.6f * clearProgress
            TileGlyph(
                glyphText, glyphFor(true), glyphShadow,
                (fontSize ?: (s * 0.56f)), s,
                Modifier.graphicsLayer {
                    scaleX = clearScale; scaleY = clearScale
                    alpha = 1f - clearProgress
                },
                colorProducer = { glyphFor(showFinal) },
            )
        }
    }
}

/**
 * B3 not a word, the clear pass: after the red glow the rejected letters shrink away
 * right to left, [TileMotion.CLEAR_STAGGER_MS] apart. The game state clears the input
 * on its own clock; this keeps a ghost of the [rejected] letters on screen while they
 * go, so the row empties one tile at a time instead of all at once. Returns the
 * letters to draw on the input row (the ghost while clearing, else [current]) and each
 * column's clear progress.
 */
@Composable
fun rememberRejectClear(current: String, isInvalid: Boolean, columns: Int): Pair<String, (Int) -> Float> {
    var lastRejected by remember { mutableStateOf("") }
    var ghost by remember { mutableStateOf<String?>(null) }
    val progress = remember(columns) { List(columns) { Animatable(0f) } }
    if (isInvalid && current.length == columns) lastRejected = current
    LaunchedEffect(current) {
        val rejected = lastRejected
        if (current.isEmpty() && rejected.isNotEmpty() && !WTheme.reducedMotion) {
            ghost = rejected
            progress.forEach { it.snapTo(0f) }
            coroutineScope {
                for (i in columns - 1 downTo 0) {
                    val col = i
                    launch {
                        delay(((columns - 1 - col) * TileMotion.CLEAR_STAGGER_MS).toLong())
                        progress[col].animateTo(1f, tween(TileMotion.CLEAR_MS, easing = CubicBezierEasing(0.5f, 0f, 0.75f, 0f)))
                    }
                }
            }
            ghost = null
            lastRejected = ""
        } else if (current.isNotEmpty()) {
            ghost = null
            if (!isInvalid) lastRejected = ""
            progress.forEach { it.snapTo(0f) }
        } else {
            lastRejected = ""
        }
    }
    val g = ghost
    return if (g != null) g to { col: Int -> progress.getOrNull(col)?.value ?: 0f }
    else current to { _: Int -> 0f }
}

/**
 * AU4 the tile's box: with a known [fontSize] (the boards pass one) a plain Box — no
 * subcomposition per tile; otherwise BoxWithConstraints measures the tile for the glyph.
 * [content] gets the tile's side in dp.
 */
@Composable
private fun TileBox(fontSize: Float?, modifier: Modifier, content: @Composable (Float) -> Unit) {
    if (fontSize != null) {
        Box(modifier, contentAlignment = Alignment.Center) { content(fontSize / 0.56f) }
    } else {
        BoxWithConstraints(modifier, contentAlignment = Alignment.Center) { content(minOf(maxWidth, maxHeight).value) }
    }
}
