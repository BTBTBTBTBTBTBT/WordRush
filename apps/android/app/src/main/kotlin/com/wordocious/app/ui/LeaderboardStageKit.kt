package com.wordocious.app.ui

import androidx.compose.animation.core.animateFloat
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.requiredWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.draw.scale
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.layout
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.R
import com.wordocious.app.data.AuthService
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.core.LeaderboardStage
import com.wordocious.core.ProperNoundle
import com.wordocious.core.leaderboardTitle

/**
 * FRIDAY-QUEUE items 11 + 11b (Android): the Leaderboard is ONE living stage. These are its pieces; LeaderboardScreen
 * composes them: the day's bubble title with YOUR mascot and the day's cast host, the game picker with no card,
 * the selected-game strip, the Everyone/Friends + share line, the podium and Yesterday's winners as the stage's base
 * ledge, all on ONE continuous backdrop in the selected game's tint. Constants: core [LeaderboardStage]
 * (parity with packages/core/src/leaderboard-stage.ts). iOS: LeaderboardStageView.swift; web: leaderboard-stage.tsx.
 */
@Composable
internal fun LeaderboardStageCard(accent: Color, content: @Composable ColumnScope.() -> Unit) {
    // Founder 10-09: the stage has NO card edge: no clip, no rounded corners. The sky wash runs past each side (to the screen edges,
    // [LB_SIDE] of page gutter), fading in over its first 60 dp and out over its last 90 dp; the cloud bank is full bleed (the gutter
    // + 36 dp each side) above the wash but behind the content, drifting side to side +-26 dp on a 22 s ease-in-out loop (still under
    // Reduce Motion), rising 6 dp above the card, its vertical mask transparent -> opaque (22%) -> opaque (60%) -> transparent (92%).
    // iOS: LeaderboardStageCard + StageDriftingClouds.
    Box(Modifier.fillMaxWidth()) {
        Box(Modifier.matchParentSize().bleed(LB_SIDE)) {
            // The sky wash in the game's tint, faded at both ends.
            Box(
                Modifier.matchParentSize()
                    .graphicsLayer { compositingStrategy = androidx.compose.ui.graphics.CompositingStrategy.Offscreen }
                    .drawWithContent {
                        drawRect(
                            Brush.verticalGradient(
                                0f to accent.copy(alpha = LeaderboardStage.SKY_TOP),
                                0.52f to accent.copy(alpha = LeaderboardStage.SKY_MID),
                                1f to accent.copy(alpha = LeaderboardStage.SKY_BOTTOM),
                            ),
                        )
                        val fadeIn = 60.dp.toPx()
                        val fadeOut = 90.dp.toPx()
                        drawRect(
                            Brush.verticalGradient(0f to Color.Transparent, 1f to Color.Black, startY = 0f, endY = fadeIn),
                            size = androidx.compose.ui.geometry.Size(size.width, fadeIn), blendMode = BlendMode.DstIn,
                        )
                        drawRect(
                            Brush.verticalGradient(0f to Color.Black, 1f to Color.Transparent, startY = size.height - fadeOut, endY = size.height),
                            topLeft = Offset(0f, size.height - fadeOut),
                            size = androidx.compose.ui.geometry.Size(size.width, fadeOut), blendMode = BlendMode.DstIn,
                        )
                    },
            )
            // The sunburst light and the floor glow.
            Box(Modifier.matchParentSize().drawBehind {
                drawRect(
                    Brush.radialGradient(
                        listOf(accent.copy(alpha = LeaderboardStage.FLOOR_GLOW), accent.copy(alpha = 0f)),
                        center = Offset(size.width / 2f, size.height), radius = size.width * 0.6f,
                    ),
                )
            })
            Box(Modifier.matchParentSize(), contentAlignment = Alignment.BottomCenter) {
                Image(
                    painterResource(R.drawable.art_lb_sunburst), null,
                    Modifier.fillMaxWidth().scale(1.3f).graphicsLayer { alpha = LeaderboardStage.RAYS; compositingStrategy = androidx.compose.ui.graphics.CompositingStrategy.Offscreen },
                    contentScale = ContentScale.FillWidth,
                )
            }
        }
        // The cloud bank: the page bleed + 36 dp each side, 85%, lifted 6 dp, drifting +-26 dp; its vertical mask as above.
        val still = WTheme.reducedMotion
        val drift = if (still) 0f else {
            val t = androidx.compose.animation.core.rememberInfiniteTransition(label = "lb-cloud-drift")
            t.animateFloat(
                initialValue = -26f, targetValue = 26f,
                animationSpec = androidx.compose.animation.core.infiniteRepeatable(
                    androidx.compose.animation.core.tween(22_000, easing = androidx.compose.animation.core.FastOutSlowInEasing),
                    androidx.compose.animation.core.RepeatMode.Reverse,
                ),
                label = "lb-cloud-drift",
            ).value
        }
        Image(
            painterResource(R.drawable.art_lb_clouds), null,
            Modifier.align(Alignment.TopCenter)
                .layout { measurable, constraints ->
                    val extra = (LB_SIDE * 2 + 72.dp).roundToPx()
                    val p = measurable.measure(androidx.compose.ui.unit.Constraints.fixedWidth(constraints.maxWidth + extra))
                    layout(constraints.maxWidth, p.height) { p.place(-extra / 2, 0) }
                }
                .offset(y = (-6).dp)
                .graphicsLayer { translationX = drift.dp.toPx(); alpha = 0.85f; compositingStrategy = androidx.compose.ui.graphics.CompositingStrategy.Offscreen }
                .drawWithContent {
                    drawContent()
                    drawRect(
                        Brush.verticalGradient(0f to Color.Transparent, 0.22f to Color.Black, 0.6f to Color.Black, 0.92f to Color.Transparent),
                        blendMode = BlendMode.DstIn,
                    )
                },
            contentScale = ContentScale.FillWidth,
        )
        Column(Modifier.fillMaxWidth(), content = content)
    }
}

