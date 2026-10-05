package com.wordocious.app.ui

import androidx.compose.material.icons.filled.Close
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Shader
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.FilterQuality
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.R
import com.wordocious.app.data.AuthService
import com.wordocious.app.data.MascotAvatars
import com.wordocious.app.data.SettingsPref
import com.wordocious.app.data.SoundManager
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.core.AvatarConfig
import com.wordocious.core.avatarBackdrop
import com.wordocious.core.avatarColorHex
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

// Founder 10-05 ("I love the Stage idea … with the Dressing Room", docs/design/profile-2026-10-05):
// the shared dress-up pieces (iOS DressUp.swift / web dress-up.tsx parity) — the router every door
// opens through, the living mascot (breathe + blink, hop on tap), the stage set (backdrop · curtains ·
// podium, ChatGPT art) and the gold title ribbon.

/** Where Edit Profile opens. */
sealed class DressDoor {
    object Stage : DressDoor()
    data class Room(val tab: BuilderTab) : DressDoor()
    /** The one-time "Party hat?" offer: the room on Hats with the party hat on. */
    object PartyHat : DressDoor()
    /** The Stage with the Title Shelves open. */
    object Titles : DressDoor()
}

object DressUp {
    /** MainScreen opens Edit Profile for this (then hands it the door). */
    val request = MutableStateFlow<DressDoor?>(null)
    /** The door Edit Profile reads once when it opens. */
    var pendingDoor: DressDoor = DressDoor.Stage
    /** The one-time party-hat card is waiting on Home. */
    val partyHatOffer = MutableStateFlow(false)
    /** Bumps when a one-time flag changes. */
    val version = MutableStateFlow(0)

    fun open(door: DressDoor = DressDoor.Stage) {
        if (AuthService.profile.value == null || AuthService.isGuest.value) return
        pendingDoor = door
        request.value = door
    }

    fun isOwn(userId: String?): Boolean {
        val me = AuthService.profile.value?.id ?: return false
        if (AuthService.isGuest.value || userId.isNullOrBlank()) return false
        return me.equals(userId, ignoreCase = true)
    }

    enum class Nudge(val key: String) { HOST_INVITE("host"), PARTY_HAT("partyhat") }

    private fun key(n: Nudge) = "wd_dressup_${n.key}_v1:${(AuthService.profile.value?.id ?: "guest").lowercase()}"
    fun done(n: Nudge): Boolean = SettingsPref.get(key(n), false)
    fun finish(n: Nudge) {
        SettingsPref.set(key(n), true)
        if (n == Nudge.PARTY_HAT) partyHatOffer.value = false
        version.value += 1
    }

    /** After a win: the first one (signed in, hatless, never offered) queues the party-hat card. */
    fun noteWin() {
        val p = AuthService.profile.value ?: return
        if (AuthService.isGuest.value || done(Nudge.PARTY_HAT)) return
        val own = MascotAvatars.ownConfig(p)
        if (own != null && own.head != "none") { finish(Nudge.PARTY_HAT); return }
        partyHatOffer.value = true
    }

    fun noteSaved() { if (!done(Nudge.HOST_INVITE)) finish(Nudge.HOST_INVITE) }

    /** Demo captures (debug only): start every shot fresh. */
    fun resetForDemo() {
        Nudge.entries.forEach { SettingsPref.remove(key(it)) }
        SeasonNudge.reset()
        version.value += 1
    }

    /** The ChatGPT tab icon for a room tab. */
    fun tabArt(t: BuilderTab): Int = when (t) {
        BuilderTab.BODY, BuilderTab.PRESETS -> R.drawable.art_dress_tab_body
        BuilderTab.COLOR -> R.drawable.art_dress_tab_color
        BuilderTab.PATTERN -> R.drawable.art_dress_tab_pattern
        BuilderTab.EYES -> R.drawable.art_dress_tab_eyes
        BuilderTab.NOSE, BuilderTab.CHEEKS -> R.drawable.art_dress_tab_nose
        BuilderTab.MOUTH -> R.drawable.art_dress_tab_mouth
        BuilderTab.HATS -> R.drawable.art_dress_tab_hats
        BuilderTab.EXTRAS -> R.drawable.art_dress_tab_extras
        BuilderTab.BACKDROP -> R.drawable.art_dress_tab_backdrop
        BuilderTab.FRAME -> R.drawable.art_dress_tab_frame
        BuilderTab.SEASON -> R.drawable.art_dress_tab_hats   // the room draws the season's first hat instead
    }

