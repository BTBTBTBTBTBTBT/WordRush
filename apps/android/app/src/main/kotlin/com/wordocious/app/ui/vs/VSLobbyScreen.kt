package com.wordocious.app.ui.vs

import com.wordocious.app.ui.PageTint
import com.wordocious.app.ui.pageBackground
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material.icons.filled.Sensors
import androidx.compose.material.icons.filled.SmartToy
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.R
import com.wordocious.app.data.AuthService
import com.wordocious.app.data.CpuKind
import com.wordocious.app.data.CpuProgression
import com.wordocious.app.data.CpuProgressionStore
import com.wordocious.app.data.DailyResultsService
import com.wordocious.app.data.InviteService
import com.wordocious.app.data.ProfileService
import com.wordocious.app.data.StatsDeepService
import com.wordocious.app.data.VSCountsService
import com.wordocious.app.data.VSPlayLimit
import com.wordocious.app.data.VsChallengeService
import com.wordocious.app.data.VsLobbyStore
import com.wordocious.app.ui.ModeGlyph
import com.wordocious.app.ui.FinishInk
import com.wordocious.app.ui.MascotId
import com.wordocious.app.ui.miniGameCard
import com.wordocious.app.ui.squishClickable
import com.wordocious.app.ui.stripedRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.semantics
import com.wordocious.app.ui.modeAccent
import com.wordocious.app.ui.theme.Nunito
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.core.GameMode
import com.wordocious.core.VsBannerInput
import com.wordocious.core.VsDayResult
import com.wordocious.core.VsLobby
import com.wordocious.core.WinLoss
import com.wordocious.core.vsClock
import com.wordocious.core.vsRecordLine
import kotlinx.coroutines.launch

/** One VS game to open: the mode, the daily flag, and what it starts. */
data class VsRoute(val mode: GameMode, val isDaily: Boolean = false, val launch: VsLaunch = VsLaunch.Live)

/** The lobby's pages: the lobby itself, the Bots page (§8), the Friend page (§3). */
sealed class VsLobbyPage {
    object Main : VsLobbyPage()
    object Bots : VsLobbyPage()
    data class Friend(val preselect: String? = null) : VsLobbyPage()
}

private val VS_MODES: List<GameMode> = VsLobby.VS_MODE_ORDER.mapNotNull { runCatching { GameMode.valueOf(it) }.getOrNull() }

/** HH:MM:SS to the next UTC midnight (Daily Battle + Bot of the Day are UTC-seeded). */
private fun utcClock(): String {
    val now = java.time.ZonedDateTime.now(java.time.ZoneOffset.UTC)
    val secs = java.time.Duration.between(now, now.toLocalDate().plusDays(1).atStartOfDay(java.time.ZoneOffset.UTC)).seconds.coerceAtLeast(0)
    return "%02d:%02d:%02d".format(secs / 3600, (secs % 3600) / 60, secs % 60)
}

/**
 * VS Battle lobby (VS overhaul §2, founder-approved 2026-10-01; spec
 * docs/VS_REDESIGN_SPEC.md). Almost nobody is ever waiting live, so every tap
 * ends in a game: the VS banner (today's Daily Battle + Bot of the Day, the
 * record), incoming challenges, PLAY (mode strip + LIVE / FRIEND / BOTS),
 * Rivals, your sent challenges and the code row. Free players get the free
 * banner, Classic only and the DAILY tile; guests keep the sign-in card.
 * Hosts the Friend and Bots pages as sub-pages.
 */
