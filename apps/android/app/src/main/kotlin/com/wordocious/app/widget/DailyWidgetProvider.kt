package com.wordocious.app.widget

import android.app.AlarmManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.graphics.Shader
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.util.SizeF
import android.view.View
import android.widget.RemoteViews
import com.wordocious.app.MainActivity
import com.wordocious.app.R
import com.wordocious.app.ui.MascotId
import java.util.Calendar

/**
 * "Daily Puzzles" home-screen widget — FINISH_SPEC BI13 (founder 10-02: "clean up the widgets …
 * make them better looking … on brand"), the iOS WordociousWidget twin:
 *
 * - ONE calm background (drawable/widget_bg: lavender → white; deep purple in night mode).
 * - ONE hero: a ring built from the eight game colors, one segment per daily, each lighting up
 *   as that daily is done, the count inside ("5/8 DAILIES"); all eight done → a gold ring that
 *   reads SWEPT.
 * - The streak number set right into the 3D flame; DAY STREAK beside it.
 * - The dailies as glossy brand tiles (ART_SPEC §20, no rim) in each game's color with a white
 *   check when done; a pale wash of the color holding the game's 3D icon when not. Each chip
 *   deep-links into its daily (wordocious://daily/<MODE>).
 * - BI13b: one small cast member peeking in (the small's mascot corner; up from behind the
 *   top-right daily chip on the medium; behind the middle Puzzle chip on the large, beside the W
 *   header) — mood by state, pose by day (WidgetCast.peekPose). Two type sizes (Nunito Black hero +
 *   tracked caps), brand purple accent, gold only for the streak and a sweep. No boxes,
 *   outlines or frames around anything.
 *
 * Small: ring + W, then the flame streak with DAY STREAK / RESETS IN 4H. Medium: ring + streak in
 * the left third, the 4×2 daily chips, one stat line (NEXT CLASSIC · 4H LEFT · 1,240 PTS TODAY).
 * Large: W + WORDOCIOUS header with the streak, ring + daily chips, the ten Puzzles chips, the
 * stat line.
 *
 * Classic RemoteViews: the ring and chips are small cached bitmaps (RemoteViews can't layer a
 * glossy tile, an icon and a check); the texts are TextViews so they follow night mode. The
 * "4H" label re-renders on each whole hour (every 15 minutes in the last hour) and at midnight
 * through inexact AlarmManager broadcasts; updatePeriodMillis (30 min) is the fallback.
 */
class DailyWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(context: Context, mgr: AppWidgetManager, ids: IntArray) {
        render(context, mgr, ids)
        scheduleNextFlip(context)
    }

    override fun onAppWidgetOptionsChanged(context: Context, mgr: AppWidgetManager, id: Int, newOptions: Bundle) {
        // Resized between the footprints (pre-31 launchers pick by size here).
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
        private const val SLATE = 0xFF64748B.toInt()

        private fun hex(s: String): Int =
            runCatching { Color.parseColor(if (s.startsWith("#")) s else "#$s") }.getOrDefault(PURPLE)

        // Explicit view-id tables (no getIdentifier: resource shrinking must see every id).
        private val DAILY_CHIPS = intArrayOf(R.id.w_t0, R.id.w_t1, R.id.w_t2, R.id.w_t3, R.id.w_t4, R.id.w_t5, R.id.w_t6, R.id.w_t7)
        private val PUZZLE_CHIPS = intArrayOf(R.id.w_p0, R.id.w_p1, R.id.w_p2, R.id.w_p3, R.id.w_p4, R.id.w_p5, R.id.w_p6, R.id.w_p7, R.id.w_p8, R.id.w_p9)

        // ── Render ──────────────────────────────────────────────────────────

        fun render(context: Context, mgr: AppWidgetManager, ids: IntArray) {
            val snap = WidgetBridge.loadSnapshot(context)
            val now = Calendar.getInstance()
            for (id in ids) {
                val views = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    // The launcher picks the largest layout that fits the current size.
                    RemoteViews(mapOf(
                        SizeF(110f, 110f) to buildSmall(context, snap, now),
                        SizeF(240f, 110f) to buildMedium(context, snap, now),
                        SizeF(240f, 280f) to buildLarge(context, snap, now),
                    ))
                } else {
                    val opts = mgr.getAppWidgetOptions(id)
                    val minW = opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 250)
                    val maxH = opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 110)
                    when {
                        minW in 1 until 200 -> buildSmall(context, snap, now)
                        maxH >= 280 -> buildLarge(context, snap, now)
                        else -> buildMedium(context, snap, now)
                    }
                }
                mgr.updateAppWidget(id, views)
            }
        }

        // ── Bitmaps (cached per process: only the done flags change) ─────────

        private val chipCache = HashMap<String, Bitmap>()
        private val ringCache = HashMap<String, Bitmap>()

        private fun dp(context: Context, v: Float): Float = v * context.resources.displayMetrics.density

        /** A color lightened toward white (k > 0) or darkened toward black (k < 0) — §20 tones. */
        private fun shade(c: Int, k: Float): Int {
            val r = Color.red(c); val g = Color.green(c); val b = Color.blue(c)
            fun ch(v: Int) = if (k >= 0) (v + (255 - v) * k).toInt() else (v * (1 + k)).toInt()
            return Color.rgb(ch(r).coerceIn(0, 255), ch(g).coerceIn(0, 255), ch(b).coerceIn(0, 255))
        }

        private fun withAlpha(c: Int, a: Float): Int = Color.argb((a * 255).toInt(), Color.red(c), Color.green(c), Color.blue(c))

        /** A to-play tint: the game color as a soft pastel, readable on both backgrounds. */
        private fun paleTint(c: Int, a: Float): Int = withAlpha(shade(c, 0.4f), a)

        /**
         * The hero ring: one round-capped arc per daily in its game color (a missed one slate),
         * pale until done; all done → every segment gold.
         */
        private fun ringBitmap(context: Context, modes: List<WidgetBridge.ModeEntry>, sizeDp: Float, flawless: Boolean = false): Bitmap {
            val key = "%.0f|$flawless|".format(sizeDp) + modes.joinToString(",") { "${it.key}:${it.played}:${it.won}" }
            ringCache[key]?.let { return it }
            if (ringCache.size > 8) ringCache.clear()
            val px = dp(context, sizeDp).toInt().coerceIn(96, 280)
            val bmp = Bitmap.createBitmap(px, px, Bitmap.Config.ARGB_8888)
            val c = Canvas(bmp)
            val d = px.toFloat()
            val lw = d * 0.11f
            val radius = (d - lw) / 2f
            val circ = (2 * Math.PI * radius).toFloat()
            val n = modes.size.coerceAtLeast(1)
            val seg = 360f / n
            val halfGap = minOf(seg * 0.35f, (lw / 2f + d * 0.03f) / circ * 360f)
            val swept = modes.isNotEmpty() && modes.all { it.played }
            val oval = RectF(lw / 2f, lw / 2f, d - lw / 2f, d - lw / 2f)
            val p = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                style = Paint.Style.STROKE; strokeWidth = lw; strokeCap = Paint.Cap.ROUND
            }
            if (flawless) {
                // Items 28 / 48: the art team's gold ring with its eight sparkle stars (art/streaks/flawless-ring).
                val art = com.wordocious.app.data.ShareFinish.decode(context, R.drawable.streak_flawless_ring)
                if (art != null) {
                    val side = minOf(d / art.width, d / art.height)
                    val w = art.width * side; val h = art.height * side
                    c.drawBitmap(art, null, RectF((d - w) / 2f, (d - h) / 2f, (d + w) / 2f, (d + h) / 2f),
                        Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG))
                    ringCache[key] = bmp
                    return bmp
                }
            }
            modes.forEachIndexed { i, m ->
                p.shader = null
                when {
                    swept -> p.shader = LinearGradient(0f, 0f, 0f, d, 0xFFFCD34D.toInt(), 0xFFF59E0B.toInt(), Shader.TileMode.CLAMP)
                    m.played -> p.color = if (m.won) hex(m.colorHex) else SLATE
                    else -> p.color = paleTint(hex(m.colorHex), 0.30f)
                }
                c.drawArc(oval, -90f + i * seg + halfGap, seg - 2 * halfGap, false, p)
            }
            ringCache[key] = bmp
            return bmp
        }

        /** The chip bitmap's side in px (a 44dp chip at the device density, capped for the parcel). */
        private fun chipPx(context: Context): Int = dp(context, 44f).toInt().coerceIn(64, 132)

        /**
         * One daily as a chip. Done: the §20 glossy tile (darker body as a bottom lip, the face's
         * light → base gradient, a white gloss on top) in the game color with a white check — a
         * missed daily is slate with a white cross. To play: a pale wash with the 3D game icon.
         */
        private fun chipBitmap(context: Context, m: WidgetBridge.ModeEntry): Bitmap {
            val key = "${m.key}|${m.played}|${m.won}"
            chipCache[key]?.let { return it }
            val px = chipPx(context)
            val s = px.toFloat()
            val bmp = Bitmap.createBitmap(px, px, Bitmap.Config.ARGB_8888)
            val c = Canvas(bmp)
            val p = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG)
            val r = s * 0.24f
            val base = if (!m.played || m.won) hex(m.colorHex) else SLATE
            if (m.played) {
                val lip = s * 0.07f
                p.color = shade(base, -0.22f)
                c.drawRoundRect(RectF(0f, 0f, s, s), r, r, p)
                p.shader = LinearGradient(0f, 0f, 0f, s - lip,
                    intArrayOf(shade(base, 0.18f), base, shade(base, -0.06f)), floatArrayOf(0f, 0.7f, 1f), Shader.TileMode.CLAMP)
                c.drawRoundRect(RectF(0f, 0f, s, s - lip), r, r, p)
                val gloss = RectF(s * 0.08f, s * 0.08f, s * 0.92f, s * 0.08f + (s - lip) * 0.42f)
                p.shader = LinearGradient(0f, gloss.top, 0f, gloss.bottom, 0x4DFFFFFF, 0x00FFFFFF, Shader.TileMode.CLAMP)
                c.drawRoundRect(gloss, s * 0.18f, s * 0.18f, p)
                p.shader = null
                // The white mark on the face (a stroke, not a glyph), with a soft darker lift.
                val box = RectF(s * 0.25f, s * 0.25f - lip / 2f, s * 0.75f, s * 0.75f - lip / 2f)
                fun pt(x: Float, y: Float) = floatArrayOf(box.left + box.width() * x, box.top + box.height() * y)
                val path = Path().apply {
                    if (m.won) {
                        val a = pt(0.2f, 0.54f); val b = pt(0.42f, 0.75f); val e = pt(0.8f, 0.3f)
                        moveTo(a[0], a[1]); lineTo(b[0], b[1]); lineTo(e[0], e[1])
                    } else {
                        val a = pt(0.28f, 0.28f); val b = pt(0.72f, 0.72f); val e = pt(0.72f, 0.28f); val f = pt(0.28f, 0.72f)
                        moveTo(a[0], a[1]); lineTo(b[0], b[1]); moveTo(e[0], e[1]); lineTo(f[0], f[1])
                    }
                }
                p.style = Paint.Style.STROKE; p.strokeWidth = s * 0.09f
                p.strokeCap = Paint.Cap.ROUND; p.strokeJoin = Paint.Join.ROUND
                p.color = withAlpha(shade(base, -0.35f), 0.45f)
                c.save(); c.translate(0f, s * 0.02f); c.drawPath(path, p); c.restore()
                p.color = Color.WHITE
                c.drawPath(path, p)
            } else {
                p.color = paleTint(base, 0.24f)
                c.drawRoundRect(RectF(0f, 0f, s, s), r, r, p)
                val icon = com.wordocious.app.ui.gameArtRes(com.wordocious.app.ModeGen.byDbKey(m.key)?.id)
                val art = icon?.let { com.wordocious.app.data.ShareFinish.decode(context, it, sample = 1) }
                if (art != null) {
                    val inset = s * 0.15f
                    c.drawBitmap(art, null, RectF(inset, inset, s - inset, s - inset), p)
                } else {
                    p.color = base; p.textAlign = Paint.Align.CENTER; p.textSize = s * 0.36f
                    p.typeface = com.wordocious.app.data.ShareFinish.nunito(context, 900)
                    c.drawText(m.iconText ?: m.glyph, s / 2f, s / 2f + p.textSize * 0.35f, p)
                }
            }
            chipCache[key] = bmp
            return bmp
        }

        // ── Shared pieces ───────────────────────────────────────────────────

        private fun isNight(context: Context): Boolean =
            (context.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES

        /** A theme color on a TextView: the resource itself on 31+ (follows night mode live). */
        private fun setTextColorRes(context: Context, views: RemoteViews, id: Int, light: Int, dark: Int, res: Int) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                views.setColorStateList(id, "setTextColor", res)
            } else {
                views.setTextColor(id, if (isNight(context)) dark else light)
            }
        }

        private fun nextUp(snap: WidgetBridge.Snapshot): WidgetBridge.ModeEntry? =
            (snap.modes + snap.puzzles.orEmpty()).firstOrNull { !it.played }

        private fun resetLabel(now: Calendar): String =
            WidgetStats.resetText(WidgetStats.msToMidnight(now) / 1000).uppercase()

        /** The hero ring + its centered count (SWEPT in gold when all eight are done). */
        private fun applyRing(context: Context, views: RemoteViews, snap: WidgetBridge.Snapshot, sizeDp: Float) {
            val modes = snap.modes
            val played = modes.count { it.played }
            val swept = modes.isNotEmpty() && played == modes.size
            val flawless = snap.isFlawless
            val run = snap.flawlessRun
            views.setImageViewBitmap(R.id.w_ring, ringBitmap(context, modes, sizeDp, flawless))
            // Flawless: the run is the hero ("×3") with FLAWLESS under it, or FLAWLESS alone on a first day.
            val heroText = when {
                flawless && run >= 2 -> "\u00D7$run"
                flawless -> "FLAWLESS"
                swept -> "SWEPT"
                else -> "$played/${modes.size}"
            }
            views.setTextViewText(R.id.w_ring_count, heroText)
            views.setTextViewText(R.id.w_ring_label, if (flawless) "FLAWLESS" else if (swept) "ALL ${modes.size}" else "DAILIES")
            // The caps label only where the ring has room for both lines (iOS DailyRing twin).
            views.setViewVisibility(R.id.w_ring_label, if (sizeDp >= 78f && !(flawless && run < 2)) View.VISIBLE else View.GONE)
            if (swept || flawless) setTextColorRes(context, views, R.id.w_ring_count, 0xFFD97706.toInt(), 0xFFFCD34D.toInt(), R.color.widget_gold)
            else setTextColorRes(context, views, R.id.w_ring_count, 0xFF3B1A78.toInt(), 0xFFE9DDFF.toInt(), R.color.widget_ink)
            views.setContentDescription(R.id.w_ring_box,
                if (flawless) (if (run >= 2) "Flawless, $run days in a row" else "Flawless today") else "$played of ${modes.size} dailies done")
        }

        /** The streak set into the flame (a zero streak dims the flame). */
        private fun applyStreak(views: RemoteViews, snap: WidgetBridge.Snapshot) {
            views.setTextViewText(R.id.w_streak, "${snap.streak}")
            views.setInt(R.id.w_flame, "setImageAlpha", if (snap.streak == 0) 150 else 255)
            views.setContentDescription(R.id.w_flame_box, WidgetStats.streakPhrase(snap.streak))
            // Item 28: the flawless trophy beside the flame (same size / baseline / number style); gone (no gap)
            // until a flawless run of 2+. Tier art by run: 3 / 5 / 7 / 10 / 30 (art/streaks).
            val run = snap.flawlessRun
            if (run >= 2) {
                val tier = when { run >= 30 -> R.drawable.streak_trophy_30; run >= 10 -> R.drawable.streak_trophy_10
                    run >= 7 -> R.drawable.streak_trophy_7; run >= 5 -> R.drawable.streak_trophy_5; else -> R.drawable.streak_trophy_3 }
                views.setImageViewResource(R.id.w_trophy, tier)
                views.setTextViewText(R.id.w_trophy_num, "$run")
                views.setContentDescription(R.id.w_trophy_box, "$run flawless days in a row")
                views.setViewVisibility(R.id.w_trophy_box, View.VISIBLE)
            } else {
                views.setViewVisibility(R.id.w_trophy_box, View.GONE)
            }
        }

        /** NEXT CLASSIC · 4H LEFT · 1,240 PTS TODAY. */
        private fun applyFooter(context: Context, views: RemoteViews, snap: WidgetBridge.Snapshot, now: Calendar) {
            val day = WidgetStats.dayStats(snap, com.wordocious.app.todayLocalDate())
            val next = nextUp(snap)
            if (next != null) {
                views.setTextViewText(R.id.w_f1_label, "NEXT ")
                views.setTextViewText(R.id.w_f1_value, WidgetStats.nextName(next.key, next.title).uppercase())
                setTextColorRes(context, views, R.id.w_f1_value, PURPLE, 0xFFA78BFA.toInt(), R.color.widget_accent)
            } else {
                views.setTextViewText(R.id.w_f1_label, "")
                views.setTextViewText(R.id.w_f1_value, "ALL DONE")
                setTextColorRes(context, views, R.id.w_f1_value, 0xFFD97706.toInt(), 0xFFFCD34D.toInt(), R.color.widget_gold)
            }
            setCountdown(views, R.id.w_left, now)
            views.setTextViewText(R.id.w_f3_value, WidgetStats.pointsLabel(day.points))
            views.setContentDescription(R.id.w_footer,
                "${next?.let { "Next: ${WidgetStats.nextName(it.key, it.title)}. " } ?: "All done. "}" +
                    "${WidgetStats.resetText(WidgetStats.msToMidnight(now) / 1000)} left. ${WidgetStats.pointsPhrase(day.points)}")
        }

        /** Chips into [slots] for [modes]; each deep-links into its daily. */
        private fun renderChips(context: Context, views: RemoteViews, slots: IntArray, modes: List<WidgetBridge.ModeEntry>, requestBase: Int) {
            for ((i, id) in slots.withIndex()) {
                val m = modes.getOrNull(i)
                if (m == null) {
                    // INVISIBLE keeps the row's weights, so a shorter roster stays aligned.
                    views.setViewVisibility(id, View.INVISIBLE)
                    continue
                }
                views.setViewVisibility(id, View.VISIBLE)
                // The layout's padded game icon is only the widget-picker preview.
                views.setViewPadding(id, 0, 0, 0, 0)
                views.setImageViewBitmap(id, chipBitmap(context, m))
                views.setContentDescription(id, "${m.title}, ${if (!m.played) "not played, tap to play" else if (m.won) "solved" else "played"}")
                // A finished one opens its solved board, like the home card.
                views.setOnClickPendingIntent(id, dailyIntent(context, requestBase + i, m.key))
            }
        }

        // ── BI13b: the one cast member peeking in (WidgetCast.peekPose) ─────────

        /** Explicit pose table (no getIdentifier: resource shrinking must see every id). */
        private val POSE_RES = mapOf(
            "r-wake" to R.drawable.art_pose_r_wake, "r-cocoa" to R.drawable.art_pose_r_cocoa,
            "o1-ready" to R.drawable.art_pose_o1_ready, "c-telescope" to R.drawable.art_pose_c_telescope,
            "d-eureka" to R.drawable.art_pose_d_eureka, "i-reach" to R.drawable.art_pose_i_reach,
            "o2-ready" to R.drawable.art_pose_o2_ready, "o3-ready" to R.drawable.art_pose_o3_ready,
            "s-trophy" to R.drawable.art_pose_s_trophy, "s-victory" to R.drawable.art_pose_s_victory,
            "d-cheer" to R.drawable.art_pose_d_cheer, "o1-cheer" to R.drawable.art_pose_o1_cheer,
            "o2-cheer" to R.drawable.art_pose_o2_cheer, "i-cheer" to R.drawable.art_pose_i_cheer,
        )

        /** The drawable for today's peeker: its pose, or that character's costume in season. */
        private fun peekRes(snap: WidgetBridge.Snapshot): Int {
            val pose = WidgetCast.peekPose(snap.modes.count { it.played }, snap.modes.size, snap.streak,
                java.time.LocalDate.now().toEpochDay())
            val season = com.wordocious.app.ui.SeasonSkins.current()
            if (season != null) {
                val id = runCatching { MascotId.valueOf(pose.substringBefore('-').uppercase()) }.getOrNull()
                if (id != null) return com.wordocious.app.ui.SeasonSkins.fullRes(id, season)
            }
            return POSE_RES[pose] ?: R.drawable.art_pose_r_wake
        }

        private val peekCache = HashMap<Any, Bitmap>()

        /**
         * The peek for a chip-sized square (w_peek sits under the chip, nudged up 18dp): the figure
         * at 80% of the chip's width, top-aligned, cut at 42% of the square so only its head and
         * shoulders clear the chip's top edge (iOS ChipGrid peek: 0.8 × side, 52% shown).
         */
        private fun peekBitmap(context: Context, res: Int): Bitmap? {
            peekCache[res]?.let { return it }
            val art = com.wordocious.app.data.ShareFinish.decode(context, res) ?: return null
            return peekBitmap(context, art, res)
        }

        /** [peekBitmap] from already-decoded [art] (BI13c: the player's own cutout), cached by [key];
         *  [show] = the share of the chip square left visible above its top edge. */
        private fun peekBitmap(context: Context, art: Bitmap, key: Any, show: Float = 0.42f): Bitmap {
            peekCache[key]?.let { return it }
            val px = chipPx(context)
            val s = px.toFloat()
            val bmp = Bitmap.createBitmap(px, px, Bitmap.Config.ARGB_8888)
            val c = Canvas(bmp)
            val w = s * 0.8f
            val h = w * art.height / art.width
            c.clipRect(0f, 0f, s, s * show)
            c.drawBitmap(art, null, RectF((s - w) / 2f, 0f, (s + w) / 2f, h), Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG))
            if (peekCache.size > 4) peekCache.clear()
            peekCache[key] = bmp
            return bmp
        }

        /** BI13c: whether the player's own look takes the peek today (big days only). */
        private fun ownPeek(snap: WidgetBridge.Snapshot): Boolean =
            WidgetCast.ownPeekDay(snap.modes.count { it.played }, snap.modes.size, snap.streak)

        /**
         * The chip peek: the day's cast member — or, on a big day, the player's own mascot cutout
         * (a photo never peeks from behind a chip: it would be cut). [own] = WidgetAvatarSnapshot.load.
         */
        private fun applyPeek(context: Context, views: RemoteViews, snap: WidgetBridge.Snapshot, own: Pair<Bitmap, Boolean>? = null) {
            val mine = own?.takeIf { !it.second && ownPeek(snap) }?.first
            if (mine != null) {
                // Medium only (the large never passes [own]): the raised own-peek view, cut lower.
                views.setImageViewBitmap(R.id.w_peek_own, peekBitmap(context, mine, "own:${mine.generationId}", show = 0.56f))
                views.setViewVisibility(R.id.w_peek_own, View.VISIBLE)
                views.setViewVisibility(R.id.w_peek, View.GONE)
                return
            }
            if (own != null) views.setViewVisibility(R.id.w_peek_own, View.GONE)
            val bmp = peekBitmap(context, peekRes(snap))
            if (bmp != null) views.setImageViewBitmap(R.id.w_peek, bmp)
            views.setViewVisibility(R.id.w_peek, if (bmp != null) View.VISIBLE else View.GONE)
        }

        private fun applyMascot(views: RemoteViews) {
            val season = com.wordocious.app.ui.SeasonSkins.current()
            views.setImageViewResource(R.id.w_mascot, com.wordocious.app.ui.SeasonSkins.fullRes(MascotId.W, season))
        }

        /** The tap outside a chip: the next unplayed daily, or the app when all are done. */
        private fun rootIntent(context: Context, snap: WidgetBridge.Snapshot): PendingIntent =
            nextUp(snap)?.let { dailyIntent(context, 99, it.key) } ?: homeIntent(context, 98)

        private fun buildSmall(context: Context, snap: WidgetBridge.Snapshot, now: Calendar): RemoteViews {
            val views = RemoteViews(context.packageName, R.layout.widget_daily_small)
            applyRing(context, views, snap, 62f)
            applyStreak(views, snap)
            applyChrome(context, views, snap, WordmarkSize.SMALL)
            // BI13b: the day's cast member in the mascot corner (sleepy R before the first
            // daily, a cheer on a sweep, S with a trophy on a milestone). BI13c: on a big day the
            // player's own look (cutout, or the framed photo whole) stands there instead.
            val own = WidgetAvatarSnapshot.load(context)
            if (own != null && ownPeek(snap)) views.setImageViewBitmap(R.id.w_mascot, own.first)
            else views.setImageViewResource(R.id.w_mascot, peekRes(snap))
            setCountdown(views, R.id.w_reset_t, now)
            views.setContentDescription(R.id.w_reset, WidgetStats.countdownPhraseFor(now))
            // Founder 10-05: the small widget opens Home, not the next unplayed daily.
            views.setOnClickPendingIntent(R.id.widget_root, homeIntent(context, 98))
            return views
        }

        private fun buildMedium(context: Context, snap: WidgetBridge.Snapshot, now: Calendar): RemoteViews {
            val views = RemoteViews(context.packageName, R.layout.widget_daily)
            applyRing(context, views, snap, 72f)
            applyStreak(views, snap)
            applyChrome(context, views, snap, WordmarkSize.MEDIUM)
            renderChips(context, views, DAILY_CHIPS, snap.modes, requestBase = 1)
            applyPeek(context, views, snap, WidgetAvatarSnapshot.load(context))
            applyFooter(context, views, snap, now)
            views.setOnClickPendingIntent(R.id.widget_root, rootIntent(context, snap))
            applyHomeTaps(context, views, R.id.w_wordmark, R.id.w_ring_box, R.id.w_footer)
            return views
        }

        private fun buildLarge(context: Context, snap: WidgetBridge.Snapshot, now: Calendar): RemoteViews {
            val views = RemoteViews(context.packageName, R.layout.widget_daily_large)
            applyRing(context, views, snap, 84f)
            applyStreak(views, snap)
            applyChrome(context, views, snap, WordmarkSize.LARGE)
            // BI13c: the player's own look (mascot cutout / framed photo) heads the large widget; W otherwise.
            val own = WidgetAvatarSnapshot.load(context)
            if (own != null) views.setImageViewBitmap(R.id.w_mascot, own.first) else applyMascot(views)
            renderChips(context, views, DAILY_CHIPS, snap.modes, requestBase = 1)
            val puzzles = snap.puzzles.orEmpty()
            if (puzzles.isEmpty()) {
                views.setViewVisibility(R.id.w_puzzles_head, View.GONE)
                views.setViewVisibility(R.id.w_puzzles, View.GONE)
            } else {
                views.setTextViewText(R.id.w_puzzles_count, "${puzzles.count { it.played }}/${puzzles.size}")
                renderChips(context, views, PUZZLE_CHIPS, puzzles, requestBase = 20)
                applyPeek(context, views, snap)
            }
            applyFooter(context, views, snap, now)
            // Item 28 (founder 10-08: the large widget did nothing): EVERY element has its own tap, and the root
            // falls back to Home when nothing is next up. Chips already deep-link above.
            views.setOnClickPendingIntent(R.id.widget_root, rootIntent(context, snap))
            applyHomeTaps(context, views, R.id.w_mascot, R.id.w_header_text, R.id.w_wordmark, R.id.w_headline,
                R.id.w_ring_box, R.id.w_puzzles_head, R.id.w_footer, R.id.w_flame_box, R.id.w_trophy_box)
            return views
        }

        // ── Item 28 / 48 / 24: lettering, live countdown, season chrome, taps ─────────

        private enum class WordmarkSize { SMALL, MEDIUM, LARGE }

        /** The live h:m:s countdown to local midnight (a Chronometer counting down; no re-render per tick). */
        private fun setCountdown(views: RemoteViews, id: Int, now: Calendar) {
            val base = android.os.SystemClock.elapsedRealtime() + WidgetStats.msToMidnight(now).coerceAtLeast(0)
            views.setChronometerCountDown(id, true)
            views.setChronometer(id, base, null, true)
        }

        /** Halloween widgets: the core season window AND the `season_halloween` off-switch. */
        private fun halloweenOn(snap: WidgetBridge.Snapshot): Boolean =
            snap.seasonHalloween != false && com.wordocious.app.ui.SeasonSkins.current() != null

        private val MOTIFS = intArrayOf(
            R.drawable.widget_halloween_moon_bats, R.drawable.widget_halloween_pumpkin_row, R.drawable.widget_halloween_bat_flock,
            R.drawable.widget_halloween_haunted_hill, R.drawable.widget_halloween_stars_clouds, R.drawable.widget_halloween_cobweb,
        )

        /** Lettering image + (in season) the black and orange background, the rotating faint motif, and light inks. */
        private fun applyChrome(context: Context, views: RemoteViews, snap: WidgetBridge.Snapshot, size: WordmarkSize) {
            val hall = halloweenOn(snap)
            val v = if (hall) "halloween_orange" else "normal"
            val wordmark = when (size) {
                WordmarkSize.SMALL -> if (hall) R.drawable.widget_wordmark_small_halloween_orange else R.drawable.widget_wordmark_small_normal
                WordmarkSize.MEDIUM -> if (hall) R.drawable.widget_wordmark_medium_halloween_orange else R.drawable.widget_wordmark_medium_normal
                WordmarkSize.LARGE -> if (hall) R.drawable.widget_wordmark_large_halloween_orange else R.drawable.widget_wordmark_large_normal
            }
            views.setImageViewResource(R.id.w_wordmark, wordmark)
            if (size == WordmarkSize.LARGE) {
                views.setImageViewResource(R.id.w_headline,
                    if (hall) R.drawable.widget_headline_halloween_orange else R.drawable.widget_headline_normal)
            }
            if (!hall) {
                views.setViewVisibility(R.id.w_motif, View.GONE)
                return
            }
            views.setInt(R.id.widget_root, "setBackgroundResource", R.drawable.widget_bg_halloween)
            views.setImageViewResource(R.id.w_motif, MOTIFS[((System.currentTimeMillis() / 3_600_000L) % MOTIFS.size).toInt()])
            views.setViewVisibility(R.id.w_motif, View.VISIBLE)
            // Light inks on the black back (the night palette values, orange for the accent).
            val ink = 0xFFE9DDFF.toInt(); val label = 0xBFCDB8FF.toInt(); val orange = 0xFFFB923C.toInt()
            for (id in intArrayOf(R.id.w_streak_caps, R.id.w_left, R.id.w_left_suffix, R.id.w_f3_value, R.id.w_puzzles_caps,
                R.id.w_reset_t, R.id.w_ring_count)) views.setTextColor(id, ink)
            for (id in intArrayOf(R.id.w_reset, R.id.w_f1_label, R.id.w_f3_label, R.id.w_puzzles_count, R.id.w_ring_label)) views.setTextColor(id, label)
            views.setTextColor(R.id.w_f1_value, orange)
            if (snap.isFlawless || (snap.modes.isNotEmpty() && snap.modes.all { it.played })) views.setTextColor(R.id.w_ring_count, 0xFFFCD34D.toInt())
        }

        /** Every listed view opens Home when tapped (ids absent from a layout are ignored by the layout in use). */
        private fun applyHomeTaps(context: Context, views: RemoteViews, vararg ids: Int) {
            val home = homeIntent(context, 98)
            for (id in ids) views.setOnClickPendingIntent(id, home)
        }

        // ── Click targets ───────────────────────────────────────────────────

        /** wordocious://home — DeepLinkRouter → MainScreen shows the Home tab. */
        private fun homeIntent(context: Context, requestCode: Int): PendingIntent =
            PendingIntent.getActivity(
                context, requestCode,
                Intent(context, MainActivity::class.java)
                    .setAction(Intent.ACTION_VIEW)
                    .setData(Uri.parse("wordocious://home"))
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )

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

        private fun flipIntent(context: Context): PendingIntent =
            PendingIntent.getBroadcast(
                context, 100,
                Intent(context, DailyWidgetProvider::class.java).setAction(ACTION_TIMED_REFRESH),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )

        /** Inexact alarm at the next label step (each whole hour; every 15 minutes in the last
         *  hour) or just past midnight (the new day's board) — each firing re-renders and
         *  schedules the next (no exact-alarm permission; a few minutes of drift is fine). */
        fun scheduleNextFlip(context: Context) {
            val next = WidgetStats.nextLabelFlipMillis(Calendar.getInstance())
            val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            am.set(AlarmManager.RTC, next, flipIntent(context))
        }
    }
}
