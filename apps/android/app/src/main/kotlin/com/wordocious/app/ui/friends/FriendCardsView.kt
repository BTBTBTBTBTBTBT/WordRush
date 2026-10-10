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
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
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
import com.wordocious.core.FriendsLayout
import com.wordocious.core.GameTile

// The Friends tab, ONE card per friend (FRIDAY-QUEUE items 9 + 9e, 2.8 wave 3; words and order from
// core FriendCards, pinned by friend-cards-fixtures.json). Their living mascot with the green dot and
// "playing Classic" under it, the name, "N games waiting on you" and a compact strip of game tiles (the
// game's art + its name + what waits in plain words); a tile opens that game. No PLAY pills, no repeated "vs @name", no
// bordered boxes. Founder 10-09: a friend with several games folds them into ONE "Pick a game" dropdown (the games' art
// overlapping, the first titles, a chevron) that opens the tiles (yours first, theirs quiet); one game shows its tile;
// none shows the start row. Each tile carries a small resign flag that flips the tile to "Resign Ghost?" Keep / Resign in
// place. The ⋯ opens the family action menu (profile, play a game …) hosted by the Friends screen.

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
) {
    if (layout.cards.isEmpty()) return
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        layout.cards.forEach { card ->
            val friend = friends.firstOrNull { it.id == card.friendId }
            FriendCardView(card, friend, onOpenGame, onPlayWith, onMenu, onResign)
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
) {
    var expanded by remember(card.friendId) { mutableStateOf(false) }
    // The tile whose flag was tapped (it shows "Resign?" with Keep / Resign in place).
    var confirming by remember(card.friendId) { mutableStateOf<String?>(null) }
    // Every game going with them: yours to play first, then theirs.
    val all = card.tiles + card.theirTurn
    val accent = if (card.waiting > 0) FriendsPink.solid else FriendsTiles.purple
    Column(
        Modifier.fillMaxWidth()
            .then(if (friend != null) Modifier.tileClickable(label = "Play a game with ${card.name}", card = true) { onPlayWith(friend) } else Modifier)
            .friendsCard(16.dp)
            .padding(start = 12.dp, end = 4.dp, top = 12.dp, bottom = 12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Row(verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            // Their living mascot with the green dot; "playing Classic" under it.
            Column(Modifier.width(76.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                FriendFace(
                    card.name, friend?.avatarUrl, friend?.avatarEmoji, 52.dp, online = card.online,
                    presenceRing = false, userId = card.friendId,
                )
                card.presence?.let {
                    Text(
                        it, fontSize = 10.sp, fontWeight = FontWeight.ExtraBold, color = FriendsPink.green, maxLines = 1,
                        overflow = TextOverflow.Ellipsis, textAlign = TextAlign.Center, modifier = Modifier.padding(top = 4.dp),
                    )
                }
            }
            Column(Modifier.weight(1f).padding(top = 4.dp), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                Text(
                    card.name, fontSize = 16.sp, fontWeight = FontWeight.Black, color = FriendsPink.heading,
                    maxLines = 1, overflow = TextOverflow.Ellipsis,
                )
                if (card.headline.isNotEmpty()) {
                    Text(card.headline, fontSize = 12.5.sp, fontWeight = FontWeight.ExtraBold, color = PocketNight.pinkInk(), maxLines = 1)
                } else if (card.theirTurn.isEmpty()) {
                    Text("Tap to pick a game", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = FriendsPink.muted, maxLines = 1)
                }
            }
            // A card for someone who is not on the friend list (a game left over, or an unfriended player) still gets
            // the ⋯: its menu (hosted by the Friends screen) offers View profile + Resign for each game in play.
            RoundIconButton(onClick = { onMenu(friend ?: FriendsService.FriendProfile(id = card.friendId, username = card.name)) }, contentDescription = "More for ${card.name}") {
                FamIconImage(FamIcon.MORE, FriendsPink.solid, 18.dp)
            }
        }

        when {
            all.size >= 2 -> {
                GamesDropdown(all, expanded, accent) { expanded = !expanded }
                if (expanded) TileGrid(all, confirming, { confirming = it }, card.name, onOpenGame, onResign, Modifier.padding(end = 8.dp))
            }
            all.size == 1 -> TileGrid(all, confirming, { confirming = it }, card.name, onOpenGame, onResign, Modifier.padding(end = 8.dp))
        }
    }
}

/** The folded games: their art overlapping, "Pick a game" with the first titles under it, and a chevron. Tap opens the tiles. */
@Composable
private fun GamesDropdown(tiles: List<GameTile>, expanded: Boolean, accent: Color, onToggle: () -> Unit) {
    val label = "${tiles.size} games, " + if (expanded) "expanded" else "collapsed"
    Row(
        Modifier.fillMaxWidth().padding(end = 8.dp)
            .clip(RoundedCornerShape(16.dp)).background(friendsWash(accent, 0.10f))
            .tileClickable(card = false, label = label, onClick = onToggle)
            .padding(horizontal = 10.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy((-10).dp)) {
            tiles.take(4).forEachIndexed { i, t ->
                Box(
                    Modifier.zIndex((10 - i).toFloat()).size(34.dp).clip(CircleShape)
                        .background(FriendsPink.page).background(friendsWash(t.kind.color, 0.22f)),
                    Alignment.Center,
                ) { FriendlyGameGlyph(t.kind, 26.dp) }
            }
        }
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(1.dp)) {
            // The header already says how many wait on you; the dropdown names the games (no repeat).
            Text("Pick a game", fontSize = 13.sp, fontWeight = FontWeight.Black, color = FriendsPink.heading, maxLines = 1)
            if (!expanded) {
                Text(
                    FriendCardCopy.gamesSubtitle(tiles.map { it.kind.title }),
                    fontSize = 10.5.sp, fontWeight = FontWeight.Bold, color = FriendsPink.muted, maxLines = 1, overflow = TextOverflow.Ellipsis,
                )
            }
        }
        Box(Modifier.size(28.dp).clip(CircleShape).background(friendsWash(accent, 0.16f)), Alignment.Center) {
            Icon(
                Icons.Filled.KeyboardArrowDown, null, tint = accent,
                modifier = Modifier.size(18.dp).rotate(if (expanded) 180f else 0f),
            )
        }
    }
}

/** Tiles in a symmetric grid: one row up to 4, else 3 across. */
@Composable
private fun TileGrid(
    tiles: List<GameTile>, confirming: String?, onConfirming: (String?) -> Unit, friendName: String,
    onOpen: (String) -> Unit, onResign: (String) -> Unit, modifier: Modifier = Modifier,
) {
    val per = if (tiles.size <= 4) tiles.size.coerceAtLeast(1) else 3
    Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        tiles.chunked(per).forEach { row ->
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                row.forEach { t ->
                    Box(Modifier.weight(1f)) {
                        if (confirming == t.gameId) {
                            ResignConfirm(t, { onConfirming(null) }, { onConfirming(null); onResign(t.gameId) })
                        } else {
                            TileCell(t, quiet = !t.yourTurn, Modifier.fillMaxWidth()) { onOpen(t.gameId) }
                            ResignFlag(t, friendName, Modifier.align(Alignment.TopEnd).offset(x = 3.dp, y = (-3).dp)) { onConfirming(t.gameId) }
                        }
                    }
                }
                repeat(per - row.size) { Spacer(Modifier.weight(1f)) }
            }
        }
    }
}