    /** The room's tabs, all visible in one row (Cheeks joins Nose, presets sit on the stage). */
    val roomTabs = listOf(
        BuilderTab.BODY, BuilderTab.COLOR, BuilderTab.PATTERN, BuilderTab.EYES, BuilderTab.NOSE,
        BuilderTab.MOUTH, BuilderTab.HATS, BuilderTab.EXTRAS, BuilderTab.BACKDROP, BuilderTab.FRAME,
    )

    /** Parts wearing the NEW tag until the player visits their tab. */
    val newIds = setOf("head:santa", "head:witch", "neck:scarf", "neck:bubbletea", "neck:guitar", "neck:fairywings")
    fun tabSeen(t: BuilderTab) = SettingsPref.get("wd_mascot_new_seen_v1:${t.name.lowercase()}", false)
    fun markTabSeen(t: BuilderTab) = SettingsPref.set("wd_mascot_new_seen_v1:${t.name.lowercase()}", true)
}

object StageMetrics {
    val height = 300.dp
    val roomHeight = 250.dp
    val mascot = 176.dp
    val podiumWidth = 232.dp
    /** The stage header's side slots (× left, SAVE / DONE right): equal, so the heading centers. */
    val sideSlot = 86.dp
}

/**
 * The Stage / Dressing Room / Title Shelves close (iOS StageCloseButton, web StageClose): the family's soft 3D X,
 * bare. On the stage it is whitened with a deep drop shadow so it reads on the curtains (the pale family X
 * disappeared there); off the stage it wears the deep violet. A 44 dp hit area.
 */
@Composable
fun StageCloseButton(onStage: Boolean = true, label: String = "Close", modifier: Modifier = Modifier, onClick: () -> Unit) {
    val img = famBitmap(FamChrome.CLOSE.res)
    val filter = remember(onStage) {
        if (onStage) androidx.compose.ui.graphics.ColorFilter.colorMatrix(
            androidx.compose.ui.graphics.ColorMatrix().apply { setToSaturation(0f) }.also { m ->
                // desaturate, then lift toward white (keeps the clay shading)
                val lift = 56f
                m.values[4] = lift; m.values[9] = lift; m.values[14] = lift
            },
        ) else androidx.compose.ui.graphics.ColorFilter.tint(Color(0xFF8B5CF6), androidx.compose.ui.graphics.BlendMode.Modulate)
    }
    Box(modifier.size(44.dp).squishClickable(label = label, icon = true, onClick = onClick), contentAlignment = Alignment.Center) {
        if (img != null) {
            // a soft drop: the same X in deep violet, 2 dp down, under the face
            Image(img, null, contentScale = ContentScale.Fit,
                colorFilter = androidx.compose.ui.graphics.ColorFilter.tint(Color(0xFF2E1065), androidx.compose.ui.graphics.BlendMode.SrcIn),
                modifier = Modifier.size(24.dp).graphicsLayer { translationY = 2.dp.toPx(); alpha = if (onStage) 0.5f else 0.18f })
            Image(img, null, contentScale = ContentScale.Fit, colorFilter = filter, modifier = Modifier.size(24.dp))
        } else {
            androidx.compose.material3.Icon(androidx.compose.material.icons.Icons.Filled.Close, null,
                tint = if (onStage) Color.White else Color(0xFF6D28D9), modifier = Modifier.size(22.dp))
        }
    }
}

/** The three frames a living mascot swaps between: the eyes swap for the blink, eyes + mouth for the tap grin. */
enum class LiveFrame { REST, BLINK, CHEER }

internal object LiveMascotRules {
    /** Eyes that can't close never blink. */
    val noBlink = setOf("glasses", "sunglasses", "cyclops", "happy", "none")

