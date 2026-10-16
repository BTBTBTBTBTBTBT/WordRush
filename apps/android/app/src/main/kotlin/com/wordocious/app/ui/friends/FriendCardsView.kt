package com.wordocious.app.ui.friends

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.zIndex
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.lerp
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.requiredHeight
import androidx.compose.foundation.layout.requiredSize
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.data.FriendlyGamesService
import com.wordocious.app.data.FriendsService
import com.wordocious.app.ui.FamIcon
import com.wordocious.app.ui.FamIconImage
import com.wordocious.app.ui.RoundIconButton
import com.wordocious.app.ui.tileClickable
import com.wordocious.core.CardFriend
import com.wordocious.core.CardGame
import com.wordocious.core.FriendCard
import com.wordocious.core.FriendCards
import com.wordocious.core.FriendlyKind
import com.wordocious.core.FriendsLayout
import com.wordocious.core.GameTile

// The Friends tab, ONE card per friend (words and order from core FriendCards, pinned by friend-cards-fixtures.json).
// Design A + B's WAITING chip (founder 10-15; docs/design/review/friends-cards-1015/SPEC.md): a 44 dp avatar, the name and ONE
// sub line (presence in green, else "N GAMES"), then ALWAYS one slim 50 dp row per game (yours first, at most 3, then "+N more"):
// a glossy game coin, the title in caps with its plain-words state, a YOUR TURN / WAITING chip and the resign flag (Keep / Resign
// in place). No bordered boxes; chip and row type are fixed size (FixedFont) except the row's title + word, which follow the
// text size capped at 1.5x (a11y review 10-16 #7). The ⋯ opens the family action menu.

/** The core layout for the friends + active games (online friends and friends with games get cards). */
fun buildFriendsLayout(
    friends: List<FriendsService.FriendProfile>,
    games: List<FriendlyGamesService.GameView>,
    nowMs: Long,
): FriendsLayout = FriendCards.friendsLayout(
    friends.map { CardFriend(it.id, it.username, it.isOnline(nowMs), it.activity, it.lastSeenMs) },
    games.map { CardGame(it.id, it.kind, it.opponent.id, it.opponent.username, it.me, it.state, it.yourTurn, it.updatedAt) },
)

@Composable
fun FriendCardsSection(
    layout: FriendsLayout,
    friends: List<FriendsService.FriendProfile>,
    onOpenGame: (String) -> Unit,
    onPlayWith: (FriendsService.FriendProfile) -> Unit,
    onMenu: (FriendsService.FriendProfile) -> Unit,
    /** Resign this game (the confirm happens on its tile; the caller resigns and reloads the games). */
    onResign: (String) -> Unit,
    /** The avatar + name open the friend's profile (iOS / web parity). */
    onOpenProfile: (String) -> Unit = {},
    /** A friend with no games keeps today's start row (spec): one tap starts that game with them. */
    onStartGame: (FriendsService.FriendProfile, FriendlyKind) -> Unit = { f, _ -> onPlayWith(f) },
) {
    if (layout.cards.isEmpty()) return
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        layout.cards.forEach { card ->
            val friend = friends.firstOrNull { it.id == card.friendId }
            FriendCardView(card, friend, onOpenGame, onPlayWith, onMenu, onResign, onOpenProfile, onStartGame)
        }
    }
}

