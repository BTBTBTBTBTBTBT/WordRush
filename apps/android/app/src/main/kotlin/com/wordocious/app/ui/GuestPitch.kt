package com.wordocious.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.ui.theme.Nunito
import com.wordocious.app.ui.theme.WTheme

/** One decorative sample chip on the signed-out pitch. */
data class GuestChip(val icon: Icon3DName, val value: String, val label: String, val accent: Color)

/** What the signed-out pitch previews under its line. */
sealed interface GuestPreview {
    data class Chips(val chips: List<GuestChip>) : GuestPreview
    data object Podium : GuestPreview
    data object None : GuestPreview
}

object GuestPitchContent {
    val statsChips = listOf(
        GuestChip(Icon3DName.FLAME, "12", "STREAK", Color(0xFFF97316)),
        GuestChip(Icon3DName.TROPHY, "48", "WINS", Color(0xFFF59E0B)),
        GuestChip(Icon3DName.CROWN, "1:42", "BEST TIME", Color(0xFF7C3AED)),
    )
    val statsColors = listOf(Color(0xFF2563EB), Color(0xFF8B5CF6))
    val leaderboardColors = listOf(Color(0xFFF59E0B), Color(0xFFEA580C))
    val friendsColors = listOf(Color(0xFFDB2777), Color(0xFFF97316))
}

/**
 * FINISH_SPEC BI23 (founder, 2026-10-03: "get rid of the sign in to track your stats gray
 * circle image and make that screen look nicer"): the signed-out Stats / Leaderboard /
 * Friends body under the pinned AppHeader (iOS `GuestPitch`, web `GuestPitch`) — the page
 * host (or a cast duo) popping in once, a gradient caps headline, one line, a dimmed
 * decorative preview (sample chips or a mini podium: soft glossy tiles, no border), the
 * SIGN IN candy button and a quiet "Play without an account" link. Fills the space it is
 * given and centers in it.
 */
@Composable
fun GuestPitch(
    hosts: List<MascotId>,
    title: String,
    subtitle: String,
    colors: List<Color>,
    preview: GuestPreview,
    onSignIn: () -> Unit,
    onPlay: (() -> Unit)?,
    modifier: Modifier = Modifier,
    subColor: Color = WTheme.textSecondary,
    /** BJ16: cast-color title art in place of the gradient headline ([title] stays its description). */
    heading: Heading? = null,
    /** False when the page's own title art already names it (the VS guest gate): no heading here. */
    showTitle: Boolean = true,
) {
    // Tablet pitch (founder 10-14): the page width with its margins inside, the cast, tiles and text
    // 1.6x (the podium 2x, the subtitle 1.3x). A phone keeps the 20 dp gutter and its sizes.
    val wc = rememberWidthClass()
    val tablet = wc != WidthClass.COMPACT
    val screenW = LocalConfiguration.current.screenWidthDp.dp
    val pageW = minOf(screenW - tabletPageMargin(wc) * 2, tabletPageMaxWidth)
    val tileW = minOf((pageW - 32.dp) / 3, 240.dp)
    Column(
        (if (tablet) modifier.fillMaxSize().tabletPageFor(wc) else modifier.fillMaxSize().padding(horizontal = 20.dp))
            .padding(bottom = TAB_CONTENT_BOTTOM_PAD),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        val art = if (tablet) 1.6f else 1f
        Row(horizontalArrangement = Arrangement.spacedBy((-18).dp * art)) {
            hosts.forEach { Mascot(it, (if (hosts.size > 1) 104.dp else 120.dp) * art, motion = MascotMotion.POP) }
        }
        Spacer(Modifier.height(10.dp))
        if (!showTitle) {
            Unit
        } else if (heading != null) {
            HeadingArt(heading, height = 36.dp * art, maxWidth = 320.dp * art, contentDescription = title)
        } else {
            PageTitleText(title, accent = colors, fontSize = 28.sp * art, maxLines = 1)
        }
        Text(
            subtitle, fontSize = if (tablet) 19.5.sp else 15.sp, fontWeight = FontWeight.SemiBold, color = subColor,
            textAlign = TextAlign.Center, modifier = Modifier.padding(top = 6.dp, start = 12.dp, end = 12.dp),
        )
        when (preview) {
            is GuestPreview.Chips -> Row(
                Modifier.padding(top = 20.dp * art).alpha(0.72f).clearAndSetSemantics { },
                horizontalArrangement = Arrangement.spacedBy(if (tablet) 16.dp else 10.dp),
            ) { preview.chips.forEach { GuestChipTile(it, art, if (tablet) tileW else 92.dp) } }
            GuestPreview.Podium -> GuestPodium(
                Modifier.padding(top = 20.dp * art).alpha(0.72f).clearAndSetSemantics { },
                if (tablet) 2f else 1f,
            )
            GuestPreview.None -> Unit
        }
        // BJ15: THE primary button is the cast button (SIGN IN lettering), as on the sign-in screen.
        CastButton("Sign in", onSignIn, color = CastColor.PURPLE, size = CastSize.L,
            modifier = Modifier.padding(top = 24.dp))
        // 2026-10-05: a guest is already playing without an account, so the link would only
        // offer what they have; SIGN IN stays (iOS + web parity).
        val isGuest by com.wordocious.app.data.AuthService.isGuest.collectAsState()
        if (onPlay != null && !isGuest) {
            // BJ15 round 2: a secondary family text link (brand ink, no underline), the sign-in screen's own link.
            TextLink("Play without an account", onClick = onPlay, modifier = Modifier.padding(top = 6.dp).heightIn(min = 44.dp))
        }
    }
}

