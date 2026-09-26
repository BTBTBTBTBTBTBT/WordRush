package com.wordocious.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material3.Icon
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
    val count by produceState<Int?>(initialValue = null) {
        kotlinx.coroutines.delay(2_000)
        while (true) {
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
    val shape = RoundedCornerShape(14.dp)

    // Completed daily: the same accent glow the mode cards wear (done tint + accent border)
    // so today's battle never looks unplayed (founder, 2026-09-26); W/L pill top-right like the cards.
    Box(
        Modifier.fillMaxWidth().clip(shape)
            .background(if (done) accent.copy(alpha = 0.10f) else WTheme.surface)
            .border(1.5.dp, if (done) accent.copy(alpha = 0.55f) else WTheme.border, shape),
    ) {
        Box(Modifier.width(4.dp).fillMaxHeight().padding(vertical = 6.dp).clip(CircleShape).background(accent))
        if (done) {
            Box(
                Modifier.align(Alignment.TopEnd).padding(top = 8.dp, end = 10.dp).size(20.dp)
                    .clip(RoundedCornerShape(6.dp)).background(if (vsDailyWon == true) Color(0xFF7C3AED) else Color(0xFFDC2626)),
                contentAlignment = Alignment.Center,
            ) { Text(if (vsDailyWon == true) "W" else "L", fontSize = 10.sp, fontWeight = FontWeight.Black, color = Color.White) }
        }
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Row(Modifier.weight(1f).clickableNoRipple(onOpen), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Box(Modifier.size(36.dp).clip(RoundedCornerShape(8.dp)).background(accent.copy(alpha = 0.08f)), contentAlignment = Alignment.Center) {
                    ModeGlyph(card, accent, 36.dp)
                }
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                    Text(card.title, fontSize = 13.sp, fontWeight = FontWeight.Black, color = WTheme.text, fontFamily = Nunito)
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        LivePulseDot()
                        Text("LIVE", fontSize = 10.sp, fontWeight = FontWeight.Black, color = WTheme.text)
                        Text("· $countText", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                    Text(subtitle, fontSize = 10.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted, maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
                Icon(Icons.Filled.ChevronRight, null, tint = accent, modifier = Modifier.size(20.dp))
            }
            if (isPro) {
                Box {
                    Box(Modifier.matchParentSize().offset(y = 2.dp).clip(RoundedCornerShape(6.dp)).background(Color(0xFF9F1239)))
                    Text(
                        "Invite", fontSize = 10.sp, fontWeight = FontWeight.Black, color = Color.White,
                        modifier = Modifier.clip(RoundedCornerShape(6.dp))
                            .background(Brush.linearGradient(listOf(Color(0xFFEC4899), Color(0xFFDB2777))))
                            .clickable { onInvite() }
                            .padding(horizontal = 12.dp, vertical = 6.dp),
                    )
                }
            }
        }
    }
}