    fun config(c: AvatarConfig, f: LiveFrame): AvatarConfig {
        var v = c.copy(frame = "none")
        if (f == LiveFrame.REST) return v
        if (c.eyes !in noBlink && MascotBuilderLogic.conflict(v, BuilderOption("eyes", "happy")) == null) v = v.copy(eyes = "happy")
        if (f == LiveFrame.CHEER && c.mouth != "laugh" && c.mouth != "none" && MascotBuilderLogic.conflict(v, BuilderOption("mouth", "laugh")) == null) v = v.copy(mouth = "laugh")
        return v
    }
}

/**
 * Your mascot, alive (founder 10-05; the cast-rig idea on the maker's layers): an idle breathe
 * (1.8% squash, 3.4 s loop), a blink every few seconds (the eyes layer swaps), a hop + grin on tap.
 * Three composed cutout bitmaps (MascotComposer cache, composed off main) + graphicsLayer transforms;
 * reduced / calm motion keeps it still (a tap still grins).
 */
@Composable
fun LiveMascot(
    config: AvatarConfig,
    initial: String,
    size: Dp = StageMetrics.mascot,
    modifier: Modifier = Modifier,
    hopToken: Int = 0,
    tappable: Boolean = true,
) {
    val context = LocalContext.current
    val density = LocalDensity.current
    val px = with(density) { size.roundToPx() }.coerceAtLeast(1)
    val still = WTheme.reducedMotion || WTheme.calmMotion
    val keys = remember(config, initial, px) {
        LiveFrame.entries.associateWith { MascotKey.of(LiveMascotRules.config(config, it), initial, size.value, px, false, cutout = true) }
    }
    var frames by remember(keys) { mutableStateOf(keys.mapValues { MascotComposer.cached(it.value) }) }
    LaunchedEffect(keys) {
        if (frames.values.any { it == null }) {
            frames = withContext(Dispatchers.Default) { keys.mapValues { MascotComposer.compose(context, it.value) } }
        }
    }
    var frame by remember { mutableStateOf(LiveFrame.REST) }
    val lift = remember { Animatable(0f) }
    val scope = rememberCoroutineScope()
    val breathe = if (still) null else rememberInfiniteTransition(label = "breathe").animateFloat(
        0f, 1f, infiniteRepeatable(tween(1700, easing = FastOutSlowInEasing), RepeatMode.Reverse), label = "b",
    )
    LaunchedEffect(config.eyes, still) {
        if (still || config.eyes in LiveMascotRules.noBlink) return@LaunchedEffect
        while (true) {
            delay((2600..4800).random().toLong())
            if (frame == LiveFrame.REST) frame = LiveFrame.BLINK
            delay(140)
            if (frame == LiveFrame.BLINK) frame = LiveFrame.REST
        }
    }
    fun hop(sound: Boolean) {
        if (sound) SoundManager.playHop()
        frame = LiveFrame.CHEER
        scope.launch {
            if (!still) {
                lift.animateTo(1f, tween(150, easing = FastOutSlowInEasing))
                lift.animateTo(0f, spring(dampingRatio = 0.38f, stiffness = 520f))
            } else delay(600)
            if (frame == LiveFrame.CHEER) frame = LiveFrame.REST
        }
    }
    var lastToken by remember { mutableIntStateOf(hopToken) }
    LaunchedEffect(hopToken) { if (hopToken != lastToken) { lastToken = hopToken; hop(sound = false) } }
    val tap = if (tappable) Modifier.squishClickable(label = "Your mascot, tap to hop") { hop(sound = true) } else Modifier
    Box(
        modifier.size(size).then(tap).graphicsLayer {
            val b = breathe?.value ?: 0f
            val v = lift.value
            transformOrigin = TransformOrigin(0.5f, 1f)
            translationY = -size.toPx() * 0.15f * v.coerceAtLeast(0f)
            scaleX = (1f + 0.018f * b) * (1f - 0.05f * v)
            scaleY = (1f - 0.018f * b) * (1f + 0.07f * v)
        },
    ) {
        val img: ImageBitmap? = frames[frame] ?: frames[LiveFrame.REST]
        img?.let {
            Image(it, null, contentScale = ContentScale.Fit, filterQuality = FilterQuality.High,
                modifier = Modifier.fillMaxSize().clearAndSetSemantics { })
        }
    }
}

