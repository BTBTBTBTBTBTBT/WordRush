package com.wordocious.app.ui

import androidx.annotation.DrawableRes
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.ColorMatrix
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.R
import com.wordocious.app.data.AuthService
import com.wordocious.app.data.FriendsService
import com.wordocious.app.ui.friends.FriendlyGameIcon
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.core.FriendlyKind
import com.wordocious.core.GameMode
import com.wordocious.core.StatsProfile
import com.wordocious.core.StatsProfile.PocketRecord
import kotlinx.coroutines.delay
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonObject

// FRIDAY-QUEUE items 16 + 17 + 20 (2.8 wave 4): the shared pieces of the redesigned Stats page, player profile and Go Pro
// screens — the four hero stats with soft 3D icons, the win-rate ring and two-color record bar (drawn in code from the
// sections/stats specs), the 5-over-4 VS game picker, HEAD TO HEAD + POCKET GAMES from GET /api/friends/pocket-records,
// the trophy shelf, and the Go Pro scene (the free player's mascot on the pedestal beside the benefit's scene).
// Ports apps/web/components/stats/{stat-hero,pocket-records}.tsx, profile/trophy-shelf.tsx, pro/pro-scene.tsx and
// iOS StatsKit28.swift. All words and decisions come from core StatsProfile.

/** A core "#rrggbb" color string (StatsProfile section colors) -> Color; the W purple when malformed. */
fun coreHexColor(hex: String): Color = runCatching { Color(android.graphics.Color.parseColor(hex)) }.getOrDefault(Color(0xFF7C3AED))

// ── Icons, ring, bar ────────────────────────────────────────────────────────

@DrawableRes
private fun statIconRes(name: String): Int = when (name) {
    "crown" -> R.drawable.art_stat_crown
    "donut" -> R.drawable.art_stat_donut
    "bolt" -> R.drawable.art_stat_bolt
    "stopwatch" -> R.drawable.art_stat_stopwatch
    "target" -> R.drawable.art_stat_target
    else -> R.drawable.art_stat_star
}

/** A shipped stat icon (art_stat_<name>: crown, donut, bolt, stopwatch, star, target), decorative. */
@Composable
fun StatIcon(name: String, size: Dp = 30.dp, modifier: Modifier = Modifier) {
    Image(artPainter(statIconRes(name), size), contentDescription = null, modifier = modifier.size(size), contentScale = ContentScale.Fit)
}

/** The win-rate ring (sections/stats spec): a rounded track, a fill arc from 12 o'clock and a pale gloss arc. */
@Composable
fun WinRateRing(pct: Float, modifier: Modifier = Modifier, size: Dp = 44.dp, accent: Color = Color(0xFF7C3AED)) {
    val frac = (pct / 100f).coerceIn(0f, 1f)
    Canvas(modifier.size(size).semantics { contentDescription = "Win rate ${pct.toInt()} percent" }) {
        val stroke = maxOf(6.dp.toPx(), (this.size.minDimension * 0.17f))
        val d = this.size.minDimension - stroke
        val topLeft = Offset(stroke / 2, stroke / 2)
        val arcSize = Size(d, d)
        drawArc(accent.copy(alpha = 0.16f), 0f, 360f, false, topLeft, arcSize, style = Stroke(stroke))
        if (frac > 0f) drawArc(accent, -90f, 360f * frac, false, topLeft, arcSize, style = Stroke(stroke, cap = StrokeCap.Round))
        drawArc(Color.White.copy(alpha = 0.38f), -85f, 360f * 0.16f, false,
            Offset(stroke * 0.68f, stroke * 0.68f), Size(this.size.minDimension - stroke * 1.36f, this.size.minDimension - stroke * 1.36f),
            style = Stroke(maxOf(1.5.dp.toPx(), stroke * 0.16f), cap = StrokeCap.Round))
    }
}

