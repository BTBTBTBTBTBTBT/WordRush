package com.wordocious.app.ui.friends

import com.wordocious.app.ui.SoftModalSheet
import com.wordocious.app.ui.Icon3D
import com.wordocious.app.ui.Icon3DName
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
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
import com.wordocious.app.R
import com.wordocious.app.data.AuthService
import com.wordocious.app.data.FriendlyGamesService
import com.wordocious.app.data.FriendsService
import com.wordocious.app.ui.GameTileSquare
import com.wordocious.app.ui.GameTileStyle
import com.wordocious.app.ui.CastPose
import com.wordocious.app.ui.MascotId
import com.wordocious.app.ui.squishClickable
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.draw.drawBehind
import com.wordocious.core.COIN_STAKES
import com.wordocious.core.FRIENDLY_KINDS
import com.wordocious.core.FriendlyKind
import com.wordocious.core.presenceLine
import kotlinx.coroutines.launch

/** What the quick-play sheet opens with: a friend (or a picker) and a game. */
data class QuickPlayRequest(val friendId: String?, val kind: FriendlyKind = FriendlyKind.RPS)

/**
 * The quick-play sheet (Friends overhaul §3): a friend header, the four QUICK
 * GAMES (Call It adds a stake row), the two WORDOCIOUS cards (VS Battle live =
 * the existing free friends challenge; Race my run = the VS Friend page, Pro)
 * and the INVITE TO <GAME> CTA, which starts the pocket game server-side and
 * opens its screen. With no friend chosen yet it shows a picker (online first).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun QuickPlaySheet(
    request: QuickPlayRequest,
    friends: List<FriendsService.FriendProfile>,
    onDismiss: () -> Unit,
    onOpenGame: (String) -> Unit,
    onVsBattle: (FriendsService.FriendProfile) -> Unit,
    onRaceRun: (String) -> Unit,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val scope = rememberCoroutineScope()
    val now = System.currentTimeMillis()
    var friendId by remember { mutableStateOf(request.friendId) }
    var kind by remember { mutableStateOf(request.kind) }
    var stake by remember { mutableStateOf(COIN_STAKES[0]) }
    var sending by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val friend = friends.firstOrNull { it.id == friendId }
    // A picker when no friend was chosen (or the one asked for isn't in your circle).
    val showPicker = remember { request.friendId == null || friends.none { it.id == request.friendId } }

    // A1: a pink-tinted sheet (no white).
    SoftModalSheet(
        onDismissRequest = onDismiss, sheetState = sheetState, containerColor = SHEET_TINT,
        dragHandle = {
            Box(Modifier.padding(top = 10.dp, bottom = 4.dp).size(width = 40.dp, height = 5.dp).clip(RoundedCornerShape(50)).background(friendsLine(FRIENDS_CARD_ACCENT, 0.5f)))
        },
    ) {
        Column(
            Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp).navigationBarsPadding(),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            // Friend picker (online friends first) — shown when the sheet opened from a game tile.
            if (showPicker) {
                FriendsLabel("PICK A FRIEND")
                // On now first, then the freshest presence, then A–Z.
                val ordered = friends.sortedWith(
                    compareByDescending<FriendsService.FriendProfile> { it.isOnline(now) }
                        .thenByDescending { it.lastSeenMs ?: 0L }.thenBy { it.username },
                )
                if (ordered.isEmpty()) {
                    Text("Add a friend first — then pick a game.", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = FriendsPink.sub)
                }
                Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    ordered.forEach { f ->
                        Column(
                            Modifier.width(58.dp).squishClickable(
                                label = "${f.username}${if (f.id == friendId) ", selected" else ""}", role = Role.RadioButton,
                            ) { friendId = f.id },
                            horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(3.dp),
                        ) {
                            FriendFace(
                                f.username, f.avatarUrl, f.avatarEmoji, 44.dp, online = f.isOnline(now),
                                ring = if (f.id == friendId) FriendsPink.solid else null, userId = f.id,
                            )
                            Text(
                                f.username, fontSize = 10.sp, fontWeight = FontWeight.Black,
                                color = if (f.id == friendId) FriendsPink.solid else FriendsPink.ink,
                                maxLines = 1, overflow = TextOverflow.Ellipsis, textAlign = TextAlign.Center,
                            )
                        }
                    }
                }
            }

            // Friend header (C cheering beside it — A7: the banner's host is O1)
            if (friend != null) {
                val on = friend.isOnline(now)
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    FriendFace(friend.username, friend.avatarUrl, friend.avatarEmoji, 48.dp, online = on, userId = friend.id)
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        Text(
                            "PLAY WITH @${friend.username.uppercase()}", fontSize = 17.sp, fontWeight = FontWeight.Black,
                            color = FriendsPink.ink, maxLines = 1, overflow = TextOverflow.Ellipsis,
                        )
                        presenceLine(friend.lastSeenMs, friend.activity, now)?.let {
                            Text(it, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = if (on) FriendsPink.green else FriendsPink.label, maxLines = 1)
                        }
                        val record = listOfNotNull(
                            h2hWords(friend.h2hW ?: 0, friend.h2hL ?: 0),
                            (friend.friendStreak ?: 0).takeIf { it > 0 }?.let { "$it-day friend streak" },
                        ).joinToString(" · ")
                        if (record.isNotEmpty()) {
                            Text(record, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = FriendsPink.label, maxLines = 1)
                        }
                    }
                    CastPose(MascotId.C, "cheer", 56.dp)
                }
            }

            // QUICK GAMES
            FriendsLabel(if (friend?.isOnline(now) == true) "QUICK GAMES · LIVE WHILE THEY'RE ON" else "QUICK GAMES")
            // Six tiles, 3 across × 2 rows (§9, web parity).
            FRIENDLY_KINDS.chunked(3).forEach { row ->
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    row.forEach { k -> GameTile(k, selected = k == kind, modifier = Modifier.weight(1f)) { kind = k; error = null } }
                }
            }
            if (kind == FriendlyKind.COIN) {
                FriendsLabel("WHAT'S ON THE LINE")
                Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    COIN_STAKES.forEach { s ->
                        // A1 / A9: a tinted chip in Call It's gold; selected = stronger tint + ring.
                        val shape = RoundedCornerShape(50)
                        val coin = FriendlyKind.COIN.color
                        Text(
                            s, fontSize = 11.sp, fontWeight = FontWeight.Black, maxLines = 1,
                            color = if (s == stake) FriendsPink.heading else FriendsPink.mid,
                            modifier = Modifier
                                .squishClickable(label = s + if (s == stake) ", selected" else "", role = Role.RadioButton) { stake = s }
                                .clip(shape).background(friendsWash(coin, if (s == stake) 0.3f else 0.12f))
                                .border(if (s == stake) 2.dp else 1.5.dp, if (s == stake) coin else friendsLine(coin), shape)
                                .padding(horizontal = 12.dp, vertical = 7.dp),
                        )
                    }
                }
            }

            // WORDOCIOUS
            FriendsLabel("WORDOCIOUS")
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                WordociousCard(
                    title = "VS Battle, live", sub = "Free for friends · Classic", solid = true,
                    enabled = friend != null, modifier = Modifier.weight(1f),
                ) { friend?.let { onVsBattle(it) } }
                WordociousCard(
                    title = "Race my run", sub = "They race your time", solid = false, locked = !AuthService.isProActive,
                    enabled = friend != null, modifier = Modifier.weight(1f),
                ) { friend?.let { onRaceRun(it.id) } }
            }

            error?.let { Text(it, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = FriendsPink.solid) }
            PinkButton(
                if (sending) "SENDING…" else "INVITE TO ${kind.title.uppercase()}",
                modifier = Modifier.fillMaxWidth(), enabled = friend != null && !sending,
            ) {
                val f = friend ?: return@PinkButton
                sending = true
                error = null
                scope.launch {
                    when (val r = FriendlyGamesService.start(kind, f.id, if (kind == FriendlyKind.COIN) stake else null)) {
                        is FriendlyGamesService.StartOutcome.Started -> onOpenGame(r.game.id)
                        is FriendlyGamesService.StartOutcome.Failed -> error = r.message
                    }
                    sending = false
                }
            }
            Text(
                "${friend?.username?.replaceFirstChar { it.uppercaseChar() } ?: "Your friend"} gets a ping. If they're busy, it waits as your turn.",
                fontSize = 11.sp, fontWeight = FontWeight.Bold, color = FriendsPink.label, textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(12.dp))
        }
    }
}

/** The square game tile (docs/GAME_TILE_STYLE.md): the home card's wash, top bar and chip, the picked game selected. */
@Composable
private fun GameTile(kind: FriendlyKind, selected: Boolean, modifier: Modifier, onClick: () -> Unit) {
    GameTileSquare(
        accent = kind.color, label = kind.title, selected = selected, modifier = modifier,
        surface = friendsWash(kind.color, 0.06f), labelColor = GameTileStyle.INK, onClick = onClick,
    ) { chip -> FriendlyGameGlyph(kind, chip * 0.82f) }
}

