package com.wordocious.app.ui

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.data.AuthService
import com.wordocious.app.data.ProfileService
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.core.GameMode
import com.wordocious.core.TileState
import com.wordocious.core.evaluateGuess

/**
 * Profile-social layer for the PUBLIC profile screen — the approved
 * "profile social" redesign (scratchpad mock profile-preview.html):
 * presence + today-ring + identity chips, You-vs-Them, Trophy Case,
 * Highlights, Lately feed, and the spoiler-guarded board viewer.
 *
 * Everything renders from best-effort fetches; a missing persona/H2H/board
 * simply hides its section — the classic profile below never breaks.
 */

// ═══════════════════════════ shared bits ════════════════════════════════════

private val BrandPink = Color(0xFFEC4899)
private val BrandPurpleDeep = Color(0xFF7C3AED)
private val Teal = Color(0xFF0D9488)
private val Green = Color(0xFF22C55E)

/** "daily-YYYY-MM-DD-MODE" → MODE (underscores intact). */
internal fun seedModeName(seed: String): String? =
    Regex("^daily-\\d{4}-\\d{2}-\\d{2}-(.+)$").find(seed)?.groupValues?.get(1)

/** DB mode string → display title via the modeTitle helper (DUEL_6 → "SIX"). */
internal fun modeTitleFromDb(name: String?): String =
    name?.let { n -> runCatching { GameMode.valueOf(n) }.getOrNull()?.let { modeTitle(it) } ?: n } ?: ""

private fun clock(secs: Int): String = "%d:%02d".format(secs / 60, secs % 60)

/** "yyyy-MM-dd" → Today / Yesterday / weekday / "MMM d" (best-effort). */
private fun relativeDayLabel(day: String): String = runCatching {
    val d = java.time.LocalDate.parse(day)
    val today = java.time.LocalDate.parse(com.wordocious.app.todayLocalDate())
    when (val diff = java.time.temporal.ChronoUnit.DAYS.between(d, today)) {
        0L -> "Today"
        1L -> "Yesterday"
        in 2..6 -> d.dayOfWeek.getDisplayName(java.time.format.TextStyle.FULL, java.util.Locale.US)
        else -> d.format(java.time.format.DateTimeFormatter.ofPattern("MMM d"))
    }
}.getOrDefault(day)

private fun shortDayLabel(day: String): String = runCatching {
    java.time.LocalDate.parse(day).format(java.time.format.DateTimeFormatter.ofPattern("MMM d"))
}.getOrDefault(day)

/** Card header caption — mock .cardtitle. */
@Composable
private fun CardTitle(text: String) {
    Text(text, fontSize = 11.sp, fontWeight = FontWeight.Black, color = WTheme.textMuted, letterSpacing = 1.2.sp)
}

/** The standard surface card used by every new section (mock .card). */
@Composable
private fun SocialCard(
    onClick: (() -> Unit)? = null,
    content: @Composable androidx.compose.foundation.layout.ColumnScope.() -> Unit,
) {
    Column(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(WTheme.surface)
            .border(1.5.dp, WTheme.border, RoundedCornerShape(16.dp))
            .then(if (onClick != null) Modifier.clickableNoRipple(onClick) else Modifier)
            .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(9.dp),
        content = content,
    )
}

// ═══════════════════════ 1 · identity: presence + ring + chips ══════════════

/** "Played 12 minutes ago" + pulsing green dot from profiles.last_seen_at. */
@Composable
fun PresenceLine(lastSeenAt: String?) {
    val minutes = rememberMinutesSince(lastSeenAt) ?: return
    if (minutes >= 7 * 24 * 60) return   // stale beyond a week — say nothing
    val live = minutes < 15
    val text = when {
        minutes < 3 -> "Playing now"
        minutes < 60 -> "Played $minutes minutes ago"
        minutes < 24 * 60 -> "Played ${minutes / 60} ${if (minutes / 60 == 1L) "hour" else "hours"} ago"
        else -> "Played ${minutes / (24 * 60)} ${if (minutes / (24 * 60) == 1L) "day" else "days"} ago"
    }
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        val dotColor = if (live) Green else WTheme.textMuted
        val glowAlpha = if (live && !WTheme.reducedMotion) {
            val transition = rememberInfiniteTransition(label = "presence")
            transition.animateFloat(
                initialValue = 0.25f, targetValue = 0.05f,
                animationSpec = infiniteRepeatable(tween(1000, easing = LinearEasing), RepeatMode.Reverse),
                label = "presenceGlow",
            ).value
        } else if (live) 0.18f else 0f
        Box(contentAlignment = Alignment.Center) {
            if (glowAlpha > 0f) Box(Modifier.size(13.dp).clip(CircleShape).background(Green.copy(alpha = glowAlpha)))
            Box(Modifier.size(7.dp).clip(CircleShape).background(dotColor))
        }
        Text(text, fontSize = 11.5.sp, fontWeight = FontWeight.Bold, color = WTheme.textSecondary)
    }
}

