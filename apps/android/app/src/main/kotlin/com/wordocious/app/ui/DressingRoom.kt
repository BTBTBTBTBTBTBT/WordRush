package com.wordocious.app.ui

import androidx.compose.material.icons.filled.Close
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.R
import com.wordocious.app.data.SoundManager
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.core.AvatarConfig
import com.wordocious.core.avatarColorHex
import com.wordocious.app.ui.game.ProPaywallDialog

/**
 * Founder 10-05 "Dressing Room" (iOS MascotBuilderView `.room` / web dressing-room parity): full screen,
 * the Stage pinned on top (bulbs + curtains + podium + your living mascot, hopping on every change),
 * Randomize + Undo on the stage, ALL tabs visible as ChatGPT icons in one row, tiles that show ONLY the
 * part (no framed mascot thumbnails), NEW / PRO tag art. Done hands the look back to the Stage.
 */
@Composable
fun DressingRoom(
    config: AvatarConfig,
    initial: String,
    level: Int,
    isPro: Boolean,
    startTab: BuilderTab,
    onClose: () -> Unit,
    onDone: (AvatarConfig) -> Unit,
) {
    val ctx = LocalContext.current
    remember { MascotBuilderLogic.fit = MascotComposer.fitManifest(ctx); true }
    var look by remember { mutableStateOf(config) }
    var tab by remember { mutableStateOf(if (startTab == BuilderTab.PRESETS) BuilderTab.BODY else startTab) }
    val undo = remember { mutableStateListOf<AvatarConfig>() }
    var hop by remember { mutableIntStateOf(0) }
    var note by remember { mutableStateOf<String?>(null) }
    var paywallFor by remember { mutableStateOf<BuilderOption?>(null) }
    val seen = remember { DressUp.roomTabs.filter { DressUp.tabSeen(it) }.toSet() }
    LaunchedEffect(tab) { DressUp.markTabSeen(tab) }
    LaunchedEffect(note) { if (note != null) { kotlinx.coroutines.delay(2600); note = null } }
    fun change(next: AvatarConfig) {
        if (next == look) return
        undo.add(look); if (undo.size > 40) undo.removeAt(0)
        look = next; hop++
        SoundManager.playHop()
    }

    Column(Modifier.fillMaxSize().background(if (WTheme.isDark) WTheme.bg else Color(0xFFF7F2FF))) {
        DressStage(
            look, initial,
            modifier = Modifier.clip(RoundedCornerShape(bottomStart = 26.dp, bottomEnd = 26.dp)),
            height = StageMetrics.roomHeight + 30.dp, mascotSize = 160.dp, hopToken = hop, curtains = true, bulbs = false,
        ) {
            StageArt(R.drawable.art_dress_bulbs, 30.dp, Modifier.align(Alignment.TopCenter).statusBarsPadding().padding(top = 4.dp), width = 280.dp)
            Row(Modifier.align(Alignment.TopCenter).fillMaxWidth().statusBarsPadding().padding(horizontal = 10.dp).padding(top = 40.dp), verticalAlignment = Alignment.CenterVertically) {
                StageCloseButton(label = "Close without saving", onClick = onClose)
                Spacer(Modifier.weight(1f))
                // The finished cast primary (the frost helper pill read pale on the stage).
                CastButton("Done", onClick = { onDone(MascotBuilderLogic.sanitize(look, isPro, level)) }, color = CastColor.PURPLE, size = CastSize.S)
            }
            Column(Modifier.align(Alignment.TopStart).statusBarsPadding().padding(start = 12.dp, top = 92.dp), verticalArrangement = Arrangement.spacedBy(9.dp)) {
                RoundCandy(null, "Randomize", listOf(Color(0xFF5EEAD4), Color(0xFF0D9488))) { change(MascotBuilderLogic.randomize(look, isPro, level)) }
                RoundCandy("↶", "Undo", listOf(Color(0xFFFDE68A), Color(0xFFF59E0B)), enabled = undo.isNotEmpty()) {
                    undo.removeLastOrNull()?.let { look = it; hop++ }
                }
            }
        }
        // All ten tabs, one row.
        Row(Modifier.fillMaxWidth().padding(horizontal = 6.dp).padding(top = 8.dp)) {
            DressUp.roomTabs.forEach { t ->
                val on = tab == t || (t == BuilderTab.NOSE && tab == BuilderTab.CHEEKS)
                Column(
                    Modifier.weight(1f).squishClickable(label = "${t.label} options" + if (on) ", selected" else "", role = Role.Tab) { tab = t },
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Box(
                        Modifier.size(32.dp)
                            .then(if (on) Modifier.shadow(6.dp, RoundedCornerShape(12.dp), clip = false, spotColor = Color(0x557C3AED)) else Modifier)
                            .clip(RoundedCornerShape(12.dp)).background(if (on) Color.White else Color.White.copy(alpha = 0.55f)),
                        contentAlignment = Alignment.Center,
                    ) {
                        StageArt(DressUp.tabArt(t), 24.dp)
                        if (t !in seen && (t == BuilderTab.HATS || t == BuilderTab.EXTRAS)) Box(Modifier.align(Alignment.TopEnd).size(7.dp).clip(CircleShape).background(Color(0xFFEC4899)))
                    }
                    // softWrap off + a hair of negative tracking: "Backdrop" fits its tenth of a 360 dp row (was "Backdro").
                    Text(t.label, fontSize = 8.5.sp, fontWeight = FontWeight.Black, maxLines = 1, softWrap = false, letterSpacing = (-0.25).sp,
                        overflow = androidx.compose.ui.text.style.TextOverflow.Visible,
                        color = if (on) Color(0xFF6D28D9) else if (WTheme.isDark) WTheme.textSecondary else Color(0xFF6B5C8F))
                }
            }
        }
        Column(
            Modifier.fillMaxWidth().weight(1f).verticalScroll(rememberScrollState()).navigationBarsPadding().padding(horizontal = 14.dp).padding(top = 8.dp, bottom = 30.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            @Composable
            fun Grid(opts: List<BuilderOption>) {
                opts.chunked(5).forEach { row ->
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        row.forEach { o ->
                            PartTile(o, look, isPro, level, newTag = (o.slot + ":" + o.id in DressUp.newIds || MascotBuilderLogic.isNew(o)) && tab !in seen, modifier = Modifier.weight(1f)) {
                                if (MascotBuilderLogic.proLocked(o, isPro)) paywallFor = o
                                else if (!MascotBuilderLogic.tierLocked(o, level)) {
                                    note = MascotBuilderLogic.conflict(look, o)?.let { (_, id) -> "That doesn't fit with ${id.replaceFirstChar { it.uppercase() }}, so it came off" }
                                    change(MascotBuilderLogic.tap(look, o))
                                }
                            }
                        }
                        repeat(5 - row.size) { Spacer(Modifier.weight(1f)) }
                    }
                }
            }
            when (tab) {
                BuilderTab.COLOR -> SwatchGridPublic("color", look, isPro, { change(it) }) { paywallFor = it }
                BuilderTab.PATTERN -> {
                    Grid(MascotBuilderLogic.options(BuilderTab.PATTERN))
                    if (look.pattern != "solid") { FinishLabel("PATTERN COLOR"); SwatchGridPublic("patternColor", look, isPro, { change(it) }) { paywallFor = it } }
                }
                BuilderTab.NOSE, BuilderTab.CHEEKS -> {
                    FinishLabel("NOSE"); Grid(MascotBuilderLogic.options(BuilderTab.NOSE))
                    FinishLabel("CHEEKS"); Grid(MascotBuilderLogic.options(BuilderTab.CHEEKS))
                }
                BuilderTab.HATS, BuilderTab.EXTRAS -> {
                    Grid(MascotBuilderLogic.options(tab))
                    if (MascotBuilderLogic.tintableWorn(look)) { FinishLabel("ACCESSORY COLOR"); SwatchGridPublic("accColor", look, isPro, { change(it) }) { paywallFor = it } }
                }
                else -> Grid(MascotBuilderLogic.options(tab))
            }
            note?.let { Text(it, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color(0xFF6D28D9), textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth()) }
        }
    }
    paywallFor?.let { o ->
        ProPaywallDialog(onDismiss = { paywallFor = null }, onPro = {
            paywallFor = null
            if (!MascotBuilderLogic.tierLocked(o, level)) change(MascotBuilderLogic.apply(look, o))
        })
    }
}

