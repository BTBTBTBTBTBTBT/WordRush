package com.wordocious.app.ui

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.R
import com.wordocious.app.data.AvatarFields
import com.wordocious.app.data.FriendsService
import com.wordocious.app.data.MascotConfigRules
import com.wordocious.app.data.PlayerAvatars
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.core.StatsProfile
import kotlinx.serialization.json.JsonElement

// FRIDAY-QUEUE item 17 (founder 10-07, Oliver's profile): the player's mascot full-body on a mini Stage (the Edit Profile
// podium + curtains), the name in the bubble lettering, a friendship badge + "Friends since Sep 2026" by the name (replacing
// the old FRIENDS pill), rank + XP as one compact strip, and one clear family-button action row (Challenge · Pocket game ·
// React · Add friend, or Requested / Accept–Decline) with Unfriend / Block / Report in the ⋯ menu. The state -> buttons
// rules are core StatsProfile.profileActions (same on web and iOS). Web: components/profile/profile-hero.tsx.

/** The mini Stage: backdrop + curtains + podium with the player's full-body mascot (alive while the living mascot is on), or their photo. */
@Composable
fun ProfileStageHero(
    username: String, userId: String?, avatarUrl: String?, config: JsonElement?, castId: String?, frame: String?, accentHex: String?,
    modifier: Modifier = Modifier,
    height: androidx.compose.ui.unit.Dp = 214.dp,
    mascotSize: androidx.compose.ui.unit.Dp = 132.dp,
    overlay: @Composable BoxScope.() -> Unit = {},
) {
    val row = remember(userId, username, avatarUrl, config, castId, frame, accentHex) {
        AvatarFields(userId, username, avatarUrl, config, castId, frame, accentHex, complete = true)
    }
    val resolved = PlayerAvatars.resolve(row)
    val initial = remember(username) { MascotConfigRules.initialOf(username) }
    Box(modifier.fillMaxWidth().clip(RoundedCornerShape(26.dp))) {
        DressStage(
            config = resolved.config, initial = initial, photoUrl = resolved.photoUrl,
            height = height, mascotSize = mascotSize, curtains = true, overlay = overlay,
        )
    }
}

/** The friendship badge (art_pf_friendship_badge) beside the name. */
@Composable
fun FriendshipBadgeView(size: androidx.compose.ui.unit.Dp = 30.dp) {
    Image(
        androidx.compose.ui.res.painterResource(R.drawable.art_pf_friendship_badge), contentDescription = "Friends",
        modifier = Modifier.size(size), contentScale = ContentScale.Fit,
    )
}

/** The identity block under the stage: the name in the bubble lettering (+ friendship badge) and "Friends since". */
@Composable
fun ProfileIdentityBlock(
    username: String, accentHex: String?, isFriend: Boolean, friendsSince: String?,
    userId: String? = null, avatarUrl: String? = null, config: JsonElement? = null, castId: String? = null, frame: String? = null,
) {
    // Founder 10-09: the name wears the player's mascot-maker backdrop color (lemon becomes a sunny gold), like their name on
    // the friend menu; no backdrop picked gives the vivid color from their body, unless they chose a custom accent.
    val row = remember(userId, username, avatarUrl, config, castId, frame, accentHex) {
        AvatarFields(userId, username, avatarUrl, config, castId, frame, accentHex, complete = true)
    }
    val cfg = PlayerAvatars.resolve(row).config
    val palette = if (com.wordocious.core.avatarBackdrop(cfg.bg) != null || !ProfileAccent.isCustom(accentHex)) {
        ThemeKit.accentPalette(coreHexColor(com.wordocious.core.PlayerTint.nameHex(cfg)))
    } else ThemeKit.accentPalette(ProfileAccent.color(accentHex))
    Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            BubbleText(username.uppercase(), palette, Modifier.widthIn(max = 320.dp), maxSize = 38, minSize = 20, animated = false)
            if (isFriend) FriendshipBadgeView()
        }
        if (isFriend) {
            Text(
                StatsProfile.friendsSinceLine(friendsSince) ?: "Friends",
                fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, color = if (WTheme.isDark) WTheme.textMuted else FinishInk.muted,
            )
        }
    }
}

