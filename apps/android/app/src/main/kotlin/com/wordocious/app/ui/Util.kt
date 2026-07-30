package com.wordocious.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import com.wordocious.app.ui.theme.WTheme

/** Clickable with no ripple — used by mode cards, keyboard keys, back button, etc. */
@Composable
fun Modifier.clickableNoRipple(onClick: () -> Unit): Modifier {
    val interaction = remember { MutableInteractionSource() }
    return this.clickable(interactionSource = interaction, indication = null, onClick = onClick)
}

/**
 * The app's page background — a vertical bg→surfaceHover gradient.
 *
 * iOS paints this on every full-screen page (`LinearGradient(colors: [Theme.background,
 * Theme.backgroundGradientEnd])`, RootTabView-hosted screens) and the web does the
 * same via `--color-bg`→`--color-surface-hover`. Android had it on only three
 * screens and painted the rest flat, so Home / Profile / Records / sign-in read
 * noticeably flatter than their iOS counterparts. Use this for PAGE roots only —
 * inner cards keep `background(WTheme.bg)`.
 */
fun Modifier.appBackground(): Modifier =
    this.background(Brush.verticalGradient(listOf(WTheme.bg, WTheme.surfaceHover)))
