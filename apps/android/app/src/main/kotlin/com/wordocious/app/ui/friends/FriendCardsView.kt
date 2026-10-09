package com.wordocious.app.ui.friends

import androidx.compose.foundation.layout.Arrangement
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
import com.wordocious.app.ui.squishClickable
import com.wordocious.core.CardFriend
import com.wordocious.core.CardGame
import com.wordocious.core.FriendCard
import com.wordocious.core.FriendCards
import com.wordocious.core.FriendsLayout
import com.wordocious.core.GameTile

// The Friends tab, ONE card per friend (FRIDAY-QUEUE items 9 + 9e, 2.8 wave 3; words and order from
// core FriendCards, pinned by friend-cards-fixtures.json). Their living mascot with the green dot and
// "playing Classic" under it, the name, "N games waiting on you" and a compact strip of game tiles (the
// game's art + a one-word state); a tile opens that game. No PLAY pills, no repeated "vs @name", no
// bordered boxes. Their-turn games collapse into one quiet line, expanded on tap. The ⋯ opens the
// family action menu (profile, play a game, resign …) hosted by the Friends screen.

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
) {
    if (layout.cards.isEmpty()) return
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        layout.cards.forEach { card ->
            val friend = friends.firstOrNull { it.id == card.friendId }
            FriendCardView(card, friend, onOpenGame, onPlayWith, onMenu)
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
) {
    var expanded by remember(card.friendId) { mutableStateOf(false) }
    Column(
        Modifier.fillMaxWidth()
            .then(if (friend != null) Modifier.squishClickable(label = "Play a game with ${card.name}", card = true) { onPlayWith(friend) } else Modifier)
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
                    Text(card.headline, fontSize = 12.5.sp, fontWeight = FontWeight.ExtraBold, color = FriendsPink.solid, maxLines = 1)
                } else if (card.theirTurn.isEmpty()) {
                    Text("Tap to pick a game", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = FriendsPink.muted, maxLines = 1)
                }
            }
            if (friend != null) {
                RoundIconButton(onClick = { onMenu(friend) }, contentDescription = "More for ${card.name}") {
                    FamIconImage(FamIcon.MORE, FriendsPink.solid, 18.dp)
                }
            }
        }

        if (card.tiles.isNotEmpty()) TileGrid(card.tiles, quiet = false, onOpen = onOpenGame, modifier = Modifier.padding(end = 8.dp))

        if (card.theirTurnLine.isNotEmpty()) {
            Row(
                Modifier.padding(end = 8.dp)
                    .squishClickable(label = card.theirTurnLine + if (expanded) ", expanded" else ", collapsed") { expanded = !expanded },
                verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                Text(card.theirTurnLine, fontSize = 11.5.sp, fontWeight = FontWeight.Bold, color = FriendsPink.muted, maxLines = 1)
                Icon(
                    Icons.Filled.KeyboardArrowDown, null, tint = FriendsPink.muted,
                    modifier = Modifier.size(16.dp).rotate(if (expanded) 180f else 0f),
                )
            }
            if (expanded) TileGrid(card.theirTurn, quiet = true, onOpen = onOpenGame, modifier = Modifier.padding(end = 8.dp))
        }
    }
}

/** Tiles in a symmetric grid: one row up to 4, else 3 across. */
@Composable
private fun TileGrid(tiles: List<GameTile>, quiet: Boolean, onOpen: (String) -> Unit, modifier: Modifier = Modifier) {
    val per = if (tiles.size <= 4) tiles.size.coerceAtLeast(1) else 3
    Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        tiles.chunked(per).forEach { row ->
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                row.forEach { t -> TileCell(t, quiet, Modifier.weight(1f)) { onOpen(t.gameId) } }
                repeat(per - row.size) { Spacer(Modifier.weight(1f)) }
            }
        }
    }
}

/** The game's art + its one-word state; a tap goes straight into that game. */
@Composable
private fun TileCell(t: GameTile, quiet: Boolean, modifier: Modifier, onClick: () -> Unit) {
    Column(
        modifier.squishClickable(label = "${t.kind.title}, ${t.word}", onClick = onClick).alpha(if (quiet) 0.72f else 1f),
        horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        FriendlyGameIcon(t.kind, 48.dp)
        Text(
            t.word, fontSize = 10.5.sp, fontWeight = FontWeight.ExtraBold,
            color = if (quiet) FriendsPink.muted else FriendsPink.heading,
            maxLines = 1, overflow = TextOverflow.Ellipsis, textAlign = TextAlign.Center,
        )
    }
}