@Composable
private fun rememberMinutesSince(instant: String?): Long? {
    if (instant.isNullOrBlank()) return null
    return runCatching {
        val then = java.time.Instant.parse(if (instant.endsWith("Z") || instant.contains('+')) instant else instant + "Z")
        java.time.Duration.between(then, java.time.Instant.now()).toMinutes().coerceAtLeast(0)
    }.getOrNull()
}

/** Progress ring + "N/9 today" capsule wrapped around the avatar. */
@Composable
fun TodayRingAvatar(completed: Int, total: Int = 9, content: @Composable () -> Unit) {
    val ringColor = WTheme.primary
    val track = WTheme.border
    Box(contentAlignment = Alignment.Center, modifier = Modifier.padding(bottom = 6.dp)) {
        Canvas(Modifier.size(112.dp)) {
            val stroke = 5.dp.toPx()
            val arcSize = Size(size.width - stroke, size.height - stroke)
            val topLeft = Offset(stroke / 2f, stroke / 2f)
            drawArc(
                color = track, startAngle = -90f, sweepAngle = 360f, useCenter = false,
                topLeft = topLeft, size = arcSize, style = Stroke(stroke, cap = StrokeCap.Round),
            )
            if (completed > 0) {
                drawArc(
                    color = ringColor, startAngle = -90f,
                    sweepAngle = 360f * completed.coerceAtMost(total) / total, useCenter = false,
                    topLeft = topLeft, size = arcSize, style = Stroke(stroke, cap = StrokeCap.Round),
                )
            }
        }
        content()
        Text(
            "$completed/$total today",
            fontSize = 9.5.sp, fontWeight = FontWeight.Black, color = Color.White,
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .offset(y = 8.dp)
                .clip(RoundedCornerShape(50))
                .background(ringColor)
                .padding(horizontal = 8.dp, vertical = 2.dp),
        )
    }
}

private data class ChipStyle(val fg: Color, val border: Color, val bg: Color)

@Composable
private fun IdentityChip(text: String, style: ChipStyle, onClick: (() -> Unit)? = null) {
    Text(
        if (onClick != null) "$text ›" else text,
        fontSize = 10.sp, fontWeight = FontWeight.Black, color = style.fg, letterSpacing = 0.4.sp,
        modifier = Modifier
            .clip(RoundedCornerShape(50))
            .background(style.bg)
            .border(1.5.dp, style.border, RoundedCornerShape(50))
            .then(if (onClick != null) Modifier.clickableNoRipple(onClick) else Modifier)
            .padding(horizontal = 10.dp, vertical = 4.5.dp),
    )
}

private fun archetypeEmoji(a: String): String = when (a) {
    "GRINDER" -> "⛏️"; "SPEEDRUNNER" -> "⚡"; "SNIPER" -> "🎯"; "NIGHT_OWL" -> "🦉"; else -> "🏹"
}

private fun archetypeLabel(a: String): String = a.replace('_', ' ')

