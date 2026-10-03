package com.wordocious.app.widget

import android.app.AlarmManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.SystemClock
import android.util.SizeF
import android.view.View
import android.widget.RemoteViews
import com.wordocious.app.MainActivity
import com.wordocious.app.R
import com.wordocious.app.data.ShareFinish
import com.wordocious.app.ui.Mascots
import java.util.Calendar

/**
 * "Daily Puzzles" home-screen widget — FINISH_SPEC E2 (the finishing-touches
 * `.wsmall` / `.wmed`): the Home wallpaper, today's dailies as mini game-card tiles
 * (accent wash + border + a 4dp accent bar + the glossy game icon, a purple check on
 * finished ones), the streak (3D flame) and rank (3D trophy) in soft numbers, the
 * cast spelling WORDOCIOUS across the top of the medium. FINISH_SPEC AL: both sizes
 * ALWAYS show three labeled stat chips — puzzles solved today ("5/18 SOLVED"), today's
 * points ("3,420 POINTS", the app's own sum) and a live countdown to new puzzles at
 * local midnight — next to the streak chip; our 3D art for every chip icon, no emoji.
 * A 2x2 placement gets the small layout.
 *
 * Classic RemoteViews on purpose: the countdown is a Chronometer with
 * isCountDown — the one RemoteViews element that ticks every second without
 * waking the app (Glance has no equivalent) — and each tile carries its own
 * PendingIntent deep-linking into that mode's daily. RemoteViews can't layer a
 * tinted card, a bar, an icon and a badge, so each tile (and the cast strip and the
 * wallpaper crop) is a small bitmap, kept small for the binder parcel.
 *
 * The board resets at midnight: inexact AlarmManager broadcasts at the next of
 * 12/17/00 local re-render it. updatePeriodMillis (30 min) is the belt-and-braces
 * fallback.
 */
class DailyWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(context: Context, mgr: AppWidgetManager, ids: IntArray) {
        render(context, mgr, ids)
        scheduleNextFlip(context)
    }

    override fun onAppWidgetOptionsChanged(context: Context, mgr: AppWidgetManager, id: Int, newOptions: Bundle) {
        // Resized between the small and medium footprints (pre-31 launchers pick by size here).
        render(context, mgr, intArrayOf(id))
    }

    override fun onEnabled(context: Context) {
        scheduleNextFlip(context)
    }

    override fun onDisabled(context: Context) {
        val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        am.cancel(flipIntent(context))
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        if (intent.action == ACTION_TIMED_REFRESH) {
            val mgr = AppWidgetManager.getInstance(context)
            val ids = mgr.getAppWidgetIds(ComponentName(context, DailyWidgetProvider::class.java))
            if (ids.isNotEmpty()) render(context, mgr, ids)
            scheduleNextFlip(context)
        }
    }

    companion object {
        private const val ACTION_TIMED_REFRESH = "com.wordocious.app.widget.TIMED_REFRESH"

        private const val PURPLE = 0xFF7C3AED.toInt()

        private fun hex(s: String): Int =
            runCatching { Color.parseColor(if (s.startsWith("#")) s else "#$s") }.getOrDefault(PURPLE)

        // Explicit view-id tables (no getIdentifier: resource shrinking must see every id).
        private val MEDIUM_TILES = intArrayOf(R.id.w_t0, R.id.w_t1, R.id.w_t2, R.id.w_t3, R.id.w_t4, R.id.w_t5, R.id.w_t6, R.id.w_t7)
        /** BC: the small widget shows all 8 Wordocious dailies (two rows of four). */
        private val SMALL_TILES = MEDIUM_TILES
        /** BC addendum: the medium widget's full-width Puzzles row (10 tiles). */
        private val PUZZLE_TILES = intArrayOf(R.id.w_p0, R.id.w_p1, R.id.w_p2, R.id.w_p3, R.id.w_p4, R.id.w_p5, R.id.w_p6, R.id.w_p7, R.id.w_p8, R.id.w_p9)

        // ── Render ──────────────────────────────────────────────────────────

        fun render(context: Context, mgr: AppWidgetManager, ids: IntArray) {
            val snap = WidgetBridge.loadSnapshot(context)
            val now = Calendar.getInstance()
            for (id in ids) {
                val views = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    // The launcher picks the layout that fits the current size.
                    RemoteViews(mapOf(
                        SizeF(110f, 110f) to buildSmall(context, snap, now),
                        SizeF(240f, 110f) to buildMedium(context, snap, now),
                    ))
                } else {
                    val minW = mgr.getAppWidgetOptions(id).getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 250)
                    if (minW in 1 until 200) buildSmall(context, snap, now) else buildMedium(context, snap, now)
                }
                mgr.updateAppWidget(id, views)
            }
        }

        // ── Bitmaps (cached per process: the art never changes, only the done flags) ──

        private val tileCache = HashMap<String, Bitmap>()
        private var castCache: Bitmap? = null
        private val wallCache = HashMap<String, Bitmap>()

        /** The tile bitmap's side in px (a 40dp tile at the device density, capped for the parcel). */
        private fun tilePx(context: Context): Int = (40f * context.resources.displayMetrics.density).toInt().coerceIn(48, 96)

        /**
         * One mini game-card tile (`.wt`): the accent wash, a 1.5 border, a 4-unit accent
         * bar, the glossy game icon at 74%, and — when [done] — the purple ✓ badge over
         * its top-right corner (the bitmap keeps a margin for it).
         */
        private fun tileBitmap(context: Context, m: WidgetBridge.ModeEntry, done: Boolean): Bitmap {
            val key = "${m.key}|$done"
            tileCache[key]?.let { return it }
            val px = tilePx(context)
            val bmp = Bitmap.createBitmap(px, px, Bitmap.Config.ARGB_8888)
            val c = Canvas(bmp)
            val margin = px * 0.12f
            val tile = RectF(margin * 0.5f, margin, px - margin, px - margin * 0.5f)
            val unit = tile.width() / 33f // the mockup's tile is ~33 css px
            val modeId = com.wordocious.app.ModeGen.byDbKey(m.key)?.id
            val icon = com.wordocious.app.ui.gameArtRes(modeId)
            ShareFinish.drawMiniGameCard(context, c, tile, hex(m.colorHex), icon, unit = unit)
            if (icon == null) {
                // No art for this id: the old glyph in the accent.
                val p = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                    textAlign = Paint.Align.CENTER; color = hex(m.colorHex); textSize = tile.width() * 0.4f
                    typeface = ShareFinish.nunito(context, 900)
                }
                val t = m.iconText ?: m.glyph
                c.drawText(t, tile.centerX(), tile.centerY() + p.textSize * 0.35f, p)
            }
            if (done) {
                // `.wt.done::after`: 14 px rounded square, #7c3aed, white ✓, at (-3, -3) off the corner.
                val b = 14f * unit
                val r = RectF(px - b - 0.5f, 0.5f, px - 0.5f, b + 0.5f)
                val p = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = PURPLE; setShadowLayer(1.5f * unit, 0f, 1f * unit, 0x553C1E6E) }
                c.drawRoundRect(r, 5f * unit, 5f * unit, p)
                p.clearShadowLayer()
                p.color = Color.WHITE; p.style = Paint.Style.STROKE; p.strokeWidth = 1.9f * unit
                p.strokeCap = Paint.Cap.ROUND; p.strokeJoin = Paint.Join.ROUND
                val path = android.graphics.Path().apply {
                    moveTo(r.left + b * 0.27f, r.top + b * 0.53f)
                    lineTo(r.left + b * 0.44f, r.top + b * 0.70f)
                    lineTo(r.left + b * 0.75f, r.top + b * 0.33f)
                }
                c.drawPath(path, p)
            }
            tileCache[key] = bmp
            return bmp
        }

        /** The ten cast heroes spelling WORDOCIOUS (`.wcast`), one strip bitmap. */
        private fun castBitmap(context: Context): Bitmap? {
            castCache?.let { return it }
            val each = (30f * context.resources.displayMetrics.density).toInt().coerceIn(40, 64)
            val gap = each * 0.06f
            val cast = Mascots.cast
            val w = (cast.size * each + (cast.size - 1) * gap).toInt()
            val bmp = Bitmap.createBitmap(w, each, Bitmap.Config.ARGB_8888)
            val c = Canvas(bmp)
            val p = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG)
            var x = 0f
            for (m in cast) {
                ShareFinish.decode(context, m.res, sample = 4)?.let { src -> c.drawBitmap(src, null, RectF(x, 0f, x + each, each.toFloat()), p) }
                x += each + gap
            }
            castCache = bmp
            return bmp
        }

        /**
         * The Home wallpaper, center-cropped to the widget's [aspect] (w / h), small and opaque —
         * AV: with today's cast painted in: the day host big (~40% of the height) leaning in from
         * the top-right corner, and three cast heads peeking up over the bottom edge (Halloween
         * skins in season). One small bitmap (the wall's 1/4 scale), cached per day.
         */
        private fun wallBitmap(context: Context, aspect: Float, peek: Boolean): Bitmap? {
            val day = com.wordocious.app.todayLocalDate()
            val season = com.wordocious.app.ui.SeasonSkins.current()
            val key = "%.2f|%s|%s|%b".format(aspect, day, season ?: "", peek)
            wallCache[key]?.let { return it }
            if (wallCache.size > 4) wallCache.clear()
            val src = ShareFinish.decode(context, R.drawable.art_wall_home, sample = 4) ?: return null
            val targetW = src.width
            val targetH = (targetW / aspect).toInt().coerceAtMost(src.height)
            val out = Bitmap.createBitmap(targetW, targetH, Bitmap.Config.RGB_565)
            val top = ((src.height - targetH) * 0.35f).toInt()
            val c = Canvas(out)
            val p = Paint(Paint.FILTER_BITMAP_FLAG or Paint.ANTI_ALIAS_FLAG)
            c.drawBitmap(src, android.graphics.Rect(0, top, targetW, top + targetH), RectF(0f, 0f, targetW.toFloat(), targetH.toFloat()), p)
            runCatching { drawWidgetCast(context, c, targetW.toFloat(), targetH.toFloat(), day, season, p, peek) }
            wallCache[key] = out
            return out
        }

        /** AV the host leaning in at the top-right + the peeking trio along the bottom edge. */
        private fun drawWidgetCast(context: Context, c: Canvas, w: Float, h: Float, day: String, season: String?, p: Paint, peekers: Boolean) {
            val host = WidgetCast.host(day)
            val epochDay = runCatching { java.time.LocalDate.parse(day).toEpochDay() }.getOrDefault(0L)
            val peek = WidgetCast.peekers(com.wordocious.app.ui.Mascots.cast, host, epochDay)
            fun art(id: com.wordocious.app.ui.MascotId) = ShareFinish.decode(context, com.wordocious.app.ui.SeasonSkins.fullRes(id, season), sample = 4)
            // The peekers (small widget only): only the top half of each head shows, like over a
            // ledge, spread EVENLY across the width inside the layout's 12 dp bottom band (≈ 8%
            // of a 2x2's height), so they never sit under text.
            val headSize = h * 0.16f
            if (peekers) peek.forEachIndexed { i, id ->
                val bmp = art(id) ?: return@forEachIndexed
                val cx = w * (i + 1) / (peek.size + 1)
                c.drawBitmap(bmp, null, RectF(cx - headSize / 2f, h - headSize * 0.5f, cx + headSize / 2f, h + headSize * 0.5f), p)
            }
            // The day host, ~40% of the height, overlapping the top-right edges, leaning in.
            art(host)?.let { bmp ->
                val s = h * 0.42f
                val cx = w - s * 0.36f
                val cy = s * 0.36f
                c.save()
                c.rotate(-14f, cx, cy)
                c.drawBitmap(bmp, null, RectF(cx - s / 2f, cy - s / 2f, cx + s / 2f, cy + s / 2f), p)
                c.restore()
            }
        }

        /** The wallpaper fill (API 31+: clipped to the corners; older launchers keep the tinted card). */
        private fun applyWall(context: Context, views: RemoteViews, aspect: Float, peek: Boolean) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val wall = wallBitmap(context, aspect, peek)
                if (wall != null) {
                    views.setImageViewBitmap(R.id.w_fill, wall)
                    views.setBoolean(R.id.w_fill, "setClipToOutline", true)
                    views.setViewVisibility(R.id.w_fill, View.VISIBLE)
                    return
                }
            }
            // setClipToOutline isn't remotable before 31: the square bitmap would poke past
            // the rounded corners, so older launchers show the tinted card alone.
            views.setViewVisibility(R.id.w_fill, View.GONE)
        }

        private fun applyCountdown(views: RemoteViews, now: Calendar) {
            // The live countdown: android.widget.Chronometer counting down to
            // local midnight — ticks every second with zero refresh budget.
            val remainingMs = nextLocalMidnightMillis(now) - System.currentTimeMillis()
            views.setChronometerCountDown(R.id.w_countdown, true)
            views.setChronometer(R.id.w_countdown, SystemClock.elapsedRealtime() + remainingMs, null, true)
        }

        /**
         * FINISH_SPEC AL: the labeled stat chips both sizes always show — streak, solved
         * today, points today, and the countdown (with its clock art). Each chip reads as
         * one full phrase to TalkBack; the countdown chip's label reads "New puzzles in"
         * and the Chronometer then reads its live time.
         */
        private fun applyStats(context: Context, views: RemoteViews, snap: WidgetBridge.Snapshot, now: Calendar) {
            val day = WidgetStats.dayStats(snap, com.wordocious.app.todayLocalDate())
            views.setTextViewText(R.id.w_streak, "${snap.streak}")
            views.setContentDescription(R.id.w_streak_row, WidgetStats.streakPhrase(snap.streak))
            views.setTextViewText(R.id.w_solved, WidgetStats.solvedLabel(day))
            views.setContentDescription(R.id.w_solved_chip, WidgetStats.solvedPhrase(day))
            views.setTextViewText(R.id.w_points, WidgetStats.pointsLabelFit(day.points))
            views.setContentDescription(R.id.w_points_chip, WidgetStats.pointsPhrase(day.points))
            clockIcon(context)?.let { views.setImageViewBitmap(R.id.w_clock_icon, it) }
            applyCountdown(views, now)
        }

        private var clockCache: Bitmap? = null

        /**
         * The countdown chip's clock (AL addendum 2: our art, never an emoji). The 3D
         * `art_badge_icon_clock_sprite` is preferred the moment it ships (looked up by name
         * so this compiles before it lands); until then a code-drawn soft gold clock face.
         */
        private fun clockIcon(context: Context): Bitmap? {
            clockCache?.let { return it }
            val px = (16f * context.resources.displayMetrics.density).toInt().coerceIn(32, 64)
            @Suppress("DiscouragedApi")
            val art = context.resources.getIdentifier("art_badge_icon_clock_sprite", "drawable", context.packageName)
            val bmp = if (art != 0) {
                ShareFinish.decode(context, art, sample = 1)?.let { Bitmap.createScaledBitmap(it, px, px, true) }
            } else null
            return (bmp ?: drawClock(px)).also { clockCache = it }
        }

        /** A soft gold clock face: gold rim with a darker edge, cream dial, plum hands, a highlight. */
        private fun drawClock(px: Int): Bitmap {
            val bmp = Bitmap.createBitmap(px, px, Bitmap.Config.ARGB_8888)
            val c = Canvas(bmp)
            val cx = px / 2f; val cy = px / 2f; val r = px * 0.46f
            val p = Paint(Paint.ANTI_ALIAS_FLAG)
            p.shader = android.graphics.LinearGradient(0f, 0f, 0f, px.toFloat(), 0xFFFCD34D.toInt(), 0xFFF59E0B.toInt(), android.graphics.Shader.TileMode.CLAMP)
            c.drawCircle(cx, cy, r, p)
            p.shader = null
            p.style = Paint.Style.STROKE; p.strokeWidth = px * 0.05f; p.color = 0xFFD97706.toInt()
            c.drawCircle(cx, cy, r - p.strokeWidth / 2f, p)
            p.style = Paint.Style.FILL; p.color = 0xFFFFF8E7.toInt()
            c.drawCircle(cx, cy, r * 0.72f, p)
            p.color = 0xFF3B1A78.toInt(); p.style = Paint.Style.STROKE; p.strokeCap = Paint.Cap.ROUND
            p.strokeWidth = px * 0.085f
            c.drawLine(cx, cy, cx, cy - r * 0.48f, p)            // minute hand (12)
            c.drawLine(cx, cy, cx + r * 0.34f, cy + r * 0.12f, p) // hour hand (~4)
            p.style = Paint.Style.FILL
            c.drawCircle(cx, cy, px * 0.06f, p)
            p.color = 0x80FFFFFF.toInt()
            c.drawOval(RectF(cx - r * 0.55f, cy - r * 0.92f, cx + r * 0.1f, cy - r * 0.6f), p)
            return bmp
        }

        /** Tiles into [slots] for [modes] (window [range]); each deep-links into its daily. */
        private fun renderTiles(context: Context, views: RemoteViews, slots: IntArray, modes: List<WidgetBridge.ModeEntry>, range: IntRange, requestBase: Int = 1) {
            for ((slot, id) in slots.withIndex()) {
                val i = range.first + slot
                val m = modes.getOrNull(i)
                if (m == null || i > range.last) {
                    // INVISIBLE keeps the row's weights, so a shorter roster stays aligned.
                    views.setViewVisibility(id, View.INVISIBLE)
                    continue
                }
                views.setViewVisibility(id, View.VISIBLE)
                // The layout's padded game icon is only the widget-picker preview.
                views.setViewPadding(id, 0, 0, 0, 0)
                views.setImageViewBitmap(id, tileBitmap(context, m, m.played))
                views.setContentDescription(id, "${m.title}, ${if (!m.played) "not played yet" else if (m.won) "won" else "played"}")
                // Every tile deep-links into that mode's daily as today (spec §5):
                // a finished one opens its solved board, like the home card.
                views.setOnClickPendingIntent(id, dailyIntent(context, requestBase + i, m.key))
            }
        }

        private fun buildMedium(context: Context, snap: WidgetBridge.Snapshot, now: Calendar): RemoteViews {
            val views = RemoteViews(context.packageName, R.layout.widget_daily)
            // BC addendum: the medium has the full cast row up top, so no peeking cast.
            applyWall(context, views, 2.1f, peek = false)
            castBitmap(context)?.let { views.setImageViewBitmap(R.id.w_cast, it) }
            renderTiles(context, views, MEDIUM_TILES, snap.modes, 0 until MEDIUM_TILES.size)
            val puzzles = snap.puzzles.orEmpty()
            renderTiles(context, views, PUZZLE_TILES, puzzles, 0 until PUZZLE_TILES.size, requestBase = 20)

            val rank = snap.rank
            if (rank != null && rank > 0) {
                views.setViewVisibility(R.id.w_side, View.VISIBLE)
                views.setImageViewResource(R.id.w_rank_icon, if (rank == 1) R.drawable.icon3d_crown else R.drawable.icon3d_trophy)
                views.setTextViewText(R.id.w_rank, "#$rank")
                views.setContentDescription(R.id.w_side, "Rank $rank today")
            } else {
                // No rank today (signed out / not on the board yet): the chip goes away cleanly.
                views.setViewVisibility(R.id.w_side, View.GONE)
            }

            applyStats(context, views, snap, now)
            // Anywhere that isn't a tile opens the app plainly.
            views.setOnClickPendingIntent(R.id.widget_root, openAppIntent(context, 0))
            return views
        }

        private fun buildSmall(context: Context, snap: WidgetBridge.Snapshot, now: Calendar): RemoteViews {
            val views = RemoteViews(context.packageName, R.layout.widget_daily_small)
            applyWall(context, views, 1f, peek = true)
            // BC: all 8 Wordocious dailies, two rows of four big tiles.
            renderTiles(context, views, SMALL_TILES, snap.modes, 0 until SMALL_TILES.size)
            applyStats(context, views, snap, now)
            views.setOnClickPendingIntent(R.id.widget_root, openAppIntent(context, 0))
            return views
        }

        // ── Click targets ───────────────────────────────────────────────────

        private fun openAppIntent(context: Context, requestCode: Int): PendingIntent =
            PendingIntent.getActivity(
                context, requestCode,
                Intent(context, MainActivity::class.java)
                    .setAction(Intent.ACTION_MAIN)
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )

        /** wordocious://daily/<key> — handled by DeepLinkRouter → MainScreen
         *  opens that mode's daily (same route the iOS chips take). */
        private fun dailyIntent(context: Context, requestCode: Int, key: String): PendingIntent =
            PendingIntent.getActivity(
                context, requestCode,
                Intent(context, MainActivity::class.java)
                    .setAction(Intent.ACTION_VIEW)
                    .setData(Uri.parse("wordocious://daily/$key"))
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )

        // ── Timed flips (the RemoteViews timeline) ──────────────────────────

        private fun nextLocalMidnightMillis(now: Calendar): Long = WidgetStats.nextLocalMidnightMillis(now)

        private fun flipIntent(context: Context): PendingIntent =
            PendingIntent.getBroadcast(
                context, 100,
                Intent(context, DailyWidgetProvider::class.java).setAction(ACTION_TIMED_REFRESH),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )

        /** Inexact alarm at the next of 12:00/17:00/00:00 local (the greeting's
         *  MORNING → AFTERNOON → EVENING steps, then the new day's board) — each
         *  firing re-renders and schedules the next (no exact-alarm permission
         *  needed; a few minutes of drift is fine for a look flip). */
        fun scheduleNextFlip(context: Context) {
            val now = Calendar.getInstance()
            val candidates = listOf(12, 17).map { h ->
                (now.clone() as Calendar).apply {
                    set(Calendar.HOUR_OF_DAY, h); set(Calendar.MINUTE, 0)
                    set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0)
                }.timeInMillis
            } + (nextLocalMidnightMillis(now) + 2_000) // past midnight → new day's board
            val next = candidates.filter { it > now.timeInMillis + 1_000 }.min()
            val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            am.set(AlarmManager.RTC, next, flipIntent(context))
        }
    }
}