@Composable
fun VSLobbyScreen(
    initialPage: VsLobbyPage = VsLobbyPage.Main,
    onPlay: (VsRoute) -> Unit,
    onEnterInvite: (GameMode, String) -> Unit,
    onOpenChallenge: (String) -> Unit,
    onSeeRivals: () -> Unit,
    onGoPro: () -> Unit,
    onClose: () -> Unit,
) {
    var page by remember { mutableStateOf(initialPage) }
    var mode by remember { mutableStateOf(VsLobbyStore.selectedMode()) }
    val isPro = AuthService.isProActive
    when (val p = page) {
        VsLobbyPage.Bots -> {
            androidx.activity.compose.BackHandler { page = VsLobbyPage.Main }
            VsBotsPage(mode, isPro, onBack = { page = VsLobbyPage.Main }, onPlay = { m, l -> onPlay(VsRoute(m, false, l)) }, onGoPro = onGoPro)
        }
        is VsLobbyPage.Friend -> {
            androidx.activity.compose.BackHandler { page = VsLobbyPage.Main }
            VsFriendPage(mode, p.preselect, onBack = { page = VsLobbyPage.Main }) { ids, link ->
                onPlay(VsRoute(mode, false, VsLaunch.Send(ids, link)))
            }
        }
        VsLobbyPage.Main -> LobbyMain(
            mode = mode, isPro = isPro,
            onMode = { mode = it; VsLobbyStore.setSelectedMode(it) },
            onPage = { page = it }, onPlay = onPlay, onEnterInvite = onEnterInvite,
            onOpenChallenge = onOpenChallenge, onSeeRivals = onSeeRivals, onGoPro = onGoPro, onClose = onClose,
        )
    }
}

