package com.wordocious.app.ui

import android.content.Intent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.data.AuthService
import com.wordocious.app.data.ReferralService
import com.wordocious.app.data.ShareEvents
import com.wordocious.app.ui.theme.Nunito
import kotlinx.coroutines.launch

// "GIFT A WEEK OF PRO" (FINISH_SPEC T4) — Android port of the web invite panel /
// iOS InvitePanelView. Placement: the Friends tab, under Add a friend (a fixed-light
// page, so the pieces take their fixed-light washes + inks).
@Composable
fun InvitePanel() {
    // Gifting Pro is a Pro benefit — a free account must never see this panel.
    // isProActive is false while the launch profile fetch is in flight, so the
    // panel appears for subscribers rather than flashing for everyone. The
    // authoritative gate is server-side in /api/referrals/create; returning
    // early here also skips the two network reads below for free users.
    // Collected rather than read bare so the panel appears on its own when the
    // profile lands, instead of depending on the parent to recompose us.
    val proProfile by AuthService.profile.collectAsState()
    if (proProfile == null || !AuthService.isProActive) return

    var invites by remember { mutableStateOf<List<ReferralService.ReferralRow>>(emptyList()) }
    // §251: invitee_id → username for the settled rows.
    var inviteeNames by remember { mutableStateOf<Map<String, String>>(emptyMap()) }
    var leaders by remember { mutableStateOf<List<ReferralService.Leader>>(emptyList()) }
    var creating by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var cancelTarget by remember { mutableStateOf<ReferralService.ReferralRow?>(null) }
    var reload by remember { mutableStateOf(0) }
    val scope = rememberCoroutineScope()
    val context = LocalContext.current

    LaunchedEffect(reload) {
        invites = ReferralService.myInvites()
        // §251 (founder's sister: "what friends correspond to those invites").
        inviteeNames = ReferralService.inviteeNames(invites.mapNotNull { it.inviteeId }.distinct())
        leaders = ReferralService.leaderboard()
    }

    fun expiryMs(row: ReferralService.ReferralRow): Long =
        runCatching { java.time.OffsetDateTime.parse(row.expiresAt).toInstant().toEpochMilli() }
            .recoverCatching { java.time.Instant.parse(row.expiresAt).toEpochMilli() }
            .getOrDefault(0L)

    // Dead invites (canceled / expired) disappear — web/iOS parity.
    val now = System.currentTimeMillis()
    // Dead invites disappear; settled rows ("X joined!") retire once the invite's own
    // expiry has passed — a join is news for a week, not a permanent line (founder, 2026-09-26).
    val visible = invites.filter { it.status != "revoked" && expiryMs(it) > now }
    val open = invites.count { it.status == "pending" && expiryMs(it) > now }
    val slotsLeft = InviteScreens.giftsLeft(open)

    fun share(code: String) {
        val send = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            // S4 invite copy; the link is the point, so it stays.
            putExtra(Intent.EXTRA_TEXT, com.wordocious.app.data.ShareHelper.inviteText("https://wordocious.com/join/$code"))
        }
        context.startActivity(Intent.createChooser(send, "Invite a friend"))
        ShareEvents.log("link_invite", "", "referral")
    }

    var sentCode by remember { mutableStateOf<String?>(null) }

    fun create() {
        if (creating || slotsLeft <= 0) return
        creating = true; error = null
        scope.launch {
            val (code, err) = ReferralService.createInvite()
            creating = false
            if (code != null) { reload++; sentCode = code; share(code) } else error = err ?: "Could not create an invite."
        }
    }

    // T1: after a gift goes out — I tossing the envelope, INVITE SENT!, the code on glossy
    // tiles, "Send another" (while a slot is free) and "Done" back to the gift card.
    sentCode?.let { code ->
        InviteSentCard(
            onDone = { sentCode = null },
            modifier = Modifier.fillMaxWidth(),
            code = code,
            note = "${InviteScreens.GIFT_DAYS} days of Pro are waiting for them. Share the link again from the gift card anytime.",
            onSendAnother = if (slotsLeft > 0) ({ sentCode = null; create() }) else null,
            sendAnotherEnabled = !creating,
            light = true,
        )
        return
    }

    // T4 "GIFT A WEEK OF PRO": O3 with the crowned gift box on the gold card, the soft
    // 7 DAYS badge, the gifts-left counter and the gold candy "Send a gift" (A7: the
    // Friends banner's host is O1).
    GiftProCard(
        Modifier.fillMaxWidth(),
        giftsLeft = slotsLeft,
        sendLabel = when {
            creating -> "Sending…"
            slotsLeft == 0 -> "All 3 gifts out"
            else -> "Send a gift"
        },
        onSend = { create() },
        sendEnabled = !creating && slotsLeft > 0,
        light = true,
        content = {
            Text(
                buildAnnotatedString {
                    val muted = androidx.compose.ui.text.SpanStyle(color = FinishInk.label)
                    val amber = androidx.compose.ui.text.SpanStyle(color = Color(0xFFB45309))
                    withStyle(muted) { append("Each friend gets ") }
                    withStyle(amber) { append("7 days of Pro") }
                    withStyle(muted) { append(" free. You get +3 days when they join, a ") }
                    withStyle(amber) { append("free month") }
                    withStyle(muted) { append(" if they subscribe — and ") }
                    withStyle(amber) { append("3 free months") }
                    withStyle(muted) { append(" if they go annual. 3 friends = +4 streak shields.") }
                },
                fontSize = 12.sp, fontWeight = FontWeight.Bold, fontFamily = Nunito,
            )
            if (slotsLeft == 0 && !creating) {
                Text(
                    "Slots free up when friends join.", fontSize = 11.sp, fontWeight = FontWeight.Bold, fontFamily = Nunito,
                    color = FinishInk.muted, modifier = Modifier.fillMaxWidth(), textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                )
            }
            error?.let { Text(it, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color(0xFFDC2626)) }

            visible.take(6).forEach { inv ->
                // §251: settled rows lead with WHO — the code is noise once spent.
                val inviteeName = inv.inviteeId?.let { inviteeNames[it] } ?: "A friend"
                // Days → hours → "expired" ladder (iOS timeLeft): the last day of an
                // invite's life read "0d left" before.
                val msLeft = expiryMs(inv) - now
                val timeLeft = when {
                    msLeft <= 0L -> "expired"
                    msLeft >= 86_400_000L -> "${msLeft / 86_400_000L}d left"
                    else -> "${maxOf(1L, msLeft / 3_600_000L)}h left"
                }
                Row(
                    Modifier.fillMaxWidth().lightTintedPill(GIFT_GOLD, 12.dp).padding(start = 10.dp, end = 6.dp, top = 8.dp, bottom = 5.dp),
                    verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    if (inv.status == "pending") {
                        // T1: the open gift's code on glossy letter tiles, a Pending pill and its time left.
                        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            InviteCodeTiles(inv.code, tile = 19.dp)
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                PendingPill()
                                Text(timeLeft, fontSize = 11.sp, fontWeight = FontWeight.Bold, fontFamily = Nunito, color = FinishInk.muted)
                            }
                        }
                        // A3: the bare 3D share icon; cancel as a small quiet candy.
                        SoftControl(Icon3DName.SHARE, contentDescription = "Share invite ${inv.code}", onClick = { share(inv.code) }, iconSize = 18.dp)
                        CandyButton("Cancel", onClick = { cancelTarget = inv }, color = CandyColor.PEACH, size = CandySize.SMALL, contentDescription = "Cancel invite ${inv.code}")
                    } else {
                        when (inv.status) {
                            "redeemed" -> Text("$inviteeName joined! +3 days", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color(0xFF059669), maxLines = 1, overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
                            "converted" -> Text(
                                "$inviteeName subscribed! " + when (inv.convertedPlan) {
                                    "annual" -> "+3 free months"; "monthly" -> "+1 free month"; else -> "Reward earned"
                                },
                                fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color(0xFFD97706), maxLines = 1, overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis,
                                modifier = Modifier.weight(1f),
                            )
                            else -> Text("Waiting · $timeLeft", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = FinishInk.muted, modifier = Modifier.weight(1f))
                        }
                        // iOS marks a converted invite with trophy.fill, not a crown.
                        if (inv.status == "converted") Icon3D(Icon3DName.TROPHY, 14.dp)
                    }
                }
            }
        },
        footer = {
            if (leaders.isNotEmpty()) {
                HorizontalDivider(color = Wash.mix(GIFT_GOLD, 0.4f))
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Icon3D(Icon3DName.TROPHY, 14.dp)
                    Text("TOP INVITERS THIS MONTH", fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 0.8.sp, color = Color(0xFF8A4A12), fontFamily = Nunito)
                }
                leaders.forEachIndexed { i, l ->
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        SoftNumber("${i + 1}", 13.sp, Modifier.width(22.dp), color = FinishInk.softNumber)
                        Text(l.username, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = FinishInk.heading)
                        Spacer(Modifier.weight(1f))
                        SoftNumber("${l.count}", 13.sp, color = FinishInk.softNumber)
                        Text(" joined", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = FinishInk.muted)
                    }
                }
            }
        },
    )

    cancelTarget?.let { target ->
        AlertDialog(
            modifier = com.wordocious.app.ui.PopupWidth, // FINISH_SPEC AG: popups cap at ~440 dp
            onDismissRequest = { cancelTarget = null },
            // A1: a gold-tinted dialog (the Friends page is fixed light).
            containerColor = Wash.mix(GIFT_GOLD, 0.10f),
            title = { Text("Cancel invite ${target.code}?", fontWeight = FontWeight.Black, fontFamily = Nunito, color = FinishInk.heading) },
            text = { Text("The link stops working immediately and your invite slot frees up.", fontFamily = Nunito, color = FinishInk.label) },
            confirmButton = {
                CandyButton("Cancel invite", onClick = {
                    val id = target.id
                    cancelTarget = null
                    scope.launch { ReferralService.cancelInvite(id); reload++ }
                }, color = CandyColor.PINK, size = CandySize.MEDIUM)
            },
            dismissButton = {
                CandyButton("Keep it", onClick = { cancelTarget = null }, color = CandyColor.PEACH, size = CandySize.MEDIUM)
            },
        )
    }
}