/** The soft glossy face (game kit: a darker lip, a gradient face, a top gloss), no border. */
@Composable
private fun GlossFace(accent: Color, width: Dp, height: Dp, corner: Dp, content: @Composable () -> Unit) {
    val shape = RoundedCornerShape(corner)
    Box(Modifier.size(width, height + 3.dp)) {
        Box(Modifier.offset(y = 3.dp).size(width, height).clip(shape).background(accent.copy(alpha = 0.95f)))
        Box(
            Modifier.size(width, height)
                .shadow(8.dp, shape, ambientColor = accent.copy(alpha = 0.22f), spotColor = accent.copy(alpha = 0.22f))
                .clip(shape)
                .background(Brush.verticalGradient(listOf(accent.copy(alpha = 0.62f), accent.copy(alpha = 0.88f)))),
            contentAlignment = Alignment.Center,
        ) {
            Box(
                Modifier.align(Alignment.TopCenter).padding(top = 4.dp, start = 7.dp, end = 7.dp)
                    .fillMaxWidth().height(28.dp).clip(RoundedCornerShape(corner * 0.75f))
                    .background(Brush.verticalGradient(listOf(Color.White.copy(alpha = 0.38f), Color.White.copy(alpha = 0f)))),
            )
            content()
        }
    }
}

@Composable
private fun GuestChipTile(c: GuestChip, art: Float = 1f, width: Dp = 92.dp * art) {
    GlossFace(c.accent, width, 88.dp * art, 16.dp * art) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Icon3D(c.icon, 24.dp * art)
            Text(c.value, fontSize = 20.sp * art, fontWeight = FontWeight.Black, color = Color.White, fontFamily = Nunito)
            Text(c.label, fontSize = 9.sp * art, fontWeight = FontWeight.ExtraBold, color = Color.White.copy(alpha = 0.9f),
                letterSpacing = 0.4.sp, maxLines = 1, fontFamily = Nunito)
        }
    }
}

/** The Leaderboard's preview: a mini podium (2 · 1 · 3), the crown on first. */
@Composable
private fun GuestPodium(modifier: Modifier, art: Float = 1f) {
    val steps = listOf(2 to 56.dp, 1 to 78.dp, 3 to 42.dp)
    Row(modifier, horizontalArrangement = Arrangement.spacedBy(8.dp * art), verticalAlignment = Alignment.Bottom) {
        steps.forEach { (rank, h) ->
            Column(Modifier.width(78.dp * art), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp * art)) {
                if (rank == 1) Icon3D(Icon3DName.CROWN, 28.dp * art)
                PodiumPedestal(rank, h * art)
            }
        }
    }
}