/** The two-color record bar (sections/stats spec): wins in the first color, losses in the second, glossy. */
@Composable
fun RecordBar(
    wins: Int, losses: Int, modifier: Modifier = Modifier, height: Dp = 10.dp,
    from: Color = Color(0xFF7C3AED), to: Color = Color(0xFFEC4899),
) {
    val bar = StatsProfile.recordBar(wins, losses)
    Canvas(modifier.fillMaxWidth().height(height).semantics { contentDescription = "$wins wins, $losses losses" }) {
        val h = this.size.height
        val r = androidx.compose.ui.geometry.CornerRadius(h / 2, h / 2)
        drawRoundRect(from.copy(alpha = 0.14f), size = this.size, cornerRadius = r)
        if (!bar.empty) {
            val w = this.size.width
            val winW = (w * bar.winFrac).toFloat()
            val lossW = (w * bar.lossFrac).toFloat()
            if (wins > 0) drawRoundRect(from, size = Size(winW, h), cornerRadius = r)
            if (losses > 0) {
                val overlap = if (wins > 0) h / 2 else 0f
                drawRoundRect(to, topLeft = Offset(winW - overlap, 0f), size = Size(lossW + overlap, h), cornerRadius = r)
            }
        }
        drawRoundRect(Color.White.copy(alpha = 0.4f), topLeft = Offset(6.dp.toPx(), h * 0.16f),
            size = Size(this.size.width - 12.dp.toPx(), maxOf(1.5.dp.toPx(), h * 0.2f)), cornerRadius = r)
    }
}

/** The four hero stats on one row: icon (the ring for the win rate) over a soft number over a small label. */
@Composable
fun HeroStatsRow(wins: Int, losses: Int, streak: Int, bestStreak: Int, fastestSeconds: Double, accent: Color, modifier: Modifier = Modifier) {
    val stats = StatsProfile.heroStats(wins, losses, streak, bestStreak, fastestSeconds)
    Row(modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.Top) {
        stats.forEach { s ->
            Column(
                Modifier.weight(1f).semantics(mergeDescendants = true) { contentDescription = listOfNotNull(s.label, s.value, s.sub).joinToString(", ") },
                horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(2.dp),
            ) {
                if (s.key == StatsProfile.HeroKey.WIN_RATE) {
                    WinRateRing(if (wins + losses > 0) wins * 100f / (wins + losses) else 0f, size = 44.dp, accent = accent)
                } else StatIcon(s.icon, 44.dp)
                Spacer(Modifier.height(2.dp))
                SoftNumber(s.value, 20.sp)
                Text(s.label.uppercase(), fontSize = 9.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = 0.5.sp, color = if (WTheme.isDark) WTheme.textMuted else FinishInk.muted)
                Text(s.sub ?: " ", fontSize = 9.sp, fontWeight = FontWeight.ExtraBold, color = accent, maxLines = 1)
            }
        }
    }
}

// ── Pocket records (GET /api/friends/pocket-records) ────────────────────────

object PocketRecordsService {
    /** The last good answer (a returning screen paints it at once, then refreshes). */
    @Volatile var cached: StatsProfile.PocketRecords? = null
        private set

    private fun JsonElement?.int0(): Int = (this as? JsonPrimitive)?.intOrNull ?: 0
    private fun rec(o: JsonObject?): PocketRecord = PocketRecord(o?.get("wins").int0(), o?.get("losses").int0(), o?.get("draws").int0())

    /** null-safe: returns the cached answer on any failure. The server counts finished friendly_games rows with core pocketRecords. */
    suspend fun fetch(): StatsProfile.PocketRecords? {
        val resp = FriendsService.api("GET", "/api/friends/pocket-records") ?: return cached
        if (resp.first != 200) return cached
        return runCatching {
            val root = Json.parseToJsonElement(resp.second).jsonObject
            val kinds = (root["byKind"] as? kotlinx.serialization.json.JsonArray)?.mapNotNull { e ->
                val o = e as? JsonObject ?: return@mapNotNull null
                val kind = FriendlyKind.from((o["kind"] as? JsonPrimitive)?.content) ?: return@mapNotNull null
                StatsProfile.PocketKindRecord(kind, rec(o), o["bestChain"].int0())
            } ?: emptyList()
            val friends = (root["byFriend"] as? JsonObject)?.mapValues { (_, v) ->
                val o = v as? JsonObject
                val byKind = (o?.get("byKind") as? JsonObject)?.entries?.mapNotNull { (k, r) ->
                    FriendlyKind.from(k)?.let { it to rec(r as? JsonObject) }
                }?.toMap() ?: emptyMap()
                StatsProfile.PocketFriendRecord(rec(o?.get("total") as? JsonObject), byKind)
            } ?: emptyMap()
            StatsProfile.PocketRecords(kinds, friends, rec(root["total"] as? JsonObject))
        }.getOrNull()?.also { cached = it } ?: cached
    }
}