/**
 * Chips row under the username: Level (existing badge, relocated here) +
 * archetype + best percentile + signature opener. Archetype taps through to
 * the explainer sheet.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun IdentityChipsRow(
    level: Int,
    persona: ProfileService.Persona?,
    onArchetypeTap: () -> Unit,
) {
    FlowRow(
        horizontalArrangement = Arrangement.spacedBy(6.dp, Alignment.CenterHorizontally),
        verticalArrangement = Arrangement.spacedBy(6.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        IdentityChip("★ LEVEL $level", ChipStyle(Color(0xFFD97706), WTheme.goldBorder, WTheme.highlightGold))
        if (persona != null) {
            IdentityChip(
                "${archetypeEmoji(persona.archetype)} ${archetypeLabel(persona.archetype)}",
                ChipStyle(BrandPurpleDeep, Color(0xFFC4B5FD), BrandPurpleDeep.copy(alpha = 0.08f)),
                onClick = onArchetypeTap,
            )
            persona.bestPercentile?.takeIf { it.topPct > 0 }?.let { pct ->
                IdentityChip(
                    "TOP ${pct.topPct}% · ${modeTitleFromDb(pct.mode)}",
                    ChipStyle(Teal, Color(0xFF5EEAD4), Teal.copy(alpha = 0.08f)),
                )
            }
            persona.opener?.takeIf { it.word.isNotBlank() }?.let { op ->
                IdentityChip(
                    "OPENS WITH “${op.word.uppercase()}”",
                    ChipStyle(BrandPink, Color(0xFFF9A8D4), BrandPink.copy(alpha = 0.07f)),
                )
            }
        }
    }
}

/** Archetype explainer — the 5 archetypes plus the viewer's own. */
@Composable
fun ArchetypeDialog(targetName: String, targetArchetype: String, onDismiss: () -> Unit) {
    val viewerId = AuthService.userId
    val myArchetype by produceState(initialValue = null as String?, viewerId) {
        value = viewerId?.let { id ->
            runCatching { ProfileService.fetchPersona(id)?.archetype }.getOrNull()
        }
    }
    AlertDialog(
        onDismissRequest = onDismiss,
        confirmButton = { TextButton(onClick = onDismiss) { Text("Done", fontWeight = FontWeight.Black, color = WTheme.primary) } },
        title = { Text("Player archetypes", fontWeight = FontWeight.Black) },
        text = {
            Column(
                Modifier.verticalScroll(rememberScrollState()).heightIn(max = 420.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Text(
                    "Computed from recent daily play — the rarest habit wins.",
                    fontSize = 11.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted,
                )
                listOf(
                    "GRINDER" to "Sweeps all nine dailies, day after day.",
                    "SPEEDRUNNER" to "Average solve under 90 seconds.",
                    "SNIPER" to "Averages 3.6 guesses or fewer.",
                    "NIGHT_OWL" to "40%+ of dailies played late at night.",
                    "CHALLENGER" to "Still writing their story — the starting archetype.",
                ).forEach { (key, desc) ->
                    val isTarget = key == targetArchetype
                    Column(
                        Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(12.dp))
                            .background(if (isTarget) BrandPurpleDeep.copy(alpha = 0.08f) else WTheme.surface)
                            .border(1.5.dp, if (isTarget) BrandPurpleDeep else WTheme.border, RoundedCornerShape(12.dp))
                            .padding(10.dp),
                        verticalArrangement = Arrangement.spacedBy(2.dp),
                    ) {
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                            Text("${archetypeEmoji(key)} ${archetypeLabel(key)}", fontSize = 12.sp, fontWeight = FontWeight.Black, color = if (isTarget) BrandPurpleDeep else WTheme.text)
                            if (isTarget) Text(targetName, fontSize = 9.sp, fontWeight = FontWeight.Black, color = BrandPurpleDeep)
                            if (key == myArchetype) Text("YOU", fontSize = 9.sp, fontWeight = FontWeight.Black, color = BrandPink)
                        }
                        Text(desc, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = WTheme.textSecondary)
                    }
                }
            }
        },
    )
}

// ═══════════════════════ 2 · You vs Them ════════════════════════════════════

@Composable
fun YouVsThemCard(
    targetName: String,
    h2h: ProfileService.H2HSummary,
    todayShared: ProfileService.SharedDaily?,
    onCardTap: () -> Unit,
    onTodayTap: (ProfileService.SharedDaily) -> Unit,
) {
    SocialCard(onClick = onCardTap) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            CardTitle("YOU vs ${targetName.uppercase()}")
            Text("›", fontSize = 15.sp, fontWeight = FontWeight.Black, color = WTheme.textMuted)
        }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    "${h2h.viewerWins}", fontSize = 24.sp, fontWeight = FontWeight.Black,
                    color = if (h2h.viewerWins >= h2h.targetWins) WTheme.primary else WTheme.text,
                )
                Text(" – ", fontSize = 24.sp, fontWeight = FontWeight.Black, color = WTheme.text)
                Text(
                    "${h2h.targetWins}", fontSize = 24.sp, fontWeight = FontWeight.Black,
                    color = if (h2h.targetWins > h2h.viewerWins) BrandPink else WTheme.text,
                )
            }
            Column(horizontalAlignment = Alignment.End) {
                val lead = when {
                    h2h.viewerWins > h2h.targetWins -> "You lead"
                    h2h.targetWins > h2h.viewerWins -> "$targetName leads"
                    else -> "All tied"
                }
                Text(lead, fontSize = 10.5.sp, fontWeight = FontWeight.Bold, color = WTheme.textSecondary)
                Text("${h2h.shared.size} shared dailies", fontSize = 10.5.sp, fontWeight = FontWeight.Bold, color = WTheme.textSecondary)
            }
        }
        if (todayShared != null) {
            Row(
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .background(WTheme.surface)
                    .border(1.5.dp, WTheme.border, RoundedCornerShape(12.dp))
                    .clickableNoRipple { onTodayTap(todayShared) }
                    .padding(horizontal = 10.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Text(modeTitleFromDb(todayShared.gameMode), fontSize = 11.5.sp, fontWeight = FontWeight.Black, color = BrandPurpleDeep)
                Text(
                    "today — $targetName ${formatScore(todayShared.targetScore)}, you ${formatScore(todayShared.viewerScore)}",
                    fontSize = 11.5.sp, fontWeight = FontWeight.Bold, color = WTheme.text,
                    modifier = Modifier.weight(1f),
                )
                Text("›", fontSize = 13.sp, fontWeight = FontWeight.Black, color = WTheme.textMuted)
            }
        }
        Text(
            "🔒 Boards open only for dailies you've finished",
            fontSize = 9.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted,
        )
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            VsStat("AVG GUESSES", h2h.targetAvgGuess?.let { "%.1f".format(it) } ?: "—", h2h.viewerAvgGuess?.let { "%.1f".format(it) } ?: "—", Modifier.weight(1f))
            VsStat("AVG SOLVE", h2h.targetAvgTime?.let { clock(it) } ?: "—", h2h.viewerAvgTime?.let { clock(it) } ?: "—", Modifier.weight(1f))
            VsStat("SWEEPS", "${h2h.targetSweeps}", "${h2h.viewerSweeps}", Modifier.weight(1f))
        }
    }
}

