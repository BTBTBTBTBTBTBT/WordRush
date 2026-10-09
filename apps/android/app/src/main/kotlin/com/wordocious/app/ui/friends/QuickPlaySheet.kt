package com.wordocious.app.ui.friends

import com.wordocious.app.ui.SoftModalSheet
import com.wordocious.app.ui.Icon3D
import com.wordocious.app.ui.Icon3DName
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.animateColorAsState
import androidx.compose.ui.draw.shadow
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.heightIn
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp
import com.wordocious.app.ui.HeadlinePalette
import com.wordocious.app.ui.LiveHeadline
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.core.MotionSpec
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
import androidx.compose.runtime.LaunchedEffect
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
data class QuickPlayRequest(val friendId: String?, val kind: FriendlyKind = FriendlyKind.RPS, val kindChosen: Boolean = false)

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
    // 2.8 wave 3 (item 9): a game already chosen (a Play-with-friends tile, a rematch) goes straight in once the
    // friend is known; Call It stops at its stake step. No second game pick, no separate INVITE button.
    var kindChosen by remember { mutableStateOf(request.kindChosen) }
    var autoStarted by remember { mutableStateOf(false) }
    var stake by remember { mutableStateOf(COIN_STAKES[0]) }
    var sending by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    // BJ13: no friend chosen (or the one asked for isn't in your circle) → the picker.
    val friend = friends.firstOrNull { it.id == friendId }

    fun begin(f: FriendsService.FriendProfile, k: FriendlyKind) {
        if (sending) return
        sending = true
        error = null
        scope.launch {
            when (val r = FriendlyGamesService.start(k, f.id, if (k == FriendlyKind.COIN) stake else null)) {
                is FriendlyGamesService.StartOutcome.Started -> onOpenGame(r.game.id)
                is FriendlyGamesService.StartOutcome.Failed -> { error = r.message; kindChosen = false }
            }
            sending = false
        }
    }
    LaunchedEffect(friend?.id, kindChosen, kind) {
        val f = friend
        if (f != null && kindChosen && kind != FriendlyKind.COIN && !autoStarted) {
            autoStarted = true
            begin(f, kind)
        }
    }

    // A1: a pink-tinted sheet (no white).
    SoftModalSheet(
        // BJ13 (mockup option 1): the picker sits on a calm lavender sheet.
        onDismissRequest = onDismiss, sheetState = sheetState,
        containerColor = animateColorAsState(if (friend == null) PICKER_SHEET else SHEET_TINT, tween(MotionSpec.CROSS_FADE_MS), label = "sheetTint").value,
        dragHandle = {
            Box(Modifier.padding(top = 10.dp, bottom = 4.dp).size(width = 40.dp, height = 5.dp).clip(RoundedCornerShape(50)).background(friendsLine(FRIENDS_CARD_ACCENT, 0.5f)))
        },
    ) {
        Column(
            Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp).navigationBarsPadding(),
        ) {
            // BJ13: picking a friend moves to the play state with the shared soft rise (core
            // MotionSpec: 0.96 → 1, up 14, fade; Reduce Motion: a cross-fade).
            val reduced = WTheme.reducedMotion
            val riseOffsetPx = with(LocalDensity.current) { MotionSpec.RISE_OFFSET_DP.dp.roundToPx() }
            AnimatedContent(
                targetState = friend == null,
                transitionSpec = {
                    if (reduced) {
                        fadeIn(tween(MotionSpec.CROSS_FADE_MS)) togetherWith fadeOut(tween(MotionSpec.CROSS_FADE_MS))
                    } else {
                        (fadeIn(tween(MotionSpec.RISE_MS, easing = RISE_EASE)) +
                            scaleIn(tween(MotionSpec.RISE_MS, easing = RISE_EASE), MotionSpec.RISE_SCALE, TransformOrigin(0.5f, 0f)) +
                            slideInVertically(tween(MotionSpec.RISE_MS, easing = RISE_EASE)) { riseOffsetPx }) togetherWith
                            fadeOut(tween(MotionSpec.POP_DISMISS_MS))
                    }
                },
                label = "quickPlayPick",
            ) { picking ->
                if (picking) {
                    FriendPicker(kind, friends, now) { friendId = it.id }
                } else Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    // Friend header (C cheering beside it — A7: the banner's host is O1)
                    if (friend != null) {
                        val on = friend.isOnline(now)
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            FriendFace(friend.username, friend.avatarUrl, friend.avatarEmoji, 48.dp, online = on, userId = friend.id)
                            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                                // BJ16: the LET'S PLAY! lettering; the friend's @name rides under it.
                                com.wordocious.app.ui.HeadingArt(
                                    com.wordocious.app.ui.Heading.LETSPLAY, height = 28.dp, maxWidth = 170.dp,
                                    contentDescription = "Play with ${friend.username}", alignment = Alignment.CenterStart,
                                )
                                Text(
                                    "@${friend.username}", fontSize = 14.sp, fontWeight = FontWeight.Black,
                                    color = FriendsPink.ink, maxLines = 1, overflow = TextOverflow.Ellipsis,
                                    modifier = Modifier.clearAndSetSemantics { },
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

                    if (kindChosen) {
                        // The game is picked: Call It asks its stake here (the three chips), everything else is
                        // already starting. One step, then straight into the game.
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
                            error?.let { Text(it, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = FriendsPink.solid) }
                            PinkButton(
                                if (sending) "STARTING…" else "START", modifier = Modifier.fillMaxWidth(),
                                enabled = friend != null && !sending,
                            ) { friend?.let { begin(it, FriendlyKind.COIN) } }
                        } else {
                            Box(Modifier.fillMaxWidth().padding(vertical = 18.dp), contentAlignment = Alignment.Center) {
                                Text("Starting ${kind.title}…", fontSize = 14.sp, fontWeight = FontWeight.ExtraBold, color = FriendsPink.muted)
                            }
                        }
                    } else {
                        // Pick a friend, then ONE game tile: it starts at once (Call It asks its stake first).
                        FriendsLabel(if (friend?.isOnline(now) == true) "PICK A GAME · LIVE WHILE THEY'RE ON" else "PICK A GAME")
                        // Six tiles, 3 across x 2 rows (web parity).
                        FRIENDLY_KINDS.chunked(3).forEach { row ->
                            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                row.forEach { k ->
                                    GameTile(k, selected = false, modifier = Modifier.weight(1f)) {
                                        kind = k
                                        error = null
                                        kindChosen = true
                                    }
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
                        Text(
                            "${friend?.username?.replaceFirstChar { it.uppercaseChar() } ?: "Your friend"} gets a ping. If they're busy, it waits as your turn.",
                            fontSize = 11.sp, fontWeight = FontWeight.Bold, color = FriendsPink.label, textAlign = TextAlign.Center,
                            modifier = Modifier.fillMaxWidth(),
                        )
                    }
                    Spacer(Modifier.height(12.dp))
                }
            }
        }
    }
}

