package com.wordocious.app.ui

import android.graphics.Bitmap
import android.os.Handler
import android.os.Looper
import android.util.LruCache
import android.widget.Toast
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Call
import androidx.compose.material.icons.filled.ChatBubble
import androidx.compose.material.icons.filled.Download
import androidx.compose.material.icons.filled.Link
import androidx.compose.material.icons.filled.MoreHoriz
import androidx.compose.material.icons.filled.ThumbUp
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.data.FlagsService
import com.wordocious.app.data.ShareChannels
import com.wordocious.app.data.ShareEvents
import com.wordocious.app.data.ShareHelper
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.core.ShareCardKind
import com.wordocious.core.ShareChannelId
import com.wordocious.core.SharePlatform
import com.wordocious.core.ShareSheetChannel
import com.wordocious.core.ShareSheetContext
import com.wordocious.core.ShareVariant
import com.wordocious.core.shareSheetModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.util.UUID
import kotlin.math.abs

/**
 * The custom share sheet (founder direction A, docs/design/review/share-sheet-1016/option-a.png + SPEC.md).
 *
 * grabber -> a pager of the REAL share-card bitmaps (center large, next one peeking) -> a slim
 * "No spoilers | Full results" toggle (when the model shows it) -> look swatches (only in a season)
 * -> the CHANNELS row in model order. Cards render off the main thread and are cached per
 * (page, variant, look); a toggle or swatch re-renders. Gated by the `share_sheet_v2` flag
 * ([ShareSheetFlag]); with the flag off the old chooser + system sheet stay as they were.
 */
object ShareSheetFlag {
    const val KEY = "share_sheet_v2"

    /** On for testers / admins while the row's audience is "testers", for everyone once "all"; no row = off. */
    fun on(): Boolean = FlagsService.isOn(KEY)
}

/**
 * What a surface hands the sheet. [pageKinds] lists the carousel pages in model order (one card kind per page);
 * [render] draws page [index] for a variant and a look ("normal" or a season id) and is called OFF the main thread.
 */
class ShareSheetSpec(
    val ctx: ShareSheetContext,
    val pageKinds: List<ShareCardKind>,
    val gameName: String,
    val gameMode: String,
    val render: (index: Int, variant: ShareVariant, look: String) -> Bitmap?,
    val fallbackText: String? = null,
    val id: String = UUID.randomUUID().toString(),
)

/** One cache for every open sheet: bitmaps keyed by sheet + page + variant + look, bounded by bytes. */
private object ShareSheetCache {
    private val cache = object : LruCache<String, Bitmap>(72 * 1024 * 1024) {
        override fun sizeOf(key: String, value: Bitmap): Int = value.byteCount
    }
    fun key(spec: ShareSheetSpec, index: Int, variant: ShareVariant, look: String) = "${spec.id}|$index|${variant.id}|$look"
    fun get(key: String): Bitmap? = cache.get(key)
    fun put(key: String, bmp: Bitmap) { cache.put(key, bmp) }
    fun clear(specId: String) {
        cache.snapshot().keys.filter { it.startsWith("$specId|") }.forEach { cache.remove(it) }
    }
}

/** Opens the sheet from anywhere (the old system-sheet funnel in [ShareHelper]); the host is composed once in MainScreen. */
object ShareSheetHost {
    var pending by mutableStateOf<ShareSheetSpec?>(null)
        private set
    @Volatile var mounted = false

    fun show(spec: ShareSheetSpec) {
        Handler(Looper.getMainLooper()).post { pending = spec }
    }
    fun dismiss() { pending = null }
}

@Composable
fun ShareSheetHostUi() {
    DisposableEffect(Unit) { ShareSheetHost.mounted = true; onDispose { ShareSheetHost.mounted = false } }
    ShareSheetHost.pending?.let { spec -> ShareSheetV2(spec, onDismiss = { ShareSheetHost.dismiss() }) }
}