@Composable
private fun LobbyMain(
    mode: GameMode,
    isPro: Boolean,
    onMode: (GameMode) -> Unit,
    onPage: (VsLobbyPage) -> Unit,
    onPlay: (VsRoute) -> Unit,
    onEnterInvite: (GameMode, String) -> Unit,
    onOpenChallenge: (String) -> Unit,
    onSeeRivals: () -> Unit,
    onGoPro: () -> Unit,
    onClose: () -> Unit,
) {
    val profile by AuthService.profile.collectAsState()
    val today = remember { CpuProgressionStore.todayUtc() }
    val prog: CpuProgression = remember { CpuProgressionStore.load() }

    // Live per-mode queue counts (/vs/counts) every 5 s and /presence every 10 s.
    var counts by remember { mutableStateOf(emptyMap<String, VSCountsService.Count>()) }
    LaunchedEffect(Unit) { while (true) { counts = VSCountsService.fetch(); kotlinx.coroutines.delay(5000) } }
    val online by produceState<Int?>(null) { while (true) { fetchOnline()?.let { value = it }; kotlinx.coroutines.delay(10_000) } }
    val clock by produceState(utcClock()) { while (true) { value = utcClock(); kotlinx.coroutines.delay(1000) } }

    var battle by remember { mutableStateOf(VsLobbyStore.Battle(VsLobbyStore.dailyBotResult()?.first ?: VsDayResult.OPEN, VsLobbyStore.dailyBotResult()?.second)) }
    var dailyUsed by remember { mutableStateOf(VSPlayLimit.hasPlayedToday()) }
    var people by remember { mutableStateOf(WinLoss(0, 0)) }
    var bots by remember { mutableStateOf(WinLoss(0, 0)) }
    var listing by remember { mutableStateOf<VsChallengeService.Listing?>(null) }
    var rivals by remember { mutableStateOf<List<StatsDeepService.Rivalry>>(emptyList()) }
    var showLimit by remember { mutableStateOf(false) }
    LaunchedEffect(profile?.id) {
        val uid = profile?.id ?: return@LaunchedEffect
        launch { battle = VsLobbyStore.todayBattle(); if (battle.result != VsDayResult.OPEN) dailyUsed = true }
        launch { if (DailyResultsService.hasPlayedDailyVsToday()) dailyUsed = true }
        launch {
            // The same sums the Stats page's VS section shows (§10).
            val stats = ProfileService.fetchUserStats(uid)
            people = stats.filter { it.playType == "vs" }.let { s -> WinLoss(s.sumOf { it.wins }, s.sumOf { it.losses }) }
            bots = stats.filter { it.playType == "vs_cpu" }.let { s -> WinLoss(s.sumOf { it.wins }, s.sumOf { it.losses }) }
        }
        // §14: race results that couldn't be sent go out now (they land in the
        // record above on the next lobby load).
        launch { com.wordocious.app.data.VsPendingRaces.retry() }
        launch { listing = VsChallengeService.list() }
        if (isPro) launch { rivals = StatsDeepService.rivalries(uid, 3) }
    }

    Box(Modifier.fillMaxSize().pageBackground(PageTint.VS, alwaysLight = true)) {
        Column(Modifier.fillMaxSize()) {
            // HEADER_SPEC §5: the VS banner's S is the page host; the top row doesn't repeat it.
            // FINISH_SPEC A6: the whole-cast VS BATTLE art is the page's headline, edge to edge.
            VsTopRow(onBack = onClose) {
                val looking = counts.values.sumOf { it.waiting }
                if (looking > 0 || online != null) Row(
                    Modifier.vsPill(VS_ACCENT, 50.dp).padding(start = 10.dp, end = 10.dp, top = 6.dp, bottom = 4.dp),
                    verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp),
                ) {
                    Box(Modifier.size(7.dp).clip(CircleShape).background(if (looking > 0) Color(0xFF22C55E) else VsTeal.grey))
                    VsNumber(if (looking > 0) "$looking" else "${online ?: 0}", 12.sp)
                    Text(
                        if (looking > 0) "looking" else "online",
                        fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, color = VsTeal.sub,
                    )
                }
            }
            Column(
                Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                com.wordocious.app.ui.PageHeadline(com.wordocious.app.ui.TitleArt.VS, bleed = 16.dp)
                if (profile == null) {
                    GuestPrompt { AuthService.exitGuest() }
                    Spacer(Modifier.height(24.dp))
                    return@Column
                }
                val free = !isPro
                val incoming = listing?.incoming.orEmpty()
                val newest = incoming.firstOrNull()
                val botOfDay = prog.botOfDayToday(today)
                // FINISH_SPEC D2: the Bot of the Day is the day host's bot (core BotCast).
                val botOfDayBot = com.wordocious.core.BotCast.botOfTheDay(today)
                val input = VsBannerInput(
                    name = profile?.username ?: "", battle = battle.result, botOfDay = botOfDay,
                    incomingFrom = newest?.challenger?.username, streak = prog.streak,
                )
                VsBannerView(
                    input = input, free = free, clock = clock,
                    challengeLeft = newest?.let { "${VsChallengeService.hoursLeft(it.expiresAt)}H" },
                    battle = VsTodayTile(battle.result, battleLine(battle, free)),
                    botOfDay = VsTodayTile(botOfDay, botLine(botOfDay, free, botOfDayBot.name)),
                    recordLine = vsRecordLine(people, bots, if (free) null else prog.ladderCleared),
                    botStreak = prog.streak,
                    onBattle = { if (dailyUsed && free) showLimit = true else onPlay(VsRoute(GameMode.DUEL, isDaily = true)) },
                    onBotOfDay = { onPlay(VsRoute(if (free) GameMode.DUEL else mode, false, VsLaunch.Bot(CpuKind.DAILY))) },
                    botOfDayId = botOfDayBot.id,
                )

                // Incoming challenges: up to 3, newest first.
                incoming.take(3).forEach { c -> IncomingCard(c) { onOpenChallenge(c.code) } }

                // PLAY
                val shownMode = if (free) GameMode.DUEL else mode
                Row(Modifier.fillMaxWidth().padding(top = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                    VsSectionLabel("PLAY", Modifier.weight(1f))
                    Text(vsModeName(shownMode).uppercase(), fontSize = 11.sp, fontWeight = FontWeight.Black, letterSpacing = 1.sp, color = vsInk(modeAccent(shownMode)))
                }
                // FINISH_SPEC A1: the mode strip's tiles are mini game cards in each game's
                // accent (the picked one = stronger tint + ring), squishing on tap (A9); no
                // label (the picked mode's name sits on the PLAY line).
                Row(
                    Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(vertical = 6.dp, horizontal = 2.dp),
                    horizontalArrangement = Arrangement.spacedBy(7.dp),
                ) {
                    VS_MODES.forEach { m ->
                        val locked = free && m != GameMode.DUEL
                        val accent = modeAccent(m)
                        val on = m == shownMode
                        Box(
                            Modifier.size(48.dp)
                                .squishClickable(
                                    vsModeName(m) + if (locked) ", Pro" else "",
                                    role = androidx.compose.ui.semantics.Role.Tab,
                                ) { if (locked) onGoPro() else onMode(m) }
                                .semantics { selected = on }
                                .alpha(if (locked) 0.4f else 1f)
                                .miniGameCard(accent, 12.dp, selected = on),
                            Alignment.Center,
                        ) { Box(Modifier.padding(top = 3.dp)) { ModeGlyph(m, accent, 30.dp) } }
                    }
                }
                // BJ7: the three tiles hug the longest one (equal heights, no 112 floor).
                Row(Modifier.fillMaxWidth().height(IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    if (free) {
                        PlayTile(
                            "DAILY", if (dailyUsed) "Played today. Pro plays live any time." else "Today’s battle. A bot steps in if nobody is on.",
                            Modifier.weight(1f), icon = { Icon(painterResource(R.drawable.ic_swords), null, tint = VsTeal.ink, modifier = Modifier.size(16.dp)) },
                        ) { if (dailyUsed) showLimit = true else onPlay(VsRoute(GameMode.DUEL, isDaily = true)) }
                        PlayTile(
                            "FRIEND", "Send with Pro. Answering is free.", Modifier.weight(1f), locked = true,
                            icon = { Icon(Icons.Filled.Groups, null, tint = VsTeal.ink, modifier = Modifier.size(16.dp)) },
                        ) { onGoPro() }
                        PlayTile(
                            "BOTS", "Bot of the Day is free. Ladder is Pro.", Modifier.weight(1f),
                            icon = { Icon(Icons.Filled.SmartToy, null, tint = VsTeal.ink, modifier = Modifier.size(16.dp)) },
                        ) { onPage(VsLobbyPage.Bots) }
                    } else {
                        val w = counts[mode.name]?.waiting ?: 0
                        PlayTile(
                            "LIVE", if (w > 0) "$w waiting now in ${vsModeName(mode)}." else "0 waiting now. A bot steps in at 0:15.",
                            Modifier.weight(1f), icon = { Icon(Icons.Filled.Sensors, null, tint = VsTeal.ink, modifier = Modifier.size(16.dp)) },
                        ) { onPlay(VsRoute(mode, false, VsLaunch.Live)) }
                        PlayTile(
                            "FRIEND", "You play first. They race your run.", Modifier.weight(1f),
                            icon = { Icon(Icons.Filled.Groups, null, tint = VsTeal.ink, modifier = Modifier.size(16.dp)) },
                        ) { onPage(VsLobbyPage.Friend()) }
                        val cleared = prog.ladderCleared
                        val allCleared = cleared >= VsLobby.LADDER_BOTS.size
                        PlayTile(
                            "BOTS",
                            // FINISH_SPEC D1: the next rung named by its cast name ("Ivy is next").
                            if (allCleared) "Ladder cleared!"
                            else "Ladder $cleared of ${VsLobby.LADDER_BOTS.size}. ${com.wordocious.app.data.BotPersonas.name(CpuProgressionStore.nextLadderBot(prog))} is next.",
                            Modifier.weight(1f),
                            icon = {
                                if (allCleared) LadderTrophy(20.dp)
                                else Icon(Icons.Filled.SmartToy, null, tint = VsTeal.ink, modifier = Modifier.size(16.dp))
                            },
                        ) { onPage(VsLobbyPage.Bots) }
                    }
                }

                // RIVALS (Pro) / the Pro card (free).
                if (free) {
                    GoProCard(onGoPro)
                } else if (rivals.isNotEmpty()) {
                    Row(Modifier.fillMaxWidth().padding(top = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                        VsSectionLabel("RIVALS", Modifier.weight(1f))
                        VsSoftPill("SEE ALL", onClick = onSeeRivals)
                    }
                    VsCard {
                        rivals.take(3).forEachIndexed { i, r ->
                            Row(
                                Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp)).stripedRow(i, VS_ACCENT).padding(horizontal = 6.dp, vertical = 6.dp),
                                // BJ7: top-aligned row, detail 4 under the name.
                                verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(10.dp),
                            ) {
                                VsAvatar(r.username, null, size = 36.dp, borderColor = Color.Transparent, userId = r.opponentId)
                                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                    Text("@${r.username}", fontSize = 13.sp, fontWeight = FontWeight.Black, color = VsTeal.deep, maxLines = 1)
                                    Text(
                                        vsRivalLine(r.wins, r.losses, r.lastMode), fontSize = 11.sp, fontWeight = FontWeight.Bold,
                                        color = if (r.wins > r.losses) VsTeal.ink else VsTeal.label, maxLines = 1, overflow = TextOverflow.Ellipsis,
                                    )
                                }
                                VsSoftPill("Challenge") { onPage(VsLobbyPage.Friend(r.opponentId)) }
                            }
                        }
                    }
                }

                // YOUR CHALLENGES (sent in the last 24 h).
                val sent = listing?.sent.orEmpty().filter { VsChallengeService.isRecent(it.createdAt) }.take(3)
                if (sent.isNotEmpty()) {
                    VsSectionLabel("YOUR CHALLENGES", Modifier.padding(top = 4.dp))
                    VsCard {
                        sent.forEachIndexed { i, s ->
                            val m = runCatching { GameMode.valueOf(s.gameMode) }.getOrDefault(GameMode.DUEL)
                            Row(
                                Modifier.fillMaxWidth().squishClickable { onOpenChallenge(s.code) }
                                    .clip(RoundedCornerShape(10.dp)).stripedRow(i, VS_ACCENT).padding(horizontal = 6.dp, vertical = 6.dp),
                                verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp),
                            ) {
                                VsModeTile(m, 26.dp)
                                Text(
                                    "${vsModeName(m)} · " + if (s.invitees > 0) "sent to ${s.invitees}" else "link",
                                    fontSize = 12.sp, fontWeight = FontWeight.ExtraBold, color = VsTeal.deep, modifier = Modifier.weight(1f), maxLines = 1,
                                )
                                val r = s.results.firstOrNull()
                                val more = if (s.results.size > 1) " +${s.results.size - 1}" else ""
                                Text(
                                    when {
                                        r == null -> "waiting"
                                        r.outcome == "loss" -> "@${r.username} beat it$more"
                                        r.outcome == "win" -> "@${r.username} lost$more"
                                        else -> "@${r.username} tied$more"
                                    },
                                    fontSize = 11.sp, fontWeight = FontWeight.Black, color = if (r == null) VsTeal.label else VsTeal.ink, maxLines = 1,
                                )
                            }
                        }
                    }
                }

                CodeRow(onOpenChallenge, onEnterInvite)
                Spacer(Modifier.height(24.dp))
            }
        }
        if (showLimit) VSDailyLimitModal(onGoPro = onGoPro, onClose = { showLimit = false })
    }
}

