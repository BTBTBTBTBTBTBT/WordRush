package com.wordocious.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.ui.theme.Nunito
import com.wordocious.app.ui.theme.WTheme

/**
 * VS Battle as a full-width tile at the very bottom of the game area (founder + JP,
 * 2026-09-26): the VS card and the old LIVE strip merged — VS icon and accent,
 * "VS Battle", the live pulse + player count, Invite for Pro. The grid above is
 * exactly the eight sweep games. Mirrors web vs-live-tile.tsx / iOS VSLiveTile.swift.
 */
@Composable
fun VSLiveTile(
    card: ModeCard,
    /** Today's daily VS result: true won, false lost, null not played (Daily mode only). */
    vsDailyWon: Boolean?,
    unlimitedMode: Boolean,
    isPro: Boolean,
    onOpen: () -> Unit,
    onInvite: () -> Unit,
) {
    // Web useLivePlayerCount: poll {server}/presence every 10s for body.online;
    // null until the first success, keep the last value on errors.
    val hidden = LocalTabHidden.current
    val count by produceState<Int?>(initialValue = null) {
        kotlinx.coroutines.delay(2_000)
        while (true) {
            hidden.awaitShown() // paused under a game / another tab (founder, 2026-09-29)
            val online = kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
                runCatching {
                    val conn = java.net.URL(com.wordocious.app.data.VSConfig.SERVER_URL + "/presence")
                        .openConnection() as java.net.HttpURLConnection
                    conn.connectTimeout = 8000; conn.readTimeout = 8000
                    val body = conn.inputStream.bufferedReader().readText()
                    conn.disconnect()
                    kotlinx.serialization.json.Json.parseToJsonElement(body)
                        .let { it as? kotlinx.serialization.json.JsonObject }
                        ?.get("online")?.let { el -> (el as? kotlinx.serialization.json.JsonPrimitive)?.content?.toIntOrNull() }
                }.getOrNull()
            }
            if (online != null) value = online
            kotlinx.coroutines.delay(10_000)
        }
    }
    val accent = card.accent
    val done = !unlimitedMode && vsDailyWon != null
    val countText = count?.let { "$it ${if (it == 1) "player" else "players"} online" } ?: "Players online"
    val subtitle = when {
        done -> if (vsDailyWon == true) "Today's battle won" else "Today's battle lost"
        unlimitedMode -> card.desc
        else -> "Today's shared battle"
    }

    // ART_SPEC §21.5: the exact Home game-card treatment (surface, radius, shadow, the
    // colored top band in the VS accent, the card's inner padding). A completed daily wears
    // the game cards' done tint + accent border so today's battle never looks unplayed
    // (founder, 2026-09-26); the W/L badge sits at the end of the title line (§21.1).
    GameCardFrame(accent, done = done) {
        Row(
            Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Row(Modifier.weight(1f).clickableNoRipple(onOpen), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Box(Modifier.size(36.dp).clip(RoundedCornerShape(8.dp)).background(accent.copy(alpha = 0.08f)), contentAlignment = Alignment.Center) {
                    ModeGlyph(card, accent, 36.dp)
                }
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            card.title, fontSize = 13.sp, fontWeight = FontWeight.Black, color = WTheme.text, fontFamily = Nunito,
                            maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f),
                        )
                        if (done) {
                            Spacer(Modifier.width(4.dp))
                            TitleLineBadge(won = vsDailyWon == true)
                        }
                    }
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        LivePulseDot()
                        Text("LIVE", fontSize = 10.sp, fontWeight = FontWeight.Black, color = WTheme.text)
                        Text("· $countText", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                    Text(subtitle, fontSize = 10.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted, maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
            }
            if (isPro) {
                // Soft pill in the tile's own teal (founder, 2026-10-01: the hot-pink 3D
                // button shouted over the tile). Same tap: the Invite modal.
                Row(
                    Modifier.height(32.dp).clip(CircleShape)
                        .background(accent.copy(alpha = 0.08f))
                        .border(1.5.dp, accent.copy(alpha = 0.33f), CircleShape)
                        .clickable { onInvite() }
                        .padding(horizontal = 12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(5.dp),
                ) {
                    Icon3D(Icon3DName.ADD_FRIEND, 17.dp) // ART_SPEC §5
                    Text("Invite", fontSize = 11.sp, fontWeight = FontWeight.Black, color = Color(0xFF0F766E))
                }
            }
        }
    }
}