/** The player's backdrop drawn full-bleed (the avatar tile's backdrop, stretched to the stage). */
@Composable
fun StageBackdrop(bg: String, baseHex: String?, modifier: Modifier = Modifier) {
    val dark = WTheme.isDark
    Canvas(modifier) {
        drawIntoCanvas { cv ->
            val c = cv.nativeCanvas
            val w = size.width; val h = size.height
            val base = MascotComposer.colorOf(baseHex, 0xFF7C3AED.toInt())
            val p = Paint(Paint.ANTI_ALIAS_FLAG)
            val b = avatarBackdrop(bg)
            if (b == null) {
                val top = if (dark) MascotComposer.mix(0xFF1E1633.toInt(), base, 0.30f) else MascotComposer.mix(android.graphics.Color.WHITE, base, 0.16f)
                val bottom = if (dark) MascotComposer.mix(0xFF1E1633.toInt(), base, 0.46f) else MascotComposer.mix(android.graphics.Color.WHITE, base, 0.34f)
                p.shader = LinearGradient(0f, 0f, 0f, h, top, bottom, Shader.TileMode.CLAMP)
                c.drawRect(0f, 0f, w, h, p)
                return@drawIntoCanvas
            }
            val cols = b.colors.map { MascotComposer.colorOf(it, base) }
            when (b.kind) {
                "gradient" -> {
                    if (cols.size >= 2) p.shader = LinearGradient(0f, 0f, w, h, cols.toIntArray(), null, Shader.TileMode.CLAMP) else p.color = cols.firstOrNull() ?: base
                    c.drawRect(0f, 0f, w, h, p)
                }
                "pattern" -> {
                    p.color = cols.first(); c.drawRect(0f, 0f, w, h, p)
                    c.save(); c.clipRect(0f, 0f, w, h)
                    MascotBackdrops.motif(c, b.id, cols, maxOf(w, h))
                    c.restore()
                }
                else -> { p.color = cols.firstOrNull() ?: base; c.drawRect(0f, 0f, w, h, p) }
            }
        }
    }
}

/** A dress-up art piece at a fixed height (aspect kept). Decorative. */
@Composable
fun StageArt(res: Int, height: Dp, modifier: Modifier = Modifier, width: Dp? = null) {
    val painter = painterResource(res)
    val ratio = painter.intrinsicSize.let { if (it.height > 0f) it.width / it.height else 1f }
    Image(
        painter, null, contentScale = ContentScale.FillBounds,
        modifier = modifier.height(height).width(width ?: (height * ratio)).clearAndSetSemantics { },
    )
}

/**
 * The Stage: the player's backdrop, soft curtains at the sides, a spotlight, the podium (ChatGPT stage
 * set) and the living mascot — or the framed photo — standing on it. [overlay] sits on top (header).
 */
@Composable
fun DressStage(
    config: AvatarConfig,
    initial: String,
    modifier: Modifier = Modifier,
    photoUrl: String? = null,
    height: Dp = StageMetrics.height,
    mascotSize: Dp = StageMetrics.mascot,
    hopToken: Int = 0,
    curtains: Boolean = true,
    bulbs: Boolean = false,
    overlay: @Composable BoxScope.() -> Unit = {},
) {
    val podiumW = minOf(StageMetrics.podiumWidth, mascotSize * 1.34f)
    val podiumH = podiumW * (241f / 555f)
    Box(modifier.fillMaxWidth().height(height), contentAlignment = Alignment.BottomCenter) {
        StageBackdrop(config.bg, avatarColorHex(config.color), Modifier.fillMaxSize())
        Box(Modifier.fillMaxSize().background(Brush.radialGradient(
            listOf(Color.White.copy(alpha = if (WTheme.isDark) 0.16f else 0.42f), Color.Transparent),
            center = androidx.compose.ui.geometry.Offset.Unspecified, radius = 900f,
        )))
        if (curtains) {
            Row(Modifier.fillMaxSize(), horizontalArrangement = Arrangement.SpaceBetween) {
                StageArt(R.drawable.art_dress_curtain_l, height * 0.78f)
                StageArt(R.drawable.art_dress_curtain_r, height * 0.78f)
            }
        }
        if (bulbs) StageArt(R.drawable.art_dress_bulbs, 30.dp, Modifier.align(Alignment.TopCenter).padding(top = 6.dp), width = 280.dp)
        Box(Modifier.padding(bottom = 10.dp), contentAlignment = Alignment.BottomCenter) {
            StageArt(R.drawable.art_dress_podium, podiumH, width = podiumW)
            Box(Modifier.padding(bottom = podiumH * 0.42f)) {
                if (photoUrl != null) PhotoAvatar(photoUrl, mascotSize * 0.74f, Modifier.padding(bottom = mascotSize * 0.06f), contentDescription = "Your photo")
                else LiveMascot(config, initial, mascotSize, hopToken = hopToken)
            }
        }
        overlay()
    }
}