private fun battleLine(b: VsLobbyStore.Battle, free: Boolean): String {
    val who = b.opponent
    return when (b.result) {
        VsDayResult.OPEN -> if (free) "Classic · free" else "Classic · open"
        VsDayResult.WON -> who?.let { "Beat $it" } ?: "Won"
        VsDayResult.LOST -> who?.let { "Lost to $it" } ?: "Lost"
        VsDayResult.DRAW -> who?.let { "Draw with $it" } ?: "Draw"
    }
}

/** The Bot of the Day tile's line, naming the day's bot (FINISH_SPEC D2). */
private fun botLine(r: VsDayResult, free: Boolean, bot: String): String = when (r) {
    VsDayResult.OPEN -> if (free) "$bot · free" else "$bot · open"
    VsDayResult.WON -> "Beat $bot"
    VsDayResult.LOST -> "Lost to $bot"
    VsDayResult.DRAW -> "Draw with $bot"
}

/** /presence `online`, or null (best-effort). */
private suspend fun fetchOnline(): Int? = kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
    runCatching {
        val conn = java.net.URL(com.wordocious.app.data.VSConfig.SERVER_URL + "/presence").openConnection() as java.net.HttpURLConnection
        conn.connectTimeout = 8000; conn.readTimeout = 8000
        val body = conn.inputStream.bufferedReader().readText()
        conn.disconnect()
        org.json.JSONObject(body).optInt("online", -1).takeIf { it >= 0 }
    }.getOrNull()
}

