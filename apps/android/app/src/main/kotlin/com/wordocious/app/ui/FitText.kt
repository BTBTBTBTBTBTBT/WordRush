package com.wordocious.app.ui

import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.TextUnit

/**
 * One line, never wrapped, never clipped: the text lays out at [fontSize] and,
 * while it overflows its bounds, steps down (to [minScale] of the size) before it
 * is drawn. Compose's Text has no minimumScaleFactor; this is that. Doug's
 * Android (2026-09-26, a larger system font scale) broke "Crosswordocious" as
 * "Crosswordociou / s" on the More Games card and "PRESENCE" as "PRESENC / E" on
 * a Kindred tile — a fixed size table cannot know the width or the font scale.
 */
@Composable
fun FitText(
    text: String,
    fontSize: TextUnit,
    modifier: Modifier = Modifier,
    color: Color = Color.Unspecified,
    fontWeight: FontWeight? = null,
    fontFamily: FontFamily? = null,
    textAlign: TextAlign? = null,
    minScale: Float = 0.6f,
    letterSpacing: TextUnit = TextUnit.Unspecified,
    /**
     * Founder 10-10 (readability): a multi-word text still wider than its slot at [minScale] wraps onto a second line at that
     * size instead of being cut (a 1.3x font scale on a narrow phone clipped "Guess the name" / "Letter Ladder").
     */
    wrapAtMin: Boolean = false,
) {
    var scale by remember(text) { mutableFloatStateOf(1f) }
    var fitted by remember(text) { mutableStateOf(false) }
    var wrap by remember(text) { mutableStateOf(false) }
    Text(
        text, fontSize = fontSize * scale, color = color, fontWeight = fontWeight, fontFamily = fontFamily, textAlign = textAlign, letterSpacing = letterSpacing,
        maxLines = if (wrap) 2 else 1, softWrap = wrap, overflow = TextOverflow.Clip,
        modifier = modifier.drawWithContent { if (fitted) drawContent() },
        onTextLayout = { r ->
            if (wrap) fitted = true
            else if (r.hasVisualOverflow && scale > minScale) scale -= 0.05f
            else if (r.hasVisualOverflow && wrapAtMin && text.contains(' ')) wrap = true
            else fitted = true
        },
    )
}