/**
 * The featured title as a gold ribbon (three-slice ChatGPT art, so it stretches); long titles shrink to
 * fit (never wrap or truncate). [placeholder] = the soft "Choose a title" state.
 */
@Composable
fun TitleRibbon(text: String, height: Dp = 28.dp, maxWidth: Dp = 260.dp, placeholder: Boolean = false, modifier: Modifier = Modifier) {
    val cap = height * (147f / 120f)
    val base = (height.value * 0.43f)
    var fs by remember(text) { mutableStateOf(base) }
    var ready by remember(text) { mutableStateOf(false) }
    Box(
        modifier.height(height).widthIn(max = maxWidth).drawWithContent { if (ready) drawContent() },
        contentAlignment = Alignment.Center,
    ) {
        Row(Modifier.matchParentSize().graphicsLayer { alpha = if (placeholder) 0.55f else 1f }) {
            Image(painterResource(R.drawable.art_dress_ribbon_l), null, contentScale = ContentScale.FillBounds, modifier = Modifier.width(cap).height(height))
            Image(painterResource(R.drawable.art_dress_ribbon_m), null, contentScale = ContentScale.FillBounds, modifier = Modifier.weight(1f).height(height))
            Image(painterResource(R.drawable.art_dress_ribbon_r), null, contentScale = ContentScale.FillBounds, modifier = Modifier.width(cap).height(height))
        }
        androidx.compose.material3.Text(
            text.uppercase(), fontSize = fs.sp, fontWeight = FontWeight.Black, letterSpacing = 0.6.sp, maxLines = 1, softWrap = false,
            color = if (placeholder) Color(0xB392400E) else Color(0xFF7C2D12), textAlign = TextAlign.Center,
            modifier = Modifier.padding(horizontal = cap * 0.8f).offset(y = -(height * 0.07f)),
            onTextLayout = { r -> if (r.didOverflowWidth && fs > base * 0.4f) fs *= 0.92f else ready = true },
        )
    }
}