/** POCKET GAMES: one tile per game with the player's record (Word Chain adds its best run); a fresh player sees dashes. */
@Composable
fun PocketGamesSection(records: StatsProfile.PocketRecords?) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        SectionHeader("Pocket Games", accent = coreHexColor(StatsProfile.CAST_S))
        StatsProfile.POCKET_ORDER.chunked(3).forEach { row ->
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                row.forEach { kind ->
                    val k = records?.byKind?.firstOrNull { it.kind == kind }
                    Column(
                        Modifier.weight(1f).statsTile(coreHexColor(StatsProfile.CAST_S)).padding(horizontal = 4.dp, vertical = 10.dp),
                        horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(2.dp),
                    ) {
                        FriendlyGameIcon(kind, 40.dp)
                        Text(kind.title, fontSize = 10.sp, fontWeight = FontWeight.Black, color = if (WTheme.isDark) WTheme.text else FinishInk.heading, maxLines = 1)
                        SoftNumber(if (records == null) "…" else if (k != null && k.record.played) "${k.record.wins}–${k.record.losses}" else "—", 14.sp)
                        Text(
                            when {
                                k == null || !k.record.played -> " "
                                k.kind == FriendlyKind.CHAIN && k.bestChain > 0 -> "best ${k.bestChain}"
                                k.record.draws > 0 -> "${k.record.draws} ${if (k.record.draws == 1) "draw" else "draws"}"
                                else -> " "
                            },
                            fontSize = 9.sp, fontWeight = FontWeight.ExtraBold, color = if (WTheme.isDark) WTheme.textMuted else FinishInk.muted, maxLines = 1,
                        )
                    }
                }
            }
        }
    }
}

/** A tinted stat tile: the accent's wash with a soft line (the Stats card family, no top bar). */
@Composable
private fun Modifier.statsTile(accent: Color): Modifier =
    this.clip(RoundedCornerShape(16.dp)).background(if (WTheme.isDark) WTheme.surface else accent.copy(alpha = 0.10f))

/** HEAD TO HEAD: every friend you have played (VS or a pocket game) — mascot, "VS 1–0 · Pocket 2–1", two-color record bar. */
@Composable
fun HeadToHeadSection(records: StatsProfile.PocketRecords?, onOpenProfile: (String) -> Unit = {}) {
    var version by remember { mutableIntStateOf(0) }
    LaunchedEffect(Unit) { FriendsService.load() }
    DisposableEffect(Unit) {
        val off = FriendsService.addListener { version++ }
        onDispose { off() }
    }
    @Suppress("UNUSED_EXPRESSION") version
    val rows = FriendsService.friends.map { f ->
        val vs = PocketRecord(f.h2hW ?: 0, f.h2hL ?: 0)
        val pocket = records?.byFriend?.get(f.id)?.total ?: PocketRecord()
        Triple(f, vs, pocket)
    }.filter { (_, vs, pocket) -> vs.played || pocket.played }
        .sortedByDescending { (_, vs, pocket) -> vs.wins + vs.losses + pocket.wins + pocket.losses + pocket.draws }
        .take(8)
    if (rows.isEmpty()) return
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        SectionHeader("Head to Head", accent = coreHexColor(StatsProfile.CAST_D))
        rows.forEach { (f, vs, pocket) ->
            val wins = vs.wins + pocket.wins
            val losses = vs.losses + pocket.losses
            KitCard(accent = coreHexColor(StatsProfile.CAST_D)) {
                Row(
                    Modifier.fillMaxWidth().clickable(interactionSource = remember { MutableInteractionSource() }, indication = null) { onOpenProfile(f.id) },
                    verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    PlayerAvatar(f.username, 40.dp, userId = f.id, avatarUrl = f.avatarUrl, config = f.avatarConfig, castId = f.avatarCastId, frame = f.avatarFrame)
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                            // Founder 10-09: the friend's name in the bubble lettering, in their own color; one line, shrinks to fit.
                            BubbleOneLine(
                                f.username.uppercase(),
                                rememberPlayerNamePalette(f.id, f.username, f.avatarUrl, f.avatarConfig, f.avatarCastId, f.avatarFrame),
                                16f, Modifier.weight(1f), align = androidx.compose.ui.text.style.TextAlign.Start,
                            )
                            SoftNumber("$wins–$losses", 16.sp)
                        }
                        Text(StatsProfile.headToHeadLine(vs, pocket), fontSize = 10.sp, fontWeight = FontWeight.ExtraBold, color = if (WTheme.isDark) WTheme.textMuted else FinishInk.muted, maxLines = 1)
                        RecordBar(wins, losses, height = 8.dp)
                    }
                }
            }
        }
    }
}

// ── The VS picker: 5 over 4, no swipe ───────────────────────────────────────

