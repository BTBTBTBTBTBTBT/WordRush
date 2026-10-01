package com.wordocious.app.ui.vs

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.data.AuthService
import com.wordocious.app.data.HeadToHeadService
import com.wordocious.app.data.VsChallengeService
import com.wordocious.app.ui.bannerShimmer
import com.wordocious.app.ui.clickableNoRipple
import com.wordocious.app.ui.modeAccent
import com.wordocious.app.ui.theme.Nunito
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.core.GameMode
import com.wordocious.core.TileState
import com.wordocious.core.VsOutcome
import com.wordocious.core.challengeHeadline
import com.wordocious.core.evaluateGuess
import com.wordocious.core.vsClock
import com.wordocious.core.vsMargin

// Async challenge screens (VS overhaul §3–§5, founder 2026-10-01): the panel a
// send run shows instead of an opponent, CHALLENGE SENT!, the race result in
// the HOME palette, and the /vs/challenge/<code> route (intro card, expired,
// already raced, your own challenge).

private val WORDMARK = listOf(Color(0xFF7C3AED), Color(0xFFEC4899))

/** "SOLVED IN 4 · 1:52" / "NOT SOLVED" for a run line. */
private fun runLine(r: VsChallengeService.Run): String =
    if (r.solved) "SOLVED IN ${r.guesses} · ${vsClock(r.timeMs)}" else "NOT SOLVED"

/** The opponent panel of a run being played to send (§3): `YOUR RUN` / who will race it. */
@Composable
fun SendRunPanel(send: VsLaunch.Send, modifier: Modifier = Modifier) {
    val n = send.friendIds.size
    val who = when {
        n > 0 -> "$n ${if (n == 1) "friend" else "friends"} will race it"
        else -> "Anyone with the link"
    }
    Row(
        modifier.fillMaxWidth().vsCard(12.dp).padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        VsIconSquare { Icon(painterResource(com.wordocious.app.R.drawable.ic_swords), null, tint = VsTeal.ink, modifier = Modifier.size(16.dp)) }
        Column(Modifier.weight(1f)) {
            Text("YOUR RUN", fontSize = 12.sp, fontWeight = FontWeight.Black, letterSpacing = 0.8.sp, color = VsTeal.deep)
            Text(who, fontSize = 10.5.sp, fontWeight = FontWeight.Bold, color = VsTeal.sub)
        }
    }
}

/**
 * The player's mini board in OUR colors (§5): single-board modes evaluate each
 * guess row against the solution; multi-board modes draw one square per board
 * (filled = solved).
 */
@Composable
fun MiniRunBoard(mode: GameMode, run: VsChallengeService.Run, solutions: List<String>) {
    val tile = 16.dp
    val gap = 3.dp
    @Composable
    fun Square(state: TileState) {
        val color = when (state) {
            TileState.CORRECT -> VsPurple.ink
            TileState.PRESENT -> Color(0xFFF59E0B)
            else -> Color(0xFFCBD5E1)
        }
        val m = if (state == TileState.CORRECT)
            Modifier.shadow(3.dp, RoundedCornerShape(4.dp), ambientColor = VsPurple.ink.copy(alpha = 0.5f), spotColor = VsPurple.ink.copy(alpha = 0.5f))
        else Modifier
        Box(m.size(tile).clip(RoundedCornerShape(4.dp)).background(color))
    }
    val total = maxOf(1, run.totalBoards)
    if (total > 1) {
        Column(verticalArrangement = Arrangement.spacedBy(gap)) {
            (0 until total).chunked(if (total > 8) 7 else 4).forEach { row ->
                Row(horizontalArrangement = Arrangement.spacedBy(gap)) {
                    row.forEach { i -> Square(if (i < run.boardsSolved) TileState.CORRECT else TileState.ABSENT) }
                }
            }
        }
        return
    }
    val solution = solutions.firstOrNull()?.uppercase()?.replace(" ", "")
    val rows = run.guessLog.mapNotNull { g ->
        val guess = g.uppercase().replace(" ", "")
        if (solution == null || guess.length != solution.length) null
        else runCatching { evaluateGuess(solution, guess).tiles.map { it.state } }.getOrNull()
    }
    Column(verticalArrangement = Arrangement.spacedBy(gap)) {
        if (rows.isEmpty()) {
            Row(horizontalArrangement = Arrangement.spacedBy(gap)) { repeat(solution?.length ?: 5) { Square(TileState.EMPTY) } }
        }
        rows.forEach { r -> Row(horizontalArrangement = Arrangement.spacedBy(gap)) { r.forEach { Square(it) } } }
    }
}

