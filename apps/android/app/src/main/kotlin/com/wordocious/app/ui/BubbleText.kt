package com.wordocious.app.ui

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.CompositingStrategy
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.wordocious.core.BUBBLE_MAX_SIZE
import com.wordocious.core.BUBBLE_MIN_SIZE
import com.wordocious.core.bubbleAtlasCovers
import com.wordocious.core.bubbleFit
import com.wordocious.core.bubbleGlyphName
import com.wordocious.core.bubbleWidthEm

// 2.8 item 6: the bubble-lettering renderer. ANY string is drawn from the glyph atlas
// (drawable `bubble_<name>`: A-Z 0-9 star ! ? , ' dot dash & — a neutral white base with shading)
// tinted per word; until the atlas ships (core BUBBLE_ATLAS_READY) every line is drawn by
// [LiveHeadline] (the live headline font) through THIS SAME API, so switching is a drop-in of
// assets plus one flag. The fit — scale UP to fill the slot, down to a min, then a balanced
// 2-3 line wrap, never "…" — is core's bubbleFit (parity-pinned with web + iOS).

/** One fitted line: the atlas when it covers the whole line, else the live font. */
@Composable
fun BubbleLine(
    text: String,
    palette: HeadlinePalette,
    sizeDp: Int,
    modifier: Modifier = Modifier,
    names: List<String> = emptyList(),
    sound: Boolean = true,
) {
    if (bubbleAtlasCovers(text)) {
        BubbleAtlasLine(text, palette, sizeDp, modifier)
    } else {
        val sizeSp = with(androidx.compose.ui.platform.LocalDensity.current) { sizeDp.dp.toSp() }
        // The fit is exact, so nothing shrinks; 0.6 is only a safety net, never an ellipsis.
        LiveHeadline(text, palette, modifier, names = names, maxSize = sizeSp, minSize = sizeSp * 0.6f, maxLines = 1, sound = sound)
    }
}

/** The atlas path: each glyph's drawable tinted by multiplying the word's gradient over the neutral base. */
@Composable
private fun BubbleAtlasLine(text: String, palette: HeadlinePalette, sizeDp: Int, modifier: Modifier) {
    val context = LocalContext.current
    Row(
        modifier.semantics { contentDescription = text; heading() },
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.Bottom,
    ) {
        for (ch in text.uppercase()) {
            val w = (bubbleWidthEm(ch.toString()) * sizeDp).dp
            val name = if (ch == ' ') null else bubbleGlyphName(ch.toString())
            val res = name?.let { context.resources.getIdentifier("bubble_$it", "drawable", context.packageName) } ?: 0
            if (res == 0) {
                Spacer(Modifier.width(w).height(sizeDp.dp))
            } else {
                Image(
                    painterResource(res), contentDescription = null, contentScale = ContentScale.Fit,
                    modifier = Modifier.width(w).height((sizeDp * 1.1f).dp)
                        .graphicsLayer { compositingStrategy = CompositingStrategy.Offscreen }
                        .drawWithContent {
                            drawContent()
                            // Modulate multiplies the tint into the glyph's colors AND alpha, so the
                            // transparent area stays transparent.
                            drawRect(Brush.verticalGradient(listOf(palette.top, palette.bottom)), blendMode = BlendMode.Modulate)
                        },
                )
            }
        }
    }
}

/** Any changing headline: measures its slot, fits it (core bubbleFit), draws each line centered. */
@Composable
fun BubbleText(
    text: String,
    palette: HeadlinePalette,
    modifier: Modifier = Modifier,
    names: List<String> = emptyList(),
    maxSize: Int = BUBBLE_MAX_SIZE,
    minSize: Int = BUBBLE_MIN_SIZE,
    sound: Boolean = true,
) {
    BoxWithConstraints(modifier.fillMaxWidth()) {
        val width = maxWidth.value.toDouble()
        val fit = remember(text, width, maxSize, minSize) { bubbleFit(text, width, maxSize, minSize) }
        Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
            fit.lines.forEachIndexed { i, line ->
                BubbleLine(line, palette, fit.size, Modifier.fillMaxWidth(), names = names, sound = sound && i == 0)
            }
        }
    }
}