/** [modes] are VS-capable db keys; 9 games read as 5 on top and 4 centered under, equal tiles (core pickerSplit). */
@Composable
fun VsGamePicker(modes: List<String>, selectedMode: String, onMode: (String) -> Unit) {
    val split = StatsProfile.pickerSplit(modes)
    val perRow = maxOf(split.top.size, 1)
    Column(Modifier.fillMaxWidth().semantics { contentDescription = "VS game" }, verticalArrangement = Arrangement.spacedBy(6.dp)) {
        listOf(split.top, split.bottom).filter { it.isNotEmpty() }.forEach { row ->
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                val pad = (perRow - row.size) / 2f
                if (pad > 0f) Spacer(Modifier.weight(pad))
                row.forEach { m ->
                    val active = m == selectedMode
                    val card = modeCardForKey(m)
                    val gm = runCatching { GameMode.valueOf(m) }.getOrNull()
                    val accent = card?.accent ?: gm?.let { modeAccent(it) } ?: WTheme.primary
                    val label = com.wordocious.app.ModeGen.byDbKey(m)?.shortTitle ?: m
                    Box(
                        Modifier.weight(1f).aspectRatio(1f)
                            .clickable(interactionSource = remember { MutableInteractionSource() }, indication = null) { onMode(m) }
                            .semantics(mergeDescendants = true) {
                                role = Role.Tab
                                selected = active
                                contentDescription = "$label VS board"
                            },
                    ) {
                        Box(Modifier.fillMaxSize().miniGameCard(accent, 11.dp, selected = active), contentAlignment = Alignment.Center) {
                            val art = gameArtRes(card?.id)
                            if (art != null) {
                                Image(androidx.compose.ui.res.painterResource(art), null, modifier = Modifier.fillMaxSize(0.72f).padding(top = 2.dp))
                            } else if (gm != null) {
                                androidx.compose.foundation.layout.BoxWithConstraints(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                                    ModeGlyph(gm, accent, box = maxWidth * 0.7f)
                                }
                            }
                        }
                    }
                }
                if (pad > 0f) Spacer(Modifier.weight(pad))
            }
        }
    }
}

// ── Trophy shelf (item 17) ──────────────────────────────────────────────────

/**
 * The ChatGPT trophy shelf with 3D gold / silver / bronze medals standing in its holders and the counts under each.
 * Holder fractions measured off the art's contact sheet (art_pf_trophy_shelf); VISUAL CHECK on a real build.
 */
@Composable
fun TrophyShelfView(gold: Int, silver: Int, bronze: Int, modifier: Modifier = Modifier, width: Dp = 260.dp) {
    val h = width * (247f / 343f)
    // x, y holder centers and the medal disc's fraction of the shelf width.
    data class Holder(val x: Float, val y: Float, val disc: Float)
    val silverH = Holder(0.19f, 0.33f, 0.26f)
    val goldH = Holder(0.51f, 0.24f, 0.29f)
    val bronzeH = Holder(0.81f, 0.33f, 0.26f)
    val discOfWidth = 0.74f
    val discCenterY = 0.64f
    Column(
        modifier.fillMaxWidth().semantics(mergeDescendants = true) { contentDescription = "$gold gold, $silver silver, $bronze bronze medals" },
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(Modifier.width(width).height(h)) {
            Image(androidx.compose.ui.res.painterResource(R.drawable.art_pf_trophy_shelf), null, Modifier.fillMaxSize(), contentScale = ContentScale.FillBounds)
            listOf(Triple(R.drawable.art_pf_medal_silver, silverH, silver), Triple(R.drawable.art_pf_medal_gold, goldH, gold), Triple(R.drawable.art_pf_medal_bronze, bronzeH, bronze)).forEach { (res, spot, n) ->
                val mw = width * (spot.disc / discOfWidth)
                val mh = mw * (351f / 256f)
                val grey = ColorFilter.colorMatrix(ColorMatrix().apply { setToSaturation(0.4f) })
                Image(
                    androidx.compose.ui.res.painterResource(res), null,
                    Modifier.offset(x = width * spot.x - mw / 2, y = h * spot.y - mh * discCenterY).size(mw, mh).alpha(if (n == 0) 0.35f else 1f),
                    contentScale = ContentScale.FillBounds, colorFilter = if (n == 0) grey else null,
                )
            }
        }
        Box(Modifier.width(width).height(28.dp)) {
            listOf(Triple(silverH.x, silver, 17.sp), Triple(goldH.x, gold, 20.sp), Triple(bronzeH.x, bronze, 17.sp)).forEach { (x, n, size) ->
                Box(Modifier.offset(x = width * x - 28.dp).width(56.dp), contentAlignment = Alignment.Center) { SoftNumber("$n", size) }
            }
        }
    }
}