private val TEAL = Color(0xFF0D9488)

/**
 * A WORDOCIOUS card (VS Battle live / Race my run): a teal-tinted card with its top
 * bar (A1), the swords, title + line, the lock on Pro; the whole card squishes (A9).
 * [solid] = the stronger tint (the free live battle).
 */
@Composable
private fun WordociousCard(
    title: String, sub: String, solid: Boolean, modifier: Modifier,
    locked: Boolean = false, enabled: Boolean = true, onClick: () -> Unit,
) {
    Row(
        modifier
            .squishClickable(label = "$title, $sub${if (locked) ", Pro" else ""}", enabled = enabled) { onClick() }
            .alpha(if (enabled) 1f else 0.5f)
            .clip(RoundedCornerShape(14.dp))
            .background(friendsWash(TEAL, if (solid) 0.22f else 0.12f))
            .drawBehind { drawRect(TEAL, size = androidx.compose.ui.geometry.Size(size.width, 5.dp.toPx())) }
            .border(if (solid) 2.dp else 1.5.dp, if (solid) TEAL else friendsLine(TEAL), RoundedCornerShape(14.dp))
            .padding(start = 10.dp, end = 10.dp, top = 13.dp, bottom = 10.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Icon(painterResource(R.drawable.ic_swords), null, tint = TEAL, modifier = Modifier.size(16.dp))
        Column(Modifier.weight(1f)) {
            Text(title, fontSize = 12.sp, fontWeight = FontWeight.Black, color = FriendsPink.heading, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(sub, fontSize = 10.sp, fontWeight = FontWeight.Bold, color = FriendsPink.muted, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        if (locked) Icon3D(Icon3DName.LOCK, 14.dp, contentDescription = "Pro") // ART_SPEC §5
    }
}

/** A1 the quick-play sheet's soft pink wash. */
private val SHEET_TINT = Color(0xFFFFF3F9)
