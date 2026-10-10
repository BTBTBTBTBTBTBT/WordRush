package com.wordocious.app.ui

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
    val shape = RoundedCornerShape(24.dp)
    Box(Modifier.fillMaxWidth().clip(shape)) {
        // The continuous backdrop: sky wash in the game's tint, clouds, the sunburst light, the floor glow.
        Box(Modifier.matchParentSize().drawBehind {
            drawRect(
                Brush.verticalGradient(
                    0f to accent.copy(alpha = LeaderboardStage.SKY_TOP),
                    0.52f to accent.copy(alpha = LeaderboardStage.SKY_MID),
                    1f to accent.copy(alpha = LeaderboardStage.SKY_BOTTOM),
                ),
            )
            drawRect(
                Brush.radialGradient(
                    listOf(accent.copy(alpha = LeaderboardStage.FLOOR_GLOW), accent.copy(alpha = 0f)),
                    center = Offset(size.width / 2f, size.height), radius = size.width * 0.6f,
                ),
            )
        })
        Image(
            // Founder 10-09: the cloud bank ends ABOVE the WORDOCIOUS row (its edge hid the label): lifted, and its lower
            // edge fades out instead of stopping under the text.
            painterResource(R.drawable.art_lb_clouds), null,
            Modifier.fillMaxWidth().alpha(0.75f).offset(y = (-26).dp)
                .graphicsLayer { compositingStrategy = androidx.compose.ui.graphics.CompositingStrategy.Offscreen }
                .drawWithContent {
                    drawContent()
                    drawRect(
                        Brush.verticalGradient(0f to Color.Black, 0.62f to Color.Black, 0.92f to Color.Transparent),
                        blendMode = BlendMode.DstIn,
                    )
                },
            contentScale = ContentScale.FillWidth,
        )
        Box(Modifier.matchParentSize(), contentAlignment = Alignment.BottomCenter) {
            Image(
                painterResource(R.drawable.art_lb_sunburst), null,
                Modifier.fillMaxWidth().scale(1.3f).graphicsLayer { alpha = LeaderboardStage.RAYS; compositingStrategy = androidx.compose.ui.graphics.CompositingStrategy.Offscreen },
                contentScale = ContentScale.FillWidth,
            )
        }
        Column(Modifier.fillMaxWidth(), content = content)
    }
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
    val prop = remember(day) { LeaderboardStage.dayProp(day) }
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
    val propRes = remember(prop) { ctx.resources.getIdentifier(prop.art.replace('-', '_'), "drawable", ctx.packageName) }
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
        Box(Modifier.fillMaxWidth()) {
        Row(
            Modifier.fillMaxWidth().height(76.dp).semantics(mergeDescendants = true) { contentDescription = titleCaseLabel(title); heading() },
            verticalAlignment = Alignment.Bottom,
        ) {
            // Your mascot leans toward the title (base fixed); a tap hops it and bounces the letters.
            Box(
                Modifier.size(62.dp)
                    .graphicsLayer {
                        translationY = hop.value.dp.toPx()
                        rotationZ = if (still) 0f else LeaderboardStage.MASCOT_LEAN_DEGREES
                        transformOrigin = androidx.compose.ui.graphics.TransformOrigin(0.5f, 1f)
                    }
                    .clickable(interactionSource = remember { MutableInteractionSource() }, indication = null, role = Role.Button, onClickLabel = "Your mascot") { taps += 1 },
                contentAlignment = Alignment.BottomCenter,
            ) { StageOwnMascot(62.dp, wizardHat = hat) }
            androidx.compose.runtime.key(taps) {
                Box(Modifier.weight(1f).padding(bottom = 10.dp), contentAlignment = Alignment.Center) {
                    BubbleText(title, HeadlinePalette.LEADERBOARD, maxSize = 30, minSize = 20)
                }
            }
            if (hostRes != 0) {
                Image(
                    painterResource(hostRes), null,
                    Modifier.size(66.dp).graphicsLayer { scaleX = -1f },
                    contentScale = ContentScale.Fit,
                )
            } else Box(Modifier.size(66.dp))
        }
        // The weekday's prop floats beside the title with its own little motion (parity with web `.lb-prop-*`).
        if (propRes != 0) DayPropImage(propRes, prop.motion, Modifier.align(Alignment.TopEnd).padding(end = 70.dp).offset(y = (-4).dp))
        }
        ResetLine()
        // (the weekday's prop floats over the title row, below)
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
        // It sits on the pale clouds in every theme (Halloween night too): always the dark warm ink.
        color = LB_LABEL, maxLines = 1, overflow = TextOverflow.Ellipsis,
    )
}

/**
 * The compact "Your board" button = today's VIEW BOARD: the family cast button, small, in the board's game color
 * (founder 10-09: the art pill read as ugly; the button wears the game's own color). [accent] null = gold.
 */
