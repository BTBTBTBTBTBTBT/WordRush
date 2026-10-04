package com.wordocious.app.ui

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.ui.theme.WTheme

/**
 * FINISH_SPEC BI24: the one finished empty / error / not-found state. No generic
 * system icon, no bare spinner, no plain-text line, no bordered box: a cast host
 * (its ART_SPEC §7 [scene] when one fits, else the [host] mascot), the [title] in
 * the brand gradient caps, ONE short [line] in the app's voice, and a candy
 * [action] when one makes sense. [preview] draws a dimmed glimpse of what will
 * appear (opacity only). Enters with a fade + rise (transform / opacity only).
 */
@Composable
fun BrandEmptyState(
    title: String,
    line: String,
    modifier: Modifier = Modifier,
    scene: SceneArt? = null,
    host: MascotId = MascotId.W,
    artHeight: Dp = 120.dp,
    accent: List<Color> = PageAccent.brand,
    lineColor: Color = WTheme.textSecondary,
    actionLabel: String? = null,
    actionColor: CandyColor = CandyColor.PURPLE,
    actionIcon: CandyIcon? = null,
    onAction: (() -> Unit)? = null,
    secondary: (@Composable () -> Unit)? = null,
    preview: (@Composable () -> Unit)? = null,
    /** FINISH_SPEC BJ16: the title as heading lettering (NOT FOUND, OOPS!, …); [title] stays its label. */
    heading: Heading? = null,
) {
    val still = WTheme.reducedMotion
    val enter = remember { Animatable(if (still) 1f else 0f) }
    LaunchedEffect(Unit) { if (!still) enter.animateTo(1f, tween(320)) }
    Column(
        modifier
            .fillMaxWidth()
            .padding(horizontal = 24.dp, vertical = 16.dp)
            .graphicsLayer { alpha = enter.value; translationY = (1f - enter.value) * 12.dp.toPx() },
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        if (scene != null) SceneImage(scene, height = artHeight)
        else Mascot(host, artHeight * 0.8f, motion = MascotMotion.BOB)
        Spacer(Modifier.height(2.dp))
        if (heading != null) HeadingArt(heading, height = 40.dp, contentDescription = title)
        else PageTitleText(title, accent = accent, fontSize = 20.sp, maxLines = 2)
        Text(
            line, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = lineColor,
            textAlign = TextAlign.Center, modifier = Modifier.widthIn(max = 320.dp),
        )
        if (actionLabel != null && onAction != null) {
            Spacer(Modifier.height(4.dp))
            CandyButton(actionLabel, onAction, color = actionColor, size = CandySize.MEDIUM, icon = actionIcon)
        }
        secondary?.invoke()
        if (preview != null) {
            Spacer(Modifier.height(6.dp))
            Box(Modifier.fillMaxWidth().graphicsLayer { alpha = 0.38f }) { preview() }
        }
    }
}
