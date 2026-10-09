package com.wordocious.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.data.AuthService
import com.wordocious.app.data.FlagsService
import com.wordocious.app.data.InviteService
import com.wordocious.app.data.SettingsPref
import com.wordocious.app.data.VsChallengeService
import com.wordocious.app.ui.vs.VsInk
import com.wordocious.app.ui.vs.VsTeal
import com.wordocious.app.ui.vs.vsModeName
import com.wordocious.core.BrandedInvite
import com.wordocious.core.GameMode
import com.wordocious.core.InviteRowItem
import com.wordocious.core.InvitesRowRules
import kotlinx.coroutines.launch

/**
 * The Invites row (FRIDAY-QUEUE 9f): everything waiting on you in one place: live VS invites sent to you
 * and race-my-run challenges, newest first, each with the sender's mascot, "Johnny challenges you to
 * CLASSIC", the run to beat, and family Accept / Decline. Renders nothing when there are none or when
 * `branded_invites` is off. Self-contained: the VS lobby and the Friends tab each place
 * `InvitesRow(onAccept = ...)` and handle the tap (live → the private match, race → the race flow).
 * Compact, symmetric, no bordered box (a soft wash only). Mirrors web components/invites/invites-row.tsx.
 */
@Composable
fun InvitesRow(onAccept: (InviteRowItem) -> Unit, modifier: Modifier = Modifier, shown: Int = 3) {
    val flags by FlagsService.flags.collectAsState()
    val profile by AuthService.profile.collectAsState()
    var rows by remember { mutableStateOf<List<InviteRowItem>>(emptyList()) }
    val scope = rememberCoroutineScope()

    LaunchedEffect(profile?.id) {
        val uid = profile?.id ?: run { rows = emptyList(); return@LaunchedEffect }
        val live = InviteService.fetchPendingInvitesForUser(uid)
        val races = VsChallengeService.list()?.incoming.orEmpty()
        val names = InviteService.lookupInviterUsernames(live.map { it.inviterId })
        val items = live.map { l ->
            InviteRowItem(
                InviteRowItem.Variant.LIVE, l.inviteCode, l.gameMode, names[l.inviterId] ?: "A friend", l.inviterId,
                inviteId = l.id, createdAtMs = runCatching { java.time.OffsetDateTime.parse(l.createdAt).toInstant().toEpochMilli() }.getOrDefault(0L),
            )
        } + races.map { c ->
            InviteRowItem(
                InviteRowItem.Variant.RACE, c.code, c.gameMode, c.challenger.username, c.challenger.id,
                raceLine = InvitesRowRules.raceLine(c.run.solved, c.run.guesses, c.run.timeMs),
                createdAtMs = runCatching { java.time.OffsetDateTime.parse(c.createdAt).toInstant().toEpochMilli() }.getOrDefault(0L),
            )
        }
        rows = InvitesRowRules.build(items, dismissed())
    }

    if (!FlagsService.isLive(BrandedInvite.SWITCH_KEY, flags) || rows.isEmpty()) return
    Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(
            if (rows.size > shown) "INVITES · ${rows.size}" else "INVITES",
            fontSize = 11.sp, fontWeight = FontWeight.Black, letterSpacing = 0.8.sp, color = VsTeal.sub, modifier = Modifier.padding(horizontal = 4.dp),
        )
        rows.take(shown).forEach { r ->
            val mode = runCatching { GameMode.valueOf(r.gameMode) }.getOrDefault(GameMode.DUEL)
            Row(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(Color(0xFF8B5CF6).copy(alpha = 0.10f)).padding(horizontal = 12.dp, vertical = 9.dp),
                verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                PlayerAvatar(r.sender, 38.dp, userId = r.senderId, contentDescription = r.sender)
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text(
                        "@${r.sender} challenges you to ${vsModeName(mode)}", fontSize = 13.sp, fontWeight = FontWeight.Black,
                        color = VsInk.heading, maxLines = 2, overflow = TextOverflow.Ellipsis,
                    )
                    Text(
                        if (r.variant == InviteRowItem.Variant.RACE) "Beat: ${r.raceLine ?: "a run to beat"}" else "Live match",
                        fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, color = VsTeal.sub, maxLines = 1, overflow = TextOverflow.Ellipsis,
                    )
                }
                CandyButton(
                    "DECLINE", onClick = {
                        if (r.variant == InviteRowItem.Variant.LIVE && r.inviteId != null) scope.launch { InviteService.markInviteDeclined(r.inviteId!!) }
                        else SettingsPref.set(InvitesRowRules.DISMISSED_KEY, (dismissed() + r.code).distinct().takeLast(50).joinToString(","))
                        rows = rows.filterNot { it.key == r.key }
                    },
                    color = CandyColor.PEACH, size = CandySize.SMALL, contentDescription = "Decline @${r.sender}'s invite",
                )
                CandyButton(
                    "ACCEPT", onClick = { onAccept(r) }, color = CandyColor.TEAL, size = CandySize.SMALL,
                    contentDescription = "Accept @${r.sender}'s invite and play",
                )
            }
        }
    }
}

private fun dismissed(): List<String> =
    SettingsPref.get(InvitesRowRules.DISMISSED_KEY, "").split(',').filter { it.isNotBlank() }