/** Close (purple) + centered WORDOCIOUS wordmark — the results screens' top bar (§5). */
@Composable
private fun ResultTopBar(onClose: () -> Unit) {
    Box(Modifier.fillMaxWidth().statusBarsPadding().padding(horizontal = 12.dp, vertical = 8.dp)) {
        Box(Modifier.size(36.dp).clip(CircleShape).clickableNoRipple(onClose).align(Alignment.CenterStart), Alignment.Center) {
            Icon(Icons.Filled.Close, "Close", tint = VsPurple.ink, modifier = Modifier.size(22.dp))
        }
        Text(
            "WORDOCIOUS", fontSize = 20.sp, fontWeight = FontWeight.Black, letterSpacing = 0.5.sp,
            style = TextStyle(brush = Brush.horizontalGradient(WORDMARK), fontFamily = Nunito),
            modifier = Modifier.align(Alignment.Center),
        )
    }
}

@Composable
private fun PurpleButton(title: String, sub: String? = null, modifier: Modifier = Modifier, onClick: () -> Unit) {
    Column(
        modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(VsPurple.ink).clickableNoRipple(onClick).padding(vertical = 12.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(title, fontSize = 14.sp, fontWeight = FontWeight.Black, letterSpacing = 0.6.sp, color = Color.White)
        sub?.let { Text(it, fontSize = 10.5.sp, fontWeight = FontWeight.Bold, color = Color.White.copy(alpha = 0.85f)) }
    }
}

@Composable
private fun SoftPurpleButton(title: String, modifier: Modifier = Modifier, onClick: () -> Unit) {
    Box(
        modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(VsPurple.soft).clickableNoRipple(onClick).padding(vertical = 13.dp),
        Alignment.Center,
    ) { Text(title, fontSize = 14.sp, fontWeight = FontWeight.Black, letterSpacing = 0.6.sp, color = VsPurple.mid) }
}

/**
 * The challenge result (§5, board AA phone 4), in the HOME palette: a split
 * window (each half lavender when that side won; draw both pale), the frosted
 * strip with the headline and a bare share icon, the two columns (label, mini
 * board, big time, solved line), the H2H card with the XP chip, and CHALLENGE
 * BACK / VS HOME.
 */
@Composable
fun ChallengeResultView(
    mode: GameMode,
    outcome: VsOutcome,
    mine: VsChallengeService.Run,
    theirs: VsChallengeService.Run,
    solutions: List<String>,
    theirName: String,
    theirAvatarUrl: String?,
    h2h: HeadToHeadService.HeadToHeadRecord?,
    xp: Int?,
    onClose: () -> Unit,
    onChallengeBack: () -> Unit,
    onShare: (headline: String) -> Unit,
) {
    val won = outcome == VsOutcome.WIN
    val lost = outcome == VsOutcome.LOSS
    val draw = outcome == VsOutcome.DRAW
    val leftBg = if (draw) VsPurple.draw else if (won) VsPurple.won else VsPurple.plain
    val rightBg = if (draw) VsPurple.draw else if (lost) VsPurple.won else VsPurple.plain
    val headline = challengeHeadline(outcome, theirName)
    val margin = vsMargin(mine.core(), theirs.core())
    Column(Modifier.fillMaxSize().background(VsTeal.page)) {
        ResultTopBar(onClose)
        Column(
            Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Column(
                Modifier.fillMaxWidth()
                    .shadow(6.dp, RoundedCornerShape(16.dp), ambientColor = Color(0x144C1D95), spotColor = Color(0x144C1D95))
                    .clip(RoundedCornerShape(16.dp))
                    .drawBehind {
                        drawRect(leftBg, size = Size(size.width / 2f, size.height))
                        drawRect(rightBg, topLeft = Offset(size.width / 2f, 0f), size = Size(size.width / 2f, size.height))
                        drawRect(Brush.linearGradient(
                            0f to Color.White.copy(alpha = 0.35f), 0.55f to Color.White.copy(alpha = 0f),
                            start = Offset.Zero, end = Offset(size.width, size.height),
                        ))
                    }
                    .then(if (won && !WTheme.reducedMotion) Modifier.bannerShimmer() else Modifier),
            ) {
                Column(
                    Modifier.fillMaxWidth().background(Color.White.copy(alpha = 0.5f)).padding(start = 12.dp, top = 10.dp, end = 6.dp, bottom = 10.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        Icon(painterResource(com.wordocious.app.R.drawable.ic_swords), null, tint = VsPurple.ink, modifier = Modifier.size(18.dp))
                        Text(headline, fontSize = 16.sp, fontWeight = FontWeight.Black, letterSpacing = 0.4.sp, color = VsPurple.deep, modifier = Modifier.weight(1f), maxLines = 2)
                        Box(Modifier.size(36.dp).clickableNoRipple { onShare(headline) }, Alignment.Center) {
                            Icon(Icons.Filled.Share, "Share", tint = VsPurple.mid, modifier = Modifier.size(19.dp))
                        }
                    }
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        Box(Modifier.size(18.dp), Alignment.Center) { com.wordocious.app.ui.ModeGlyph(mode, modeAccent(mode), 18.dp) }
                        Text(
                            "${vsModeName(mode).uppercase()} · SAME PUZZLE · $margin",
                            fontSize = 10.5.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = 0.4.sp, color = VsPurple.mid,
                        )
                    }
                }
                Row(Modifier.fillMaxWidth().padding(vertical = 14.dp)) {
                    ResultColumn("YOU", won, mine, mode, solutions, Modifier.weight(1f))
                    ResultColumn("@${theirName.uppercase()}", lost, theirs, mode, solutions, Modifier.weight(1f))
                }
            }
            // Head-to-head with the XP chip.
            Row(
                Modifier.fillMaxWidth().vsCard().padding(12.dp),
                verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                VsAvatar(theirName, theirAvatarUrl, size = 36.dp, borderColor = Color.Transparent)
                Column(Modifier.weight(1f)) {
                    Text("YOU AND @${theirName.uppercase()}", fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 0.6.sp, color = VsTeal.label, maxLines = 1)
                    Text(
                        h2h?.let { vsRivalLine(it.myWins, it.theirWins, null) } ?: "…",
                        fontSize = 14.sp, fontWeight = FontWeight.Black, color = VsPurple.deep,
                    )
                }
                if (xp != null && xp > 0) {
                    Text(
                        "+$xp XP", fontSize = 11.sp, fontWeight = FontWeight.Black, color = Color(0xFF92400E),
                        modifier = Modifier.clip(RoundedCornerShape(50)).background(Color(0xFFFEF3C7))
                            .border(1.dp, Color(0xFFFCD34D), RoundedCornerShape(50)).padding(horizontal = 10.dp, vertical = 4.dp),
                    )
                }
            }
            PurpleButton("CHALLENGE BACK", "new puzzle, ${theirName.replaceFirstChar { it.uppercaseChar() }} races you", onClick = onChallengeBack)
            SoftPurpleButton("VS HOME", onClick = onClose)
            Spacer(Modifier.height(24.dp))
        }
    }
}