@Composable
private fun VsStat(label: String, them: String, you: String, modifier: Modifier = Modifier) {
    Column(modifier, horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(3.dp)) {
        Text(label, fontSize = 9.sp, fontWeight = FontWeight.Black, color = WTheme.textMuted, letterSpacing = 0.8.sp)
        Row {
            Text(them, fontSize = 12.sp, fontWeight = FontWeight.Black, color = BrandPink)
            Text(" / ", fontSize = 12.sp, fontWeight = FontWeight.Black, color = WTheme.textMuted)
            Text(you, fontSize = 12.sp, fontWeight = FontWeight.Black, color = WTheme.textMuted)
        }
    }
}

/** H2H drill-down: every shared daily — date, mode, both scores, winner dot. */
@Composable
fun H2HDetailDialog(targetName: String, h2h: ProfileService.H2HSummary, onDismiss: () -> Unit) {
    AlertDialog(
        onDismissRequest = onDismiss,
        confirmButton = { TextButton(onClick = onDismiss) { Text("Done", fontWeight = FontWeight.Black, color = WTheme.primary) } },
        title = { Text("You vs $targetName", fontWeight = FontWeight.Black) },
        text = {
            Column(
                Modifier.verticalScroll(rememberScrollState()).heightIn(max = 440.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Text(
                    "${h2h.shared.size} shared dailies · winner by daily score",
                    fontSize = 11.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted,
                )
                h2h.shared.forEach { s ->
                    Row(
                        Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(10.dp))
                            .background(WTheme.surface)
                            .border(1.dp, WTheme.border, RoundedCornerShape(10.dp))
                            .padding(horizontal = 10.dp, vertical = 7.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        Box(
                            Modifier.size(8.dp).clip(CircleShape).background(
                                when (s.winner) {
                                    1 -> WTheme.primary
                                    2 -> BrandPink
                                    else -> WTheme.textMuted
                                },
                            ),
                        )
                        Column(Modifier.weight(1f)) {
                            Text(modeTitleFromDb(s.gameMode), fontSize = 11.sp, fontWeight = FontWeight.Black, color = WTheme.text)
                            Text(shortDayLabel(s.day), fontSize = 9.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
                        }
                        Column(horizontalAlignment = Alignment.End) {
                            Text("You ${formatScore(s.viewerScore)}", fontSize = 10.sp, fontWeight = FontWeight.Black, color = if (s.winner == 1) WTheme.primary else WTheme.textSecondary)
                            Text("$targetName ${formatScore(s.targetScore)}", fontSize = 10.sp, fontWeight = FontWeight.Black, color = if (s.winner == 2) BrandPink else WTheme.textSecondary)
                        }
                    }
                }
                Text(
                    "🔒 Boards open only for dailies you've finished",
                    fontSize = 9.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted,
                )
            }
        },
    )
}

// ═══════════════════════ guarded board viewer ═══════════════════════════════

/** Read-only reconstruction of another player's solved daily board. */
@Composable
fun GuardedBoardDialog(targetId: String, targetName: String, seed: String, onDismiss: () -> Unit) {
    val fetch by produceState(initialValue = null as ProfileService.BoardFetch?, targetId, seed) {
        value = runCatching { ProfileService.fetchGuardedBoard(targetId, seed) }
            .getOrDefault(ProfileService.BoardFetch.Unavailable)
    }
    val modeName = seedModeName(seed)
    AlertDialog(
        onDismissRequest = onDismiss,
        confirmButton = { TextButton(onClick = onDismiss) { Text("Close", fontWeight = FontWeight.Black, color = WTheme.primary) } },
        title = { Text("$targetName · ${modeTitleFromDb(modeName)}", fontWeight = FontWeight.Black) },
        text = {
            when (val f = fetch) {
                null -> Text("Loading board…", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
                is ProfileService.BoardFetch.Locked -> Column(
                    Modifier.fillMaxWidth().padding(vertical = 12.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    Text("🔒", fontSize = 28.sp)
                    Text(
                        "Finish today's ${modeTitleFromDb(modeName)} first — no spoilers",
                        fontSize = 13.sp, fontWeight = FontWeight.Black, color = WTheme.text, textAlign = TextAlign.Center,
                    )
                    Text(
                        "Boards open only for dailies you've finished.",
                        fontSize = 11.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted, textAlign = TextAlign.Center,
                    )
                }
                is ProfileService.BoardFetch.Unavailable -> Text(
                    "This board isn't available.",
                    fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted,
                )
                is ProfileService.BoardFetch.Ready -> Column(
                    Modifier.verticalScroll(rememberScrollState()).heightIn(max = 440.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    val b = f.board
                    Text(
                        listOfNotNull(
                            if (b.won) "Won" else "Lost",
                            "${b.guesses.size} ${if (b.guesses.size == 1) "guess" else "guesses"}",
                            b.timeSeconds.takeIf { it > 0 }?.let { clock(it) },
                            b.hintsUsed.takeIf { it > 0 }?.let { "$it ${if (it == 1) "hint" else "hints"}" },
                        ).joinToString(" · "),
                        fontSize = 11.sp, fontWeight = FontWeight.Bold, color = WTheme.textSecondary,
                    )
                    ReadOnlyBoards(b)
                }
            }
        },
    )
}

@Composable
private fun ReadOnlyBoards(board: ProfileService.BoardDetail) {
    val solutions = board.solutions.filter { it.isNotBlank() }
    if (solutions.isEmpty()) {
        Text("No board data recorded.", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
        return
    }
    if (solutions.size == 1) {
        ReadOnlyBoard(solutions[0], board.guesses, Modifier.widthIn(max = 220.dp))
    } else {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            solutions.chunked(2).forEach { pair ->
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                    pair.forEach { sol -> ReadOnlyBoard(sol, board.guesses, Modifier.weight(1f)) }
                    if (pair.size == 1) Spacer(Modifier.weight(1f))
                }
            }
        }
    }
}

/** Tile rows re-evaluated with core evaluateGuess; stops after the solving row. */
@Composable
private fun ReadOnlyBoard(solution: String, guesses: List<String>, modifier: Modifier = Modifier) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(3.dp)) {
        var solved = false
        guesses.forEach { g ->
            if (solved) return@forEach
            val eval = runCatching { evaluateGuess(solution, g) }.getOrNull() ?: return@forEach
            Row(horizontalArrangement = Arrangement.spacedBy(3.dp), modifier = Modifier.fillMaxWidth()) {
                eval.tiles.forEach { t ->
                    Box(
                        Modifier
                            .weight(1f)
                            .height(26.dp)
                            .clip(RoundedCornerShape(4.dp))
                            .background(if (t.state == TileState.EMPTY) WTheme.surfaceAlt else WTheme.tileColor(t.state)),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(t.letter, fontSize = 12.sp, fontWeight = FontWeight.Black, color = Color.White)
                    }
                }
            }
            if (eval.isCorrect) solved = true
        }
    }
}

// ═══════════════════════ 3 · Trophy Case ════════════════════════════════════

@Composable
fun TrophyCaseCard(
    gold: Int,
    silver: Int,
    bronze: Int,
    flawless: ProfileService.PersonaFlawless?,
    onTap: () -> Unit,
) {
    SocialCard(onClick = onTap) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            CardTitle("TROPHY CASE")
            Text("›", fontSize = 15.sp, fontWeight = FontWeight.Black, color = WTheme.textMuted)
        }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(9.dp)) {
            TrophyShelf("🥇", gold, "GOLD", highlight = true, Modifier.weight(1f))
            TrophyShelf("🥈", silver, "SILVER", highlight = false, Modifier.weight(1f))
            TrophyShelf("🥉", bronze, "BRONZE", highlight = false, Modifier.weight(1f))
        }
        flawless?.takeIf { it.count > 0 }?.let { fl ->
            Row(
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .background(WTheme.surfaceHover)
                    .padding(horizontal = 11.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Text("💎 Rarest: ", fontSize = 11.5.sp, fontWeight = FontWeight.Bold, color = WTheme.text)
                Text("Flawless Victory ×${fl.count}", fontSize = 11.5.sp, fontWeight = FontWeight.Black, color = BrandPurpleDeep, modifier = Modifier.weight(1f))
                Text("held by ${fl.pctOfPlayers}% of players", fontSize = 10.sp, fontWeight = FontWeight.Black, color = BrandPink)
            }
        }
    }
}