/** Rank + XP as ONE compact strip: the tier level badge, a thin XP bar, "N XP to next". */
@Composable
fun ProfileRankStrip(level: Int, xp: Int) {
    val into = xp % 1000
    Row(
        Modifier.fillMaxWidth().widthIn(max = 320.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp, Alignment.CenterHorizontally),
    ) {
        Box(Modifier.tintedPill(Color(0xFF7C3AED), 50.dp).padding(horizontal = 12.dp, vertical = 4.dp)) {
            LevelBadge(level, 30.dp, prefix = "Lvl", showTier = true)
        }
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Box(Modifier.fillMaxWidth().height(8.dp).clip(RoundedCornerShape(50)).background(Color(0xFF7C3AED).copy(alpha = if (WTheme.isDark) 0.25f else 0.14f))) {
                Box(
                    Modifier.fillMaxWidth(into / 1000f).height(8.dp).clip(RoundedCornerShape(50))
                        .background(Brush.horizontalGradient(listOf(Color(0xFFA855F7), Color(0xFFEC4899)))),
                )
            }
            Text("${1000 - into} XP to next", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
        }
    }
}

/** The action row: family buttons by friendship state (core profileActions). The ⋯ menu stays in the page's top row. */
@Composable
fun ProfileActionRow(
    state: StatsProfile.FriendshipState, busy: Boolean,
    onChallenge: () -> Unit, onPocket: () -> Unit, onReact: () -> Unit, onAddFriend: () -> Unit,
    onCancelRequest: () -> Unit, onAccept: () -> Unit, onDecline: () -> Unit,
) {
    val acts = StatsProfile.profileActions(state)
    if (acts.row.isEmpty()) return
    CastButtonRow(Modifier.fillMaxWidth(), controlHeight = CandySize.SMALL.height) {
        acts.row.forEach { a ->
            val (text, color) = when (a) {
                StatsProfile.ProfileAction.CHALLENGE -> "Challenge" to CandyColor.PINK
                StatsProfile.ProfileAction.POCKET -> "Pocket game" to CandyColor.TEAL
                StatsProfile.ProfileAction.REACT -> "React" to CandyColor.AMBER
                StatsProfile.ProfileAction.ADD_FRIEND -> "Add friend" to CandyColor.PURPLE
                StatsProfile.ProfileAction.REQUESTED -> "Requested" to CandyColor.PEACH
                StatsProfile.ProfileAction.ACCEPT -> "Accept" to CandyColor.PURPLE
                StatsProfile.ProfileAction.DECLINE -> "Decline" to CandyColor.PEACH
            }
            CandyButton(
                text, onClick = {
                    when (a) {
                        StatsProfile.ProfileAction.CHALLENGE -> onChallenge()
                        StatsProfile.ProfileAction.POCKET -> onPocket()
                        StatsProfile.ProfileAction.REACT -> onReact()
                        StatsProfile.ProfileAction.ADD_FRIEND -> onAddFriend()
                        StatsProfile.ProfileAction.REQUESTED -> onCancelRequest()
                        StatsProfile.ProfileAction.ACCEPT -> onAccept()
                        StatsProfile.ProfileAction.DECLINE -> onDecline()
                    }
                },
                color = color, size = CandySize.SMALL, enabled = !busy,
            )
        }
    }
}

/**
 * HEAD TO HEAD (item 17): your record against this player — VS plus pocket games, the same numbers as the Stats page's HEAD TO
 * HEAD rows — one line over a two-color record bar. Friends only (the data is friend-scoped).
 */
@Composable
fun ProfileHeadToHeadStrip(friend: FriendsService.FriendProfile, name: String) {
    var records by remember { mutableStateOf(PocketRecordsService.cached) }
    LaunchedEffect(friend.id) { PocketRecordsService.fetch()?.let { records = it } }
    val vs = StatsProfile.PocketRecord(friend.h2hW ?: 0, friend.h2hL ?: 0)
    val pocket = records?.byFriend?.get(friend.id)?.total ?: StatsProfile.PocketRecord()
    val wins = vs.wins + pocket.wins
    val losses = vs.losses + pocket.losses
    if (wins + losses + pocket.draws == 0) return
    KitCard(accent = coreHexColor(StatsProfile.CAST_D)) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            BubbleText(
                "HEAD TO HEAD", ThemeKit.accentPalette(coreHexColor(StatsProfile.CAST_D)), Modifier.widthIn(max = 240.dp).weight(1f),
                maxSize = 20, minSize = 13, align = TextAlign.Start,
            )
            SoftNumber("$wins–$losses", 20.sp)
        }
        androidx.compose.foundation.layout.Spacer(Modifier.height(6.dp))
        RecordBar(wins, losses, height = 9.dp)
        Text(
            "${StatsProfile.headToHeadLine(vs, pocket)} · you vs $name",
            fontSize = 10.5.sp, fontWeight = FontWeight.ExtraBold, color = if (WTheme.isDark) WTheme.textMuted else FinishInk.muted,
            modifier = Modifier.padding(top = 6.dp).fillMaxWidth(), textAlign = TextAlign.Center,
        )
    }
}