@Composable
private fun ResultColumn(label: String, winner: Boolean, run: VsChallengeService.Run, mode: GameMode, solutions: List<String>, modifier: Modifier) {
    Column(modifier, horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            if (winner) Icon(Icons.Filled.EmojiEvents, null, tint = Color(0xFFB45309), modifier = Modifier.size(13.dp))
            Text(label, fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 0.8.sp, color = VsPurple.deep, maxLines = 1)
        }
        MiniRunBoard(mode, run, solutions)
        Text(vsClock(run.timeMs), fontSize = 22.sp, fontWeight = FontWeight.Black, color = VsPurple.deep)
        Text(if (run.solved) "SOLVED IN ${run.guesses}" else "NOT SOLVED", fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 0.6.sp, color = VsPurple.mid)
    }
}

/** The race's finish, from the live VM (§4 → §5). */
@Composable
fun RaceResultScreen(vm: VSMatchViewModel, onHome: () -> Unit, onGoPro: () -> Unit, onChallengeBack: (String) -> Unit) {
    val c = vm.race ?: return
    val mine = vm.myRun
    val outcome = vm.raceOutcome
    val context = LocalContext.current
    if (mine == null || outcome == null) {
        Box(Modifier.fillMaxSize().background(VsTeal.page), Alignment.Center) { CircularProgressIndicator(color = VsPurple.ink) }
        return
    }
    ChallengeResultView(
        mode = vm.mode, outcome = outcome, mine = mine, theirs = c.run,
        solutions = c.run.solutions.ifEmpty { mine.solutions },
        theirName = c.challenger.username, theirAvatarUrl = c.challenger.avatarUrl,
        h2h = vm.headToHead, xp = vm.xpResult?.totalXp,
        onClose = onHome,
        onChallengeBack = { if (AuthService.isProActive) onChallengeBack(c.challenger.id) else onGoPro() },
        onShare = { headline ->
            com.wordocious.app.data.ShareHelper.share(
                context, "${headline.lowercase().replaceFirstChar { it.uppercaseChar() }} ${vsModeName(vm.mode)} on Wordocious\nhttps://wordocious.com/vs/challenge/${c.code}",
            )
        },
    )
}