/**
 * An incoming challenge as a K1 notice: a tinted card in the challenge teal with its
 * top bar, the sender's letter tile, S "ready" for a challenge (A7), the headline in
 * Nunito Black with the run's numbers soft, and a candy RACE button. Squishes on tap.
 */
@Composable
private fun IncomingCard(c: VsChallengeService.ChallengeView, onRace: () -> Unit) {
    val m = runCatching { GameMode.valueOf(c.gameMode) }.getOrDefault(GameMode.DUEL)
    val left = "${VsChallengeService.hoursLeft(c.expiresAt)}h left"
    val summary = if (c.run.solved) "${vsModeName(m)}, solved in ${c.run.guesses}, ${vsClock(c.run.timeMs)}, $left"
    else "${vsModeName(m)}, not solved, $left"
    VsNoticeCard(
        accent = VS_ACCENT,
        label = "Challenge from @${c.challenger.username}. $summary",
        onClick = onRace,
        avatar = { VsAvatar(c.challenger.username, c.challenger.avatarUrl, size = 38.dp, borderColor = Color.Transparent, userId = c.challenger.id) },
        pose = MascotId.S to "ready",
        action = { VsTealButton("RACE", icon = com.wordocious.app.ui.CandyIcon.PLAY, size = com.wordocious.app.ui.CandySize.SMALL, onClick = onRace) },
    ) {
        Text(
            "CHALLENGE FROM @${c.challenger.username.uppercase()}", fontSize = 11.sp, fontWeight = FontWeight.Black,
            letterSpacing = 0.4.sp, color = FinishInk.heading, maxLines = 1, overflow = TextOverflow.Ellipsis,
        )
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(vsModeName(m), fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, color = VsTeal.sub, maxLines = 1)
            if (c.run.solved) {
                Text("·", fontSize = 11.sp, color = VsTeal.sub)
                VsNumber("${c.run.guesses}", 13.sp)
                Text("·", fontSize = 11.sp, color = VsTeal.sub)
                VsNumber(vsClock(c.run.timeMs), 13.sp)
            } else Text("· not solved", fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, color = VsTeal.sub, maxLines = 1)
            Text("· $left", fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, color = VsTeal.label, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
    }
}

@Composable
private fun PlayTile(title: String, sub: String, modifier: Modifier, locked: Boolean = false, icon: @Composable () -> Unit, onClick: () -> Unit) {
    // A1: a tinted card with the game-card top bar; A9: the whole tile squishes.
    VsTintedCard(
        modifier.fillMaxHeight().squishClickable("$title. $sub" + if (locked) " Pro." else "", onClick = onClick),
        corner = 16.dp, barHeight = 5.dp,
        contentPadding = PaddingValues(10.dp), verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            VsIconSquare(content = icon)
            Spacer(Modifier.weight(1f))
            if (locked) VsLock()
        }
        Text(title, fontSize = 12.sp, fontWeight = FontWeight.Black, letterSpacing = 0.6.sp, color = VsTeal.deep)
        Text(sub, fontSize = 10.5.sp, fontWeight = FontWeight.Bold, color = VsTeal.sub, lineHeight = 13.sp)
    }
}