/** Lays the child out [side] wider than its parent on each side (the page gutter), unclipped: the stage's edge-to-edge bleed. */
private fun Modifier.bleed(side: androidx.compose.ui.unit.Dp): Modifier = layout { measurable, constraints ->
    val extra = (side * 2).roundToPx()
    val w = constraints.maxWidth + extra
    val p = measurable.measure(androidx.compose.ui.unit.Constraints.fixed(w, constraints.maxHeight))
    layout(constraints.maxWidth, constraints.maxHeight) { p.place(-extra / 2, 0) }
}

/** The player's own mascot beside the title: the full-body standing figure (alive when the living mascot is on). */
@Composable
internal fun StageOwnMascot(size: androidx.compose.ui.unit.Dp, wizardHat: Boolean = false) {
    val profile by AuthService.profile.collectAsState()
    val p = profile
    if (p != null) {
        PlayerAvatar(
            p.username, size, Modifier, userId = p.id, avatarUrl = p.avatarUrl, live = true, podiumPlace = 3,
            headOverride = if (wizardHat) LeaderboardStage.WIZARD_HAT_PART else null,
        )
    } else {
        Image(painterResource(R.drawable.art_pose_w_wave), null, Modifier.size(size), contentScale = ContentScale.Fit)
    }
}

/**
 * Row 1 of the stage: [your mascot] · the day's title in bubble lettering · [the day's cast host], filling the width;
 * the date + reset clock is ONE small line under it.
 */