/** Door 3: the one-time "Party hat?" card on Home (after the first win). Never on top of a game. */
@Composable
fun PartyHatOffer(modifier: Modifier = Modifier) {
    val show by DressUp.partyHatOffer.collectAsState()
    val v by DressUp.version.collectAsState()
    if (!show || DressUp.done(DressUp.Nudge.PARTY_HAT) || v < 0) return
    Row(
        modifier.fillMaxWidth().clip(RoundedCornerShape(18.dp))
            .background(Brush.horizontalGradient(listOf(Color(0xFFFCE7F3), Color(0xFFEDE9FE))).let { it })
            .padding(start = 10.dp, end = 2.dp, top = 8.dp, bottom = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        StageArt(R.drawable.art_dress_partyhat, 50.dp)
        Column(Modifier.weight(1f)) {
            androidx.compose.material3.Text("First win! Party hat?", fontSize = 15.sp, fontWeight = FontWeight.Black, color = Color(0xFF6D28D9), maxLines = 1)
            androidx.compose.material3.Text("Your mascot wants to celebrate.", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color(0xFF7A6AA6), maxLines = 1)
        }
        CandyButton("Yes!", onClick = { DressUp.open(DressDoor.PartyHat) }, color = CandyColor.PINK, size = CandySize.SMALL)
        // Button family §3: the soft 3D X.
        RoundIconButton(FamChrome.CLOSE, "No thanks", onClick = { DressUp.finish(DressUp.Nudge.PARTY_HAT) }, size = 22.dp)
    }
}

/**
 * The one-time seasonal nudge (10-05, the party-hat card's pattern): first Home open in a season with a mascot shelf
 * ("Dress up for Halloween?", core AvatarSeason.nudgeDue). Yes opens the Dressing Room on the seasonal shelf; Yes or
 * × end it for this season (it comes back next year). Signed-in players not already wearing one of its parts.
 */
object SeasonNudge {
    private fun key() = "wd_dressup_season_v1:${(AuthService.profile.value?.id ?: "guest").lowercase()}"
    fun seen(): List<String> = SettingsPref.get(key(), "").split(',').filter { it.isNotBlank() }
    fun finish(season: String) {
        SettingsPref.set(key(), (seen() + com.wordocious.core.AvatarSeason.nudgeKey(season, com.wordocious.core.AvatarSeason.today())).joinToString(","))
        DressUp.version.value += 1
    }
    fun reset() { SettingsPref.remove(key()) }
}

@Composable
fun SeasonDressOffer(modifier: Modifier = Modifier) {
    val ctx = androidx.compose.ui.platform.LocalContext.current
    val v by DressUp.version.collectAsState()
    val profile by AuthService.profile.collectAsState()
    val guest by AuthService.isGuest.collectAsState()
    val season = rememberSeason()
    val p = profile ?: return
    if (guest || v < 0) return
    val fit = MascotComposer.fitManifest(ctx) ?: return
    val own = MascotAvatars.ownConfig(p)?.let { com.wordocious.core.AvatarSeason.worn(it) }
    val due = com.wordocious.core.AvatarSeason.nudgeDue(com.wordocious.core.AvatarSeason.today(), season ?: "none", own, SeasonNudge.seen(), fit) ?: return
    val first = com.wordocious.core.AvatarSeason.shelf(due, fit).firstOrNull()
    Row(
        modifier.fillMaxWidth().clip(RoundedCornerShape(18.dp))
            .background(Brush.horizontalGradient(listOf(Color(0xFFFFEDD5), Color(0xFFEDE9FE))))
            .padding(start = 10.dp, end = 2.dp, top = 8.dp, bottom = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        val icon = first?.let { MascotComposer.drawableId(ctx, "art_av_acc_${it.id}") } ?: 0
        if (icon != 0) Box(Modifier.width(50.dp), contentAlignment = Alignment.Center) { StageArt(icon, 44.dp) }
        Column(Modifier.weight(1f)) {
            androidx.compose.material3.Text("Dress up for ${seasonTitle(due)}?", fontSize = 15.sp, fontWeight = FontWeight.Black, color = Color(0xFF6D28D9), maxLines = 1)
            androidx.compose.material3.Text("Free looks for the season.", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color(0xFF7A6AA6), maxLines = 1)
        }
        CandyButton("Yes!", onClick = { SeasonNudge.finish(due); DressUp.open(DressDoor.Room(BuilderTab.SEASON)) }, color = CandyColor.PINK, size = CandySize.SMALL)
        // Button family §3: the soft 3D X.
        RoundIconButton(FamChrome.CLOSE, "No thanks", onClick = { SeasonNudge.finish(due) }, size = 22.dp)
    }
}

/** Door 2: "Make me yours!" beside the plain host — tap opens the room, × ends it for good. */
@Composable
internal fun HostInviteBubble(modifier: Modifier = Modifier) {
    Box(modifier) {
        Box(
            Modifier.squishClickable(label = "Make me yours! Dress up your mascot") {
                DressUp.finish(DressUp.Nudge.HOST_INVITE); DressUp.open(DressDoor.Room(BuilderTab.BODY))
            },
        ) {
            Image(painterResource(R.drawable.art_dress_bubble), null, contentScale = ContentScale.FillBounds, modifier = Modifier.matchParentSize())
            androidx.compose.material3.Text(
                "Make me yours!", fontSize = 12.sp, fontWeight = FontWeight.Black, color = Color(0xFF6D28D9), maxLines = 1,
                modifier = Modifier.padding(start = 14.dp, end = 14.dp, top = 8.dp, bottom = 13.dp),
            )
        }
        // Button family §3: the soft 3D X (44 dp hit area; the offset keeps its center on the bubble's corner).
        RoundIconButton(
            FamChrome.CLOSE, "Dismiss", onClick = { DressUp.finish(DressUp.Nudge.HOST_INVITE) },
            modifier = Modifier.align(Alignment.TopEnd).offset(x = 17.dp, y = (-17).dp), size = 18.dp,
        )
    }
}