/** BJ9's soft-rise curve (ease-out-expo-like; web MOTION.growEase). */
private val RISE_EASE = CubicBezierEasing(0.16f, 1f, 0.3f, 1f)

/**
 * BJ13 (founder 10-03): the pocket-game friend picker as a character-select grid. Header:
 * the game's title art (else its 3D icon + the name in the live title lettering), one
 * rules line, then WHO ARE YOU PLAYING? (its art once it ships). The grid fills the sheet:
 * 3 across on phones, 4 on wide sheets, avatars ~76% of the cell (PickerGrid); each cell =
 * the avatar (green glow when on), the name and one short status. Online first, then most
 * recent. No chevrons, stripes or bordered card. No friends: I's invite scene.
 */
@Composable
private fun FriendPicker(
    kind: FriendlyKind,
    friends: List<FriendsService.FriendProfile>,
    now: Long,
    onPick: (FriendsService.FriendProfile) -> Unit,
) {
    val ctx = LocalContext.current
    val titleRes = remember(kind) { ctx.resources.getIdentifier(pocketTitleArtName(kind), "drawable", ctx.packageName) }
    val askRes = remember { ctx.resources.getIdentifier(PICK_FRIEND_TITLE_ART, "drawable", ctx.packageName) }
    // On now first, then the freshest presence, then A–Z (web sortForPicker).
    val ordered = friends.sortedWith(
        compareByDescending<FriendsService.FriendProfile> { it.isOnline(now) }
            .thenByDescending { it.lastSeenMs ?: 0L }.thenBy { it.username.lowercase() },
    )
    Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
        if (titleRes != 0) {
            Image(
                painterResource(titleRes), contentDescription = kind.title, contentScale = ContentScale.Fit,
                modifier = Modifier.fillMaxWidth().heightIn(max = 84.dp).semantics { heading() },
            )
        } else {
            LiveHeadline(kind.title, HeadlinePalette.FRIENDS, Modifier.fillMaxWidth(), maxSize = 32.sp, minSize = 18.sp, maxLines = 1)
        }
        Text(
            friendlyRules(kind), fontSize = 15.sp, fontWeight = FontWeight.ExtraBold, color = FriendsPink.heading,
            modifier = Modifier.padding(top = 6.dp),
        )
        Spacer(Modifier.height(12.dp))
        if (askRes != 0) {
            Image(
                painterResource(askRes), contentDescription = "Who are you playing?", contentScale = ContentScale.Fit,
                modifier = Modifier.fillMaxWidth(0.64f).heightIn(max = 30.dp).semantics { heading() },
            )
        } else {
            Text(
                "WHO ARE YOU PLAYING?", fontSize = 13.sp, fontWeight = FontWeight.Black, letterSpacing = 1.6.sp,
                color = FriendsPink.muted, modifier = Modifier.semantics { heading() },
            )
        }
        Spacer(Modifier.height(12.dp))
        if (ordered.isEmpty()) {
            // §A7 / BI24: I with the invite scene, the brand headline over I's voice line.
            com.wordocious.app.ui.BrandEmptyState(
                title = "No friends yet", line = "Add a friend first, then pick a game and play.",
                scene = com.wordocious.app.ui.SceneArt.INVITE, artHeight = 110.dp,
                accent = com.wordocious.app.ui.PageAccent.friends, lineColor = FriendsPink.muted,
            )
        } else {
            BoxWithConstraints(Modifier.fillMaxWidth()) {
                val (cols, avatar) = PickerGrid.layout(maxWidth.value)
                // A partial last row sits CENTERED (founder: symmetry): every cell keeps the
                // grid's column width and each row centers, instead of trailing spacers.
                val cellW = (maxWidth - (PickerGrid.GAP * (cols - 1)).dp) / cols
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    ordered.chunked(cols).forEach { row ->
                        Row(
                            Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(PickerGrid.GAP.dp, Alignment.CenterHorizontally),
                        ) {
                            row.forEach { f -> PickerCell(f, avatar.dp, now, Modifier.width(cellW)) { onPick(f) } }
                        }
                    }
                }
            }
        }
        Spacer(Modifier.height(16.dp))
    }
}

