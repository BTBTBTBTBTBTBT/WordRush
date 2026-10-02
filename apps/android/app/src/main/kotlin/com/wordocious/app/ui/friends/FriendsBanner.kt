package com.wordocious.app.ui.friends

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import com.wordocious.app.data.FriendsService
import com.wordocious.app.ui.BANNER_HOST_CLEAR
import com.wordocious.app.ui.BANNER_HOST_PEEK
import com.wordocious.app.ui.BannerHost
import com.wordocious.app.ui.CappedFontScale
import com.wordocious.app.ui.Mascot
import com.wordocious.app.ui.Mascots
import com.wordocious.app.ui.LocalTabHidden
import com.wordocious.app.ui.RaceRow
import com.wordocious.app.ui.awaitShown
import com.wordocious.app.ui.bannerShimmer
import com.wordocious.app.ui.clickableNoRipple
import com.wordocious.app.ui.racePts
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.core.FriendsBannerInput
import com.wordocious.core.friendsBannerClockLine
import com.wordocious.core.friendsBannerHeadline
import kotlinx.coroutines.delay

/** The best live friend streak for the TODAY'S RACE row ("DOUG 12 DAYS"). */
data class BestFriendStreak(val name: String, val days: Int)

/** The banner's inputs from today's race rows (the same numbers Today's Race uses). */
fun friendsBannerInput(friendCount: Int, online: List<String>, rows: List<RaceRow>): FriendsBannerInput {
    val me = rows.firstOrNull { it.me }
    val leader = rows.firstOrNull()
    // The person right behind me: the best score among friends at or under mine (web bannerModel).
    val behind = rows.filter { !it.me && it.points <= (me?.points ?: 0) }.maxOfOrNull { it.points }
    return FriendsBannerInput(
        friendCount = friendCount,
        online = online,
        myRank = me?.rank ?: 1,
        myPoints = me?.points ?: 0,
        leaderName = if (leader?.me == true) "You" else leader?.username ?: "",
        leaderPoints = leader?.points ?: 0,
        nextPoints = behind ?: 0,
    )
}

/**
 * The Friends banner (Friends overhaul §2.2, board AD): one window like the
 * home and VS banners — a frosted strip with the core headline and the clock
 * line, an ON NOW row (faces of friends on now, or who was here last) and a
 * TODAY'S RACE row (top three chips + the best friend streak). Pink-to-lavender,
 * one shimmer while anyone is on. Words come from core FriendlyGames.kt.
 */
@Composable
fun FriendsBannerView(
    friends: List<FriendsService.FriendProfile>,
    rows: List<RaceRow>,
    nowMs: Long,
    onFace: (FriendsService.FriendProfile) -> Unit,
    onRace: () -> Unit,
) {
    // On now, the freshest heartbeat first.
    val online = friends.filter { it.isOnline(nowMs) }
        .sortedWith(compareByDescending<FriendsService.FriendProfile> { it.lastSeenMs ?: 0L }.thenBy { it.username })
    val input = friendsBannerInput(friends.size, online.map { it.username }, rows)
    val hidden = LocalTabHidden.current
    val clock by produceState(localMidnightClock()) {
        while (true) { delay(1_000); hidden.awaitShown(); value = localMidnightClock() }
    }
    val headline = friendsBannerHeadline(input)
    val clockLine = friendsBannerClockLine(input, clock)
    val shimmer = online.isNotEmpty() && !WTheme.reducedMotion
    val shape = RoundedCornerShape(16.dp)
    val best = friends.mapNotNull { f -> (f.friendStreak ?: 0).takeIf { it > 0 }?.let { BestFriendStreak(f.username, it) } }
        .maxByOrNull { it.days }

    CappedFontScale {
        // The host (O1, the cheerleader: MASCOT_SPEC §1–§2) peeks over the strip's top edge.
        Box(Modifier.fillMaxWidth().padding(top = BANNER_HOST_PEEK)) {
        Column(
            Modifier.fillMaxWidth()
                .friendsBannerGlow()
                .clip(shape)
                .drawBehind {
                    drawRect(Brush.verticalGradient(listOf(Color(0xFFFCE7F3), Color(0xFFEDE9FE))))
                    drawRect(Brush.linearGradient(
                        0f to Color.White.copy(alpha = 0.35f), 0.55f to Color.White.copy(alpha = 0f),
                        start = Offset.Zero, end = Offset(size.width, size.height),
                    ))
                }
                .then(if (shimmer) Modifier.bannerShimmer() else Modifier),
        ) {
            // Frosted strip
            Column(
                Modifier.fillMaxWidth().background(Color.White.copy(alpha = 0.5f))
                    .padding(start = 12.dp, top = 12.dp, end = 10.dp, bottom = 10.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                // Larger and glowing (founder 2026-10-01): 22 sp / 900 with a soft pink glow.
                Text(
                    headline, fontSize = 22.sp, fontWeight = FontWeight.Black, letterSpacing = 0.4.sp, lineHeight = 1.15.em,
                    color = FriendsPink.ink, maxLines = 2, modifier = Modifier.heightIn(min = 26.dp).padding(end = BANNER_HOST_CLEAR - 2.dp),
                    style = androidx.compose.ui.text.TextStyle(
                        shadow = androidx.compose.ui.graphics.Shadow(Color(0x8CDB2777), Offset.Zero, blurRadius = 16f),
                    ),
                )
                Text(clockLine, fontSize = 10.5.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = 0.4.sp, color = FriendsPink.mid)
            }
            // ON NOW
            Column(
                Modifier.fillMaxWidth().padding(start = 12.dp, end = 12.dp, top = 10.dp, bottom = 6.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("ON NOW", fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 1.sp, color = FriendsPink.mid)
                    if (online.isNotEmpty()) {
                        Text("${online.size}", fontSize = 10.sp, fontWeight = FontWeight.Black, color = FriendsPink.green)
                    }
                }
                if (online.isEmpty()) {
                    Text(
                        nobodyOnLine(friends, nowMs), fontSize = 11.sp, fontWeight = FontWeight.Bold,
                        color = FriendsPink.sub, maxLines = 1, overflow = TextOverflow.Ellipsis,
                    )
                } else {
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        online.take(5).forEach { f ->
                            Column(
                                Modifier.width(52.dp).clickableNoRipple { onFace(f) },
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.spacedBy(3.dp),
                            ) {
                                FriendFace(f.username, f.avatarUrl, f.avatarEmoji, 40.dp, online = true)
                                Text(
                                    f.username, fontSize = 10.sp, fontWeight = FontWeight.Black, color = FriendsPink.ink,
                                    maxLines = 1, overflow = TextOverflow.Ellipsis, textAlign = TextAlign.Center,
                                )
                                Text(
                                    f.activity?.let { "in $it" } ?: "on now", fontSize = 9.sp, fontWeight = FontWeight.Bold,
                                    color = FriendsPink.green, maxLines = 1, overflow = TextOverflow.Ellipsis, textAlign = TextAlign.Center,
                                )
                            }
                        }
                    }
                }
            }
            // TODAY'S RACE
            Column(
                Modifier.fillMaxWidth().clickableNoRipple(onRace).padding(start = 12.dp, end = 12.dp, top = 6.dp, bottom = 12.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("TODAY’S RACE", fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 1.sp, color = FriendsPink.mid)
                    Spacer(Modifier.weight(1f))
                    best?.let { FlameCount("${it.name.uppercase()} ${it.days} ${if (it.days == 1) "DAY" else "DAYS"}") }
                }
                if (rows.size <= 1) {
                    // I's voice (MASCOT_SPEC §6).
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        Mascot(Mascots.addFriends, 24.dp)
                        Text(Mascots.addFriendLine, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = FriendsPink.sub)
                    }
                } else {
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        raceChips(rows).forEach { r -> RaceChip(r, Modifier.weight(1f)) }
                    }
                }
            }
        }
        BannerHost(Mascots.friends, Modifier.align(Alignment.TopEnd))
        }
    }
}

