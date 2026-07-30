package com.wordocious.app.ui

import android.content.Intent
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.CardGiftcard
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.R
import com.wordocious.app.data.ReferralService
import com.wordocious.app.data.ShareEvents
import com.wordocious.app.ui.theme.Nunito
import com.wordocious.app.ui.theme.WTheme
import kotlinx.coroutines.launch

// "GIFT PRO TO FRIENDS" — Android port of the web invite panel / iOS
// InvitePanelView. Placement: Profile screen between the header and
// Today's Dailies (web order parity).
@Composable
fun InvitePanel() {
    var invites by remember { mutableStateOf<List<ReferralService.ReferralRow>>(emptyList()) }
    var leaders by remember { mutableStateOf<List<ReferralService.Leader>>(emptyList()) }
    var creating by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var cancelTarget by remember { mutableStateOf<ReferralService.ReferralRow?>(null) }
    var reload by remember { mutableStateOf(0) }
    val scope = rememberCoroutineScope()
    val context = LocalContext.current

    LaunchedEffect(reload) {
        invites = ReferralService.myInvites()
        leaders = ReferralService.leaderboard()
    }

    fun expiryMs(row: ReferralService.ReferralRow): Long =
        runCatching { java.time.OffsetDateTime.parse(row.expiresAt).toInstant().toEpochMilli() }
            .recoverCatching { java.time.Instant.parse(row.expiresAt).toEpochMilli() }
            .getOrDefault(0L)

    // Dead invites (cancelled / expired) disappear — web/iOS parity.
    val now = System.currentTimeMillis()
    val visible = invites.filter {
        it.status != "revoked" && !(it.status == "pending" && expiryMs(it) < now)
    }
    val open = invites.count { it.status == "pending" && expiryMs(it) > now }
    val slotsLeft = (3 - open).coerceAtLeast(0)

    fun share(code: String) {
        val send = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(
                Intent.EXTRA_TEXT,
                "I'm gifting you 7 days of Wordocious Pro — daily word puzzles, battles, the works. Claim it here: https://wordocious.com/join/$code",
            )
        }
        context.startActivity(Intent.createChooser(send, null))
        ShareEvents.log("link_invite", "", "referral")
    }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(WTheme.surface, RoundedCornerShape(20.dp))
            .border(1.5.dp, Color(0xFFC4B5FD), RoundedCornerShape(20.dp))
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            // iOS: Image(systemName: "gift.fill") tinted brand purple. An emoji
            // renders in the system font and can't be tinted.
            Icon(
                Icons.Filled.CardGiftcard, null, tint = WTheme.primary,
                modifier = Modifier.size(15.dp),
            )
            Text(
                "GIFT PRO TO FRIENDS",
                fontSize = 15.sp, fontWeight = FontWeight.Black,
                style = TextStyle(
                    brush = Brush.linearGradient(listOf(Color(0xFF7C3AED), Color(0xFFEC4899))),
                    fontFamily = Nunito,
                ),
            )
        }

        Text(
            buildAnnotatedString {
                val muted = androidx.compose.ui.text.SpanStyle(color = WTheme.textMuted)
                val amber = androidx.compose.ui.text.SpanStyle(color = Color(0xFFD97706))
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

        Button3D(
            onClick = {
                if (!creating && slotsLeft > 0) {
                    creating = true; error = null
                    scope.launch {
                        val (code, err) = ReferralService.createInvite()
                        creating = false
                        if (code != null) { reload++; share(code) } else error = err ?: "Could not create an invite."
                    }
                }
            },
            face = Brush.linearGradient(listOf(Color(0xFF7C3AED), Color(0xFF6D28D9))),
            shadow = Color(0xFF4C1D95),
            modifier = Modifier.fillMaxWidth(),
            enabled = !creating && slotsLeft > 0,
        ) {
            Text(
                when {
                    creating -> "Creating…"
                    slotsLeft == 0 -> "All 3 invites out — slots free when friends join"
                    else -> "Create invite link ($slotsLeft left)"
                },
                color = Color.White, fontWeight = FontWeight.Black, fontSize = 14.sp, fontFamily = Nunito,
            )
        }
        error?.let { Text(it, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color(0xFFDC2626)) }

        visible.take(6).forEach { inv ->
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(inv.code, fontSize = 12.sp, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace, color = WTheme.text)
                // Days → hours → "expired" ladder (iOS timeLeft): the last day of an
                // invite's life read "0d left" before.
                val msLeft = expiryMs(inv) - now
                val timeLeft = when {
                    msLeft <= 0L -> "expired"
                    msLeft >= 86_400_000L -> "${msLeft / 86_400_000L}d left"
                    else -> "${maxOf(1L, msLeft / 3_600_000L)}h left"
                }
                when (inv.status) {
                    "redeemed" -> Text("Friend joined! +3 days", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color(0xFF059669))
                    "converted" -> Text("Subscribed! Reward earned", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color(0xFFD97706))
                    else -> Text("Waiting · $timeLeft", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
                }
                Spacer(Modifier.weight(1f))
                if (inv.status == "pending") {
                    Icon(Icons.Filled.Share, "Share", tint = WTheme.primary,
                        modifier = Modifier.size(14.dp).clickableNoRipple { share(inv.code) })
                    Spacer(Modifier.width(4.dp))
                    Text("✕", fontSize = 12.sp, color = WTheme.textMuted,
                        modifier = Modifier.clickableNoRipple { cancelTarget = inv })
                }
                if (inv.status == "converted") {
                    // iOS marks a converted invite with trophy.fill, not a crown.
                    Icon(Icons.Filled.EmojiEvents, null, tint = Color(0xFFD97706), modifier = Modifier.size(12.dp))
                }
            }
        }

        if (leaders.isNotEmpty()) {
            HorizontalDivider(color = WTheme.border)
            Text("TOP INVITERS THIS MONTH", fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 0.8.sp, color = WTheme.textMuted, fontFamily = Nunito)
            leaders.forEachIndexed { i, l ->
                Row {
                    Text("${i + 1}. ${l.username}", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = WTheme.text)
                    Spacer(Modifier.weight(1f))
                    Text("${l.count} joined", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
                }
            }
        }
    }

    cancelTarget?.let { target ->
        AlertDialog(
            onDismissRequest = { cancelTarget = null },
            title = { Text("Cancel invite ${target.code}?", fontWeight = FontWeight.Black, fontFamily = Nunito) },
            text = { Text("The link stops working immediately and your invite slot frees up.", fontFamily = Nunito) },
            confirmButton = {
                TextButton(onClick = {
                    val id = target.id
                    cancelTarget = null
                    scope.launch { ReferralService.cancelInvite(id); reload++ }
                }) { Text("Cancel invite", color = Color(0xFFDC2626), fontWeight = FontWeight.Black) }
            },
            dismissButton = {
                TextButton(onClick = { cancelTarget = null }) { Text("Keep it", fontWeight = FontWeight.Black) }
            },
        )
    }
}