@Composable
private fun GoProCard(onGoPro: () -> Unit) {
    // G1 family: the gold-tinted card with its gold top bar, W crowned (A7: not the
    // banner's S), and the amber candy CTA.
    VsTintedCard(Modifier.fillMaxWidth(), accent = VS_GOLD_ACCENT, corner = 18.dp, contentPadding = PaddingValues(12.dp)) {
        Row(verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text("GO PRO FOR ALL OF VS", fontSize = 15.sp, fontWeight = FontWeight.Black, letterSpacing = 0.4.sp, color = Color(0xFF78350F))
                Text(
                    "All 9 modes, live matches any time, challenge any friend, the bot ladder, rematches and your rivals.",
                    fontSize = 12.sp, fontWeight = FontWeight.Bold, color = FinishInk.muted,
                )
            }
            androidx.compose.foundation.Image(
                painterResource(R.drawable.art_scene_pro_crown), contentDescription = null,
                modifier = Modifier.size(60.dp).clearAndSetSemantics { },
            )
        }
        VsTealButton("SEE PRO", color = com.wordocious.app.ui.CandyColor.AMBER, onClick = onGoPro)
    }
}

/** HAVE A CODE? — a challenge code opens the race; otherwise it's a live private-match code. */
@Composable
private fun CodeRow(onOpenChallenge: (String) -> Unit, onEnterInvite: (GameMode, String) -> Unit) {
    val scope = rememberCoroutineScope()
    var code by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val canJoin = code.trim().length >= 4 && !busy
    VsSectionLabel("HAVE A CODE?", Modifier.padding(top = 4.dp))
    Row(
        Modifier.fillMaxWidth().vsCard(16.dp).padding(10.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        BasicTextField(
            value = code, onValueChange = { code = it.uppercase().filter { ch -> ch.isLetterOrDigit() }.take(8); error = null },
            singleLine = true,
            textStyle = TextStyle(fontFamily = Nunito, fontSize = 16.sp, fontWeight = FontWeight.Black, letterSpacing = 3.sp, color = VsTeal.deep),
            cursorBrush = SolidColor(VsTeal.ink),
            keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Characters, autoCorrectEnabled = false),
            // A1: the input takes the teal wash too (no plain white).
            // BI23 / BJ7: a soft filled field, no outline.
            modifier = Modifier.weight(1f).clip(RoundedCornerShape(10.dp)).background(vsWash(VS_ACCENT, 0.14f)).padding(10.dp),
            decorationBox = { inner ->
                if (code.isEmpty()) Text("CODE", fontSize = 16.sp, fontWeight = FontWeight.Black, letterSpacing = 3.sp, color = VsTeal.grey)
                inner()
            },
        )
        VsTealButton("JOIN", enabled = canJoin) {
            val c = code.trim()
            if (c.length < 4 || busy) return@VsTealButton
            busy = true; error = null
            scope.launch {
                when (VsChallengeService.lookup(c)) {
                    is VsChallengeService.LookupOutcome.Found -> { busy = false; onOpenChallenge(c) }
                    else -> {
                        val gm = InviteService.lookupMode(c)?.let { runCatching { GameMode.valueOf(it) }.getOrNull() }
                        busy = false
                        if (gm != null) onEnterInvite(gm, c) else error = "No challenge or match found for that code."
                    }
                }
            }
        }
    }
    error?.let { Text(it, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color(0xFFDC2626)) }
}

/** Guest sign-in prompt — VS is account-based. Founder: no plain-text headings — the
 *  Friends guest pitch (cast scene, the VS BATTLE heading art, one line, SIGN IN). */
@Composable
private fun GuestPrompt(onSignIn: () -> Unit) {
    com.wordocious.app.ui.GuestPitch(
        hosts = listOf(MascotId.S, MascotId.W), title = "VS Battle", heading = com.wordocious.app.ui.Heading.VSBATTLE,
        subtitle = "Sign in to battle live opponents, bots and your friends' runs, and keep your results.",
        colors = com.wordocious.app.ui.GuestPitchContent.friendsColors, preview = com.wordocious.app.ui.GuestPreview.None,
        onSignIn = onSignIn, onPlay = null,
        modifier = Modifier.fillMaxWidth().padding(top = 8.dp), subColor = VsTeal.sub,
    )
}