@Composable
private fun RaceChip(r: RaceRow, modifier: Modifier) {
    val shape = RoundedCornerShape(10.dp)
    val medal = when (r.rank) { 1 -> Color(0xFFF59E0B); 2 -> Color(0xFF9CA3AF); 3 -> Color(0xFFB45309); else -> Color(0xFFCBD5E1) }
    Row(
        modifier.clip(shape).background(Color.White.copy(alpha = 0.85f))
            .then(if (r.me) Modifier.border(2.dp, FriendsPink.solid, shape) else Modifier)
            .padding(horizontal = 6.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp),
    ) {
        Box(Modifier.size(18.dp).clip(CircleShape).background(medal), Alignment.Center) {
            Text("${r.rank}", fontSize = 10.sp, fontWeight = FontWeight.Black, color = Color.White)
        }
        Column(Modifier.weight(1f)) {
            Text(
                if (r.me) "YOU" else r.username.uppercase(), fontSize = 10.sp, fontWeight = FontWeight.Black,
                color = FriendsPink.ink, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.widthIn(max = 90.dp),
            )
            Text(racePts(r.points), fontSize = 10.sp, fontWeight = FontWeight.Bold, color = FriendsPink.mid, maxLines = 1)
        }
    }
}

/** The banner's three race chips: the top three, with you swapped in for third when you're lower. */
fun raceChips(rows: List<RaceRow>): List<RaceRow> {
    val top = rows.take(3)
    if (top.any { it.me }) return top
    val me = rows.firstOrNull { it.me }
    return if (me != null && top.size == 3) listOf(top[0], top[1], me) else top
}

/** "Nobody's on right now · Doug was here 12 min ago" (the most recent presence) or "Nobody's on right now". */
fun nobodyOnLine(friends: List<FriendsService.FriendProfile>, nowMs: Long): String {
    val last = friends.mapNotNull { f -> f.lastSeenMs?.takeIf { it <= nowMs }?.let { f to it } }.maxByOrNull { it.second }
        ?: return "Nobody's on right now"
    val m = (nowMs - last.second) / 60_000L
    val ago = when {
        m < 60 -> "${maxOf(1L, m)} min ago"
        m < 60 * 24 -> "${m / 60} h ago"
        else -> return "Nobody's on right now"
    }
    return "Nobody's on right now · ${last.first.username} was here $ago"
}

/** The home banner's soft violet shadow (0 4px 14px rgba(76,29,149,0.08)). */
private fun Modifier.friendsBannerGlow(): Modifier = drawBehind {
    val blur = 14.dp.toPx()
    val dy = 4.dp.toPx()
    val r = 16.dp.toPx()
    drawIntoCanvas { canvas ->
        val paint = android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG).apply {
            color = Color(0xFF4C1D95).copy(alpha = 0.08f).toArgb()
            maskFilter = android.graphics.BlurMaskFilter(blur / 2f, android.graphics.BlurMaskFilter.Blur.NORMAL)
        }
        canvas.nativeCanvas.drawRoundRect(0f, dy, size.width, size.height + dy, r, r, paint)
    }
}
