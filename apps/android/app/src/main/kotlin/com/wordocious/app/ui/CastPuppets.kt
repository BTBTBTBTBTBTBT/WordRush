package com.wordocious.app.ui

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.RectF
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.nativeCanvas
import com.wordocious.core.CastRig
import com.wordocious.core.CastRigBundle
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlin.math.roundToInt

/**
 * 2.7.1 cast puppets: the rig bundle (res/raw/cast_rigs.json) and its layers
 * (drawable-nodpi/rig_<id>_<layer>, kept by raw/keep_rigs.xml), written by
 * docs/design/brand/animation/rig-engine/ship-rigs.py — the same data web and iOS read
 * (core CastRig, CastRigTest). [load] decodes everything off the main thread once; it
 * returns null (→ the header keeps the static hero images) if anything is missing.
 */
object CastPuppets {
    @Volatile private var bundle: CastRigBundle? = null
    @Volatile private var failed = false
    private val sources = HashMap<String, Bitmap>()
    /** Layers pre-scaled to the size they are drawn at (key: id/layer/scale). */
    private val scaled = HashMap<String, Bitmap>()
    private val paint = Paint(Paint.FILTER_BITMAP_FLAG or Paint.ANTI_ALIAS_FLAG)
    private val matrix = Matrix()
    private val rect = RectF()

    fun loaded(): CastRigBundle? = bundle

    suspend fun load(context: Context): CastRigBundle? {
        bundle?.let { return it }
        if (failed) return null
        // QA / perf A-B: the pref `debug-no-puppets` = true keeps the static hero images.
        if (runCatching { com.wordocious.app.data.SettingsPref.get("debug-no-puppets", false) }.getOrDefault(false)) return null
        return withContext(Dispatchers.Default) {
            runCatching {
                val res = context.applicationContext.resources
                val pkg = context.applicationContext.packageName
                val b = CastRigBundle.parse(res.openRawResource(com.wordocious.app.R.raw.cast_rigs).bufferedReader().use { it.readText() })
                val opts = BitmapFactory.Options().apply { inScaled = false }
                val map = HashMap<String, Bitmap>()
                for (id in b.cast) for (layer in b.rigs.getValue(id).lay.keys) {
                    val name = "rig_${id}_$layer".replace('-', '_')
                    @Suppress("DiscouragedApi")
                    val rid = res.getIdentifier(name, "drawable", pkg)
                    require(rid != 0) { "missing $name" }
                    map["$id/$layer"] = BitmapFactory.decodeResource(res, rid, opts) ?: error("decode $name")
                }
                synchronized(sources) { sources.putAll(map) }
                bundle = b
                b
            }.getOrElse { failed = true; null }
        }
    }

    private fun image(id: String, layer: String, w: Int, h: Int): Bitmap? {
        val key = "$id/$layer/$w/$h"
        scaled[key]?.let { return it }
        var src = synchronized(sources) { sources["$id/$layer"] } ?: return null
        // halve until within 2× of the target, then one filtered scale (no shimmer from a big jump)
        while (src.width / 2 >= w * 2 && src.height / 2 >= h * 2) src = Bitmap.createScaledBitmap(src, src.width / 2, src.height / 2, true)
        val out = Bitmap.createScaledBitmap(src, w.coerceAtLeast(1), h.coerceAtLeast(1), true)
        out.prepareToDraw()
        scaled[key] = out
        return out
    }

    /**
     * Draw [rig] at [t] / [gr] / [tap] into a figure box of this DrawScope's size, which shows
     * the `mascot_<id>` 512-px art cut to [crop] (CastCrops). Nothing is clipped: the hop and
     * raised arms reach outside the box.
     */
    fun DrawScope.drawPuppet(b: CastRigBundle, rig: CastRig, crop: CastCrops.Crop, t: Double, gr: Double?, tap: Double?, still: Boolean) {
        val u = size.height / crop.height                 // px per mascot px
        val M = rig.mascot
        val a = (M.s * u).toFloat()
        val ex = ((M.ox - crop.left) * u).toFloat()
        val ey = ((M.oy - crop.top) * u).toFloat()
        val ops = rig.evaluate(b, t, gr, tap, still)
        drawIntoCanvas { c ->
            val nc = c.nativeCanvas
            for (op in ops) {
                val box = rig.lay[op.layer] ?: continue
                val bmp = image(rig.id, op.layer, (box.w * a).roundToInt(), (box.h * a).roundToInt()) ?: continue
                val m = op.m
                matrix.setValues(floatArrayOf(
                    a * m[0].toFloat(), a * m[2].toFloat(), a * m[4].toFloat() + ex,
                    a * m[1].toFloat(), a * m[3].toFloat(), a * m[5].toFloat() + ey,
                    0f, 0f, 1f,
                ))
                paint.alpha = (op.alpha * 255).roundToInt().coerceIn(0, 255)
                rect.set(0f, 0f, box.w.toFloat(), box.h.toFloat())
                nc.save()
                nc.concat(matrix)
                nc.drawBitmap(bmp, null, rect, paint)
                nc.restore()
            }
        }
    }
}