// Time of day (founder 10-16): in a dark season the sheet is that look's window (card -> raised), so it tints with the sky like every
// other window; out of season it keeps its own night gradient.
private val SheetBg: Color get() = WTheme.season?.takeIf { it.dark }?.card ?: Color(0xFF1B1038)
private val SheetTop: Color get() = WTheme.season?.takeIf { it.dark && it.card != null }?.let { it.raised ?: it.card } ?: Color(0xFF2A1659)
private val InkWhite: Color get() = WTheme.season?.takeIf { it.dark }?.text ?: Color(0xFFF5F0FF)
private val InkMuted: Color get() = WTheme.season?.takeIf { it.dark }?.textMuted ?: Color(0xFFB4A5E0)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ShareSheetV2(spec: ShareSheetSpec, onDismiss: () -> Unit) {
    val context = LocalContext.current
    val hostView = LocalView.current
    val scope = rememberCoroutineScope()
    val model = remember(spec) { shareSheetModel(spec.ctx, SharePlatform.ANDROID) }
    // The core model's share line for the card: the X channel's text (caption + link), else any channel's caption.
    val cardText = remember(model) { model.channels.firstNotNullOfOrNull { it.caption ?: it.text } }
    val channels = remember(model) { model.channels.filter { ShareChannels.isAvailable(context, it.id) } }
    val pages = spec.pageKinds.size.coerceAtLeast(1)
    val pager = rememberPagerState { pages }
    var variant by remember { mutableStateOf(ShareVariant.from(model.variant.initial) ?: ShareVariant.CLEAN) }
    var look by remember { mutableStateOf(model.looks.initial) }
    // What each page draws right now; a re-render keeps the old picture (dimmed) until the new one lands.
    val shown = remember { mutableStateMapOf<Int, Bitmap>() }
    var rendering by remember { mutableStateOf(true) }
    var failed by remember { mutableStateOf(false) }
    var closing by remember { mutableStateOf(false) }
    var busy by remember { mutableStateOf(false) }

    suspend fun bitmapFor(index: Int): Bitmap? {
        val key = ShareSheetCache.key(spec, index, variant, look)
        ShareSheetCache.get(key)?.let { return it }
        val v = variant; val l = look
        val bmp = withContext(Dispatchers.Default) { runCatching { spec.render(index, v, l) }.getOrNull() }
        if (bmp != null) ShareSheetCache.put(key, bmp)
        return bmp
    }

    LaunchedEffect(variant, look) {
        rendering = true
        val order = (0 until pages).sortedBy { abs(it - pager.currentPage) }
        for (i in order) {
            val bmp = bitmapFor(i)
            if (bmp != null) { shown[i] = bmp; failed = false } else if (shown[i] == null) failed = true
        }
        rendering = false
    }
    DisposableEffect(spec.id) { onDispose { ShareSheetCache.clear(spec.id) } }

    fun onChannel(ch: ShareSheetChannel) {
        if (busy) return
        busy = true
        scope.launch {
            val page = pager.currentPage
            var ok = false
            if (ch.id == ShareChannelId.COPY) {
                ok = ch.link?.let { ShareChannels.copyLink(context, it) } == true
            } else {
                val bmp = bitmapFor(page)
                if (bmp == null) {
                    Toast.makeText(context, "That card isn't ready yet", Toast.LENGTH_SHORT).show()
                } else if (ch.id == ShareChannelId.SAVE) {
                    ok = withContext(Dispatchers.IO) { ShareChannels.saveImage(context, bmp, ShareHelper.fileName(spec.gameName)) }
                    if (!ok) Toast.makeText(context, "Couldn't save the image", Toast.LENGTH_SHORT).show()
                } else {
                    val uri = withContext(Dispatchers.IO) { ShareHelper.writePng(context, bmp, ShareHelper.fileName(spec.gameName)) }
                    ok = when {
                        uri == null -> false
                        ch.id == ShareChannelId.MORE -> ShareChannels.more(context, uri, ShareHelper.chooserTitle(spec.gameName))
                        else -> ShareChannels.sendToApp(context, ch, uri)
                    }
                    if (!ok && uri == null) spec.fallbackText?.let { ShareHelper.share(context, it, ShareHelper.chooserTitle(spec.gameName)) }
                }
            }
            if (ok) {
                when (ch.id) {
                    ShareChannelId.COPY -> hostView.announceForAccessibility("Link copied")
                    ShareChannelId.SAVE -> hostView.announceForAccessibility("Saved to Photos")
                    else -> {}
                }
                ShareEvents.log(
                    kind = if (ch.id == ShareChannelId.COPY || ch.id == ShareChannelId.SAVE) "other" else "image",
                    gameMode = spec.gameMode, surface = "sheet_${ch.id.id}",
                )
                closing = true
            }
            busy = false
        }
    }

    val screenH = LocalConfiguration.current.screenHeightDp
    val pagerH = (screenH * 0.42f).coerceIn(220f, 340f).dp

    SoftModalSheet(onDismissRequest = onDismiss, containerColor = SheetBg, dragHandle = null, closeRequest = closing) {
        Column(
            Modifier.fillMaxWidth().background(Brush.verticalGradient(listOf(SheetTop, SheetBg))).padding(bottom = 16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            // The grabber.
            Box(Modifier.padding(top = 10.dp, bottom = 10.dp).width(44.dp).height(5.dp).clip(CircleShape).background(Color(0xFF8B6CD9)))

            // The cards: the center one large, the next peeking.
            HorizontalPager(
                pager, Modifier.fillMaxWidth().height(pagerH),
                contentPadding = PaddingValues(horizontal = if (pages > 1) 64.dp else 0.dp), pageSpacing = 12.dp,
            ) { p ->
                val away = abs((pager.currentPage - p) + pager.currentPageOffsetFraction).coerceIn(0f, 1f)
                Box(
                    Modifier.fillMaxSize().graphicsLayer { val s = 1f - 0.1f * away; scaleX = s; scaleY = s; alpha = 1f - 0.25f * away }
                        .semantics(mergeDescendants = true) {
                            contentDescription = cardDescription(model.cards.getOrNull(p)?.title ?: "Result", cardText, variant, model.variant.shown, model.variant.copy)
                            stateDescription = "${p + 1} of $pages"
                        },
                    contentAlignment = Alignment.Center,
                ) {
                    val bmp = shown[p]
                    if (bmp != null) {
                        Image(
                            bmp.asImageBitmap(), "Share card ${p + 1} of $pages", contentScale = ContentScale.Fit,
                            modifier = Modifier.fillMaxSize().clip(RoundedCornerShape(18.dp)).graphicsLayer { alpha = if (rendering) 0.55f else 1f },
                        )
                    } else CardSkeleton(failed, pagerH)
                }
            }
            if (pages > 1) {
                Row(Modifier.padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    repeat(pages) { i ->
                        val on = i == pager.currentPage
                        Box(Modifier.size(if (on) 7.dp else 5.dp).clip(CircleShape).background(if (on) Color(0xFFFBBF24) else Color(0xFF5B4A8F)))
                    }
                }
            }

            // No spoilers | Full results.
            if (model.variant.shown) {
                Spacer(10)
                CandySegmentedToggle(
                    options = listOf(ShareVariant.CLEAN to model.variant.copy.clean.title, ShareVariant.FULL to model.variant.copy.full.title),
                    selected = variant, onChange = { variant = it }, height = 42.dp, width = 280.dp, fontSize = 15.sp,
                )
                val sub = if (variant == ShareVariant.CLEAN) model.variant.copy.clean.subtitle else model.variant.copy.full.subtitle
                Text(sub, color = InkMuted, fontSize = 11.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 4.dp))
            }

            // Looks: only in a season.
            if (model.looks.shown) {
                Spacer(10)
                Row(horizontalArrangement = Arrangement.spacedBy(22.dp)) {
                    model.looks.options.forEach { opt -> LookSwatch(opt.id, opt.label, opt.id == look) { look = opt.id } }
                }
            }

            // Channels.
            Text(
                "CHANNELS", color = InkMuted, fontSize = 11.sp, fontWeight = FontWeight.Black, letterSpacing = 1.2.sp,
                modifier = Modifier.fillMaxWidth().padding(start = 20.dp, top = 14.dp, bottom = 6.dp),
            )
            LazyRow(
                contentPadding = PaddingValues(horizontal = 14.dp), horizontalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                items(channels, key = { it.id.id }) { ch -> ChannelTile(ch) { onChannel(ch) } }
            }
        }
    }
}

