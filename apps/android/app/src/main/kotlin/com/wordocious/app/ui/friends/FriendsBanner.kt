package com.wordocious.app.ui.friends

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import com.wordocious.app.data.FriendsService
import com.wordocious.app.ui.CappedFontScale
import com.wordocious.app.ui.CastPose
import com.wordocious.app.ui.FinishInk
import com.wordocious.app.ui.LocalTabHidden
import com.wordocious.app.ui.Mascot
import com.wordocious.app.ui.MascotId
import com.wordocious.app.ui.Mascots
import com.wordocious.app.ui.PodiumInk
import com.wordocious.app.ui.RaceRow
import com.wordocious.app.ui.awaitShown
import com.wordocious.app.ui.bannerShimmer
import com.wordocious.app.ui.racePts
import com.wordocious.app.ui.softNumberStyle
import com.wordocious.app.ui.squishClickable
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.core.FriendsBannerInput
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
 * The Friends banner (Friends overhaul §2.2 → FINISH_SPEC C4, stats-friends-polish
 * mockup): a pink-tinted card (#fff0f7 / #ffd3e7) with a pink → gold top bar and O1
 * cheering on the right — the core headline ("OLIVER LEADS TODAY'S RACE") and the
 * clock line, ON NOW (online friends as letter tiles with a green dot, or who was here
 * last) and TODAY'S RACE (the top three as medal-colored chips with soft numbers + the
 * best friend streak). One shimmer while anyone is on. Words come from core
 * FriendlyGames.kt. Fixed light, like the Friends page.
 */
@Composable
fun FriendsBannerView(
    friends: List<FriendsService.FriendProfile>,
    rows: List<RaceRow>,
    nowMs: Long,
    onRace: () -> Unit,
) {
    // On now, the freshest heartbeat first.
    val online = friends.filter { it.isOnline(nowMs) }
        .sortedWith(compareByDescending<FriendsService.FriendProfile> { it.lastSeenMs ?: 0L }.thenBy { it.username })
    // 2.8 wave 3 (9e): ON NOW folded into the friend cards (green dot + "playing Classic"), so the headline is the race only.
    val input = friendsBannerInput(friends.size, emptyList(), rows)
    val hidden = LocalTabHidden.current
    val clock by produceState(localMidnightClock()) {
        while (true) { delay(1_000); hidden.awaitShown(); value = localMidnightClock() }
    }
    val headline = friendsBannerHeadline(input)
    val shimmer = online.isNotEmpty() && !WTheme.reducedMotion
    val shape = RoundedCornerShape(20.dp)
    val best = friends.mapNotNull { f -> (f.friendStreak ?: 0).takeIf { it > 0 }?.let { BestFriendStreak(f.username, it) } }
        .maxByOrNull { it.days }

    CappedFontScale {
        Box(
            Modifier.fillMaxWidth()
                .shadow(6.dp, shape, clip = false, ambientColor = FinishInk.cardShadow, spotColor = FinishInk.cardShadow)
                .clip(shape)
                .background(BANNER_TINT)
                .then(if (shimmer) Modifier.bannerShimmer() else Modifier)
                .border(1.5.dp, BANNER_LINE, shape),
        ) {
            Column(Modifier.fillMaxWidth()) {
                // The pink → gold top bar.
                Box(Modifier.fillMaxWidth().height(6.dp).background(Brush.horizontalGradient(listOf(Color(0xFFEC4899), Color(0xFFF59E0B)))))
                // BJ7: the banner hugs its rows (8 between, 10 / 12 padding, a smaller host).
                Column(
                    Modifier.fillMaxWidth().padding(start = 12.dp, end = 12.dp, top = 10.dp, bottom = 12.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        // AR: the live lettering (pink → orange, names in the accent, gold numbers).
                        com.wordocious.app.ui.BubbleText(
                            headline, com.wordocious.app.ui.HeadlinePalette.FRIENDS,
                            Modifier.heightIn(min = 24.dp).padding(end = 68.dp),
                            names = friends.map { it.username },
                            maxSize = 20, minSize = 14, align = androidx.compose.ui.text.style.TextAlign.Start,
                        )
                    }
                    // TODAY'S RACE (the whole row opens the full race)
                    Column(
                        Modifier.fillMaxWidth().squishClickable(label = "Today's race, see everyone", onClick = onRace),
                        verticalArrangement = Arrangement.spacedBy(6.dp),
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            FriendsLabel("TODAY’S RACE", color = BANNER_INK)
                            // The countdown, small, in the header (the race is told once: the pills below).
                            if (friends.isNotEmpty()) {
                                Text(
                                    "ends in $clock", fontSize = 10.sp, fontWeight = FontWeight.ExtraBold, color = BANNER_FACES,
                                    maxLines = 1, modifier = Modifier.padding(start = 8.dp),
                                )
                            }
                            Spacer(Modifier.weight(1f))
                            best?.let { FlameCount("${it.name.uppercase()} ${it.days} ${if (it.days == 1) "DAY" else "DAYS"}") }
                        }
                        if (rows.size <= 1) {
                            // I's voice (MASCOT_SPEC §6).
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                Mascot(Mascots.addFriends, 24.dp)
                                Text(Mascots.addFriendLine, fontSize = 12.sp, fontWeight = FontWeight.ExtraBold, color = BANNER_FACES)
                            }
                        } else {
                            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                raceChips(rows).forEach { r -> RaceChip(r, Modifier.weight(1f)) }
                            }
                        }
                    }
                }
            }
            // The host: O1, the cheerleader, cheering on the right (decorative).
            CastPose(MascotId.O1, "cheer", 66.dp, Modifier.align(Alignment.TopEnd).padding(top = 8.dp, end = 8.dp))
        }
    }
}