@Composable
internal fun StageTitleRow() {
    val countdown = rememberMidnightCountdown()
    val minute by remember { androidx.compose.runtime.derivedStateOf { countdown.value / 60 } }
    val day = remember(minute) { com.wordocious.app.todayLocalDate() }
    val holiday = remember(day) { ProperNoundle.holidayNameForDay(day) }
    val title = remember(day) { leaderboardTitle(day, holiday) }
    val host = remember(day) { LeaderboardStage.host(day) }
    val hat = remember(day) { LeaderboardStage.wearsWizardHat(day) }
    // Tapping your mascot: it hops and the title letters bounce again (the title re-mounts, replaying its pop).
    var taps by remember { mutableIntStateOf(0) }
    val hop = remember { androidx.compose.animation.core.Animatable(0f) }
    val still = WTheme.reducedMotion
    LaunchedEffect(taps) {
        if (taps > 0 && !still) {
            hop.animateTo(-14f, androidx.compose.animation.core.tween(140))
            hop.animateTo(0f, androidx.compose.animation.core.spring(dampingRatio = 0.35f, stiffness = 500f))
        }
    }
    val ctx = LocalContext.current
    val hostRes = remember(host) { ctx.resources.getIdentifier("art_pose_${host.castId}_${host.pose}", "drawable", ctx.packageName) }
    // Founder 10-09: the title's cloud bank glows from behind (a warm gold light), so it reads as lit, not pasted.
    Column(
        Modifier.fillMaxWidth()
            .drawBehind {
                val r = size.maxDimension * 0.62f
                drawOval(
                    brush = androidx.compose.ui.graphics.Brush.radialGradient(
                        listOf(androidx.compose.ui.graphics.Color(0x9EFFD978), androidx.compose.ui.graphics.Color(0x38FFB04A), androidx.compose.ui.graphics.Color.Transparent),
                        center = center, radius = r,
                    ),
                    topLeft = androidx.compose.ui.geometry.Offset(center.x - r * 1.1f, center.y - r * 0.62f),
                    size = androidx.compose.ui.geometry.Size(r * 2.2f, r * 1.24f),
                )
            }
            .padding(start = 10.dp, end = 10.dp, top = 8.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        // Founder 10-09: the day's name fills the cloud on two big bubble lines (FRIDAY'S over FINEST); your mascot and the day's
        // host stand larger at either side of the second line; the floating weekday prop is gone. Splits at the LAST space.
        val words = title.split(" ")
        val line1 = if (words.size > 1) words.dropLast(1).joinToString(" ") else title
        val line2 = if (words.size > 1) words.last() else ""
        Column(
            Modifier.fillMaxWidth().semantics(mergeDescendants = true) { contentDescription = titleCaseLabel(title); heading() },
            verticalArrangement = Arrangement.spacedBy(1.dp),
        ) {
            androidx.compose.runtime.key(taps) {
                BubbleOneLine(line1, HeadlinePalette.LEADERBOARD, 42f, Modifier.padding(horizontal = 4.dp))
            }
            Row(
                // The mascot row is pulled up 25 dp under line 1 (iOS .padding(.top, -25): the layout shrinks too).
                Modifier.fillMaxWidth().heightIn(min = 70.dp).layout { measurable, constraints ->
                    val pull = 25.dp.roundToPx()
                    val p = measurable.measure(constraints)
                    layout(p.width, (p.height - pull).coerceAtLeast(0)) { p.place(0, -pull) }
                },
                verticalAlignment = Alignment.Bottom,
                horizontalArrangement = Arrangement.spacedBy(2.dp),
            ) {
                // Your mascot leans toward the title (base fixed); a tap hops it and bounces the letters.
                Box(
                    Modifier.size(70.dp)
                        .graphicsLayer {
                            translationY = hop.value.dp.toPx()
                            rotationZ = if (still) 0f else LeaderboardStage.MASCOT_LEAN_DEGREES
                            transformOrigin = androidx.compose.ui.graphics.TransformOrigin(0.5f, 1f)
                        }
                        .clickable(interactionSource = remember { MutableInteractionSource() }, indication = null, role = Role.Button, onClickLabel = "Your mascot") { taps += 1 },
                    contentAlignment = Alignment.BottomCenter,
                ) { StageOwnMascot(70.dp, wizardHat = hat) }
                androidx.compose.runtime.key(taps) {
                    Box(Modifier.weight(1f).padding(bottom = 14.dp), contentAlignment = Alignment.Center) {
                        BubbleOneLine(line2, HeadlinePalette.LEADERBOARD, 42f)
                    }
                }
                if (hostRes != 0) {
                    Image(
                        painterResource(hostRes), null,
                        Modifier.size(72.dp).graphicsLayer { scaleX = -1f },
                        contentScale = ContentScale.Fit,
                    )
                } else Box(Modifier.size(72.dp))
            }
        }
        ResetLine()
    }
}

/** "OCT 9 · RESETS IN 12:41:17" — the one small line under the title. */
@Composable
private fun ResetLine() {
    val secs by rememberMidnightCountdown()
    val day = remember(secs / 60) { com.wordocious.app.todayLocalDate() }
    val lead = remember(day) {
        java.time.LocalDate.parse(day).format(java.time.format.DateTimeFormatter.ofPattern("MMM d", java.util.Locale.US)).uppercase(java.util.Locale.US)
    }
    Text(
        "$lead · RESETS IN ${formatCountdown(secs)}", fontSize = 10.5.sp, fontWeight = FontWeight.Black, letterSpacing = 0.6.sp,
        // Founder 10-09: the cloud fades out above this line, so on a dark theme it takes a warm light ink.
        color = if (WTheme.isDark) Color(0xFFFDE68A).copy(alpha = 0.92f) else LB_LABEL, maxLines = 1, overflow = TextOverflow.Ellipsis,
    )
}

/**
 * The compact "Your board" button = today's VIEW BOARD: the family cast button, small, in the board's game color
 * (founder 10-09: the art pill read as ugly; the button wears the game's own color). [accent] null = gold.
 */
@Composable
internal fun YourBoardPill(onClick: () -> Unit, label: String = "View board", accent: Color? = null) {
    // Founder 10-09: reads "View board" and sits smaller (the small cast pill at 80%, like iOS / web).
    Box(Modifier.size(width = 84.dp, height = 26.dp), contentAlignment = Alignment.Center) {
        Box(Modifier.requiredWidth(104.dp).graphicsLayer { scaleX = 0.8f; scaleY = 0.8f }) {
            CastButton(text = label, onClick = onClick, color = accent?.let { castColorForAccent(it.red, it.green, it.blue) } ?: CastColor.GOLD,
                size = CastSize.S, modifier = Modifier.fillMaxWidth())
        }
    }
}

/**
 * The family cast color nearest a game accent's HUE (<18 / >=335 deg pink, <40 orange, <62 gold, <150 green, <190 teal,
 * <245 blue, <300 purple; low saturation = slate). Mirrors iOS YourBoardPill.castColor and web castColorForAccent.
 */
internal fun castColorForAccent(r: Float, g: Float, b: Float): CastColor {
    val max = maxOf(r, g, b)
    val min = minOf(r, g, b)
    val d = max - min
    val sat = if (max == 0f) 0f else d / max
    if (sat < 0.18f) return CastColor.SLATE
    var deg = 0f
    if (d > 0f) {
        deg = when (max) {
            r -> ((g - b) / d).mod(6f)
            g -> (b - r) / d + 2f
            else -> (r - g) / d + 4f
        } * 60f
    }
    return when {
        deg < 18f || deg >= 335f -> CastColor.PINK
        deg < 40f -> CastColor.ORANGE
        deg < 62f -> CastColor.GOLD
        deg < 150f -> CastColor.GREEN
        deg < 190f -> CastColor.TEAL
        deg < 245f -> CastColor.BLUE
        deg < 300f -> CastColor.PURPLE
        else -> CastColor.PINK
    }
}

/** The main stage podium's one fixed min height (founder 10-09; iOS stagePodiumHeight 240): no shift switching games. */
internal val STAGE_PODIUM_HEIGHT = 240.dp

/** Yesterday's small podium keeps one fixed height (founder 10-09) so the page never jumps while it loads. */
internal val YESTERDAY_PODIUM_HEIGHT = 230.dp

/**
 * Yesterday (founder 10-09): it sits UNDER today's last player and the Completed Today line (not inside the stage), and
 * collapsed it is a SMALLER COPY of the main podium (gold / silver / bronze steps, the top three's points + detail lines,
 * the same glows) at a fixed height; the header folds it all away ([expanded], rows only). [minis] are the podium spots.
 */
@Composable
internal fun StageYesterdayLedge(
    minis: List<BoardPodiumSpot>,
    open: Boolean,
    loading: Boolean,
    accent: Color,
    onToggle: () -> Unit,
    share: @Composable () -> Unit,
    expanded: @Composable () -> Unit,
) {
    // Known and empty: no podium (a blank podium reads unfinished), just one calm line beside the header.
    val empty = !loading && minis.isEmpty()
    Column(Modifier.fillMaxWidth().padding(start = 4.dp, end = 4.dp, bottom = 8.dp)) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            if (empty) {
                Row(
                    Modifier.weight(1f).padding(vertical = 6.dp).semantics(mergeDescendants = true) { },
                    verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Text(
                        "YESTERDAY", fontSize = 11.sp, fontWeight = FontWeight.Black, letterSpacing = 1.2.sp,
                        color = if (WTheme.isDark) WTheme.textSecondary else LB_SECTION_INK,
                    )
                    Text(
                        "No results from yesterday", fontSize = 11.5.sp, fontWeight = FontWeight.Bold, color = lbSubInk(),
                        maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f, fill = false),
                    )
                }
            } else {
                Row(
                    Modifier.clickable(interactionSource = remember { MutableInteractionSource() }, indication = null, role = Role.Button,
                        onClickLabel = "Yesterday's winners, " + if (open) "expanded" else "collapsed", onClick = onToggle)
                        .padding(vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        "YESTERDAY", fontSize = 11.sp, fontWeight = FontWeight.Black, letterSpacing = 1.2.sp,
                        color = if (WTheme.isDark) WTheme.textSecondary else LB_SECTION_INK,
                    )
                    Icon(
                        if (open) Icons.Filled.KeyboardArrowUp else Icons.Filled.KeyboardArrowDown, null,
                        tint = if (WTheme.isDark) WTheme.textSecondary else LB_SECTION_INK, modifier = Modifier.size(16.dp),
                    )
                }
                Box(Modifier.weight(1f))
            }
            if (open && !empty) share()
        }
        // Founder 10-09: open (the default) shows the small podium + everyone else; minimizing folds it all to the header line.
        if (open && !empty) {
            Box(
                Modifier.fillMaxWidth().height(YESTERDAY_PODIUM_HEIGHT),
                contentAlignment = Alignment.BottomCenter,
            ) {
                if (!loading) {
                    Box(Modifier.widthIn(max = 360.dp).fillMaxWidth()) {
                        BoardPodium(
                            minis.take(3), open = (minOf(minis.size, 3) + 1..3).toList(), accent = accent,
                            bare = true, compact = true,
                        )
                    }
                }
            }
        }
        if (open && !empty) expanded()
    }
}

