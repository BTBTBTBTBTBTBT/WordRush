package com.wordocious.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Flag
import androidx.compose.material.icons.outlined.Notifications
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.ModeGen
import com.wordocious.app.R
import com.wordocious.app.data.FriendsService
import com.wordocious.app.ui.theme.Nunito
import com.wordocious.app.ui.theme.WTheme

// TODAY'S RACE (§289, Friends D3.1) — the top of the FRIENDS card: you and
// every friend ranked by TODAY's daily points (the digest's todayPoints —
// composite score over every daily played today, sweep and More Games alike).
// Ties share a rank (competition ranking), then alphabetical. Every row has a
// reason to tap: Challenge (a private Classic VS Battle, pushed to the friend,
// free for friends), the bell for a friend who hasn't played, the row itself
// into the profile. Twin of web components/friends/todays-race.tsx; the
// ranking below mirrors lib/todays-race.ts and is pinned by TodaysRaceTest.

data class RaceEntrant(
    val id: String,
    val username: String,
    val points: Int,
    /** Sweep dailies played today (the "N/8" line). */
    val played: Int,
    val me: Boolean,
)

data class RaceRow(
    val id: String,
    val username: String,
    val points: Int,
    val played: Int,
    val me: Boolean,
    val rank: Int,
)

/** Points desc, ties share a rank, then alphabetical — lib/todays-race.ts rankToday. */
fun rankToday(entrants: List<RaceEntrant>): List<RaceRow> {
    val sorted = entrants.sortedWith(
        compareByDescending<RaceEntrant> { it.points }
            .thenBy(String.CASE_INSENSITIVE_ORDER) { it.username }
            .thenBy { it.username },
    )
    val out = ArrayList<RaceRow>(sorted.size)
    sorted.forEachIndexed { i, e ->
        val prev = out.getOrNull(i - 1)
        val rank = if (prev != null && prev.points == e.points) prev.rank else i + 1
        out.add(RaceRow(e.id, e.username, e.points, e.played, e.me, rank))
    }
    return out
}

/** "Leading by 340" / "120 behind Doug" / "Tied with Doug" / "Play a daily to join the race". */
fun raceStatusLine(rows: List<RaceRow>): String {
    val me = rows.firstOrNull { it.me } ?: return ""
    if (me.points == 0) return "Play a daily to join the race"
    val others = rows.filter { !it.me }
    if (others.isEmpty()) return "${racePts(me.points)} pts today"
    if (me.rank == 1) {
        val next = others.first()
        return if (next.points == me.points) "Tied with ${next.username}"
        else "Leading by ${racePts(me.points - next.points)}"
    }
    val ahead = others.filter { it.points > me.points }.minByOrNull { it.points }!!
    return "${racePts(ahead.points - me.points)} behind ${ahead.username}"
}

/** "1,504" — US-grouped points, the race surfaces' formatting. */
internal fun racePts(n: Int): String = String.format(java.util.Locale.US, "%,d", n)

private val PURPLE = Color(0xFF7C3AED)
private val PINK = Color(0xFFEC4899)

/**
 * The card body. Renders nothing without a signed-in profile or friends.
 * [challengingId] is the friend whose challenge is in flight (one at a time).
 */