@Composable
private fun FriendCardView(
    card: FriendCard,
    friend: FriendsService.FriendProfile?,
    onOpenGame: (String) -> Unit,
    onPlayWith: (FriendsService.FriendProfile) -> Unit,
    onMenu: (FriendsService.FriendProfile) -> Unit,
    onResign: (String) -> Unit,
    onOpenProfile: (String) -> Unit,
    onStartGame: (FriendsService.FriendProfile, FriendlyKind) -> Unit,
) {
    var expanded by remember(card.friendId) { mutableStateOf(false) }
    // A game partner who left the friend list still has a profile to open and games to start.
    val who = friend ?: FriendsService.FriendProfile(id = card.friendId, username = card.name)
    // The game whose flag was tapped (its row shows "Resign Ghost?" with Keep / Resign in place).
    var confirming by remember(card.friendId) { mutableStateOf<String?>(null) }
    // Every game going with them: yours to play first, then theirs.
    val all = card.tiles + card.theirTurn
    val shown = if (expanded || all.size <= MAX_ROWS) all else all.take(MAX_ROWS)
    // The bubble headline ("1 game waiting on you") is not drawn any more (the gold row says it); TalkBack still hears it.
    val cardLabel = "Play a game with ${card.name}" + if (card.headline.isNotEmpty()) ", ${card.headline}" else ""
    val profileLabel = listOfNotNull(card.name, card.presence, card.headline.takeIf { it.isNotEmpty() }).joinToString(", ")
    Column(
        Modifier.fillMaxWidth()
            .then(if (friend != null) Modifier.tileClickable(label = cardLabel, card = true) { onPlayWith(friend) } else Modifier)
            .friendsCard(16.dp)
            .padding(10.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            // iOS / web parity: the avatar and the name open the profile (the rest of the card still quick-plays).
            Box(Modifier.tileClickable(card = false, label = "${card.name}'s profile") { onOpenProfile(card.friendId) }) {
                FriendFace(
                    card.name, friend?.avatarUrl, friend?.avatarEmoji, 44.dp, online = card.online,
                    presenceRing = false, userId = card.friendId, dotSize = 11.dp,
                )
            }
            Column(
                Modifier.weight(1f).tileClickable(card = false, label = profileLabel) { onOpenProfile(card.friendId) },
                verticalArrangement = Arrangement.spacedBy(2.dp),
            ) {
                FriendsName(card.name, size = 16f)
                // ONE sub line: the presence in green, else "N GAMES", else today's start prompt.
                FixedFont {
                    when {
                        card.presence != null -> Text(
                            card.presence!!, fontSize = 12.sp, fontWeight = FontWeight.ExtraBold, color = FriendsPink.green,
                            maxLines = 1, overflow = TextOverflow.Ellipsis,
                        )
                        all.isNotEmpty() -> Text(
                            if (all.size == 1) "1 GAME" else "${all.size} GAMES", fontSize = 10.5.sp, fontWeight = FontWeight.ExtraBold,
                            color = FriendsPink.muted, letterSpacing = 0.6.sp, maxLines = 1,
                        )
                        else -> {}
                    }
                }
            }
            // A card for someone who is not on the friend list (a game left over, or an unfriended player) still gets
            // the ⋯: its menu (hosted by the Friends screen) offers View profile + Resign for each game in play.
            RoundIconButton(
                onClick = { onMenu(friend ?: FriendsService.FriendProfile(id = card.friendId, username = card.name)) },
                contentDescription = "More for ${card.name}", tap = 36.dp, compact = true,
            ) { FamIconImage(FamIcon.MORE, FriendsPink.solid, 20.dp) }
        }

        // ALWAYS one slim row per game (yours first), at most 3; more fold behind "+N more". Nothing going yet:
        // the six games as small tiles, tap one to start it with them (spec: "keeps today's start row").
        if (all.isEmpty()) StartRow(card.name) { onStartGame(who, it) }
        shown.forEach { t ->
            GameRow(t, card.name, confirming == t.gameId, { confirming = if (it) t.gameId else null }, onOpenGame) { onResign(t.gameId) }
        }
        if (all.size > MAX_ROWS) MoreRow(all.size - MAX_ROWS, expanded) { expanded = !expanded }
    }
}

private const val MAX_ROWS = 3
private val GOLD = Color(0xFFFFC83D)
private val GOLD_TEXT = Color(0xFFFFD45A)

/** A friend with nothing going yet: the six games as small tiles (iOS `startRow` / web `StartStrip`), tap one to start it. */
@Composable
private fun StartRow(friendName: String, onStart: (FriendlyKind) -> Unit) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        FriendlyKind.entries.forEach { k ->
            Box(
                Modifier.weight(1f).clip(RoundedCornerShape(12.dp)).background(friendsWash(k.color, 0.10f))
                    .tileClickable(card = false, label = "Play ${k.title} with $friendName") { onStart(k) }
                    .padding(vertical = 7.dp),
                Alignment.Center,
            ) { FriendlyGameGlyph(k, 30.dp) }
        }
    }
}

/** "+N more ⌄": the quiet fourth row that toggles the rest of the games (22 dp on screen, 44 dp to the finger: a11y review 10-16 #6). */
@Composable
private fun MoreRow(more: Int, expanded: Boolean, onToggle: () -> Unit) {
    val lavender = FriendsQuietInk.violet
    FixedFont {
        Row(
            Modifier.fillMaxWidth().height(22.dp).requiredHeight(44.dp).clip(RoundedCornerShape(10.dp))
                .tileClickable(card = false, label = if (expanded) "Show fewer games" else "$more more games, collapsed", onClick = onToggle),
            horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(if (expanded) "Show fewer" else "+$more more", fontSize = 11.5.sp, fontWeight = FontWeight.Black, color = lavender, maxLines = 1)
            Spacer(Modifier.width(3.dp))
            Icon(Icons.Filled.KeyboardArrowDown, null, tint = lavender, modifier = Modifier.size(14.dp).rotate(if (expanded) 180f else 0f))
        }
    }
}

