package com.wordocious.app.ui

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.keyframes
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
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
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.data.SoundManager
import com.wordocious.app.ui.game.ProPaywallDialog
import com.wordocious.app.ui.game.ProPill
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.core.AvatarConfig
import com.wordocious.core.AvatarOptions
import com.wordocious.core.avatarBackdrop
import com.wordocious.core.avatarColorHex
import kotlinx.coroutines.launch

// FINISH_SPEC AN4 — the "Make your mascot" builder (Edit Profile). A big live
// preview on a tinted stage that hops on every change, candy-chip category tabs
// (Presets · Body · Color · Pattern · Eyes · Nose · Mouth · Hats · Extras · Backdrop · Frame),
// each a grid of squishy tiles showing that part ON the current mascot, Randomize
// (dice candy, playful wiggle) and Save (candy). Pro-only items carry the gold PRO
// pill for free players and open the G1 paywall; tier frames above the player's
// level are dimmed with a lock + "Lv N". Pure rules: MascotBuilderLogic.

private val BUILDER_PURPLE = Color(0xFF7C3AED)
private val CHIP_GOLD = Color(0xFFF5C542)

/** "#rrggbb" → Color (purple when malformed). */
internal fun avatarColor(hex: String?): Color {
    val h = hex?.trim()?.removePrefix("#") ?: return BUILDER_PURPLE
    val v = h.toLongOrNull(16)?.takeIf { h.length == 6 } ?: return BUILDER_PURPLE
    return Color(0xFF000000L or v)
}

/** A swatch id ("purple", …) → its Color. */
internal fun swatchColor(id: String?): Color = avatarColor(avatarColorHex(id))

/**
 * The builder. [config] is the live (unsaved) look; every tap reports the new one
 * through [onChange]. [initial] is the player's body letter. [onSave] null hides the
 * builder's own Save (the page's Save still writes it).
 */
@Composable
fun MascotBuilder(
    config: AvatarConfig,
    onChange: (AvatarConfig) -> Unit,
    initial: String,
    level: Int,
    isPro: Boolean,
    modifier: Modifier = Modifier,
    onSave: (() -> Unit)? = null,
    saving: Boolean = false,
    saved: Boolean = false,
    /** FINISH_SPEC AO coach hook: reports "stage", "tabs", "randomize" and "save" as they lay out. */
    anchor: ((String, androidx.compose.ui.layout.LayoutCoordinates) -> Unit)? = null,
) {
    var tab by rememberSaveable { mutableStateOf(BuilderTab.PRESETS) }
    var paywallFor by remember { mutableStateOf<BuilderOption?>(null) }
    val accent = swatchColor(config.color)

    Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Box(Modifier.builderAnchor("stage", anchor)) {
            MascotStage(config, initial, isPro)
        }

        // The two actions under the stage: Randomize (dice) and Save.
        Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(10.dp, Alignment.CenterHorizontally),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(Modifier.builderAnchor("randomize", anchor)) {
                RandomizeButton { onChange(MascotBuilderLogic.randomize(config, isPro, level)) }
            }
            if (onSave != null) {
                CandyButton(
                    when { saving -> "Saving…"; saved -> "Saved!"; else -> "Save" },
                    onClick = { if (!saving) onSave() },
                    color = CandyColor.PURPLE, size = CandySize.MEDIUM,
                    contentDescription = if (saved) "Mascot saved" else "Save mascot",
                    modifier = Modifier.builderAnchor("save", anchor),
                )
            }
        }

        // Category tabs as candy chips (scrolls sideways on narrow phones).
        Row(
            Modifier.builderAnchor("tabs", anchor).fillMaxWidth().horizontalScroll(rememberScrollState()).padding(vertical = 4.dp),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            BuilderTab.entries.forEach { t -> BuilderChip(t.label, t == tab) { tab = t } }
        }

        // The option grid for the tab: 4 across, each tile the mascot wearing that option.
        val options = remember(tab) { MascotBuilderLogic.options(tab) }
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            options.chunked(4).forEach { row ->
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    row.forEach { o ->
                        OptionTile(
                            tab, o, config, initial, isPro, level, accent, Modifier.weight(1f),
                            onTap = {
                                if (MascotBuilderLogic.proLocked(o, isPro)) paywallFor = o
                                else onChange(MascotBuilderLogic.tap(config, o))
                            },
                        )
                    }
                    repeat(4 - row.size) { Spacer(Modifier.weight(1f)) }
                }
            }
        }
        if (tab == BuilderTab.PATTERN && config.pattern != "solid") {
            PatternColorRow(config, onChange)
        }
        if (tab == BuilderTab.FRAME) {
            Text(
                "Reach a new level tier to unlock its frame.",
                fontSize = 10.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted,
            )
        }
    }

    // G1: a free player tapped a Pro item. If they go Pro on the paywall, the item goes on.
    paywallFor?.let { o ->
        ProPaywallDialog(
            onDismiss = { paywallFor = null },
            onPro = {
                paywallFor = null
                if (!MascotBuilderLogic.tierLocked(o, level)) onChange(MascotBuilderLogic.apply(config, o))
            },
        )
    }
}