private fun cardDescription(
    title: String, text: String?, variant: ShareVariant, hasVariant: Boolean, copy: com.wordocious.core.ShareVariantCopy,
): String = buildString {
    append(title).append(" card")
    if (hasVariant) append(", ").append(if (variant == ShareVariant.CLEAN) copy.clean.title else copy.full.title)
    if (!text.isNullOrBlank()) append(". ").append(text)
}

@Composable
private fun Spacer(h: Int) = androidx.compose.foundation.layout.Spacer(Modifier.height(h.dp))

/** The card placeholder: a soft pulsing slab (not a bare spinner); a failed draw says so. */
@Composable
private fun CardSkeleton(failed: Boolean, h: androidx.compose.ui.unit.Dp) {
    val pulse = if (WTheme.reducedMotion) 0.6f else {
        val t = rememberInfiniteTransition(label = "cardPulse")
        val a by t.animateFloat(0.4f, 0.8f, infiniteRepeatable(tween(900), RepeatMode.Reverse), label = "a")
        a
    }
    Box(
        Modifier.height(h).fillMaxWidth(0.62f).clip(RoundedCornerShape(18.dp))
            .background(Brush.verticalGradient(listOf(Color(0xFF3A2380).copy(alpha = pulse), Color(0xFF241250).copy(alpha = pulse)))),
        contentAlignment = Alignment.Center,
    ) {
        if (failed) Text("Couldn't draw this card", color = InkMuted, fontSize = 12.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center, modifier = Modifier.padding(16.dp))
    }
}