/** CHALLENGE SENT! (§3), from the live VM. */
@Composable
fun ChallengeSentScreen(vm: VSMatchViewModel, onHome: () -> Unit) {
    val context = LocalContext.current
    val run = vm.myRun
    val state = vm.sendState
    val send = vm.sendLaunch
    Column(Modifier.fillMaxSize().background(VsTeal.page)) {
        ResultTopBar(onHome)
        Column(
            Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp),
            horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Spacer(Modifier.height(8.dp))
            when (state) {
                null, SendState.Sending -> {
                    CircularProgressIndicator(color = VsPurple.ink)
                    Text("Sending your run…", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = VsTeal.sub)
                }
                is SendState.Failed -> {
                    Text("COULDN’T SEND", fontSize = 22.sp, fontWeight = FontWeight.Black, color = VsPurple.deep)
                    Text(state.message, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = VsTeal.sub, textAlign = TextAlign.Center)
                    PurpleButton("TRY AGAIN") { vm.retrySend() }
                }
                is SendState.Sent -> {
                    Column(
                        Modifier.fillMaxWidth().vsCard(16.dp).background(Brush.verticalGradient(listOf(VsPurple.won, VsPurple.plain)))
                            .padding(vertical = 18.dp, horizontal = 12.dp),
                        horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        Text("CHALLENGE SENT!", fontSize = 22.sp, fontWeight = FontWeight.Black, letterSpacing = 0.6.sp, color = VsPurple.deep)
                        run?.let { r ->
                            Text(
                                "${vsModeName(vm.mode).uppercase()} · ${runLine(r)} · 24H TO RACE",
                                fontSize = 10.5.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = 0.4.sp, color = VsPurple.mid, textAlign = TextAlign.Center,
                            )
                            MiniRunBoard(vm.mode, r, r.solutions)
                        }
                    }
                    if (send?.link == true) {
                        PurpleButton("SHARE LINK") {
                            com.wordocious.app.data.ShareEvents.log("link_invite", vm.mode.name.lowercase(), "vs_challenge")
                            com.wordocious.app.data.ShareHelper.share(
                                context,
                                "Race my Wordocious ${vsModeName(vm.mode)} run — code ${state.code}\nhttps://wordocious.com/vs/challenge/${state.code}",
                            )
                        }
                    }
                }
            }
            SoftPurpleButton("VS HOME", onClick = onHome)
            Spacer(Modifier.height(24.dp))
        }
    }
}

/**
 * The /vs/challenge/<code> route (§4): looks the code up, then shows the
 * expired card, the stored result (already raced), your own challenge's
 * results so far, or the RACE intro card with START.
 */
