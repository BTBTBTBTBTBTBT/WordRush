package com.wordocious.app.ui

import androidx.compose.foundation.border

import androidx.compose.ui.draw.drawWithContent

import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/**
 * The shared 3D button, now in the FINISH_SPEC A8 glossy candy finish: a pill (the
 * caller's [shape] is kept only for its corner on non-pill callers), the caller's
 * [face] gradient, a thin gold outline just inside the edge, the darker [shadow] lip
 * the face sinks into on press, a white gloss across the top half, and the A9 squish.
 * New code uses [CandyButton]; this keeps the older call sites in the same family.
 */
@Composable
fun Button3D(
    onClick: () -> Unit,
    face: Brush,
    shadow: Color,
    modifier: Modifier = Modifier,
    height: Dp = 48.dp,
    depth: Dp = 4.dp,
    @Suppress("UNUSED_PARAMETER") shape: Shape = RoundedCornerShape(14.dp),
    enabled: Boolean = true,
    content: @Composable RowScope.() -> Unit,
) {
    val interaction = remember { MutableInteractionSource() }
    val pressed by interaction.collectIsPressedAsState()
    val y by animateDpAsState(if (pressed && !com.wordocious.app.ui.theme.WTheme.reducedMotion) depth * 0.6f else 0.dp, tween(80), label = "btn3d")
    val pill = RoundedCornerShape(50)

    Box(modifier.height(height + depth).pressSquish(interaction)) {
        // Lip layer (the dark bottom edge) with a soft drop shadow.
        Box(
            Modifier.fillMaxWidth().height(height).offset(y = depth)
                .shadow(6.dp, pill, clip = false, ambientColor = shadow.copy(alpha = 0.3f), spotColor = shadow.copy(alpha = 0.45f))
                .clip(pill).background(shadow),
        )
        // Face (sinks into the lip when pressed), gloss on the top half, gold outline.
        Row(
            Modifier.fillMaxWidth().height(height).offset(y = y)
                .clip(pill).background(face)
                .drawWithContent {
                    val inset = size.height * 0.12f
                    drawRoundRect(
                        Brush.verticalGradient(
                            listOf(Color.White.copy(alpha = 0.45f), Color.White.copy(alpha = 0f)),
                            startY = inset * 0.6f, endY = size.height * 0.52f,
                        ),
                        topLeft = androidx.compose.ui.geometry.Offset(inset * 1.4f, inset * 0.6f),
                        size = androidx.compose.ui.geometry.Size(size.width - inset * 2.8f, size.height * 0.46f),
                        cornerRadius = androidx.compose.ui.geometry.CornerRadius(size.height * 0.25f),
                    )
                    drawContent()
                }
                .border(1.5.dp, Color(0xFFF5C542), pill)
                .clickable(
                    interactionSource = interaction,
                    indication = null,
                    enabled = enabled,
                    onClick = onClick,
                ),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically,
            content = content,
        )
    }
}

/** Convenience for a solid-color 3D button. */
@Composable
fun Button3D(
    onClick: () -> Unit,
    color: Color,
    shadow: Color,
    modifier: Modifier = Modifier,
    height: Dp = 48.dp,
    shape: Shape = RoundedCornerShape(14.dp),
    enabled: Boolean = true,
    content: @Composable RowScope.() -> Unit,
) = Button3D(
    onClick = onClick,
    face = androidx.compose.ui.graphics.SolidColor(color),
    shadow = shadow,
    modifier = modifier,
    height = height,
    shape = shape,
    enabled = enabled,
    content = content,
)

/**
 * Subtle card drop-shadow matching the web mode/surface cards. On a tinted page
 * (ART_SPEC §11) the shadow leans toward the page's accent instead.
 */
fun Modifier.cardShadow(corner: Dp = 14.dp): Modifier =
    this.pageCardShadow(corner) {
        shadow(
            elevation = 2.dp,
            shape = RoundedCornerShape(corner),
            clip = false,
            ambientColor = Color(0x18000000),
            spotColor = Color(0x18000000),
        )
    }