@Composable
internal fun YourBoardPill(onClick: () -> Unit, label: String = "Your board", accent: Color? = null) {
    CastButton(text = label, onClick = onClick, color = accent?.let { castColorForAccent(it.red, it.green, it.blue) } ?: CastColor.GOLD, size = CastSize.S)
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

/** The main stage podium's one fixed min height (founder 10-09; iOS stagePodiumHeight 300): no shift switching games. */
internal val STAGE_PODIUM_HEIGHT = 300.dp

/** Yesterday's small podium keeps one fixed height (founder 10-09) so the page never jumps while it loads. */
internal val YESTERDAY_PODIUM_HEIGHT = 210.dp

/**
 * Yesterday (founder 10-09): it sits UNDER today's last player and the Completed Today line (not inside the stage), and
 * collapsed it is a SMALLER COPY of the main podium (gold / silver / bronze steps, the top three's points + detail lines,
 * the same glows) at a fixed height; tap to open everyone else ([expanded], rows only). [minis] are the podium spots.
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
        if (!empty) {
            Box(
                Modifier.fillMaxWidth().height(YESTERDAY_PODIUM_HEIGHT).clickable(
                    interactionSource = remember { MutableInteractionSource() }, indication = null, role = Role.Button,
                    onClickLabel = if (open) "Hide yesterday's full list" else "Show yesterday's full list", onClick = onToggle,
                ),
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
 * The selected-game strip: the game's art, "N today", YOUR rank + stats on ONE line, and one compact button —
 * PLAY before today's daily, the Your board pill (= the old VIEW BOARD) after.
 */
@Composable
internal fun ModeStageStrip(
    modeId: String, players: Int, played: Boolean, rankLine: String, rank: Int?, friends: Boolean,
    onPlay: (com.wordocious.core.GameMode) -> Unit,
) {
    val card = modeCardForKey(modeId)
    val accent = card?.accent ?: Color(0xFF7C3AED)
    Row(
        Modifier.fillMaxWidth().heightIn(min = 46.dp).padding(horizontal = 14.dp, vertical = 4.dp)
            .gameLaunchSource("lb:play", Wash.mix(accent, Wash.CARD), GAME_SOURCE_RADIUS),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        gameArtRes(card?.id ?: modeId)?.let { art -> Image(artPainter(art, 34.dp), null, Modifier.size(34.dp)) }
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                "${card?.title ?: modeTitleForKey(modeId)} · $players today",
                fontSize = 12.5.sp, lineHeight = 15.sp, fontWeight = FontWeight.ExtraBold, color = lbNameInk(), maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(
                    rankLine, fontSize = 11.5.sp, lineHeight = 15.sp, fontWeight = FontWeight.Black, color = lbSubInk(), maxLines = 1,
                    overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f, fill = false),
                )
                if (rank != null) RankDeltaBadge(mode = modeId, playType = "solo", pageKey = if (friends) "daily-friends" else "daily", currentRank = rank)
            }
        }
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

/** The Sweep board's strip in the same family: the glossy broom, the name + count, your sweep rank line. */
@Composable
internal fun SweepStageStrip(sweepers: Int, rankLine: String) {
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
    }
}

/** The weekday's prop: spin (sun), bob (coffee), hover (rocket), swish (wand), flash (lightning), drift (rainbow cloud). Reduce Motion: still. */
@Composable
private fun DayPropImage(res: Int, motion: String, modifier: Modifier) {
    val still = WTheme.reducedMotion
    var t by remember { androidx.compose.runtime.mutableDoubleStateOf(0.0) }
    if (!still) {
        LaunchedEffect(Unit) {
            val start = System.nanoTime()
            while (true) {
                androidx.compose.runtime.withFrameNanos { t = (it - start) / 1e9 }
                kotlinx.coroutines.delay(24)   // ~30 fps: a small image does not need more
            }
        }
    }
    fun ease(period: Double) = (1 - kotlin.math.cos(2 * Math.PI * t / period)) / 2
    fun keys(phase: Double, stops: List<Pair<Double, Double>>): Double {
        if (phase <= stops.first().first) return stops.first().second
        for (i in 1 until stops.size) if (phase <= stops[i].first) {
            val a = stops[i - 1]; val b = stops[i]
            return a.second + (b.second - a.second) * (phase - a.first) / maxOf(b.first - a.first, 0.0001)
        }
        return stops.last().second
    }
    var dx = 0f; var dy = 0f; var rot = 0f; var scale = 1f; var alpha = 1f
    if (!still) when (motion) {
        "spin" -> rot = ((t / 18) % 1.0 * 360).toFloat()
        "bob" -> { val p = ease(2.8); dy = (-4 * p).toFloat(); rot = (-3 + 6 * p).toFloat() }
        "hover" -> { val p = ease(3.2); dy = (-6 * p).toFloat(); rot = (-4 + 6 * p).toFloat() }
        "swish" -> rot = keys((t / 3.6) % 1.0, listOf(0.0 to 0.0, 0.55 to 0.0, 0.62 to -24.0, 0.72 to 20.0, 0.82 to -8.0, 0.90 to 0.0, 1.0 to 0.0)).toFloat()
        "flash" -> {
            val ph = (t / 3.4) % 1.0
            scale = keys(ph, listOf(0.0 to 1.0, 0.70 to 1.0, 0.74 to 1.22, 0.78 to 0.96, 0.84 to 1.12, 0.92 to 1.0, 1.0 to 1.0)).toFloat()
            alpha = keys(ph, listOf(0.0 to 1.0, 0.74 to 1.0, 0.78 to 0.75, 0.84 to 1.0, 1.0 to 1.0)).toFloat()
        }
        else -> dx = (6 * kotlin.math.sin(2 * Math.PI * t / 12)).toFloat()
    }
    Image(
        painterResource(res), null,
        modifier.size(40.dp).graphicsLayer { translationX = dx.dp.toPx(); translationY = dy.dp.toPx(); rotationZ = rot; scaleX = scale; scaleY = scale; this.alpha = alpha },
        contentScale = ContentScale.Fit,
    )
}