/** The small flag in a tile's corner (a 30 dp hit area around a 22 dp coin). */
@Composable
private fun ResignFlag(t: GameTile, friendName: String, modifier: Modifier, onTap: () -> Unit) {
    Box(
        modifier.size(30.dp).tileClickable(card = false, label = "Resign ${t.kind.title} against $friendName", onClick = onTap),
        Alignment.Center,
    ) {
        Box(
            Modifier.size(22.dp).clip(CircleShape)
                .background(if (com.wordocious.app.ui.vs.vsDarkSeason) Color.Black.copy(alpha = 0.30f) else Color.White.copy(alpha = 0.85f)),
            Alignment.Center,
        ) { FamIconImage(FamIcon.FLAG, FriendsPink.solid, 12.dp) }
    }
}

/** The tile turned over: "Resign Ghost?", then Keep and Resign side by side, in the tile's own place. */
@Composable
private fun ResignConfirm(t: GameTile, onKeep: () -> Unit, onResign: () -> Unit) {
    val pink = FriendsPink.solid
    Column(
        Modifier.fillMaxWidth().heightIn(min = 96.dp).clip(RoundedCornerShape(14.dp)).background(friendsWash(pink, 0.14f))
            .padding(horizontal = 6.dp, vertical = 8.dp),
        horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(6.dp, Alignment.CenterVertically),
    ) {
        FamIconImage(FamIcon.FLAG, pink, 20.dp)
        Text(
            "Resign ${t.kind.title}?", fontSize = 12.sp, fontWeight = FontWeight.Black, color = FriendsPink.heading,
            maxLines = 2, textAlign = TextAlign.Center, lineHeight = 13.sp,
        )
        Text("They win this one", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = FriendsPink.muted, maxLines = 1, textAlign = TextAlign.Center)
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(5.dp)) {
            Box(
                Modifier.weight(1f).height(26.dp).clip(CircleShape).background(FriendsTiles.purple.copy(alpha = 0.18f))
                    .tileClickable(card = false, label = "Keep ${t.kind.title}", onClick = onKeep),
                Alignment.Center,
            ) { Text("Keep", fontSize = 11.5.sp, fontWeight = FontWeight.Black, color = FriendsTiles.purple, maxLines = 1) }
            Box(
                Modifier.weight(1f).height(26.dp).clip(CircleShape)
                    .background(Brush.verticalGradient(listOf(Color(0xFFF472B6), Color(0xFFDB2777))))
                    .tileClickable(card = false, label = "Resign ${t.kind.title}", onClick = onResign),
                Alignment.Center,
            ) { Text("Resign", fontSize = 11.5.sp, fontWeight = FontWeight.Black, color = Color.White, maxLines = 1) }
        }
    }
}