/** The banner's card inks (stats-friends-polish `.banner`). */
// A dark season (iOS FriendsInk parity): the night glass and the light twins of the banner inks.
private val night: Boolean get() = com.wordocious.app.ui.vs.vsDarkSeason
private val BANNER_TINT: Color get() = if (night) com.wordocious.app.ui.theme.WTheme.season?.cardFill ?: Color(0xEB1C0F30) else Color(0xFFFFF0F7)
private val BANNER_LINE: Color get() = if (night) Color.Transparent else Color(0xFFFFD3E7)
private val BANNER_HEAD: Color get() = if (night) Color(0xFFFBCFE8) else Color(0xFF7A1F55)
private val BANNER_INK: Color get() = if (night) Color(0xFFF9A8D4) else Color(0xFFB0306F)
private val BANNER_FACES: Color get() = if (night) Color(0xFFF5D0FE) else Color(0xFF8A4A6E)

/** "Doug is in Gauntlet" / "Doug is on now" (+ "+2 more") beside the ON NOW faces. */
internal fun onNowLine(online: List<FriendsService.FriendProfile>): String {
    val f = online.firstOrNull() ?: return ""
    val lead = f.activity?.let { "${f.username} is in $it" } ?: "${f.username} is on now"
    val more = online.size - 1
    return if (more > 0) "$lead · +$more more" else lead
}

/** A TODAY'S RACE chip: the rank on a medal-colored disc, the name and the soft points, on its medal's tint. */
@Composable
private fun RaceChip(r: RaceRow, modifier: Modifier) {
    val shape = RoundedCornerShape(50)
    val medal = if (r.rank in 1..3) PodiumInk.medal(r.rank) else Color(0xFF7C3AED)
    Row(
        modifier.clip(shape).background(friendsWash(medal, 0.16f))
            .border(if (r.me) 2.dp else 1.5.dp, if (r.me) Color(0xFF7C3AED) else friendsLine(medal, 0.4f), shape)
            .padding(start = 4.dp, end = 10.dp, top = 4.dp, bottom = 4.dp)
            .semantics(mergeDescendants = true) { },
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Box(Modifier.size(22.dp).clip(CircleShape).background(medal), Alignment.Center) {
            Text("${r.rank}", fontSize = 11.sp, fontWeight = FontWeight.Black, color = Color.White, maxLines = 1)
        }
        Column(Modifier.weight(1f)) {
            Text(
                if (r.me) "YOU" else r.username.uppercase(), fontSize = 10.sp, fontWeight = FontWeight.Black,
                color = if (night) Color(0xFFFBCFE8) else Color(0xFF5A2342), maxLines = 1, overflow = TextOverflow.Ellipsis,
            )
            Text(racePts(r.points), style = softNumberStyle(13.sp, com.wordocious.app.ui.vs.VsInk.softNumber), maxLines = 1)
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