@Composable
private fun TrophyShelf(emoji: String, count: Int, cap: String, highlight: Boolean, modifier: Modifier = Modifier) {
    Column(
        modifier
            .clip(RoundedCornerShape(13.dp))
            .background(if (highlight) WTheme.highlightGold else WTheme.surface)
            .border(1.5.dp, if (highlight) WTheme.goldBorder else WTheme.border, RoundedCornerShape(13.dp))
            .padding(vertical = 8.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(1.dp),
    ) {
        Text(emoji, fontSize = 16.sp)
        Text("$count", fontSize = 21.sp, fontWeight = FontWeight.Black, color = WTheme.text)
        Text(cap, fontSize = 9.sp, fontWeight = FontWeight.Black, color = WTheme.textSecondary, letterSpacing = 0.8.sp)
    }
}

private fun medalEmoji(type: String): String = when (type) {
    "gold" -> "🥇"; "silver" -> "🥈"; "bronze" -> "🥉"; "perfect" -> "💎"
    "streak_7", "streak_30", "streak_100" -> "🔥"
    else -> "🏅"
}

private fun medalLabel(m: ProfileService.UserMedal): String = when (m.medalType) {
    "gold" -> "Gold · ${modeTitleFromDb(m.gameMode)}"
    "silver" -> "Silver · ${modeTitleFromDb(m.gameMode)}"
    "bronze" -> "Bronze · ${modeTitleFromDb(m.gameMode)}"
    "perfect" -> "Perfect game · ${modeTitleFromDb(m.gameMode)}"
    "streak_7" -> "7-day streak"
    "streak_30" -> "30-day streak"
    "streak_100" -> "100-day streak"
    else -> m.medalType
}

/** Medal history — every medal; podium rows tap through to that day's podium. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MedalHistorySheet(
    targetName: String,
    medals: List<ProfileService.UserMedal>,
    onPodium: (day: String, gameMode: String) -> Unit,
    onDismiss: () -> Unit,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = sheetState, containerColor = WTheme.bg, dragHandle = null) {
        Column(
            Modifier.padding(horizontal = 16.dp, vertical = 18.dp).verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text("$targetName's medals", fontSize = 18.sp, fontWeight = FontWeight.Black, color = WTheme.text)
            if (medals.isEmpty()) {
                Text("No medals yet.", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
            }
            medals.forEach { m ->
                val podiumable = m.medalType in setOf("gold", "silver", "bronze") &&
                    !m.gameMode.isNullOrBlank() && m.gameMode != "ALL"
                Row(
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(WTheme.surface)
                        .border(1.5.dp, WTheme.border, RoundedCornerShape(12.dp))
                        .then(
                            if (podiumable) Modifier.clickableNoRipple { onPodium(m.day, m.gameMode!!) } else Modifier,
                        )
                        .padding(horizontal = 12.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    Text(medalEmoji(m.medalType), fontSize = 16.sp)
                    Column(Modifier.weight(1f)) {
                        Text(medalLabel(m), fontSize = 12.sp, fontWeight = FontWeight.Black, color = WTheme.text)
                        Text(shortDayLabel(m.day), fontSize = 10.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
                    }
                    if (podiumable) Text("›", fontSize = 14.sp, fontWeight = FontWeight.Black, color = WTheme.textMuted)
                }
            }
            Spacer(Modifier.height(12.dp))
        }
    }
}

/** One day+mode podium — 3 rows; tapping a row opens that player's profile. */
@Composable
fun PodiumDialog(
    day: String,
    gameMode: String,
    onOpenProfile: (String) -> Unit,
    onDismiss: () -> Unit,
) {
    val podium by produceState(initialValue = null as List<ProfileService.PodiumEntry>?, day, gameMode) {
        value = runCatching { ProfileService.fetchPodium(day, gameMode) }.getOrDefault(emptyList())
    }
    AlertDialog(
        onDismissRequest = onDismiss,
        confirmButton = { TextButton(onClick = onDismiss) { Text("Close", fontWeight = FontWeight.Black, color = WTheme.primary) } },
        title = { Text("${modeTitleFromDb(gameMode)} · ${shortDayLabel(day)}", fontWeight = FontWeight.Black) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                when {
                    podium == null -> Text("Loading podium…", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
                    podium!!.isEmpty() -> Text("No podium recorded for this day.", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
                    else -> podium!!.forEachIndexed { i, e ->
                        Row(
                            Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(10.dp))
                                .background(if (i == 0) WTheme.highlightGold else WTheme.surface)
                                .border(1.5.dp, if (i == 0) WTheme.goldBorder else WTheme.border, RoundedCornerShape(10.dp))
                                .clickableNoRipple { onOpenProfile(e.userId) }
                                .padding(horizontal = 12.dp, vertical = 9.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            Text(listOf("🥇", "🥈", "🥉").getOrElse(i) { "🏅" }, fontSize = 15.sp)
                            Text(e.username, fontSize = 12.sp, fontWeight = FontWeight.Black, color = WTheme.text, modifier = Modifier.weight(1f))
                            Text(formatScore(e.score), fontSize = 12.sp, fontWeight = FontWeight.Black, color = WTheme.textSecondary)
                            Text("›", fontSize = 13.sp, fontWeight = FontWeight.Black, color = WTheme.textMuted)
                        }
                    }
                }
            }
        },
    )
}

// ═══════════════════════ 4 · Highlights ═════════════════════════════════════

data class ProfileHighlight(val emoji: String, val big: String, val cap: String, val onTap: (() -> Unit)? = null)

@Composable
fun HighlightsCard(highlights: List<ProfileHighlight>) {
    if (highlights.isEmpty()) return
    SocialCard {
        CardTitle("HIGHLIGHTS")
        Row(
            Modifier.horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(9.dp),
        ) {
            highlights.forEach { h ->
                Column(
                    Modifier
                        .widthIn(min = 118.dp)
                        .clip(RoundedCornerShape(13.dp))
                        .background(WTheme.surface)
                        .border(1.5.dp, WTheme.border, RoundedCornerShape(13.dp))
                        .then(if (h.onTap != null) Modifier.clickableNoRipple(h.onTap) else Modifier)
                        .padding(horizontal = 11.dp, vertical = 10.dp),
                    verticalArrangement = Arrangement.spacedBy(2.dp),
                ) {
                    Text(h.emoji, fontSize = 16.sp)
                    Text(h.big, fontSize = 15.sp, fontWeight = FontWeight.Black, color = WTheme.text)
                    Text(h.cap, fontSize = 9.5.sp, fontWeight = FontWeight.Bold, color = WTheme.textSecondary)
                }
            }
        }
    }
}

/** 60-day streak calendar — dot grid, gold ring on 9/9 days. */
@Composable
fun StreakCalendarDialog(
    targetName: String,
    dayCounts: Map<String, Int>,
    onDismiss: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        confirmButton = { TextButton(onClick = onDismiss) { Text("Done", fontWeight = FontWeight.Black, color = WTheme.primary) } },
        title = { Text("$targetName · last 60 days", fontWeight = FontWeight.Black) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                val days = remember60Days()
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    days.chunked(10).forEach { week ->
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            week.forEach { day ->
                                val n = dayCounts[day] ?: 0
                                val flawlessDay = n >= 9
                                Box(
                                    Modifier
                                        .size(18.dp)
                                        .clip(CircleShape)
                                        .background(
                                            when {
                                                flawlessDay -> WTheme.gold
                                                n > 0 -> WTheme.primary
                                                else -> WTheme.surfaceAlt
                                            },
                                        )
                                        .then(
                                            if (flawlessDay) Modifier.border(2.dp, WTheme.goldBorder, CircleShape)
                                            else Modifier.border(1.dp, WTheme.border, CircleShape),
                                        ),
                                    contentAlignment = Alignment.Center,
                                ) {
                                    if (n in 1..8) {
                                        Text("$n", fontSize = 8.sp, fontWeight = FontWeight.Black, color = Color.White)
                                    }
                                }
                            }
                        }
                    }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                    LegendDot(WTheme.primary, "played")
                    LegendDot(WTheme.gold, "all 9 dailies")
                    LegendDot(WTheme.surfaceAlt, "missed")
                }
            }
        },
    )
}

