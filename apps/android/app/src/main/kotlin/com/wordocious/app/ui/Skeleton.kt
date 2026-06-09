package com.wordocious.app.ui

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.wordocious.app.ui.theme.WTheme

/**
 * Pulsing placeholder block — the Compose analogue of the web's `animate-pulse`
 * skeletons (gray rounded bars that breathe while loading). Used instead of
 * spinners on data-heavy surfaces, matching the web.
 */
@Composable
fun SkeletonBlock(height: Dp, width: Dp? = null, cornerRadius: Dp = 8.dp) {
    val alpha = if (WTheme.reducedMotion) {
        1f
    } else {
        val transition = rememberInfiniteTransition(label = "skeleton")
        val a by transition.animateFloat(
            initialValue = 1f, targetValue = 0.45f,
            animationSpec = infiniteRepeatable(tween(900), RepeatMode.Reverse),
            label = "skeletonAlpha",
        )
        a
    }
    Spacer(
        Modifier
            .then(if (width != null) Modifier.width(width) else Modifier.fillMaxWidth())
            .height(height)
            .alpha(alpha)
            .clip(RoundedCornerShape(cornerRadius))
            .background(WTheme.surfaceAlt),
    )
}

/** N pulsing leaderboard-row placeholders (web LeaderboardSkeleton — 5 rows). */
@Composable
fun LeaderboardSkeleton(rows: Int = 5) {
    Column {
        repeat(rows) {
            SkeletonBlock(height = 44.dp, cornerRadius = 10.dp)
            Spacer(Modifier.height(8.dp))
        }
    }
}

/** Pulsing card blocks (web AllTimeSkeleton on the Records page). */
@Composable
fun CardsSkeleton(cards: Int = 3) {
    Column {
        repeat(cards) {
            SkeletonBlock(height = 120.dp, cornerRadius = 16.dp)
            Spacer(Modifier.height(12.dp))
        }
    }
}