@Composable
fun TodaysRaceCard(
    friends: List<FriendsService.FriendProfile>,
    meDigest: FriendsService.MeDigest?,
    challengingId: String?,
    onOpenProfile: (String) -> Unit,
    onTaunt: (FriendsService.FriendProfile) -> Unit,
    onChallenge: (FriendsService.FriendProfile) -> Unit,
) {
    val me = com.wordocious.app.data.AuthService.profile.value ?: return
    if (friends.isEmpty()) return

    val rows = rankToday(
        friends.map { RaceEntrant(it.id, it.username, it.todayPoints ?: 0, it.playedToday ?: 0, me = false) } +
            RaceEntrant(me.id, me.username ?: "You", meDigest?.todayPoints ?: 0, meDigest?.playedToday ?: 0, me = true),
    )
    val byId = friends.associateBy { it.id }
    val status = raceStatusLine(rows)
    val anyPoints = rows.any { it.points > 0 }
    val sweepSize = ModeGen.sweep.size

    Column(verticalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.fillMaxWidth()) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
            Icon(Icons.Filled.Flag, null, tint = PURPLE, modifier = Modifier.size(13.dp))
            Spacer(Modifier.width(4.dp))
            Text(
                "TODAY'S RACE", fontSize = 9.sp, fontWeight = FontWeight.Black,
                letterSpacing = 0.8.sp, color = WTheme.textMuted, fontFamily = Nunito,
            )
            Spacer(Modifier.weight(1f))
            Text(
                status, fontSize = 10.sp, fontWeight = FontWeight.Black,
                color = if (anyPoints) PURPLE else WTheme.textMuted, fontFamily = Nunito,
                maxLines = 1, overflow = TextOverflow.Ellipsis,
            )
        }
        rows.forEach { r ->
            val f = if (r.me) null else byId[r.id]
            val medal = if (anyPoints && r.points > 0) listOf("🥇", "🥈", "🥉").getOrNull(r.rank - 1) else null
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .background(if (r.me) PURPLE.copy(alpha = 0.06f) else Color.Transparent)
                    .border(1.dp, if (r.me) Color(0xFFC4B5FD) else Color.Transparent, RoundedCornerShape(12.dp))
                    .padding(horizontal = 6.dp, vertical = 5.dp),
            ) {
                Text(
                    medal ?: "${r.rank}", fontSize = 11.sp, fontWeight = FontWeight.Black,
                    color = WTheme.textMuted, fontFamily = Nunito,
                    textAlign = TextAlign.Center, modifier = Modifier.width(22.dp),
                )
                // The row opens the friend's profile; your own row goes nowhere.
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.weight(1f).let { m ->
                        if (f != null) m.clickableNoRipple { onOpenProfile(f.id) } else m
                    },
                ) {
                    FriendAvatar(
                        f ?: FriendsService.FriendProfile(
                            id = me.id, username = me.username ?: "You",
                            avatarUrl = me.avatarUrl, avatarEmoji = me.avatarEmoji, level = me.level,
                        ),
                    )
                    Column(verticalArrangement = Arrangement.spacedBy(1.dp), modifier = Modifier.weight(1f)) {
                        Text(
                            if (r.me) "You" else r.username, fontSize = 12.sp,
                            fontWeight = FontWeight.ExtraBold,
                            color = if (r.me) PURPLE else WTheme.text,
                            maxLines = 1, overflow = TextOverflow.Ellipsis,
                        )
                        Text(
                            if (r.points > 0) "${racePts(r.points)} pts · ${r.played}/$sweepSize dailies"
                            else "hasn't played today",
                            fontSize = 10.sp, fontWeight = FontWeight.Bold,
                            color = WTheme.textMuted, fontFamily = Nunito,
                            maxLines = 1, overflow = TextOverflow.Ellipsis,
                        )
                    }
                }
                if (f != null) {
                    if (r.points == 0) {
                        // The bell — the existing canned taunt picker.
                        Box(
                            Modifier.size(26.dp).clip(CircleShape).background(WTheme.surfaceHover)
                                .border(1.5.dp, WTheme.border, CircleShape)
                                .clickableNoRipple { onTaunt(f) },
                            contentAlignment = Alignment.Center,
                        ) {
                            Icon(
                                Icons.Outlined.Notifications, "Nudge ${f.username}",
                                tint = PURPLE, modifier = Modifier.size(14.dp),
                            )
                        }
                    }
                    val sending = challengingId == f.id
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp),
                        modifier = Modifier
                            .clip(RoundedCornerShape(8.dp))
                            .background(PINK.copy(alpha = 0.08f))
                            .border(1.5.dp, PINK, RoundedCornerShape(8.dp))
                            .alpha(if (challengingId != null && !sending) 0.5f else 1f)
                            .clickableNoRipple { if (challengingId == null) onChallenge(f) }
                            .padding(horizontal = 8.dp, vertical = 4.dp),
                    ) {
                        Icon(
                            painterResource(R.drawable.ic_swords), "Challenge ${f.username} to a VS Battle",
                            tint = PINK, modifier = Modifier.size(11.dp),
                        )
                        Text(
                            if (sending) "Sending…" else "Challenge", fontSize = 10.sp,
                            fontWeight = FontWeight.Black, color = PINK, fontFamily = Nunito,
                        )
                    }
                }
            }
        }
        Text(
            "Today's points across every daily · Challenge = a private Classic battle, free for friends",
            fontSize = 9.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted, fontFamily = Nunito,
            textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth().padding(top = 2.dp),
        )
    }
}