@Composable
internal fun RoundCandy(glyph: String?, label: String, colors: List<Color>, enabled: Boolean = true, size: androidx.compose.ui.unit.Dp = 38.dp, onClick: () -> Unit) {
    Box(
        Modifier.size(size).graphicsLayer { alpha = if (enabled) 1f else 0.45f }
            .shadow(3.dp, CircleShape, clip = false).clip(CircleShape).background(Brush.verticalGradient(colors))
            .squishClickable(label = label, enabled = enabled, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) { if (glyph == null) DiceGlyphPublic(size * 0.47f) else Text(glyph, fontSize = 17.sp, fontWeight = FontWeight.Black, color = Color.White) }
}

/**
 * One option as JUST the part (founder 10-05) on a soft round pad: the body shape in the current color,
 * the pattern on that body, the face part / accessory art, the backdrop swatch or the frame. Selected = a
 * gold ring + glow; NEW / PRO = the ChatGPT tag art; a level-locked frame = the lock + "Lv N".
 */
@Composable
private fun PartTile(o: BuilderOption, look: AvatarConfig, isPro: Boolean, level: Int, newTag: Boolean, modifier: Modifier, onTap: () -> Unit) {
    val ctx = LocalContext.current
    val selected = MascotBuilderLogic.isSelected(look, o)
    val proLock = MascotBuilderLogic.proLocked(o, isPro)
    val tierLock = MascotBuilderLogic.tierLocked(o, level)
    Column(modifier, horizontalAlignment = Alignment.CenterHorizontally) {
        Box(
            Modifier.fillMaxWidth().aspectRatio(1f)
                .squishClickable(label = MascotBuilderLogic.a11yLabel(BuilderTab.BODY, o, o.id, selected, isPro, level), role = Role.RadioButton, onClick = onTap),
        ) {
            Box(
                Modifier.fillMaxSize()
                    .then(if (selected) Modifier.shadow(6.dp, CircleShape, clip = false, spotColor = Color(0x99F59E0B)) else Modifier)
                    .clip(CircleShape).background(if (selected) Color.White else if (WTheme.isDark) Color.White.copy(alpha = 0.1f) else Color(0xFFEAE2FA))
                    .then(if (selected) Modifier.border(3.dp, Color(0xFFF5B82E), CircleShape) else Modifier),
                contentAlignment = Alignment.Center,
            ) {
                Box(Modifier.fillMaxSize().padding(if (o.slot == "bg") 0.dp else 7.dp).clip(CircleShape).graphicsLayer { alpha = if (tierLock) 0.45f else 1f }, contentAlignment = Alignment.Center) {
                    if (o.id == MascotBuilderLogic.NONE || (o.slot == "pattern" && o.id == "solid")) NoneLabel()
                    else when (o.slot) {
                        "bg" -> StageBackdrop(o.id, avatarColorHex(look.color), Modifier.fillMaxSize())
                        "body", "pattern" -> Canvas(Modifier.fillMaxSize()) {
                            drawIntoCanvas { MascotComposer.drawBodyThumb(ctx, it.nativeCanvas, size.minDimension, if (o.slot == "body") o.id else look.body, look, if (o.slot == "pattern") o.id else "solid") }
                        }
                        "frame" -> if (o.id == MascotBuilderLogic.NONE) NoneLabel() else AvatarSquareFrame(o.id, 40.dp)
                        "extras" -> NoneLabel()
                        else -> {
                            val kind = when (o.slot) { "eyes" -> "eyes"; "mouth" -> "mouth"; "nose" -> "nose"; "cheeks" -> "cheeks"; "brows" -> "brows"; else -> "acc" }
                            val id = if (o.id == MascotBuilderLogic.NONE) 0 else MascotComposer.drawableId(ctx, "art_av_${kind}_${o.id.replace('-', '_')}")
                            if (id != 0) Image(painterResource(id), null, contentScale = ContentScale.Fit, modifier = Modifier.fillMaxSize())
                            else if (o.id == MascotBuilderLogic.NONE) NoneLabel()
                            else Text(o.id, fontSize = 9.sp, fontWeight = FontWeight.Black, color = WTheme.text, textAlign = TextAlign.Center)
                        }
                    }
                }
                if (tierLock) StageArt(R.drawable.art_dress_lock, 20.dp)
            }
            if (newTag && !proLock) StageArt(R.drawable.art_dress_tag_new, 15.dp, Modifier.align(Alignment.TopEnd).offset(x = 4.dp, y = (-3).dp))
            if (proLock) StageArt(R.drawable.art_dress_tag_pro, 15.dp, Modifier.align(Alignment.BottomEnd).offset(x = 6.dp, y = 2.dp))
        }
        MascotBuilderLogic.frameTier(o)?.takeIf { tierLock }?.let {
            Text("Lv ${it.minLevel}", fontSize = 9.sp, fontWeight = FontWeight.Black, color = WTheme.textMuted)
        }
    }
}

@Composable
private fun NoneLabel() {
    // founder 10-05: the soft None glyph (ChatGPT art: a puffy lavender ring with a gentle slash)
    StageArt(R.drawable.art_dress_none, 30.dp)
}
