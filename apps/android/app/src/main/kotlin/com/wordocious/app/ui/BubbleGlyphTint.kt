package com.wordocious.app.ui

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Rect
import android.util.LruCache
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import com.wordocious.core.BubbleAtlasMetrics
import kotlin.math.roundToInt

// 2.8 item 6: the bubble-letter glyph tinter. The atlas drawables are TINT MAPS, not colored art
// (scripts/build-bubble-atlas.py): R = tint multiplier, G = additive white (highlights), B = rim shade.
// One rule, identical on web and iOS:  out = clamp(tint(y) * A + Wh + rimColor * Rm).
// Each tinted glyph is built once per (stem, size, tint, rim) and cached, so a headline costs a few images.

internal object BubbleGlyphTint {
    private val sources = HashMap<String, Bitmap?>()
    private val tinted = object : LruCache<String, ImageBitmap>(160) {}

    private fun source(context: Context, stem: String): Bitmap? = sources.getOrPut(stem) {
        val res = context.resources.getIdentifier("bubble_$stem", "drawable", context.packageName)
        if (res == 0) null
        else BitmapFactory.decodeResource(context.resources, res, BitmapFactory.Options().apply {
            inScaled = false
            inPreferredConfig = Bitmap.Config.ARGB_8888
        })
    }

    /**
     * The tinted glyph at [pxW] x [pxH]. [f0] / [f1] = the tint gradient position (0 at the cap line, 1 at the
     * baseline) at the glyph's top and bottom edge, so a whole word shares ONE vertical gradient.
     */
    fun glyph(context: Context, stem: String, pxW: Int, pxH: Int, f0: Float, f1: Float, top: Int, bottom: Int, rim: Int): ImageBitmap? {
        val key = "$stem|${pxW}x$pxH|${(f0 * 1000).roundToInt()}|${(f1 * 1000).roundToInt()}|$top|$bottom|$rim"
        tinted.get(key)?.let { return it }
        val src = source(context, stem) ?: return null
        val w = pxW.coerceAtLeast(1)
        val h = pxH.coerceAtLeast(1)
        val scaled = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
        Canvas(scaled).drawBitmap(src, Rect(0, 0, src.width, src.height), Rect(0, 0, w, h), Paint(Paint.FILTER_BITMAP_FLAG or Paint.ANTI_ALIAS_FLAG))
        val px = IntArray(w * h)
        scaled.getPixels(px, 0, w, 0, 0, w, h)   // non-premultiplied ARGB
        val kA = BubbleAtlasMetrics.K_A.toFloat()
        val kW = BubbleAtlasMetrics.K_W.toFloat()
        val kR = BubbleAtlasMetrics.K_R.toFloat()
        val tr0 = ((top shr 16) and 255) / 255f; val tg0 = ((top shr 8) and 255) / 255f; val tb0 = (top and 255) / 255f
        val tr1 = ((bottom shr 16) and 255) / 255f; val tg1 = ((bottom shr 8) and 255) / 255f; val tb1 = (bottom and 255) / 255f
        val rr = ((rim shr 16) and 255) / 255f; val rg = ((rim shr 8) and 255) / 255f; val rb = (rim and 255) / 255f
        for (y in 0 until h) {
            val f = (f0 + (f1 - f0) * (y + 0.5f) / h).coerceIn(0f, 1f)
            val tr = tr0 + (tr1 - tr0) * f; val tg = tg0 + (tg1 - tg0) * f; val tb = tb0 + (tb1 - tb0) * f
            for (x in 0 until w) {
                val i = y * w + x
                val c = px[i]
                val a = (c ushr 24) and 255
                if (a == 0) continue
                val A = (((c shr 16) and 255) / 255f) * kA
                val Wh = (((c shr 8) and 255) / 255f) * kW
                val R = ((c and 255) / 255f) * kR
                val r = ((tr * A + Wh + rr * R).coerceIn(0f, 1f) * 255f).roundToInt()
                val g = ((tg * A + Wh + rg * R).coerceIn(0f, 1f) * 255f).roundToInt()
                val b = ((tb * A + Wh + rb * R).coerceIn(0f, 1f) * 255f).roundToInt()
                px[i] = (a shl 24) or (r shl 16) or (g shl 8) or b
            }
        }
        scaled.setPixels(px, 0, w, 0, 0, w, h)
        val out = scaled.asImageBitmap()
        tinted.put(key, out)
        return out
    }
}
