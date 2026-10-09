package com.wordocious.app.data

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import com.wordocious.app.R
import com.wordocious.core.MomentShare

/**
 * Item 46: the moment shares (a level-up, a pocket-game result, the streak calendar), drawn through the one
 * [ShareCard] renderer so they wear the same wallpaper, lettered headline, hero band (the sender's mascot, posed by the
 * result), cast wordmark and site line as every other share. The copy is core [MomentShare] (pinned by
 * moment-share-fixtures.json, the same cards as the web builders).
 */
object MomentCard {
    private const val BODY_W = 900f
    private const val BIG_MAX = 260f
    private const val LINE_PX = 44f
    private const val LINE_STEP = 62f
    private const val DOT = 40f
    private const val DOT_GAP = 16f

    private fun accentOf(hex: String): Int = runCatching { Color.parseColor(hex) }.getOrDefault(0xFF7C3AED.toInt())

    /** The body's pure geometry: where each row's center sits for a [bigPx] hero number. */
    internal data class Geo(val bigCy: Float, val labelCy: Float, val firstLineCy: Float, val dotsCy: Float, val height: Float)

    internal fun geometry(bigPx: Float, lineCount: Int, hasDots: Boolean): Geo {
        val labelCy = bigPx * 1.1f + 24f
        val firstLineCy = bigPx * 1.1f + 84f
        val lines = lineCount.coerceIn(0, 3)
        val lastLineCy = if (lines == 0) firstLineCy - LINE_STEP else firstLineCy + (lines - 1) * LINE_STEP
        val dotsCy = lastLineCy + LINE_STEP
        val bottom = if (hasDots) dotsCy + DOT / 2f else lastLineCy + LINE_PX / 2f
        return Geo(bigPx * 0.55f, labelCy, firstLineCy, dotsCy, bottom + 20f)
    }

    fun render(context: Context, m: MomentShare.Moment): Bitmap {
        val fonts = ShareFinish.Fonts(context)
        val accent = accentOf(m.accentHex)
        val big = ShareFinish.softPaint(fonts, BIG_MAX, color = accent)
        ShareFinish.fitText(big, m.big, BODY_W - 40f)
        val g = geometry(big.textSize, m.lines.size, m.dots.isNotEmpty())
        val body = ShareCard.Body(BODY_W, g.height) { c ->
            fun centered(text: String, cy: Float, p: Paint) = c.drawText(text, BODY_W / 2f, cy - (p.ascent() + p.descent()) / 2f, p)
            centered(m.big, g.bigCy, big)
            val label = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                typeface = fonts.black; textSize = 34f; color = accent; textAlign = Paint.Align.CENTER; letterSpacing = 0.08f
            }
            ShareFinish.fitText(label, m.bigLabel.uppercase(), BODY_W - 40f)
            centered(m.bigLabel.uppercase(), g.labelCy, label)
            m.lines.take(3).forEachIndexed { i, line ->
                val p = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                    typeface = fonts.black; textSize = LINE_PX; color = 0xFF4C1D95.toInt(); textAlign = Paint.Align.CENTER
                }
                ShareFinish.fitText(p, line, BODY_W - 40f)
                centered(line, g.firstLineCy + i * LINE_STEP, p)
            }
            if (m.dots.isNotEmpty()) {
                val n = m.dots.size.coerceAtMost(14)
                val rowW = n * DOT + (n - 1) * DOT_GAP
                var x = BODY_W / 2f - rowW / 2f + DOT / 2f
                val on = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = accent }
                val off = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.argb(41, 124, 58, 237) }
                for (played in m.dots.takeLast(n)) {
                    c.drawCircle(x, g.dotsCy, DOT / 2f, if (played) on else off)
                    x += DOT + DOT_GAP
                }
            }
        }
        return ShareCard.render(context, ShareCard.Spec(
            wallpaper = R.drawable.art_wall_home,
            title = null,
            titleFallback = m.title,
            info = ShareFinish.dayCaps(null),
            body = body,
            hero = m.heroResult,
        ))
    }

    /** The image-only share (no hosted link), like the stats card. */
    fun share(context: Context, m: MomentShare.Moment) {
        val bitmap = render(context, m)
        val fallback = when (m.kind) {
            MomentShare.Kind.LEVEL_UP -> "I just hit level ${m.big} on Wordocious.\nwordocious.com"
            MomentShare.Kind.POCKET -> "${m.title.lowercase().replaceFirstChar { it.uppercase() }}: ${m.lines.firstOrNull().orEmpty()}.\nwordocious.com"
            MomentShare.Kind.STREAK -> "${m.big}-day streak on Wordocious.\nwordocious.com"
        }
        val name = when (m.kind) { MomentShare.Kind.LEVEL_UP -> "Level up"; MomentShare.Kind.POCKET -> "Game result"; MomentShare.Kind.STREAK -> "Streak" }
        val sent = ShareHelper.shareImage(context, bitmap, name, fallbackText = fallback, chooserTitle = "Share your ${name.lowercase()}")
        ShareEvents.log(if (sent) "image" else "text", "", "moment-${m.kind.id}")
    }
}