/**
 * The selected-game strip, two rows each with its control on the right (founder 10-09): [game art · "Game · N today"]
 * [[trailing]: the Everyone | Friends switch + share], then [YOUR rank + stats on ONE line, shrinking to fit] [PLAY before
 * today's daily, the Your board pill after].
 */
@Composable
internal fun ModeStageStrip(
    modeId: String, players: Int, played: Boolean, rankLine: String, rank: Int?, friends: Boolean,
    onPlay: (com.wordocious.core.GameMode) -> Unit,
    trailing: @Composable () -> Unit = {},
) {
    val card = modeCardForKey(modeId)
    val accent = card?.accent ?: Color(0xFF7C3AED)
    Column(
        Modifier.fillMaxWidth().heightIn(min = 46.dp).padding(horizontal = 10.dp, vertical = 4.dp)
            .gameLaunchSource("lb:play", Wash.mix(accent, Wash.CARD), GAME_SOURCE_RADIUS),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            gameArtRes(card?.id ?: modeId)?.let { art -> Image(artPainter(art, 34.dp), null, Modifier.size(34.dp)) }
            Text(
                "${card?.title ?: modeTitleForKey(modeId)} · $players today",
                fontSize = 12.5.sp, lineHeight = 15.sp, fontWeight = FontWeight.ExtraBold, color = lbNameInk(), maxLines = 1,
                overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f, fill = false),
            )
            Box(Modifier.weight(1f))
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) { trailing() }
        }
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(
                rankLine, fontSize = 11.5.sp, lineHeight = 15.sp, fontWeight = FontWeight.Black, color = lbSubInk(), maxLines = 1,
                overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f, fill = false),
            )
            if (rank != null) RankDeltaBadge(mode = modeId, playType = "solo", pageKey = if (friends) "daily-friends" else "daily", currentRank = rank)
            Box(Modifier.weight(1f))
            card?.engineMode?.let { gm ->
                if (played) {
                    YourBoardPill(onClick = { GameMotion.arm("lb:play"); onPlay(gm) }, accent = accent)
                } else {
                    CandyButton(
                        text = "PLAY", onClick = { GameMotion.arm("lb:play"); onPlay(gm) },
                        color = CandyColor.PURPLE, size = CandySize.SMALL, icon = CandyIcon.PLAY,
                        contentDescription = "Play ${card.title}",
                    )
                }
            }
        }
    }
}

/** The Sweep board's strip in the same family: the glossy broom, the name + count, your sweep rank line, and the share at the right ([trailing]). */
@Composable
internal fun SweepStageStrip(sweepers: Int, rankLine: String, trailing: @Composable () -> Unit = {}) {
    Row(
        Modifier.fillMaxWidth().heightIn(min = 46.dp).padding(horizontal = 14.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Image(painterResource(R.drawable.game_sweep), null, Modifier.size(38.dp))
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                "Daily Sweep · $sweepers swept", fontSize = 14.sp, fontWeight = FontWeight.Black, color = lbNameInk(), maxLines = 1,
                overflow = TextOverflow.Ellipsis, modifier = Modifier.semantics { heading() },
            )
            Text(rankLine, fontSize = 11.5.sp, fontWeight = FontWeight.Black, color = lbSubInk(), maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        trailing()
    }
}
