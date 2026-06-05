package com.wordocious.app.ui

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
 * `btn-3d` button — matches the web's solid-offset-shadow 3D buttons
 * (e.g. `boxShadow: 0 4px 0 #4c1d95` + translateY(3px) on press). The face sits
 * above a darker shadow rect; pressing slides the face down onto the shadow.
 */
@Composable
fun Button3D(
    onClick: () -> Unit,
    face: Brush,
    shadow: Color,
    modifier: Modifier = Modifier,
    height: Dp = 48.dp,
    depth: Dp = 4.dp,
    shape: Shape = RoundedCornerShape(14.dp),
    enabled: Boolean = true,
    content: @Composable RowScope.() -> Unit,
) {
    val interaction = remember { MutableInteractionSource() }
    val pressed by interaction.collectIsPressedAsState()
    val y by animateDpAsState(if (pressed) depth else 0.dp, tween(80), label = "btn3d")

    Box(modifier.height(height + depth)) {
        // Shadow layer (the dark bottom edge)
        Box(
            Modifier.fillMaxWidth().height(height).offset(y = depth)
                .clip(shape).background(shadow),
        )
        // Face (slides down onto the shadow when pressed)
        Row(
            Modifier.fillMaxWidth().height(height).offset(y = y)
                .clip(shape).background(face)
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

/** Subtle card drop-shadow matching the web mode/surface cards. */
fun Modifier.cardShadow(corner: Dp = 14.dp): Modifier =
    this.shadow(
        elevation = 2.dp,
        shape = RoundedCornerShape(corner),
        clip = false,
        ambientColor = Color(0x18000000),
        spotColor = Color(0x18000000),
    )