/**
 * One character-select cell: the friend's REAL avatar (FriendFace → the shared resolver: their
 * mascot, photo or cast pick) as a tile filling the cell, a soft green glow when they're on
 * (no outline), the name (no @) and one short status, centered.
 */
@Composable
private fun PickerCell(f: FriendsService.FriendProfile, avatar: Dp, now: Long, modifier: Modifier, onClick: () -> Unit) {
    val (status, on) = pickerStatus(f, now)
    Column(
        modifier.squishClickable(label = "${f.username}, $status") { onClick() },
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        val glow = if (on) {
            Modifier.shadow(16.dp, com.wordocious.app.ui.avatarTileShape(avatar), clip = false, ambientColor = FriendsPink.green, spotColor = FriendsPink.green)
        } else Modifier
        FriendFace(f.username, f.avatarUrl, f.avatarEmoji, avatar, online = false, modifier = glow, userId = f.id)
        Spacer(Modifier.height(6.dp))
        Text(
            f.username, fontSize = 15.sp, fontWeight = FontWeight.Black, color = FriendsPink.heading,
            maxLines = 1, overflow = TextOverflow.Ellipsis, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth(),
        )
        Text(
            status, fontSize = 12.sp, fontWeight = FontWeight.ExtraBold, color = if (on) FriendsPink.green else FriendsPink.muted,
            maxLines = 1, overflow = TextOverflow.Ellipsis, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth(),
        )
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

/** BJ13: the calm lavender picker sheet (founder mockup option 1). */
private val PICKER_SHEET = Color(0xFFF4F0FF)

/** A1 the quick-play sheet's soft pink wash. */
private val SHEET_TINT = Color(0xFFFFF3F9)