@Composable
fun ChallengeRouteScreen(
    code: String,
    onStart: (VsChallengeService.ChallengeView) -> Unit,
    onHome: () -> Unit,
    onGoPro: () -> Unit,
    onChallengeBack: (String) -> Unit,
) {
    val context = LocalContext.current
    var lookup by remember { mutableStateOf<VsChallengeService.Lookup?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var sent by remember { mutableStateOf<VsChallengeService.Sent?>(null) }
    var h2h by remember { mutableStateOf<HeadToHeadService.HeadToHeadRecord?>(null) }
    LaunchedEffect(code) {
        when (val r = VsChallengeService.lookup(code)) {
            is VsChallengeService.LookupOutcome.Found -> {
                lookup = r.lookup
                if (r.lookup.isMine) sent = VsChallengeService.list()?.sent?.firstOrNull { it.code == r.lookup.challenge.code }
                else if (r.lookup.entry != null) AuthService.userId?.let { h2h = HeadToHeadService.fetchHeadToHead(it, r.lookup.challenge.challenger.id) }
            }
            VsChallengeService.LookupOutcome.NotFound -> error = "We couldn’t find that challenge."
            is VsChallengeService.LookupOutcome.Failed -> error = r.message
        }
    }
    val l = lookup
    val c = l?.challenge
    val mode = c?.let { runCatching { GameMode.valueOf(it.gameMode) }.getOrNull() } ?: GameMode.DUEL
    val entry = l?.entry
    if (c != null && entry != null) {
        val mine = VsChallengeService.Run(entry.solved, entry.boardsSolved, c.run.totalBoards, entry.guesses, entry.timeMs, entry.guessLog, c.run.solutions)
        val outcome = when (entry.outcome) { "win" -> VsOutcome.WIN; "loss" -> VsOutcome.LOSS; else -> VsOutcome.DRAW }
        ChallengeResultView(
            mode = mode, outcome = outcome, mine = mine, theirs = c.run, solutions = c.run.solutions,
            theirName = c.challenger.username, theirAvatarUrl = c.challenger.avatarUrl,
            h2h = h2h, xp = null, onClose = onHome,
            onChallengeBack = { if (AuthService.isProActive) onChallengeBack(c.challenger.id) else onGoPro() },
            onShare = { headline ->
                com.wordocious.app.data.ShareHelper.share(context, "${headline.lowercase().replaceFirstChar { it.uppercaseChar() }} ${vsModeName(mode)} on Wordocious\nhttps://wordocious.com/vs/challenge/${c.code}")
            },
        )
        return
    }
    Column(Modifier.fillMaxSize().background(VsTeal.page)) {
        VsNavBar("CHALLENGE", onBack = onHome) { if (c != null) VsModeChip(mode) }
        Column(
            Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp), horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Spacer(Modifier.height(12.dp))
            when {
                error != null -> SimpleCard(error!!, onHome)
                l == null || c == null -> CircularProgressIndicator(color = VsTeal.ink)
                l.expired && !l.isMine -> SimpleCard("This challenge has expired", onHome)
                l.isMine -> {
                    VsCard {
                        VsSectionLabel("YOUR CHALLENGE")
                        Text("${vsModeName(mode)} · ${runLine(c.run).lowercase().replaceFirstChar { it.uppercaseChar() }}", fontSize = 13.sp, fontWeight = FontWeight.ExtraBold, color = VsTeal.deep)
                        val results = sent?.results.orEmpty()
                        if (results.isEmpty()) Text(if (l.expired) "Nobody raced it." else "Nobody has raced it yet.", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = VsTeal.sub)
                        results.forEach { r ->
                            Text(
                                "@${r.username} " + when (r.outcome) { "win" -> "lost"; "loss" -> "beat it"; else -> "tied it" } +
                                    " · " + (if (r.solved) "solved in ${r.guesses} · ${vsClock(r.timeMs)}" else "not solved"),
                                fontSize = 12.sp, fontWeight = FontWeight.Bold, color = VsTeal.ink,
                            )
                        }
                    }
                    VsTealButton("VS HOME", Modifier.fillMaxWidth(), onClick = onHome)
                }
                else -> RaceIntroCard(c, mode) { onStart(c) }
            }
        }
    }
}

@Composable
private fun SimpleCard(text: String, onHome: () -> Unit) {
    VsCard(padding = 18.dp) {
        Text(text, fontSize = 16.sp, fontWeight = FontWeight.Black, color = VsTeal.deep, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth())
        VsTealButton("VS HOME", Modifier.fillMaxWidth(), onClick = onHome)
    }
}

/** The frosted teal intro card: RACE @DOUG'S RUN, target, START (§4). */
@Composable
private fun RaceIntroCard(c: VsChallengeService.ChallengeView, mode: GameMode, onStart: () -> Unit) {
    val name = c.challenger.username
    Column(
        Modifier.fillMaxWidth().shadow(6.dp, RoundedCornerShape(16.dp), ambientColor = Color(0x144C1D95), spotColor = Color(0x144C1D95))
            .clip(RoundedCornerShape(16.dp)).background(Brush.verticalGradient(listOf(Color(0xFFD5F5EE), Color(0xFFE0F2FE)))),
    ) {
        Column(
            Modifier.fillMaxWidth().background(Color.White.copy(alpha = 0.5f)).padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                VsAvatar(name, c.challenger.avatarUrl, size = 40.dp, borderColor = Color.Transparent)
                Text("RACE @${name.uppercase()}’S RUN", fontSize = 16.sp, fontWeight = FontWeight.Black, color = VsTeal.deep, modifier = Modifier.weight(1f))
            }
            VsModeChip(mode)
        }
        Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(
                if (c.run.solved) "Solved in ${c.run.guesses} · ${vsClock(c.run.timeMs)}" else "Not solved — just solve it",
                fontSize = 18.sp, fontWeight = FontWeight.Black, color = VsTeal.ink,
            )
            Text(
                "Same puzzle. ${name.replaceFirstChar { it.uppercaseChar() }}’s pace plays out beside you.",
                fontSize = 12.sp, fontWeight = FontWeight.Bold, color = VsTeal.sub,
            )
            Text("${VsChallengeService.hoursLeft(c.expiresAt)}h left", fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, color = VsTeal.label)
            VsTealButton("START", Modifier.fillMaxWidth(), onClick = onStart)
        }
    }
}
