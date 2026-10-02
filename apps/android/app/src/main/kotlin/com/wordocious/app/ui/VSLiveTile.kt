package com.wordocious.app.ui

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.R
import com.wordocious.app.data.BotArt
import com.wordocious.app.data.CpuProgressionStore
import com.wordocious.app.ui.theme.Nunito
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.core.BotCast

/**
 * VS Battle as a full-width tile at the very bottom of the game area (founder + JP,
 * 2026-09-26): the VS card and the old LIVE strip merged — VS icon and accent,
 * "VS Battle", the live pulse + player count, Invite for Pro. The grid above is
 * exactly the eight sweep games. FINISH_SPEC O2 (10-02): the faceoff art as a small hero,
 * the status line, Bot of the day and PLAY / INVITE candy buttons; Home's VS BATTLE
 * section title sits above it (O1). Mirrors web vs-live-tile.tsx / iOS VSLiveTile.swift.
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
        done -> if (vsDailyWon == true) "Battle won!" else "Today's battle lost"
        unlimitedMode -> card.desc
        else -> "Today's shared battle"
    }
    // D2: today's Bot of the Day (seeded on the UTC day), its cast VS "ready" pose.
    val bot = remember { BotCast.botOfTheDay(CpuProgressionStore.todayUtc()) }
    val muted = if (WTheme.isDark) WTheme.textMuted else FinishInk.muted

    // FINISH_SPEC O2 (same place, same data, no drastic change): the exact Home game-card
    // treatment (§21.5) in the VS teal — tinted face, the colored top band, the card's
    // inner padding; a completed daily wears the done tint. Left: the W-vs-S faceoff art
    // as a small hero (~40% of the card, the two characters and the bolt). Right: LIVE ·
    // N players online with the pulsing dot, today's status line (+ the W / L badge,
    // §21.1), the Bot of the day line, then PLAY (teal candy) and INVITE (peach, Pro).
    GameCardFrame(accent, done = done) {
        Row(
            Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Image(
                painterResource(R.drawable.art_scene_vs_faceoff),
                contentDescription = null,
                contentScale = ContentScale.Fit,
                modifier = Modifier.fillMaxWidth(0.4f).widthIn(max = 170.dp).aspectRatio(FACEOFF_ASPECT)
                    .squishClickable(onClick = onOpen).clearAndSetSemantics { },
            )
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                // A9: the info block opens the lobby and squishes; TalkBack reads it as one button.
                Column(
                    Modifier.fillMaxWidth().squishClickable("${card.title}, $countText, $subtitle, Bot of the day: ${bot.name}", card = true, onClick = onOpen),
                    verticalArrangement = Arrangement.spacedBy(3.dp),
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        LivePulseDot()
                        Text("LIVE", fontSize = 10.sp, fontWeight = FontWeight.Black, color = WTheme.text, fontFamily = Nunito)
                        Text(
                            "· $countText", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = muted, fontFamily = Nunito,
                            maxLines = 1, overflow = TextOverflow.Ellipsis,
                        )
                    }
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            subtitle, fontSize = 13.sp, fontWeight = FontWeight.Black, color = WTheme.text, fontFamily = Nunito,
                            maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f, fill = false),
                        )
                        if (done) {
                            Spacer(Modifier.width(4.dp))
                            TitleLineBadge(won = vsDailyWon == true)
                        }
                    }
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        Image(
                            painterResource(BotArt.pose(bot.id, "ready")), contentDescription = null,
                            modifier = Modifier.size(18.dp).clearAndSetSemantics { },
                        )
                        Text(
                            "Bot of the day: ${bot.name}", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = muted,
                            fontFamily = Nunito, maxLines = 1, overflow = TextOverflow.Ellipsis,
                        )
                    }
                }
                Row(
                    Modifier.padding(top = 3.dp),
                    verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    // A8: PLAY is the card's primary candy (teal, the VS color) — same tap as the card.
                    CandyButton(
                        "PLAY", onClick = onOpen, color = CandyColor.TEAL, size = CandySize.SMALL,
                        icon = CandyIcon.PLAY, contentDescription = "Play ${card.title}",
                    )
                    if (isPro) {
                        // Same tap as before: the Invite modal. Peach = the quiet secondary.
                        CandyButton(
                            "INVITE", onClick = onInvite, color = CandyColor.PEACH, size = CandySize.SMALL,
                            leading = { Icon3D(Icon3DName.ADD_FRIEND, 16.dp) }, // ART_SPEC §5
                            contentDescription = "Invite",
                        )
                    }
                }
            }
        }
    }
}

/** The faceoff art's aspect (1200 × 638). */
private const val FACEOFF_ASPECT = 1200f / 638f
