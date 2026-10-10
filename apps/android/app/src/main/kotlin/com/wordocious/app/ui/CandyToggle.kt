package com.wordocious.app.ui

import androidx.annotation.DrawableRes
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.snap
import androidx.compose.animation.core.spring
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.FilterQuality
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.res.imageResource
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.R
import com.wordocious.app.ui.theme.WTheme
import kotlin.math.roundToInt

/**
 * The candy toggles (night art 10-03 sprites; "Small menus with flair" proposals 1 + 3, founder
 * 10-03): `art_toggle_{light,dark}_{track,thumb_on,switch,switch_on,knob}`. Pills are THREE-SLICED
 * (the round end caps keep their shape, only the middle stretches; three drawImage calls in one
 * draw pass), so one sprite fits any width; only the thumb / knob moves (graphicsLayer / offset).
 * Mirrors web lib/candy-toggle.ts + iOS CandyToggleKit.swift.
 */
enum class CandySprite(@DrawableRes val light: Int, @DrawableRes val dark: Int) {
    TRACK(R.drawable.art_toggle_light_track, R.drawable.art_toggle_dark_track),
    THUMB_ON(R.drawable.art_toggle_light_thumb_on, R.drawable.art_toggle_dark_thumb_on),
    SWITCH_OFF(R.drawable.art_toggle_light_switch, R.drawable.art_toggle_dark_switch),
    SWITCH_ON(R.drawable.art_toggle_light_switch_on, R.drawable.art_toggle_dark_switch_on),
    KNOB(R.drawable.art_toggle_light_knob, R.drawable.art_toggle_dark_knob),
}

/** The groove inset of the track sprite: the thumb sits this far inside the track's rim. */
fun candyPad(height: Float): Float = maxOf(2f, Math.round(height * 0.12f).toFloat())

/** Label inks: white on the glossy purple thumb, deep purple (light) / lilac (dark) off it. */
object CandyInk {
    val ON = Color.White
    val off: Color get() = if (WTheme.isDark) Color(0xFFC4B5FD) else Color(0xFF6D28D9)
}

/** Draws [img] three-sliced across the whole box (caps = half the sprite's height). */
fun Modifier.candyPill(img: ImageBitmap): Modifier = drawBehind {
    val sw = img.width; val sh = img.height
    val cap = minOf(sh / 2, sw / 2)
    val end = minOf(size.height / 2f, size.width / 2f).roundToInt()
    val w = size.width.roundToInt(); val h = size.height.roundToInt()
    if (w <= 0 || h <= 0) return@drawBehind
    val q = FilterQuality.High
    drawImage(img, IntOffset(0, 0), IntSize(cap, sh), IntOffset(0, 0), IntSize(end, h), filterQuality = q)
    drawImage(img, IntOffset(cap, 0), IntSize(maxOf(1, sw - 2 * cap), sh), IntOffset(end, 0), IntSize(maxOf(0, w - 2 * end), h), filterQuality = q)
    drawImage(img, IntOffset(sw - cap, 0), IntSize(cap, sh), IntOffset(w - end, 0), IntSize(end, h), filterQuality = q)
}

@Composable
fun candyBitmap(sprite: CandySprite): ImageBitmap =
    ImageBitmap.imageResource(if (WTheme.isDark) sprite.dark else sprite.light)

/**
 * The candy segmented toggle (proposal 1/4): the glossy track with a glossy purple thumb that
 * slides (transform only) under the chosen option — white label on it, the deep purple ink off
 * it. Each option is a Tab with `selected` semantics.
 */
@Composable
fun <T> CandySegmentedToggle(
    options: List<Pair<T, String>>,
    selected: T,
    onChange: (T) -> Unit,
    modifier: Modifier = Modifier,
    height: Dp = 36.dp,
    width: Dp = 150.dp,
    fontSize: androidx.compose.ui.unit.TextUnit = 13.sp,
) {
    val n = options.size.coerceAtLeast(1)
    val index = options.indexOfFirst { it.first == selected }
    val pad = candyPad(height.value).dp
    val half = (width - pad * 2) / n
    val spec: androidx.compose.animation.core.AnimationSpec<Float> =
        if (WTheme.reducedMotion) snap() else spring(dampingRatio = 0.6f, stiffness = 520f)
    val pos by animateFloatAsState(index.coerceAtLeast(0).toFloat(), spec, label = "candyThumb")
    val track = candyBitmap(CandySprite.TRACK)
    val thumb = candyBitmap(CandySprite.THUMB_ON)
    Box(modifier.width(width).height(height).candyPill(track)) {
        if (index >= 0) {
            Box(
                Modifier.padding(pad).width(half).height(height - pad * 2)
                    .graphicsLayer { translationX = half.toPx() * pos }
                    .candyPill(thumb),
            )
        }
        Row(Modifier.padding(horizontal = pad)) {
            options.forEach { (key, label) ->
                val on = key == selected
                Box(
                    Modifier.squishClickable(label, role = Role.Tab) { if (!on) onChange(key) }
                        .semantics { this.selected = on }
                        .width(half).height(height),
                    contentAlignment = Alignment.Center,
                ) {
                    androidx.compose.material3.Text(
                        label, fontSize = fontSize, fontWeight = FontWeight.Black, maxLines = 1,
                        color = if (on) CandyInk.ON else CandyInk.off,
                    )
                }
            }
        }
    }
}

/**
 * The candy on/off switch (proposal 3): a short frosted-lilac track that turns glossy purple
 * (a crossfade) while a pearl knob springs across. Purely visual — the row around it owns the
 * `toggleable(role = Switch)` semantics and the hit area (as Material's Switch with a null
 * onCheckedChange did).
 */
@Composable
fun CandySwitch(checked: Boolean, modifier: Modifier = Modifier) {
    val w = 52.dp; val h = 30.dp; val knob = h - 4.dp
    val spec: androidx.compose.animation.core.AnimationSpec<Float> =
        if (WTheme.reducedMotion) snap() else spring(dampingRatio = 0.6f, stiffness = 520f)
    val pos by animateFloatAsState(if (checked) 1f else 0f, spec, label = "candyKnob")
    val off = candyBitmap(CandySprite.SWITCH_OFF)
    val on = candyBitmap(CandySprite.SWITCH_ON)
    Box(modifier.size(w, h)) {
        Box(Modifier.fillMaxSize().candyPill(off))
        Box(Modifier.fillMaxSize().graphicsLayer { alpha = pos }.candyPill(on))
        Image(
            painterResource(if (WTheme.isDark) CandySprite.KNOB.dark else CandySprite.KNOB.light), contentDescription = null,
            modifier = Modifier.offset(x = 2.dp, y = 2.dp).size(knob)
                .graphicsLayer { translationX = (w - knob - 4.dp).toPx() * pos },
        )
    }
}