/**
 * The game's art, its NAME (bold, one line), then what waits in plain words (up to two lines, centered, shrink to fit);
 * a tap goes straight into that game. Founder 10-09: never a cryptic two-word state.
 */
@Composable
private fun TileCell(t: GameTile, quiet: Boolean, modifier: Modifier, onClick: () -> Unit) {
    Column(
        modifier.tileClickable(card = false, label = "${t.kind.title}, ${t.word}", onClick = onClick).alpha(if (quiet) 0.72f else 1f),
        horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        FriendlyGameIcon(t.kind, 42.dp)
        // The name shrinks to fit one line (the iOS minimumScaleFactor), never an ellipsis.
        var nameSize by remember(t.kind) { mutableStateOf(12f) }
        Text(
            t.kind.title, fontSize = nameSize.sp, fontWeight = FontWeight.Black,
            color = if (quiet) FriendsPink.muted else FriendsPink.heading,
            maxLines = 1, softWrap = false, overflow = TextOverflow.Clip, textAlign = TextAlign.Center,
            onTextLayout = { if (it.hasVisualOverflow && nameSize > 8f) nameSize -= 0.5f },
        )
        // The plain-words state: two lines at most, centered, shrinking until it fits.
        var size by remember(t.word) { mutableStateOf(10.5f) }
        Text(
            t.word, fontSize = size.sp, fontWeight = FontWeight.Bold, lineHeight = (size + 2f).sp,
            color = if (quiet) FriendsPink.muted else FriendsPink.heading.copy(alpha = 0.85f),
            maxLines = 2, overflow = TextOverflow.Clip, textAlign = TextAlign.Center,
            onTextLayout = { if (it.hasVisualOverflow && size > 7.5f) size -= 0.5f },
        )
    }
}
