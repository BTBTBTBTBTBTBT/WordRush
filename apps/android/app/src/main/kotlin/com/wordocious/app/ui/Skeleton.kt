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
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.wordocious.app.ui.theme.WTheme

/**
 * Placeholder block — the Compose analogue of the web's `animate-pulse`
 * skeletons (tinted rounded bars that shimmer while loading). Used instead of
 * spinners on data-heavy surfaces, matching the web.
 */
@Composable
fun SkeletonBlock(height: Dp, width: Dp? = null, cornerRadius: Dp = 8.dp) {
    // FINISH_SPEC A1 / G5: a soft lavender wash (never gray-white) with a light band
    // sweeping across it — the tinted shimmer. Reduce Motion: the still wash.
    val still = WTheme.reducedMotion
    val phase = if (still) {
        -1f
    } else {
        val transition = rememberInfiniteTransition(label = "skeleton")
        val p by transition.animateFloat(
            initialValue = -0.4f, targetValue = 1.4f,
            animationSpec = infiniteRepeatable(tween(1300), RepeatMode.Restart),
            label = "skeletonShimmer",
        )
        p
    }
    val wash = accentWash(SKELETON_ACCENT, 0.14f)
    val band = if (WTheme.isDark) Color.White.copy(alpha = 0.08f) else Color.White.copy(alpha = 0.55f)
    Spacer(
        Modifier
            .then(if (width != null) Modifier.width(width) else Modifier.fillMaxWidth())
            .height(height)
            .clip(RoundedCornerShape(cornerRadius))
            .background(wash)
            .drawBehind {
                if (phase > -1f) {
                    val w = size.width * 0.35f
                    val x = phase * size.width
                    drawRect(
                        Brush.horizontalGradient(listOf(Color.Transparent, band, Color.Transparent), startX = x - w / 2f, endX = x + w / 2f),
                    )
                }
            },
    )
}

private val SKELETON_ACCENT = Color(0xFF7C3AED)

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