@Composable
private fun LegendDot(color: Color, label: String) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        Box(Modifier.size(9.dp).clip(CircleShape).background(color).border(1.dp, WTheme.border, CircleShape))
        Text(label, fontSize = 9.5.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
    }
}

/** Oldest → newest local dates, 60 of them, ending today. */
private fun remember60Days(): List<String> = runCatching {
    val today = java.time.LocalDate.parse(com.wordocious.app.todayLocalDate())
    (59 downTo 0).map { today.minusDays(it.toLong()).toString() }
}.getOrDefault(emptyList())

// ═══════════════════════ 5 · Lately + nemesis ═══════════════════════════════

data class LatelyItem(val emoji: String, val text: String, val whenLabel: String, val onTap: (() -> Unit)? = null)

/** Build the feed: medals grouped per day (newest 3 days) + login streak. */
fun buildLatelyItems(
    medals: List<ProfileService.UserMedal>,
    loginStreak: Int,
    onMedals: () -> Unit,
    onStreak: () -> Unit,
): List<LatelyItem> {
    val items = mutableListOf<LatelyItem>()
    val podiumTypes = setOf("gold", "silver", "bronze")
    medals.filter { it.medalType in podiumTypes || it.medalType == "perfect" }
        .groupBy { it.day }
        .entries.sortedByDescending { it.key }
        .take(3)
        .forEach { (day, dayMedals) ->
            val gold = dayMedals.count { it.medalType == "gold" }
            val silver = dayMedals.count { it.medalType == "silver" }
            val bronze = dayMedals.count { it.medalType == "bronze" }
            val perfect = dayMedals.count { it.medalType == "perfect" }
            val text = when {
                gold > 0 && silver == 0 && bronze == 0 && perfect == 0 ->
                    "Won gold in $gold ${if (gold == 1) "mode" else "modes"}"
                else -> "Earned " + listOfNotNull(
                    gold.takeIf { it > 0 }?.let { "$it gold" },
                    silver.takeIf { it > 0 }?.let { "$it silver" },
                    bronze.takeIf { it > 0 }?.let { "$it bronze" },
                    perfect.takeIf { it > 0 }?.let { "$it perfect" },
                ).joinToString(" · ")
            }
            val emoji = when {
                gold > 0 -> "🥇"; silver > 0 -> "🥈"; bronze > 0 -> "🥉"; else -> "💎"
            }
            items += LatelyItem(emoji, text, relativeDayLabel(day), onTap = onMedals)
        }
    if (loginStreak >= 2) {
        items += LatelyItem("🔥", "On a $loginStreak-day login streak", "Today", onTap = onStreak)
    }
    return items
}