/** A look swatch: W in that look (the hero W for Normal, the costumed W for the season) on a disc with a soft gold glow when picked (no outline), its name under it. */
@Composable
private fun LookSwatch(id: String, label: String, selected: Boolean, onClick: () -> Unit) {
    val wRes = remember(id) { SeasonSkins.fullRes(MascotId.W, if (id == "normal") null else id) }
    val disc = if (id == "normal") listOf(Color(0xFF6B5BD6), Color(0xFF2E1F73)) else listOf(Color(0xFFFF9F43), Color(0xFFB04A0C))
    Column(
        Modifier.squishClickable(label, onClick = onClick),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(
            Modifier.size(56.dp)
                .drawBehind {
                    if (selected) drawCircle(
                        Brush.radialGradient(listOf(Color(0xFFFBBF24).copy(alpha = 0.75f), Color.Transparent), center, size.minDimension * 0.78f),
                        radius = size.minDimension * 0.78f,
                    )
                }
                .clip(CircleShape).background(Brush.verticalGradient(disc)),
            contentAlignment = Alignment.Center,
        ) {
            androidx.compose.foundation.Image(
                androidx.compose.ui.res.painterResource(wRes), contentDescription = null,
                contentScale = androidx.compose.ui.layout.ContentScale.Fit, modifier = Modifier.size(46.dp),
            )
        }
        Text(label, color = if (selected) InkWhite else InkMuted, fontSize = 12.sp, fontWeight = FontWeight.ExtraBold, modifier = Modifier.padding(top = 4.dp))
    }
}

/** One channel: a glossy candy disc with a simple glyph, its label under it. */
@Composable
private fun ChannelTile(ch: ShareSheetChannel, onClick: () -> Unit) {
    val (top, bottom) = when (ch.id) {
        ShareChannelId.COPY, ShareChannelId.MORE -> Color(0xFFA66BFF) to Color(0xFF6D28D9)
        ShareChannelId.MESSAGES -> Color(0xFF4ADE80) to Color(0xFF15803D)
        ShareChannelId.WHATSAPP -> Color(0xFF34E07A) to Color(0xFF0F9D58)
        ShareChannelId.X -> Color(0xFF52525B) to Color(0xFF111114)
        ShareChannelId.FACEBOOK -> Color(0xFF5B9BFF) to Color(0xFF1D4ED8)
        ShareChannelId.SAVE -> Color(0xFFFFC56B) to Color(0xFFF97316)
        else -> Color(0xFFA66BFF) to Color(0xFF6D28D9)
    }
    Column(
        Modifier.width(72.dp).squishClickable(ch.label, onClick = onClick).padding(vertical = 2.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(
            Modifier.size(56.dp)
                .drawBehind {
                    // The lip: a darker copy a few px below, then the body.
                    drawCircle(bottom.copy(alpha = 0.9f), radius = size.minDimension / 2f, center = Offset(size.width / 2f, size.height / 2f + 3.dp.toPx()))
                }
                .clip(CircleShape).background(Brush.verticalGradient(listOf(top, bottom)))
                .drawBehind {
                    // The gloss: a soft white cap across the top half.
                    drawOval(
                        Brush.verticalGradient(listOf(Color.White.copy(alpha = 0.38f), Color.Transparent), 0f, size.height * 0.5f),
                        topLeft = Offset(size.width * 0.14f, size.height * 0.05f),
                        size = androidx.compose.ui.geometry.Size(size.width * 0.72f, size.height * 0.42f),
                    )
                },
            contentAlignment = Alignment.Center,
        ) {
            when (ch.id) {
                ShareChannelId.X -> Text("X", color = Color.White, fontSize = 24.sp, fontWeight = FontWeight.Black)
                else -> Icon(channelIcon(ch.id), null, tint = Color.White, modifier = Modifier.size(28.dp))
            }
        }
        Text(
            ch.label, color = InkWhite, fontSize = 12.sp, fontWeight = FontWeight.ExtraBold, maxLines = 1,
            modifier = Modifier.padding(top = 6.dp), textAlign = TextAlign.Center,
        )
    }
}

private fun channelIcon(id: ShareChannelId) = when (id) {
    ShareChannelId.COPY -> Icons.Filled.Link
    ShareChannelId.MESSAGES -> Icons.Filled.ChatBubble
    ShareChannelId.WHATSAPP -> Icons.Filled.Call
    ShareChannelId.FACEBOOK -> Icons.Filled.ThumbUp
    ShareChannelId.SAVE -> Icons.Filled.Download
    else -> Icons.Filled.MoreHoriz
}
