package com.wordocious.app.ui

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
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
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
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
            painterResource(R.drawable.art_lb_clouds), null, Modifier.fillMaxWidth().alpha(0.75f).offset(y = (-6).dp),
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
private fun StageOwnMascot(size: androidx.compose.ui.unit.Dp) {
    val profile by AuthService.profile.collectAsState()
    val p = profile
    if (p != null) {
        PlayerAvatar(
            p.username, size, Modifier, userId = p.id, avatarUrl = p.avatarUrl, live = true, podiumPlace = 3,
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
    val ctx = LocalContext.current
    val hostRes = remember(host) { ctx.resources.getIdentifier("art_pose_${host.castId}_${host.pose}", "drawable", ctx.packageName) }
    Column(Modifier.fillMaxWidth().padding(start = 10.dp, end = 10.dp, top = 8.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Row(
            Modifier.fillMaxWidth().height(76.dp).semantics(mergeDescendants = true) { contentDescription = titleCaseLabel(title); heading() },
            verticalAlignment = Alignment.Bottom,
        ) {
            Box(Modifier.size(62.dp), contentAlignment = Alignment.BottomCenter) { StageOwnMascot(62.dp) }
            Box(Modifier.weight(1f).padding(bottom = 10.dp), contentAlignment = Alignment.Center) {
                BubbleText(title, HeadlinePalette.LEADERBOARD, maxSize = 30, minSize = 20)
            }
            if (hostRes != 0) {
                Image(
                    painterResource(hostRes), null,
                    Modifier.size(66.dp).graphicsLayer { scaleX = -1f },
                    contentScale = ContentScale.Fit,
                )
            } else Box(Modifier.size(66.dp))
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
        color = if (WTheme.isDark) WTheme.textSecondary else LB_LABEL, maxLines = 1, overflow = TextOverflow.Ellipsis,
    )
}

/** The compact "Your board" pill (`art_lb_btn_yourboard`, label drawn live) = today's VIEW BOARD. */
@Composable
internal fun YourBoardPill(onClick: () -> Unit, label: String = "Your board") {
    Box(
        Modifier.size(width = 112.dp, height = 36.dp)
            .clickable(interactionSource = remember { MutableInteractionSource() }, indication = null, role = Role.Button, onClickLabel = label, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Image(painterResource(R.drawable.art_lb_btn_yourboard), null, Modifier.fillMaxWidth(), contentScale = ContentScale.FillWidth)
        Text(
            label.uppercase(), fontSize = 11.5.sp, fontWeight = FontWeight.Black, letterSpacing = 0.3.sp,
            color = Color(0xFF4C1D95), maxLines = 1, overflow = TextOverflow.Ellipsis,
            modifier = Modifier.padding(start = 30.dp, end = 8.dp),
        )
    }
}

/**
 * The stage's base: the "Yesterday" ledge art with yesterday's top three as small mascots on its steps; tap to expand
 * the full list in place ([expanded]). [minis] are the podium spots (any order; matched by place).
 */
@Composable
internal fun StageYesterdayLedge(
    minis: List<BoardPodiumSpot>,
    open: Boolean,
    loading: Boolean,
    onToggle: () -> Unit,
    share: @Composable () -> Unit,
    expanded: @Composable () -> Unit,
) {
    Column(Modifier.fillMaxWidth().padding(start = 12.dp, end = 12.dp, bottom = 8.dp)) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
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
            if (open) share()
        }
        BoxWithConstraints(
            Modifier.fillMaxWidth().clickable(interactionSource = remember { MutableInteractionSource() }, indication = null, role = Role.Button, onClick = onToggle),
            contentAlignment = Alignment.TopCenter,
        ) {
            val w = if (maxWidth > 394.dp) 394.dp else maxWidth
            val h = w * 160f / 394f
            Box(Modifier.width(w).height(h)) {
                Image(painterResource(R.drawable.art_lb_ledge), null, Modifier.fillMaxWidth(), contentScale = ContentScale.FillWidth)
                if (!loading) {
                    val fig = w * LeaderboardStage.LEDGE_FIGURE_FRACTION
                    LeaderboardStage.LEDGE_STEPS.forEach { step ->
                        val s = minis.firstOrNull { it.place == step.place } ?: return@forEach
                        Box(
                            Modifier.size(fig).offset(x = w * step.x - fig / 2, y = h * step.top - fig * 0.88f),
                            contentAlignment = Alignment.BottomCenter,
                        ) {
                            PlayerAvatar(
                                s.username ?: s.name, fig, Modifier, userId = s.userId, avatarUrl = s.avatarUrl, config = s.config,
                                castId = s.castId, frame = s.frame, accentHex = s.accentHex, podiumPlace = s.place,
                            )
                        }
                    }
                    if (minis.isEmpty()) {
                        Text(
                            "No results from yesterday", fontSize = 11.5.sp, fontWeight = FontWeight.ExtraBold, color = lbSubInk(),
                            modifier = Modifier.align(Alignment.TopCenter).padding(top = h * 0.28f),
                        )
                    }
                }
            }
        }
        if (open) expanded()
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
                YourBoardPill(onClick = { GameMotion.arm("lb:play"); onPlay(gm) })
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