@Composable
fun LatelyCard(
    items: List<LatelyItem>,
    nemesis: ProfileService.PersonaNemesis?,
    onNemesisTap: (String) -> Unit,
) {
    if (items.isEmpty() && nemesis == null) return
    SocialCard {
        CardTitle("LATELY")
        items.forEachIndexed { i, item ->
            if (i > 0) Box(Modifier.fillMaxWidth().height(1.dp).background(WTheme.divider))
            Row(
                Modifier
                    .fillMaxWidth()
                    .then(if (item.onTap != null) Modifier.clickableNoRipple(item.onTap) else Modifier)
                    .padding(vertical = 3.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Box(
                    Modifier.size(28.dp).clip(RoundedCornerShape(9.dp)).background(WTheme.surfaceHover),
                    contentAlignment = Alignment.Center,
                ) { Text(item.emoji, fontSize = 13.sp) }
                Column(Modifier.weight(1f)) {
                    Text(item.text, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.text)
                    Text(item.whenLabel, fontSize = 10.sp, fontWeight = FontWeight.ExtraBold, color = WTheme.textMuted)
                }
                if (item.onTap != null) Text("›", fontSize = 14.sp, fontWeight = FontWeight.Black, color = WTheme.textMuted)
            }
        }
        nemesis?.let { n ->
            Row(
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .background(BrandPink.copy(alpha = 0.06f))
                    .border(1.5.dp, Color(0xFFF9A8D4), RoundedCornerShape(12.dp))
                    .clickableNoRipple { onNemesisTap(n.userId) }
                    .padding(horizontal = 11.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Text("⚔️ Most frequent rival: ", fontSize = 11.5.sp, fontWeight = FontWeight.Bold, color = WTheme.text)
                Text(n.username, fontSize = 11.5.sp, fontWeight = FontWeight.Black, color = BrandPink)
                Text(
                    "— ${n.sharedBoards} shared boards",
                    fontSize = 11.5.sp, fontWeight = FontWeight.Bold, color = WTheme.text,
                    modifier = Modifier.weight(1f), maxLines = 1,
                )
                Text("›", fontSize = 14.sp, fontWeight = FontWeight.Black, color = WTheme.textMuted)
            }
        }
    }
}