/**
 * One slim game row (50 dp): the game's glossy coin, its title in caps with the plain-words state under it, then the chip
 * (YOUR TURN gold / WAITING quiet) and the resign flag. Your turn = a faint gold fill + a soft gold glow (a shadow, no border).
 * The whole row opens the game; the flag flips the row to Keep / Resign in place.
 */
@Composable
private fun GameRow(
    t: GameTile, friendName: String, confirming: Boolean, onConfirming: (Boolean) -> Unit,
    onOpen: (String) -> Unit, onResign: () -> Unit,
) {
    val shape = RoundedCornerShape(14.dp)
    val dark = FriendsPink.dark
    val mine = t.yourTurn
    val plate = when {
        confirming -> friendsWash(FriendsPink.solid, 0.14f)
        mine -> GOLD.copy(alpha = 0.12f)
        dark -> Color.White.copy(alpha = 0.06f)
        else -> FriendsTiles.purple.copy(alpha = 0.10f)
    }
    // A11y review 10-16 #7: the title and word (the only text that says what game and whose move) follow the
    // user's text size, capped at 1.5x; the row is min 50 dp and grows with them. Captured OUTSIDE FixedFont.
    val userDensity = LocalDensity.current
    Box(
        Modifier.fillMaxWidth().heightIn(min = 50.dp)
            .then(if (mine && !confirming) Modifier.shadow(8.dp, shape, clip = false, ambientColor = GOLD.copy(alpha = 0.40f), spotColor = GOLD.copy(alpha = 0.40f)) else Modifier)
            .clip(shape).background(plate),
    ) {
        FixedFont {
            if (confirming) {
                ResignConfirm(t, { onConfirming(false) }, { onConfirming(false); onResign() })
            } else {
                Row(
                    Modifier.fillMaxWidth().heightIn(min = 50.dp)
                        .tileClickable(card = false, label = FriendCards.gameRowLabel(t.kind, t.word, t.yourTurn), onClick = { onOpen(t.gameId) })
                        .padding(start = 8.dp, end = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    GameCoin(t.kind.color) { FriendlyGameGlyph(t.kind, 22.dp) }
                    CompositionLocalProvider(LocalDensity provides Density(userDensity.density, userDensity.fontScale.coerceAtMost(1.5f))) {
                        Column(Modifier.weight(1f).padding(start = 10.dp, end = 6.dp), verticalArrangement = Arrangement.spacedBy(1.dp)) {
                            FitText(t.kind.title.uppercase(), 12.5f, FontWeight.Black, FriendsPink.heading, 0.75f)
                            FitText(t.word, 11f, FontWeight.Bold, if (mine) (if (dark) GOLD_TEXT else FriendsQuietInk.gold) else FriendsPink.muted, 0.8f)
                        }
                    }
                    if (mine) YourTurnChip() else WaitingChip()
                    Spacer(Modifier.width(6.dp))
                    ResignFlag(t, friendName, Modifier) { onConfirming(true) }
                }
            }
        }
    }
}

/** One line of text (sp at whatever font scale the caller provides) that shrinks (down to [minScale]) before it would clip. */
@Composable
private fun FitText(text: String, size: Float, weight: FontWeight, color: Color, minScale: Float) {
    var scale by remember(text, size) { mutableFloatStateOf(1f) }
    Text(
        text, fontSize = (size * scale).sp, fontWeight = weight, color = color,
        maxLines = 1, softWrap = false, overflow = TextOverflow.Ellipsis,
        onTextLayout = { if (it.hasVisualOverflow && scale > minScale) scale = (scale - 0.05f).coerceAtLeast(minScale) },
    )
}

/** The game's coin (34): a radial gradient of its accent (light top-left, 25% darker at the rim), a gloss ellipse, the art 22. */
@Composable
private fun GameCoin(accent: Color, art: @Composable () -> Unit) {
    val light = lerp(accent, Color.White, 0.40f)
    val rim = lerp(accent, Color.Black, 0.25f)
    Box(
        Modifier.size(34.dp).clip(CircleShape).drawBehind {
            drawCircle(
                Brush.radialGradient(listOf(light, accent, rim), center = Offset(size.width * 0.32f, size.height * 0.28f), radius = size.width * 0.95f),
            )
            drawOval(Color.White.copy(alpha = 0.22f), Offset(size.width * 0.16f, size.height * 0.05f), Size(size.width * 0.68f, size.height * 0.45f))
        },
        Alignment.Center,
    ) { art() }
}

/** YOUR TURN: a gold capsule (24 high) with a 1 px white top highlight and dark-amber type. */
@Composable
private fun YourTurnChip() {
    Box(
        Modifier.height(24.dp).clip(CircleShape)
            .background(Brush.verticalGradient(listOf(Color(0xFFFFE58A), Color(0xFFF5B21B))))
            .drawBehind {
                val px = 1.dp.toPx()
                drawLine(Color.White.copy(alpha = 0.35f), Offset(size.height / 2f, px / 2f), Offset(size.width - size.height / 2f, px / 2f), strokeWidth = px)
            }
            .padding(horizontal = 10.dp),
        Alignment.Center,
    ) {
        // 11.5 sp (a11y review 10-16 #7; iOS/web keep 10.5): Android's floor is 12 and the 24 dp capsule still fits (line ~15.7 dp).
        Text("YOUR TURN", fontSize = 11.5.sp, fontWeight = FontWeight.Black, color = Color(0xFF5A3200), letterSpacing = 0.4.sp, maxLines = 1, softWrap = false)
    }
}

/** WAITING (B's chip): a quiet capsule (22 high), a small clock and WAITING in muted ink. */
@Composable
private fun WaitingChip() {
    Row(
        Modifier.height(22.dp).clip(CircleShape)
            .background(if (FriendsPink.dark) Color.White.copy(alpha = 0.08f) else FriendsTiles.purple.copy(alpha = 0.14f))
            .padding(horizontal = 9.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        Icon(Icons.Filled.Schedule, null, tint = FriendsPink.muted, modifier = Modifier.size(9.dp))
        // 11.5 sp (a11y review 10-16 #7; iOS/web keep 10): the 22 dp capsule still fits (line ~15.7 dp).
        Text("WAITING", fontSize = 11.5.sp, fontWeight = FontWeight.ExtraBold, color = FriendsPink.muted, letterSpacing = 0.5.sp, maxLines = 1, softWrap = false)
    }
}

/** The flag at a row's right end (a 22 dp coin in a 30 dp slot; the hit area is 44 x 50 around it, a11y review 10-16 #6). */
@Composable
private fun ResignFlag(t: GameTile, friendName: String, modifier: Modifier, onTap: () -> Unit) {
    Box(
        modifier.size(30.dp).requiredSize(44.dp, 50.dp).tileClickable(card = false, label = "Resign ${t.kind.title} against $friendName", onClick = onTap),
        Alignment.Center,
    ) {
        Box(
            Modifier.size(22.dp).clip(CircleShape)
                .background(if (com.wordocious.app.ui.vs.vsDarkSeason) Color.Black.copy(alpha = 0.30f) else Color.White.copy(alpha = 0.85f)),
            Alignment.Center,
        ) { FamIconImage(FamIcon.FLAG, FriendsPink.solid, 12.dp) }
    }
}

/** The row turned over, inside its 50 dp: "Resign Ghost?" with "They win this one" under it, then Keep and Resign. */
@Composable
private fun ResignConfirm(t: GameTile, onKeep: () -> Unit, onResign: () -> Unit) {
    // a11y review 10-16 #5: focus lands on Keep when the row flips.
    val keepFocus = remember { FocusRequester() }
    LaunchedEffect(Unit) { runCatching { keepFocus.requestFocus() } }
    Row(
        Modifier.fillMaxWidth().heightIn(min = 50.dp).padding(start = 12.dp, end = 8.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        FamIconImage(FamIcon.FLAG, FriendsPink.solid, 18.dp)
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(1.dp)) {
            FitText("Resign ${t.kind.title}?", 12.5f, FontWeight.Black, FriendsPink.heading, 0.75f)
            FitText("They win this one", 11f, FontWeight.Bold, FriendsPink.muted, 0.8f)
        }
        // the 28 dp pills sit in 44 dp hit areas (a11y review 10-16 #6; the row stays 50)
        Box(
            Modifier.height(28.dp).requiredHeight(44.dp).focusRequester(keepFocus)
                .tileClickable(card = false, label = "Keep ${t.kind.title}", onClick = onKeep),
            Alignment.Center,
        ) {
            Box(
                Modifier.height(28.dp).widthIn(min = 52.dp).clip(CircleShape).background(FriendsTiles.purple.copy(alpha = 0.18f)).padding(horizontal = 10.dp),
                Alignment.Center,
            ) { Text("Keep", fontSize = 11.5.sp, fontWeight = FontWeight.Black, color = FriendsTiles.purple, maxLines = 1) }
        }
        Box(
            Modifier.height(28.dp).requiredHeight(44.dp).tileClickable(card = false, label = "Resign ${t.kind.title}", onClick = onResign),
            Alignment.Center,
        ) {
            Box(
                Modifier.height(28.dp).widthIn(min = 52.dp).clip(CircleShape)
                    .background(Brush.verticalGradient(listOf(Color(0xFFF472B6), Color(0xFFDB2777)))).padding(horizontal = 10.dp),
                Alignment.Center,
            ) { Text("Resign", fontSize = 11.5.sp, fontWeight = FontWeight.Black, color = Color.White, maxLines = 1) }
        }
    }
}