/**
 * The big live preview: the mascot (~160 dp) on a tinted stage in its own color,
 * hopping on every change (a quick lift, then a bouncy spring landing with a little
 * squash) with the `hop` sound. Reduce Motion / calm motion: no hop.
 */
@Composable
private fun MascotStage(config: AvatarConfig, initial: String, isPro: Boolean) {
    val accent = swatchColor(config.color)
    val shape = RoundedCornerShape(24.dp)
    val lift = remember { Animatable(0f) }
    val calm = WTheme.calmMotion
    val dark = WTheme.isDark
    var first by remember { mutableStateOf(true) }
    LaunchedEffect(config) {
        if (first) { first = false; return@LaunchedEffect }
        SoundManager.playHop()
        if (calm) { lift.snapTo(0f); return@LaunchedEffect }
        lift.animateTo(1f, tween(150, easing = FastOutSlowInEasing))
        lift.animateTo(0f, spring(dampingRatio = 0.38f, stiffness = 520f))
    }
    Box(
        Modifier.fillMaxWidth().height(210.dp)
            .shadow(6.dp, shape, clip = false, ambientColor = FinishInk.cardShadow, spotColor = FinishInk.cardShadow)
            .clip(shape)
            .background(Brush.verticalGradient(listOf(accentWash(accent, 0.08f), accentWash(accent, 0.24f))))
            .border(1.5.dp, accentLine(accent), shape)
            .clearAndSetSemantics { },
        contentAlignment = Alignment.Center,
    ) {
        // A soft floor shadow that shrinks as the mascot leaves the ground.
        Canvas(Modifier.align(Alignment.BottomCenter).padding(bottom = 14.dp).size(120.dp, 16.dp)) {
            val k = 1f - 0.35f * lift.value.coerceIn(0f, 1f)
            val w = size.width * k
            drawOval(
                accent.copy(alpha = if (dark) 0.35f else 0.22f),
                topLeft = Offset((size.width - w) / 2f, 0f), size = Size(w, size.height),
            )
        }
        MascotAvatar(
            config = config, initial = initial, size = 160.dp, pro = isPro,
            modifier = Modifier.padding(bottom = 6.dp).graphicsLayer {
                val v = lift.value
                translationY = -30.dp.toPx() * v.coerceAtLeast(0f)
                // Up = a little stretch; the spring's overshoot below 0 = the landing squash.
                scaleY = 1f + 0.07f * v
                scaleX = 1f - 0.05f * v
                transformOrigin = TransformOrigin(0.5f, 1f)
            },
        )
    }
}

/** A category tab as a candy chip: the selected one is the glossy purple candy with the gold edge; the rest tinted pills. Squishes. */
@Composable
private fun BuilderChip(text: String, selected: Boolean, onClick: () -> Unit) {
    val shape = RoundedCornerShape(50)
    val base = Modifier
        .squishClickable(label = "$text tab" + if (selected) ", selected" else "", role = Role.Tab, onClick = onClick)
        .heightIn(min = 36.dp)
    val look = if (selected) {
        Modifier
            .shadow(4.dp, shape, clip = false, ambientColor = CandyColor.PURPLE.lip.copy(alpha = 0.3f), spotColor = CandyColor.PURPLE.lip.copy(alpha = 0.45f))
            .clip(shape)
            .background(Brush.verticalGradient(listOf(CandyColor.PURPLE.top, CandyColor.PURPLE.bottom)))
            .drawWithContent {
                val h = size.height
                drawRoundRect(
                    Brush.verticalGradient(listOf(Color.White.copy(alpha = 0.45f), Color.White.copy(alpha = 0f)), endY = h * 0.5f),
                    topLeft = Offset(h * 0.25f, h * 0.08f), size = Size(size.width - h * 0.5f, h * 0.42f),
                    cornerRadius = CornerRadius(h * 0.2f),
                )
                drawContent()
            }
            .border(1.dp, CHIP_GOLD, shape)
    } else {
        Modifier.clip(shape).background(accentWash(BUILDER_PURPLE, 0.12f)).border(1.5.dp, accentLine(BUILDER_PURPLE), shape)
    }
    Box(base.then(look).padding(horizontal = 14.dp, vertical = 7.dp), contentAlignment = Alignment.Center) {
        if (selected) CandyLabel(text, 13.sp)
        else Text(
            text, fontSize = 13.sp, fontWeight = FontWeight.Black, maxLines = 1,
            color = if (WTheme.isDark) WTheme.text else FinishInk.label,
        )
    }
}

