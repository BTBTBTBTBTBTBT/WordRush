package com.wordocious.app.ui.vs

import com.wordocious.app.ui.PageTint
import com.wordocious.app.ui.pageBackground
import com.wordocious.app.ui.Icon3D
import com.wordocious.app.ui.Icon3DName
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
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.filled.Close
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
import androidx.compose.ui.draw.drawWithContent
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
import com.wordocious.app.ui.stripedRow
import com.wordocious.app.ui.game.TrayState
import com.wordocious.app.ui.game.gameTray
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
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
    // A1: the tinted strip (always light) with its 4 dp teal band, the same height as the opponent strip.
    Row(
        // AB: at least the strip height; grows with Larger Text instead of clipping its two lines.
        modifier.fillMaxWidth().heightIn(min = 58.dp).vsRow(VS_ACCENT, 14.dp)
            .drawWithContent { drawContent(); drawRect(VS_ACCENT, size = Size(size.width, 4.dp.toPx())) }
            .padding(start = 12.dp, end = 12.dp, top = 10.dp, bottom = 8.dp),
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
    // L: the run's board sits in the shared game tray (won purple / lost slate).
    val tray = Modifier.gameTray(
        VsPurple.ink, if (run.solved) TrayState.WON else TrayState.LOST,
        corner = 12.dp, padding = androidx.compose.foundation.layout.PaddingValues(7.dp), shadow = false,
    )
    if (total > 1) {
        Column(tray, verticalArrangement = Arrangement.spacedBy(gap)) {
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
    Column(tray, verticalArrangement = Arrangement.spacedBy(gap)) {
        if (rows.isEmpty()) {
            Row(horizontalArrangement = Arrangement.spacedBy(gap)) { repeat(solution?.length ?: 5) { Square(TileState.EMPTY) } }
        }
        rows.forEach { r -> Row(horizontalArrangement = Arrangement.spacedBy(gap)) { r.forEach { Square(it) } } }
    }
}

/** Close (purple) + the centered cast row spelling WORDOCIOUS — the results screens' top bar (§5). */
@Composable
internal fun ResultTopBar(onClose: () -> Unit) {
    Box(Modifier.fillMaxWidth().statusBarsPadding().padding(horizontal = 12.dp, vertical = 8.dp)) {
        // The shared white close circle (HEADER_SPEC §4).
        com.wordocious.app.ui.HeaderBackButton(onClose, Modifier.align(Alignment.CenterStart), close = true)
        // Founder 10-03 (no plain-text headings): the cast spells the brand, not a gradient wordmark.
        com.wordocious.app.ui.CastRow(22.dp, Modifier.align(Alignment.Center))
    }
}

/**
 * The primary result action (A8): a LARGE PURPLE candy button, full width; an optional
 * [sub] line sits under it (TalkBack reads it with the label).
 */
@Composable
internal fun PurpleButton(title: String, sub: String? = null, modifier: Modifier = Modifier, enabled: Boolean = true, onClick: () -> Unit) {
    Column(modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(3.dp)) {
        com.wordocious.app.ui.CandyButton(
            title, onClick = { if (enabled) onClick() }, modifier = Modifier.fillMaxWidth(),
            color = com.wordocious.app.ui.CandyColor.PURPLE, size = com.wordocious.app.ui.CandySize.LARGE, fill = true,
            enabled = enabled, contentDescription = if (sub != null) "$title, $sub" else title,
        )
        sub?.let {
            Text(it, fontSize = 10.5.sp, fontWeight = FontWeight.Bold, color = VsPurple.mid, textAlign = TextAlign.Center, modifier = Modifier.clearAndSetSemantics { })
        }
    }
}

/** The quiet result action (A8): a MEDIUM PEACH candy button, full width. */
@Composable
internal fun SoftPurpleButton(title: String, modifier: Modifier = Modifier, enabled: Boolean = true, onClick: () -> Unit) {
    com.wordocious.app.ui.CandyButton(
        title, onClick = { if (enabled) onClick() }, modifier = modifier.fillMaxWidth(),
        color = com.wordocious.app.ui.CandyColor.PEACH, size = com.wordocious.app.ui.CandySize.MEDIUM, fill = true, enabled = enabled,
    )
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
    /** BJ5: the challenger's user id (the shared avatar resolver). */
    theirUserId: String? = null,
    /** A line under the window (§14: the result is saved to send later). */
    note: String? = null,
) {
    val won = outcome == VsOutcome.WIN
    val lost = outcome == VsOutcome.LOSS
    val draw = outcome == VsOutcome.DRAW
    val leftBg = if (draw) VsPurple.draw else if (won) VsPurple.won else VsPurple.plain
    val rightBg = if (draw) VsPurple.draw else if (lost) VsPurple.won else VsPurple.plain
    val headline = challengeHeadline(outcome, theirName)
    val margin = vsMargin(mine.core(), theirs.core())
    Column(Modifier.fillMaxSize().pageBackground(PageTint.VS, alwaysLight = true)) {
        ResultTopBar(onClose)
        Column(
            Modifier.fillMaxSize().navigationBarsPadding().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            // The result's host stands on the window (MASCOT_SPEC §3): S pops on a win,
            // R stands still on a loss, U (calm) on a draw.
            Box(Modifier.fillMaxWidth().padding(top = com.wordocious.app.ui.BANNER_HOST_PEEK)) {
                // A1: the tinted result card in the results' purple with its top bar.
                VsTintedCard(
                    Modifier.fillMaxWidth().then(if (won && !WTheme.reducedMotion) Modifier.clip(RoundedCornerShape(18.dp)).bannerShimmer() else Modifier),
                    accent = VS_RESULT_ACCENT, corner = 18.dp, barHeight = 10.dp,
                    barColor = if (won) VS_RESULT_ACCENT else if (draw) Color(0xFF94A3B8) else Color(0xFF64748B),
                    contentPadding = androidx.compose.foundation.layout.PaddingValues(0.dp), verticalArrangement = Arrangement.spacedBy(0.dp),
                ) {
                    Column(
                        Modifier.fillMaxWidth().background(vsWash(VS_RESULT_ACCENT, 0.20f)).padding(start = 12.dp, top = 10.dp, end = 6.dp, bottom = 10.dp),
                        verticalArrangement = Arrangement.spacedBy(4.dp),
                    ) {
                        Row(Modifier.padding(end = com.wordocious.app.ui.BANNER_HOST_CLEAR + 2.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            // Moment lettering (ART_SPEC §6): YOU WIN! / YOU LOSE / DRAW; TalkBack
                            // reads the full headline ("YOU BEAT DOUG’S RUN!"), which shares too.
                            com.wordocious.app.ui.MomentTitle(
                                when (outcome) {
                                    VsOutcome.WIN -> com.wordocious.app.ui.MomentArt.YOU_WIN
                                    VsOutcome.LOSS -> com.wordocious.app.ui.MomentArt.YOU_LOSE
                                    VsOutcome.DRAW -> com.wordocious.app.ui.MomentArt.DRAW
                                },
                                Modifier.weight(1f), widthFraction = 0.85f, maxHeight = 56.dp,
                                contentDescription = com.wordocious.app.ui.titleCaseLabel(headline),
                                alignment = Alignment.CenterStart,
                            )
                            com.wordocious.app.ui.SoftControl(Icon3DName.SHARE, "Share", onClick = { onShare(headline) })
                        }
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            Box(Modifier.size(18.dp), Alignment.Center) { com.wordocious.app.ui.ModeGlyph(mode, modeAccent(mode), 18.dp) }
                            Text(
                                "${vsModeName(mode).uppercase()} · SAME PUZZLE · $margin",
                                fontSize = 10.5.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = 0.4.sp, color = VsPurple.mid,
                            )
                        }
                    }
                    Row(Modifier.fillMaxWidth().padding(10.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        ResultColumn("YOU", won, mine, mode, solutions, Modifier.weight(1f))
                        ResultColumn("@${theirName.uppercase()}", lost, theirs, mode, solutions, Modifier.weight(1f))
                    }
                }
                com.wordocious.app.ui.Mascot(
                    // A7: the host is never the H2H notice's character below (O1 / O2 / I).
                    if (draw) com.wordocious.app.ui.Mascots.vsDraw else if (won) com.wordocious.app.ui.Mascots.vsWin else com.wordocious.app.ui.Mascots.vsLoss,
                    56.dp,
                    Modifier.align(Alignment.TopEnd).offset(x = (-2).dp, y = -com.wordocious.app.ui.BANNER_HOST_PEEK),
                    motion = if (won) com.wordocious.app.ui.MascotMotion.POP else com.wordocious.app.ui.MascotMotion.NONE,
                )
            }
            note?.let {
                Text(it, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = VsTeal.sub, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth())
            }
            // Head-to-head with the XP chip (K1-style notice: the sender's tile, soft numbers;
            // A7: O2 gasps when they beat you, O1 cheers your win, U on a draw).
            VsNoticeCard(
                accent = VS_RESULT_ACCENT,
                label = "You and @$theirName: " + (h2h?.let { vsRivalLine(it.myWins, it.theirWins, null) } ?: "loading") +
                    if (xp != null && xp > 0) ". Plus $xp XP" else "",
                onClick = null,
                avatar = { VsAvatar(theirName, theirAvatarUrl, size = 38.dp, borderColor = Color.Transparent, userId = theirUserId) },
                pose = when (outcome) {
                    VsOutcome.WIN -> com.wordocious.app.ui.MascotId.O1 to "cheer"
                    VsOutcome.LOSS -> com.wordocious.app.ui.MascotId.O2 to "gasp"
                    VsOutcome.DRAW -> com.wordocious.app.ui.MascotId.I to "cheer"
                },
                action = if (xp != null && xp > 0) {
                    {
                        Row(
                            Modifier.vsPill(VS_GOLD_ACCENT, 50.dp).padding(start = 9.dp, end = 9.dp, top = 6.dp, bottom = 3.dp),
                            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(2.dp),
                        ) {
                            VsNumber("+$xp", 13.sp)
                            VsCapsLabel("XP", color = if (vsDarkSeason) Color(0xFFFCD34D) else Color(0xFF92400E))
                        }
                    }
                } else null,
            ) {
                VsCapsLabel("YOU AND @${theirName.uppercase()}", color = VsTeal.label)
                if (h2h != null) Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    val lead = when { h2h.myWins > h2h.theirWins -> "You lead"; h2h.theirWins > h2h.myWins -> "You trail"; else -> "Even" }
                    Text(lead, fontSize = 13.sp, fontWeight = FontWeight.Black, color = VsPurple.deep)
                    VsNumber("${h2h.myWins}–${h2h.theirWins}", 16.sp)
                } else Text("…", fontSize = 14.sp, fontWeight = FontWeight.Black, color = VsPurple.deep)
            }
            PurpleButton("CHALLENGE BACK", "new puzzle, ${theirName.replaceFirstChar { it.uppercaseChar() }} races you", onClick = onChallengeBack)
            SoftPurpleButton("VS HOME", onClick = onClose)
            Spacer(Modifier.height(24.dp))
        }
    }
}

@Composable
private fun ResultColumn(label: String, winner: Boolean, run: VsChallengeService.Run, mode: GameMode, solutions: List<String>, modifier: Modifier) {
    // A1 / A2: each side a tinted tile (the winner's stronger + ring), the time soft.
    Column(
        modifier.vsRow(if (winner) VS_RESULT_ACCENT else Color(0xFF94A3B8), 14.dp, selected = winner).padding(vertical = 10.dp, horizontal = 4.dp)
            .semantics(mergeDescendants = true) { },
        horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            if (winner) com.wordocious.app.ui.Icon3D(com.wordocious.app.ui.Icon3DName.TROPHY, 16.dp)
            Text(label, fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 0.8.sp, color = VsPurple.deep, maxLines = 1)
        }
        MiniRunBoard(mode, run, solutions)
        VsNumber(vsClock(run.timeMs), 22.sp)
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
        Box(Modifier.fillMaxSize().pageBackground(PageTint.VS, alwaysLight = true), Alignment.Center) { com.wordocious.app.ui.CastLoader(null) }
        return
    }
    ChallengeResultView(
        mode = vm.mode, outcome = outcome, mine = mine, theirs = c.run,
        solutions = c.run.solutions.ifEmpty { mine.solutions },
        theirName = c.challenger.username, theirAvatarUrl = c.challenger.avatarUrl, theirUserId = c.challenger.id,
        h2h = vm.headToHead, xp = vm.xpResult?.totalXp,
        onClose = onHome,
        onChallengeBack = { if (AuthService.isProActive) onChallengeBack(c.challenger.id) else onGoPro() },
        onShare = { _ ->
            // S4: the result line + the challenge link (challenge links keep their link).
            com.wordocious.app.data.ShareHelper.share(
                context,
                com.wordocious.app.data.ShareHelper.vsResultText(outcome == VsOutcome.WIN, outcome == VsOutcome.DRAW, c.challenger.username, vsModeName(vm.mode)) +
                    "\nhttps://wordocious.com/vs/challenge/${c.code}",
                "Share your VS battle",
            )
        },
        note = if (vm.raceSavedOffline) "Saved. We’ll send your result when you’re back online." else null,
    )
}

/** CHALLENGE SENT! (§3), from the live VM. */
@Composable
fun ChallengeSentScreen(vm: VSMatchViewModel, onHome: () -> Unit) {
    val context = LocalContext.current
    val run = vm.myRun
    val state = vm.sendState
    val send = vm.sendLaunch
    Column(Modifier.fillMaxSize().pageBackground(PageTint.VS, alwaysLight = true)) {
        ResultTopBar(onHome)
        Column(
            Modifier.fillMaxSize().navigationBarsPadding().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp),
            horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Spacer(Modifier.height(8.dp))
            when (state) {
                null, SendState.Sending -> {
                    com.wordocious.app.ui.CastLoader(null)
                    Text("Sending your run…", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = VsTeal.sub)
                }
                is SendState.Failed -> {
                    // Error screens get R unplugged (ART_SPEC §7).
                    com.wordocious.app.ui.SceneImage(com.wordocious.app.ui.SceneArt.UNPLUGGED)
                    Text("COULDN’T SEND", fontSize = 22.sp, fontWeight = FontWeight.Black, color = VsPurple.deep, modifier = Modifier.semantics { heading() })
                    Text(state.message, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = VsTeal.sub, textAlign = TextAlign.Center)
                    PurpleButton("TRY AGAIN") { vm.retrySend() }
                }
                is SendState.Sent -> {
                    VsTintedCard(
                        Modifier.fillMaxWidth(), accent = VS_RESULT_ACCENT, corner = 18.dp, barHeight = 10.dp,
                        contentPadding = androidx.compose.foundation.layout.PaddingValues(vertical = 14.dp, horizontal = 12.dp),
                    ) {
                      Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        // K1: S "ready" for a challenge on its way.
                        VsCastPose(com.wordocious.app.ui.MascotId.S, "ready", 96.dp)
                        Text(
                            "CHALLENGE SENT!", fontSize = 22.sp, fontWeight = FontWeight.Black, letterSpacing = 0.6.sp, color = VsPurple.deep,
                            modifier = Modifier.semantics { heading(); liveRegion = androidx.compose.ui.semantics.LiveRegionMode.Polite },
                        )
                        run?.let { r ->
                            Text(
                                "${vsModeName(vm.mode).uppercase()} · ${runLine(r)} · 24H TO RACE",
                                fontSize = 10.5.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = 0.4.sp, color = VsPurple.mid, textAlign = TextAlign.Center,
                            )
                            MiniRunBoard(vm.mode, r, r.solutions)
                        }
                      }
                    }
                    if (send?.link == true) {
                        PurpleButton("SHARE LINK") {
                            com.wordocious.app.data.ShareEvents.log("link_invite", vm.mode.name.lowercase(), "vs_challenge")
                            com.wordocious.app.data.ShareHelper.share(
                                context,
                                com.wordocious.app.data.ShareHelper.inviteShareText(true, vsModeName(vm.mode), com.wordocious.app.data.ShareHelper.challengeUrl(state.code)),
                                "Invite a friend",
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
            theirName = c.challenger.username, theirAvatarUrl = c.challenger.avatarUrl, theirUserId = c.challenger.id,
            h2h = h2h, xp = null, onClose = onHome,
            onChallengeBack = { if (AuthService.isProActive) onChallengeBack(c.challenger.id) else onGoPro() },
            onShare = { _ ->
                // S4: the result line + the challenge link (challenge links keep their link).
                com.wordocious.app.data.ShareHelper.share(
                    context,
                    com.wordocious.app.data.ShareHelper.vsResultText(outcome == VsOutcome.WIN, outcome == VsOutcome.DRAW, c.challenger.username, vsModeName(mode)) +
                        "\nhttps://wordocious.com/vs/challenge/${c.code}",
                    "Share your VS battle",
                )
            },
        )
        return
    }
    Column(Modifier.fillMaxSize().pageBackground(PageTint.VS, alwaysLight = true)) {
        VsNavBar("CHALLENGE", onBack = onHome, heading = com.wordocious.app.ui.Heading.CHALLENGE) { if (c != null) VsModeChip(mode) }
        Column(
            Modifier.fillMaxSize().navigationBarsPadding().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp), horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Spacer(Modifier.height(12.dp))
            when {
                error != null -> SimpleCard(error!!, onHome, com.wordocious.app.ui.SceneArt.UNPLUGGED)
                l == null || c == null -> com.wordocious.app.ui.CastLoader(null)
                l.expired && !l.isMine -> SimpleCard("This challenge has expired", onHome, com.wordocious.app.ui.SceneArt.NOT_FOUND)
                l.isMine -> {
                    VsCard {
                        VsSectionLabel("YOUR CHALLENGE")
                        Text("${vsModeName(mode)} · ${runLine(c.run).lowercase().replaceFirstChar { it.uppercaseChar() }}", fontSize = 13.sp, fontWeight = FontWeight.ExtraBold, color = VsTeal.deep)
                        val results = sent?.results.orEmpty()
                        if (results.isEmpty()) Text(if (l.expired) "Nobody raced it." else "Nobody has raced it yet.", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = VsTeal.sub)
                        results.forEachIndexed { i, r ->
                            Text(
                                "@${r.username} " + when (r.outcome) { "win" -> "lost"; "loss" -> "beat it"; else -> "tied it" } +
                                    " · " + (if (r.solved) "solved in ${r.guesses} · ${vsClock(r.timeMs)}" else "not solved"),
                                fontSize = 12.sp, fontWeight = FontWeight.Bold, color = VsTeal.deep,
                                modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(8.dp)).stripedRow(i, VS_ACCENT).padding(horizontal = 6.dp, vertical = 5.dp),
                            )
                        }
                    }
                    VsTealButton("VS HOME", Modifier.fillMaxWidth(), fill = true, size = com.wordocious.app.ui.CandySize.LARGE, onClick = onHome)
                }
                else -> RaceIntroCard(c, mode) { onStart(c) }
            }
        }
    }
}

@Composable
private fun SimpleCard(text: String, onHome: () -> Unit, scene: com.wordocious.app.ui.SceneArt) {
    VsCard(padding = 18.dp) {
        // Errors get R unplugged, expired links O3's not-found scene (ART_SPEC §7).
        com.wordocious.app.ui.SceneImage(scene, height = 120.dp)
        Text(text, fontSize = 16.sp, fontWeight = FontWeight.Black, color = VsTeal.deep, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth())
        VsTealButton("VS HOME", Modifier.fillMaxWidth(), fill = true, size = com.wordocious.app.ui.CandySize.LARGE, onClick = onHome)
    }
}

/**
 * The race intro (§4; FINISH_SPEC K1 / D3): a tinted teal card with its top bar —
 * RACE @DOUG'S RUN with the sender's letter tile and S "ready" for a challenge, the
 * target in soft numbers, and START (large teal candy).
 */
@Composable
private fun RaceIntroCard(c: VsChallengeService.ChallengeView, mode: GameMode, onStart: () -> Unit) {
    val name = c.challenger.username
    VsTintedCard(
        Modifier.fillMaxWidth(), corner = 18.dp, barHeight = 10.dp,
        contentPadding = androidx.compose.foundation.layout.PaddingValues(0.dp), verticalArrangement = Arrangement.spacedBy(0.dp),
    ) {
        Column(
            Modifier.fillMaxWidth().background(vsWash(VS_ACCENT, 0.20f)).padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                VsAvatar(name, c.challenger.avatarUrl, size = 40.dp, borderColor = Color.Transparent, userId = c.challenger.id)
                Text(
                    "RACE @${name.uppercase()}’S RUN", fontSize = 16.sp, fontWeight = FontWeight.Black, color = VsTeal.deep,
                    modifier = Modifier.weight(1f).semantics { heading() },
                )
                VsCastPose(com.wordocious.app.ui.MascotId.S, "ready", 56.dp)
            }
            VsModeChip(mode)
        }
        Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            if (c.run.solved) Row(
                Modifier.semantics(mergeDescendants = true) { },
                verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp),
            ) {
                Text("Solved in", fontSize = 16.sp, fontWeight = FontWeight.Black, color = VsTeal.ink)
                VsNumber("${c.run.guesses}", 22.sp)
                Text("·", fontSize = 16.sp, fontWeight = FontWeight.Black, color = VsTeal.ink)
                VsNumber(vsClock(c.run.timeMs), 22.sp)
            } else Text("Not solved — just solve it", fontSize = 18.sp, fontWeight = FontWeight.Black, color = VsTeal.ink)
            Text(
                "Same puzzle. ${name.replaceFirstChar { it.uppercaseChar() }}’s pace plays out beside you.",
                fontSize = 12.sp, fontWeight = FontWeight.Bold, color = VsTeal.sub,
            )
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(3.dp)) {
                VsNumber("${VsChallengeService.hoursLeft(c.expiresAt)}h", 13.sp)
                Text("left", fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, color = VsTeal.label)
            }
            VsTealButton("START", Modifier.fillMaxWidth(), fill = true, size = com.wordocious.app.ui.CandySize.LARGE, icon = com.wordocious.app.ui.CandyIcon.PLAY, onClick = onStart)
        }
    }
}