// ── Go Pro scenes (item 20) ─────────────────────────────────────────────────

@DrawableRes
private fun proSceneRes(b: StatsProfile.ProBenefit): Int = when (b) {
    StatsProfile.ProBenefit.UNLIMITED -> R.drawable.art_pro_unlimited
    StatsProfile.ProBenefit.ITEMS -> R.drawable.art_pro_items
    StatsProfile.ProBenefit.VS_BOTS -> R.drawable.art_pro_vs_bots
    StatsProfile.ProBenefit.STATS -> R.drawable.art_pro_stats
    StatsProfile.ProBenefit.NO_LIMITS -> R.drawable.art_pro_no_limits
}

/** Native pixel aspect (w / h) of each scene art. */
private fun proSceneAspect(b: StatsProfile.ProBenefit): Float = when (b) {
    StatsProfile.ProBenefit.UNLIMITED -> 392f / 307f
    StatsProfile.ProBenefit.ITEMS -> 402f / 424f
    StatsProfile.ProBenefit.VS_BOTS -> 416f / 257f
    StatsProfile.ProBenefit.STATS -> 354f / 356f
    StatsProfile.ProBenefit.NO_LIMITS -> 333f / 317f
}

/**
 * The free player's own mascot on the spotlight pedestal with the benefit's scene beside it. The mascot is the real resolver
 * render (alive while the living mascot is on), never an illustration; a guest sees the default mascot.
 */
@Composable
fun ProScene(benefit: StatsProfile.ProBenefit, modifier: Modifier = Modifier, height: Dp = 170.dp, caption: Boolean = true) {
    val profile by AuthService.profile.collectAsState()
    val pedW = height * 0.92f
    val pedH = pedW * (306f / 412f)
    val sceneH = height * 0.78f
    val sceneW = sceneH * proSceneAspect(benefit)
    val mascot = height * 0.82f
    Column(modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
        Box(Modifier.width(pedW + sceneW * 0.7f).height(height)) {
            Image(androidx.compose.ui.res.painterResource(R.drawable.art_pro_stage_pedestal), null,
                Modifier.align(Alignment.BottomStart).size(pedW, pedH), contentScale = ContentScale.FillBounds)
            Box(Modifier.align(Alignment.BottomStart).offset(x = (pedW - mascot) / 2, y = -pedH * 0.34f).size(mascot)) {
                PlayerAvatar(profile?.username, mascot, userId = profile?.id, standing = true)
            }
            androidx.compose.animation.Crossfade(benefit, Modifier.align(Alignment.BottomEnd).padding(bottom = 4.dp), label = "proScene") { b ->
                Image(androidx.compose.ui.res.painterResource(proSceneRes(b)), null, Modifier.size(sceneH * proSceneAspect(b), sceneH), contentScale = ContentScale.Fit)
            }
        }
        if (caption) {
            Text(StatsProfile.PRO_BENEFIT_CAPTION.getValue(benefit), fontSize = 12.sp, fontWeight = FontWeight.Black, color = Color(0xFFB45309), modifier = Modifier.padding(top = 2.dp))
        }
    }
}

/** The Go Pro page's hero: the five scenes take turns every 3.4 s (the picker pills choose one; Reduce Motion stays on the first until a pill is tapped). */
@Composable
fun ProSceneCarousel(modifier: Modifier = Modifier, height: Dp = 190.dp) {
    var index by remember { mutableIntStateOf(0) }
    var held by remember { mutableStateOf(false) }
    LaunchedEffect(held) {
        if (held || WTheme.reducedMotion) return@LaunchedEffect
        while (true) {
            delay(3400)
            index = (index + 1) % StatsProfile.PRO_BENEFIT_ORDER.size
        }
    }
    Column(modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(6.dp)) {
        ProScene(StatsProfile.PRO_BENEFIT_ORDER[index], height = height)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            StatsProfile.PRO_BENEFIT_ORDER.forEachIndexed { i, b ->
                HelperButton(
                    text = null, onClick = { held = true; index = i }, tint = Color(0xFFF5A524), circle = true, selected = i == index,
                    leading = { Image(androidx.compose.ui.res.painterResource(proSceneRes(b)), null, Modifier.size(20.dp), contentScale = ContentScale.Fit) },
                    contentDescription = StatsProfile.PRO_BENEFIT_CAPTION.getValue(b),
                )
            }
        }
    }
}