/**
 * One option tile: a mini game card (A1) that squishes (A9), the mascot wearing
 * the option, its name; the selected tile is ringed. A Pro item shows the PRO pill
 * for free players; a locked tier frame is dimmed with a lock and "Lv N".
 */
@Composable
private fun OptionTile(
    tab: BuilderTab,
    o: BuilderOption,
    config: AvatarConfig,
    initial: String,
    isPro: Boolean,
    level: Int,
    accent: Color,
    modifier: Modifier,
    onTap: () -> Unit,
) {
    val preview = remember(config, o) { MascotBuilderLogic.apply(config, o) }
    val selected = MascotBuilderLogic.isSelected(config, o)
    val proLock = MascotBuilderLogic.proLocked(o, isPro)
    val tierLock = MascotBuilderLogic.tierLocked(o, level)
    val name = optionName(o)
    val label = MascotBuilderLogic.a11yLabel(tab, o, name, selected, isPro, level)
    val tileAccent = when (o.slot) {
        "color", "preset" -> swatchColor(preview.color)
        "bg" -> avatarBackdrop(o.id)?.colors?.firstOrNull()?.let { avatarColor(it) } ?: accent
        else -> accent
    }
    Box(modifier) {
        Column(
            Modifier.fillMaxWidth()
                .squishClickable(label = label, role = Role.RadioButton, enabled = !tierLock, onClick = onTap)
                .miniGameCard(tileAccent, 14.dp, selected = selected)
                .alpha(if (tierLock) 0.5f else 1f)
                .padding(top = 9.dp, bottom = 6.dp, start = 2.dp, end = 2.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(3.dp),
        ) {
            Box(Modifier.size(54.dp), contentAlignment = Alignment.Center) {
                MascotAvatar(config = preview, initial = initial, size = 54.dp, pro = false)
                if (tierLock) Icon3D(Icon3DName.LOCK, 18.dp, Modifier.align(Alignment.BottomEnd))
            }
            val tier = MascotBuilderLogic.frameTier(o)
            Text(
                if (tierLock && tier != null) "Lv ${tier.minLevel}" else name,
                fontSize = 10.sp, fontWeight = FontWeight.Black, maxLines = 1, overflow = TextOverflow.Ellipsis,
                textAlign = TextAlign.Center,
                color = if (WTheme.isDark) WTheme.text else FinishInk.heading,
                modifier = Modifier.clearAndSetSemantics { },
            )
        }
        // AA4: the gold PRO pill only for free players (decorative; the tile's label says "Pro only").
        if (proLock) ProPill(Modifier.align(Alignment.TopEnd).offset(x = 2.dp, y = (-4).dp))
    }
}

/** The tile's display name: the parts catalog (AvatarParts) label when it has one, else the builder's own. */
private fun optionName(o: BuilderOption): String {
    val id = o.id.takeIf { it != MascotBuilderLogic.NONE || o.slot == "nose" } ?: return MascotBuilderLogic.fallbackName(o)
    val category = when (o.slot) {
        "body" -> AvatarCategory.BODY
        "color" -> AvatarCategory.COLOR
        "pattern" -> AvatarCategory.PATTERN
        "eyes" -> AvatarCategory.EYES
        "nose" -> AvatarCategory.NOSE
        "mouth" -> AvatarCategory.MOUTH
        "head" -> AvatarCategory.HATS
        "face", "neck" -> AvatarCategory.EXTRAS
        "bg" -> AvatarCategory.BACKDROP
        "frame" -> AvatarCategory.FRAME
        else -> null
    } ?: return MascotBuilderLogic.fallbackName(o)
    return runCatching { AvatarParts.label(category, id) }.getOrNull()?.takeIf { it.isNotBlank() && it != id }
        ?: MascotBuilderLogic.fallbackName(o)
}

/** Under the Pattern grid: the pattern's second color (Auto = the body color, its default). */
@Composable
private fun PatternColorRow(config: AvatarConfig, onChange: (AvatarConfig) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        FinishLabel("PATTERN COLOR", Modifier.semantics { heading() })
        Row(
            Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(vertical = 4.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            val autoSel = config.patternColor == config.color
            Box(
                Modifier
                    .squishClickable(label = "Pattern color: Auto" + if (autoSel) ", selected" else "", role = Role.RadioButton) {
                        onChange(config.copy(patternColor = config.color, display = AvatarOptions.DISPLAY_MASCOT))
                    }
                    .miniGameCard(BUILDER_PURPLE, 10.dp, selected = autoSel)
                    .padding(horizontal = 10.dp, vertical = 8.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text("Auto", fontSize = 11.sp, fontWeight = FontWeight.Black, color = if (WTheme.isDark) WTheme.text else FinishInk.label)
            }
            AvatarOptions.COLORS.filter { it != config.color }.forEach { id ->
                val sel = config.patternColor == id
                val c = swatchColor(id)
                val name = optionName(BuilderOption("color", id))
                Box(
                    Modifier.size(38.dp)
                        .squishClickable(label = "Pattern color: $name" + if (sel) ", selected" else "", role = Role.RadioButton) {
                            onChange(config.copy(patternColor = id, display = AvatarOptions.DISPLAY_MASCOT))
                        }
                        .miniGameCard(c, 10.dp, selected = sel),
                    contentAlignment = Alignment.Center,
                ) {
                    Box(Modifier.padding(top = 3.dp).size(20.dp).clip(CircleShape).background(c))
                }
            }
        }
    }
}

/** Randomize: the pink dice candy button; a tap rolls a new look and the button does a playful wiggle. */
@Composable
private fun RandomizeButton(onRoll: () -> Unit) {
    val scope = rememberCoroutineScope()
    val wiggle = remember { Animatable(0f) }
    val calm = WTheme.calmMotion
    CandyButton(
        "Randomize",
        onClick = {
            onRoll()
            if (!calm) scope.launch {
                wiggle.snapTo(0f)
                wiggle.animateTo(0f, keyframes {
                    durationMillis = 480
                    -12f at 70
                    11f at 160
                    -8f at 250
                    5f at 340
                    -2f at 420
                })
            }
        },
        color = CandyColor.PINK, size = CandySize.MEDIUM,
        leading = { DiceGlyph(18.dp, wiggle.value) },
        contentDescription = "Randomize mascot",
        modifier = Modifier.graphicsLayer { rotationZ = wiggle.value * 0.35f },
    )
}

/** A white candy die (five pips, dark-purple outline) — tilts with the wiggle. Decorative. */
@Composable
private fun DiceGlyph(size: Dp, tilt: Float) {
    Canvas(Modifier.size(size).graphicsLayer { rotationZ = tilt * 1.6f }.clearAndSetSemantics { }) {
        val s = this.size.minDimension
        val stroke = s * 0.09f
        val r = CornerRadius(s * 0.24f)
        drawRoundRect(CANDY_OUTLINE, topLeft = Offset.Zero, size = Size(s, s), cornerRadius = r)
        drawRoundRect(
            Color.White, topLeft = Offset(stroke, stroke), size = Size(s - stroke * 2, s - stroke * 2),
            cornerRadius = CornerRadius(s * 0.18f),
        )
        val pip = s * 0.085f
        val a = s * 0.3f; val b = s * 0.5f; val c = s * 0.7f
        listOf(Offset(a, a), Offset(c, a), Offset(b, b), Offset(a, c), Offset(c, c)).forEach {
            drawCircle(CANDY_OUTLINE, radius = pip, center = it)
        }
        drawRoundRect(CANDY_OUTLINE.copy(alpha = 0.25f), topLeft = Offset.Zero, size = Size(s, s), cornerRadius = r, style = Stroke(stroke * 0.4f))
    }
}

/**
 * What the avatar shows when the player also has a photo: their mascot or their
 * photo (avatar_config.display; the photo is never deleted — the toggle only picks
 * which one shows). A tinted two-option toggle that squishes.
 */
@Composable
fun MascotWearToggle(wearPhoto: Boolean, onChange: (Boolean) -> Unit, modifier: Modifier = Modifier) {
    Row(modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        listOf(false to "My mascot", true to "My photo").forEach { (photo, text) ->
            val sel = photo == wearPhoto
            Box(
                Modifier.weight(1f)
                    .squishClickable(label = "Show $text" + if (sel) ", selected" else "", role = Role.RadioButton) { onChange(photo) }
                    .miniGameCard(BUILDER_PURPLE, 12.dp, selected = sel)
                    .heightIn(min = 40.dp)
                    .padding(top = 6.dp, start = 8.dp, end = 8.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text, fontSize = 13.sp, fontWeight = FontWeight.Black, maxLines = 1,
                    color = if (WTheme.isDark) WTheme.text else if (sel) FinishInk.heading else FinishInk.label,
                )
            }
        }
    }
}

/** AO: report a control's layout to the onboarding coach (no-op without a hook). */
private fun Modifier.builderAnchor(key: String, anchor: ((String, androidx.compose.ui.layout.LayoutCoordinates) -> Unit)?): Modifier =
    if (anchor == null) this else this.onGloballyPositioned { anchor(key, it) }
