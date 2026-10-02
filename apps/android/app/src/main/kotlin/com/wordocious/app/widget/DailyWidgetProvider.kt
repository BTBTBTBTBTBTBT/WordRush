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
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Shader
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.SystemClock
import android.util.SizeF
import android.view.View
import android.widget.RemoteViews
import com.wordocious.app.MainActivity
import com.wordocious.app.R
import com.wordocious.app.ui.Mascots
import com.wordocious.app.ui.PageTint
import com.wordocious.app.ui.lightArgb
import com.wordocious.core.BannerTier
import com.wordocious.core.DayStreaks
import com.wordocious.core.GroupProgress
import com.wordocious.core.bannerHeadline
import com.wordocious.core.groupStatus
import com.wordocious.core.groupStreak
import com.wordocious.core.groupTier
import java.util.Calendar

/**
 * "Daily Puzzles" home-screen widget — the Android twin of iOS
 * WordociousWidget.swift. Home redesign (founder, 2026-10-01): the widget is the
 * home banner. One-window background (the Wordocious row's tier color on top
 * blending into the Puzzles row's below, with the white sheen), a frosted header
 * strip with the shared bannerHeadline, the 8 + 10 chip rows, and today's footer
 * strip (wordmark · N/18 · points · live countdown). Double Flawless turns the
 * frame gold with a gold glow. The old fresh / at-risk / sweep / flawless themes
 * are gone; the tier colors replace them. A 2x2 placement gets the small layout.
 * ART_SPEC §17: the home tint gradient under the tier bands, the day's host at the
 * corner, the 3D flame beside every streak and the W / L badge art on played chips.
 *
 * Classic RemoteViews on purpose: the countdown is a Chronometer with
 * isCountDown — the one RemoteViews element that ticks every second without
 * waking the app (Glance has no equivalent) — and each chip carries its own
 * PendingIntent deep-linking into that mode's daily.
 *
 * The headline's greeting moves at noon and 5 pm, and the board resets at
 * midnight: inexact AlarmManager broadcasts at the next of 12/17/00 local
 * re-render it. updatePeriodMillis (30 min) is the belt-and-braces fallback.
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

        // Exact banner hexes (docs/HOME_REDESIGN_SPEC.md §2).
        private const val PURPLE = 0xFF7C3AED.toInt()
        private const val HEAD_INK = 0xFF4C1D95.toInt()
        private const val HEAD_INK_GOLD = 0xFF78350F.toInt()
        private const val TROPHY = 0xFFB45309.toInt()
        private const val LOST_GRAY = 0xFF9CA3AF.toInt()
        private const val DOT_EMPTY = 0xB3FFFFFF.toInt()
        private const val SWEEP_TINT = 0xFFEBD6FD.toInt()
        private const val FLAWLESS_TINT = 0xFFFDE68A.toInt()

        private fun tierInk(t: BannerTier): Int = when (t) {
            BannerTier.NONE -> 0xFF6D28D9.toInt()
            BannerTier.SWEEP -> 0xFF7E22CE.toInt()
            BannerTier.FLAWLESS -> 0xFF92400E.toInt()
        }

        private fun hex(s: String): Int =
            runCatching { Color.parseColor(if (s.startsWith("#")) s else "#$s") }.getOrDefault(PURPLE)

        private fun withAlpha(color: Int, alpha: Float): Int =
            Color.argb((alpha * 255).toInt(), Color.red(color), Color.green(color), Color.blue(color))

        // Explicit view-id tables (no getIdentifier: resource shrinking must see every id).
        private val ID_TABLE: Map<String, IntArray> = mapOf(
            "w_word" to intArrayOf(R.id.w_word0, R.id.w_word1, R.id.w_word2, R.id.w_word3, R.id.w_word4, R.id.w_word5, R.id.w_word6, R.id.w_word7),
            "w_word_bg" to intArrayOf(R.id.w_word0_bg, R.id.w_word1_bg, R.id.w_word2_bg, R.id.w_word3_bg, R.id.w_word4_bg, R.id.w_word5_bg, R.id.w_word6_bg, R.id.w_word7_bg),
            "w_word_dash" to intArrayOf(R.id.w_word0_dash, R.id.w_word1_dash, R.id.w_word2_dash, R.id.w_word3_dash, R.id.w_word4_dash, R.id.w_word5_dash, R.id.w_word6_dash, R.id.w_word7_dash),
            "w_word_icon" to intArrayOf(R.id.w_word0_icon, R.id.w_word1_icon, R.id.w_word2_icon, R.id.w_word3_icon, R.id.w_word4_icon, R.id.w_word5_icon, R.id.w_word6_icon, R.id.w_word7_icon),
            "w_word_glyph" to intArrayOf(R.id.w_word0_glyph, R.id.w_word1_glyph, R.id.w_word2_glyph, R.id.w_word3_glyph, R.id.w_word4_glyph, R.id.w_word5_glyph, R.id.w_word6_glyph, R.id.w_word7_glyph),
            "w_puz" to intArrayOf(R.id.w_puz0, R.id.w_puz1, R.id.w_puz2, R.id.w_puz3, R.id.w_puz4, R.id.w_puz5, R.id.w_puz6, R.id.w_puz7, R.id.w_puz8, R.id.w_puz9),
            "w_puz_bg" to intArrayOf(R.id.w_puz0_bg, R.id.w_puz1_bg, R.id.w_puz2_bg, R.id.w_puz3_bg, R.id.w_puz4_bg, R.id.w_puz5_bg, R.id.w_puz6_bg, R.id.w_puz7_bg, R.id.w_puz8_bg, R.id.w_puz9_bg),
            "w_puz_dash" to intArrayOf(R.id.w_puz0_dash, R.id.w_puz1_dash, R.id.w_puz2_dash, R.id.w_puz3_dash, R.id.w_puz4_dash, R.id.w_puz5_dash, R.id.w_puz6_dash, R.id.w_puz7_dash, R.id.w_puz8_dash, R.id.w_puz9_dash),
            "w_puz_icon" to intArrayOf(R.id.w_puz0_icon, R.id.w_puz1_icon, R.id.w_puz2_icon, R.id.w_puz3_icon, R.id.w_puz4_icon, R.id.w_puz5_icon, R.id.w_puz6_icon, R.id.w_puz7_icon, R.id.w_puz8_icon, R.id.w_puz9_icon),
            "w_puz_glyph" to intArrayOf(R.id.w_puz0_glyph, R.id.w_puz1_glyph, R.id.w_puz2_glyph, R.id.w_puz3_glyph, R.id.w_puz4_glyph, R.id.w_puz5_glyph, R.id.w_puz6_glyph, R.id.w_puz7_glyph, R.id.w_puz8_glyph, R.id.w_puz9_glyph),
            "w_sw" to intArrayOf(R.id.w_sw0, R.id.w_sw1, R.id.w_sw2, R.id.w_sw3, R.id.w_sw4, R.id.w_sw5, R.id.w_sw6, R.id.w_sw7),
            "w_sp" to intArrayOf(R.id.w_sp0, R.id.w_sp1, R.id.w_sp2, R.id.w_sp3, R.id.w_sp4, R.id.w_sp5, R.id.w_sp6, R.id.w_sp7, R.id.w_sp8, R.id.w_sp9),
        )

        private fun ids(prefix: String, suffix: String): IntArray = ID_TABLE.getValue(prefix + suffix)

        /** Snapshot iconAsset → bundled drawable (the SAME assets the home menu
         *  uses; keep in step with ui.modeIconRes and WidgetBridge.iconSpec).
         *  null → text glyph fallback, exactly like iOS. */
        private fun assetRes(name: String?): Int? = when (name) {
            "wordle-grid" -> R.drawable.ic_wordle_grid
            "swords" -> R.drawable.ic_swords
            "trending-up" -> R.drawable.ic_trending_up
            "shield" -> R.drawable.ic_shield
            "skull" -> R.drawable.ic_skull
            "crown" -> R.drawable.ic_crown
            "broom" -> R.drawable.ic_broom
            "six-hand" -> R.drawable.ic_six_hand
            "seven-hand" -> R.drawable.ic_seven_hand
            "grid-3x3" -> R.drawable.ic_grid_3x3
            "shuffle" -> R.drawable.ic_shuffle
            "hexagon" -> R.drawable.ic_hexagon
            "quote" -> R.drawable.ic_quote
            "group" -> R.drawable.ic_group
            "ladder" -> R.drawable.ic_ladder
            "key-round" -> R.drawable.ic_key_round
            "text-search" -> R.drawable.ic_text_search
            "star" -> R.drawable.ic_star
            else -> null
        }

        /** Today's two rows, read off the snapshot. */
        private class Rows(snap: WidgetBridge.Snapshot) {
            val word = GroupProgress(snap.modes.count { it.played }, snap.modes.count { it.won }, snap.modes.size)
            val puzzleList = snap.puzzles.orEmpty()
            val puzzles = GroupProgress(puzzleList.count { it.played }, puzzleList.count { it.won }, puzzleList.size)
            val wTier = groupTier(word)
            val pTier = groupTier(puzzles)
            val double = wTier == BannerTier.FLAWLESS && pTier == BannerTier.FLAWLESS
            val played = word.played + puzzles.played
            val total = word.total + puzzles.total
            val wStreak = groupStreak(wTier, DayStreaks(snap.wordSweepStreak ?: 0, snap.wordFlawlessStreak ?: 0))
            val pStreak = groupStreak(pTier, DayStreaks(snap.puzzlesSweepStreak ?: 0, snap.puzzlesFlawlessStreak ?: 0))
            fun headline(now: Calendar, name: String?) =
                bannerHeadline(word, puzzles, now.get(Calendar.HOUR_OF_DAY), name.orEmpty())
        }

        // ── Render ──────────────────────────────────────────────────────────

        fun render(context: Context, mgr: AppWidgetManager, ids: IntArray) {
            val snap = WidgetBridge.loadSnapshot(context)
            val now = Calendar.getInstance()
            val rows = Rows(snap)
            for (id in ids) {
                val views = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    // The launcher picks the layout that fits the current size.
                    RemoteViews(mapOf(
                        SizeF(110f, 110f) to buildSmall(context, snap, rows, now),
                        SizeF(240f, 110f) to buildMedium(context, snap, rows, now),
                    ))
                } else {
                    val minW = mgr.getAppWidgetOptions(id).getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 250)
                    if (minW in 1 until 200) buildSmall(context, snap, rows, now) else buildMedium(context, snap, rows, now)
                }
                mgr.updateAppWidget(id, views)
            }
        }

        /**
         * The one-window fill: the ART_SPEC §11 home tint (3-stop diagonal, no tiles
         * at widget sizes — §17) under the banner's tier bands — a swept / flawless
         * Wordocious row tints the top (0–52%, fading out by 72%), the Puzzles row
         * the bottom — and the white 135° sheen. A tiny bitmap stretched to the
         * widget: gradients survive the stretch, and it keeps the RemoteViews parcel
         * far under the binder limit.
         */
        private fun fillBitmap(rows: Rows): Bitmap {
            val w = 48; val h = 48
            val bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
            val c = Canvas(bmp)
            val p = Paint()
            p.shader = LinearGradient(0f, 0f, w.toFloat(), h.toFloat(), PageTint.HOME.lightArgb(), null, Shader.TileMode.CLAMP)
            c.drawRect(0f, 0f, w.toFloat(), h.toFloat(), p)
            fun tierTint(t: BannerTier): Int? = when (t) { BannerTier.NONE -> null; BannerTier.SWEEP -> SWEEP_TINT; BannerTier.FLAWLESS -> FLAWLESS_TINT }
            tierTint(rows.wTier)?.let { top ->
                p.shader = LinearGradient(0f, 0f, 0f, h.toFloat(), intArrayOf(top, top, top and 0x00FFFFFF, top and 0x00FFFFFF), floatArrayOf(0f, 0.52f, 0.72f, 1f), Shader.TileMode.CLAMP)
                c.drawRect(0f, 0f, w.toFloat(), h.toFloat(), p)
            }
            tierTint(rows.pTier)?.let { bottom ->
                p.shader = LinearGradient(0f, 0f, 0f, h.toFloat(), intArrayOf(bottom and 0x00FFFFFF, bottom and 0x00FFFFFF, bottom, bottom), floatArrayOf(0f, 0.52f, 0.72f, 1f), Shader.TileMode.CLAMP)
                c.drawRect(0f, 0f, w.toFloat(), h.toFloat(), p)
            }
            p.shader = LinearGradient(0f, 0f, w.toFloat(), h.toFloat(), intArrayOf(0x59FFFFFF, 0x00FFFFFF, 0x00FFFFFF), floatArrayOf(0f, 0.55f, 1f), Shader.TileMode.CLAMP)
            c.drawRect(0f, 0f, w.toFloat(), h.toFloat(), p)
            return bmp
        }

        /** Frame, fill and halo — shared by both sizes. */
        private fun applyChrome(views: RemoteViews, rows: Rows) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                views.setInt(R.id.widget_root, "setBackgroundResource", if (rows.double) R.drawable.widget_frame_gold else R.drawable.widget_frame_brand)
                views.setImageViewBitmap(R.id.w_fill, fillBitmap(rows))
                views.setBoolean(R.id.w_fill, "setClipToOutline", true)
                views.setViewVisibility(R.id.w_fill, View.VISIBLE)
            } else {
                // setClipToOutline isn't remotable before 31: the square bitmap would poke
                // past the rounded corners, so older launchers get the nearest baked drawable.
                views.setViewVisibility(R.id.w_fill, View.GONE)
                views.setInt(R.id.widget_root, "setBackgroundResource", when {
                    rows.wTier == BannerTier.FLAWLESS || rows.pTier == BannerTier.FLAWLESS -> R.drawable.widget_bg_flawless
                    rows.wTier == BannerTier.SWEEP || rows.pTier == BannerTier.SWEEP -> R.drawable.widget_bg_sweep
                    else -> R.drawable.widget_bg_midday
                })
            }
            views.setImageViewResource(R.id.w_halo, if (rows.double) R.drawable.widget_halo_gold else R.drawable.widget_halo_violet)
            // ART_SPEC §17: the day's host (the cast member on today's day-title art) at the corner.
            views.setImageViewResource(R.id.w_host, Mascots.dayHost(java.time.LocalDate.now()).res)
        }

        private fun applyCountdown(views: RemoteViews, now: Calendar) {
            // The live countdown: android.widget.Chronometer counting down to
            // local midnight — ticks every second with zero refresh budget.
            views.setInt(R.id.w_hourglass, "setColorFilter", PURPLE)
            val remainingMs = nextLocalMidnightMillis(now) - System.currentTimeMillis()
            views.setChronometerCountDown(R.id.w_countdown, true)
            views.setChronometer(R.id.w_countdown, SystemClock.elapsedRealtime() + remainingMs, null, true)
        }

        private fun buildMedium(context: Context, snap: WidgetBridge.Snapshot, rows: Rows, now: Calendar): RemoteViews {
            val views = RemoteViews(context.packageName, R.layout.widget_daily)
            applyChrome(views, rows)

            // Header strip: the shared headline (after 8 pm it stays the evening
            // greeting until a puzzle is played) and the day-streak flame.
            views.setTextViewText(R.id.w_title, rows.headline(now, snap.username))
            views.setTextColor(R.id.w_title, if (rows.double) HEAD_INK_GOLD else HEAD_INK)
            views.setViewVisibility(R.id.w_trophy, if (rows.double) View.VISIBLE else View.GONE)
            views.setInt(R.id.w_trophy, "setColorFilter", TROPHY)
            views.setTextViewText(R.id.w_streak, "${snap.streak}")

            renderRowLabel(views, R.id.w_wrow_label, R.id.w_wrow_status, R.id.w_wrow_flame, R.id.w_wrow_streak,
                "WORDOCIOUS", groupStatus(rows.word), rows.wTier, rows.wStreak)
            renderRowLabel(views, R.id.w_prow_label, R.id.w_prow_status, R.id.w_prow_flame, R.id.w_prow_streak,
                "PUZZLES", groupStatus(rows.puzzles), rows.pTier, rows.pStreak)
            renderChips(context, views, "w_word", 8, snap.modes, requestBase = 1, glyphDp = 11f, badgeDp = 22f)
            renderChips(context, views, "w_puz", 10, rows.puzzleList, requestBase = 20, glyphDp = 10f, badgeDp = 20f)

            val points = groupedPoints((snap.points ?: 0) + (snap.puzzlePoints ?: 0))
            views.setTextViewText(R.id.w_stat, "${rows.played}/${rows.total} · $points pts")
            applyCountdown(views, now)

            // Anywhere that isn't a chip opens the app plainly.
            views.setOnClickPendingIntent(R.id.widget_root, openAppIntent(context, 0))
            return views
        }

        private fun buildSmall(context: Context, snap: WidgetBridge.Snapshot, rows: Rows, now: Calendar): RemoteViews {
            val views = RemoteViews(context.packageName, R.layout.widget_daily_small)
            applyChrome(views, rows)
            views.setTextViewText(R.id.w_streak, "${snap.streak}")
            views.setTextViewText(R.id.w_big, "${rows.played}/${rows.total}")
            views.setTextColor(R.id.w_big, if (rows.double) HEAD_INK_GOLD else HEAD_INK)
            views.setTextViewText(R.id.w_title, rows.headline(now, snap.username))
            views.setTextColor(R.id.w_title, if (rows.double) HEAD_INK_GOLD else HEAD_INK)
            renderDots(context, views, "w_sw", 8, snap.modes)
            renderDots(context, views, "w_sp", 10, rows.puzzleList)
            applyCountdown(views, now)
            views.setOnClickPendingIntent(R.id.widget_root, openAppIntent(context, 0))
            return views
        }

        private fun renderRowLabel(
            views: RemoteViews, labelId: Int, statusId: Int, flameId: Int, streakId: Int,
            label: String, status: String, tier: BannerTier, streak: Int,
        ) {
            val ink = tierInk(tier)
            views.setTextViewText(labelId, label)
            views.setTextColor(labelId, ink)
            views.setTextViewText(statusId, status)
            views.setTextColor(statusId, ink)
            // A row's flame hides when its run is 0 (spec §2 Streaks).
            val show = if (streak > 0) View.VISIBLE else View.GONE
            views.setViewVisibility(flameId, show)
            views.setViewVisibility(streakId, show)
            views.setTextViewText(streakId, "$streak")
        }

        private fun renderDots(context: Context, views: RemoteViews, prefix: String, slots: Int, modes: List<WidgetBridge.ModeEntry>) {
            val dot = ids(prefix, "")
            for (i in 0 until slots) {
                val m = modes.getOrNull(i)
                if (m == null) { views.setViewVisibility(dot[i], View.GONE); continue }
                views.setViewVisibility(dot[i], View.VISIBLE)
                views.setInt(dot[i], "setColorFilter", when {
                    m.played && m.won -> hex(m.colorHex)
                    m.played -> LOST_GRAY
                    else -> DOT_EMPTY
                })
            }
        }

        private fun renderChips(
            context: Context,
            views: RemoteViews,
            prefix: String,
            slots: Int,
            modes: List<WidgetBridge.ModeEntry>,
            requestBase: Int,
            glyphDp: Float,
            /** The W / L badge's size in this row's chip (a touch larger than the 15 dp icon). */
            badgeDp: Float,
        ) {
            val cell = ids(prefix, "")
            val bg = ids(prefix, "_bg")
            val dash = ids(prefix, "_dash")
            val icon = ids(prefix, "_icon")
            val glyph = ids(prefix, "_glyph")
            val density = context.resources.displayMetrics.density
            for (i in 0 until slots) {
                val m = modes.getOrNull(i)
                if (m == null) {
                    // INVISIBLE keeps the row's weights, so a shorter roster stays aligned.
                    views.setViewVisibility(cell[i], View.INVISIBLE)
                    continue
                }
                views.setViewVisibility(cell[i], View.VISIBLE)
                val accent = hex(m.colorHex)
                if (m.played) {
                    // Solid accent tile (gray when lost) wearing today's result as the 3D W / L
                    // badge art (ART_SPEC §17, the home cards' §4 badges), untinted. The
                    // launcher re-applies onto the old views, so the tint is cleared
                    // explicitly (a transparent SRC_ATOP filter draws nothing).
                    views.setInt(bg[i], "setColorFilter", if (m.won) accent else LOST_GRAY)
                    views.setInt(bg[i], "setImageAlpha", 255)
                    views.setViewVisibility(dash[i], View.GONE)
                    views.setViewVisibility(glyph[i], View.GONE)
                    views.setViewVisibility(icon[i], View.VISIBLE)
                    views.setImageViewResource(icon[i], if (m.won) R.drawable.icon3d_badge_w else R.drawable.icon3d_badge_l)
                    views.setInt(icon[i], "setColorFilter", Color.TRANSPARENT)
                    sizeIcon(views, icon[i], badgeDp)
                } else {
                    sizeIcon(views, icon[i], ICON_DP)
                    // The "door": white ~72% tile, dashed accent border, the
                    // mode's own home-menu icon.
                    views.setInt(bg[i], "setColorFilter", Color.WHITE)
                    views.setInt(bg[i], "setImageAlpha", 184) // 0.72
                    views.setViewVisibility(dash[i], View.VISIBLE)
                    views.setInt(dash[i], "setColorFilter", withAlpha(accent, 0.55f))
                    val res = assetRes(m.iconAsset)
                    if (res != null && m.iconKind == "hand" && m.iconText != null) {
                        // Brand hand + digit overlay (iOS ModeIconView `.hand`), the
                        // digit nudged down via top padding (RemoteViews has no offset).
                        views.setViewVisibility(icon[i], View.VISIBLE)
                        views.setImageViewResource(icon[i], res)
                        views.setInt(icon[i], "setColorFilter", accent)
                        views.setViewVisibility(glyph[i], View.VISIBLE)
                        views.setTextViewText(glyph[i], m.iconText)
                        views.setTextColor(glyph[i], accent)
                        // DIP, not SP: the chip is a fixed square, so the user's
                        // font scale must not grow the digit out of it.
                        views.setTextViewTextSize(glyph[i], android.util.TypedValue.COMPLEX_UNIT_DIP, 8f)
                        views.setViewPadding(glyph[i], 0, (6f * density).toInt(), 0, 0)
                    } else if (res != null && (m.iconKind == "asset" || m.iconKind == "original" || m.iconKind == "hand")) {
                        views.setViewVisibility(glyph[i], View.GONE)
                        views.setViewVisibility(icon[i], View.VISIBLE)
                        views.setImageViewResource(icon[i], res)
                        views.setInt(icon[i], "setColorFilter", accent)
                    } else {
                        // Roman text / digit / glyph, accent, smaller when longer
                        // than 2 chars (VIII). DIP on purpose (fixed chip).
                        val t = m.iconText ?: m.glyph
                        views.setViewVisibility(icon[i], View.GONE)
                        views.setViewVisibility(glyph[i], View.VISIBLE)
                        views.setTextViewText(glyph[i], t)
                        views.setTextColor(glyph[i], accent)
                        views.setViewPadding(glyph[i], 0, 0, 0, 0)
                        views.setTextViewTextSize(
                            glyph[i], android.util.TypedValue.COMPLEX_UNIT_DIP,
                            if (t.length > 2) glyphDp * 0.75f else glyphDp,
                        )
                    }
                }
                // Every chip deep-links into that mode's daily as today (spec §5):
                // a finished one opens its solved board, like the home card.
                views.setOnClickPendingIntent(cell[i], dailyIntent(context, requestBase + i, m.key))
            }
        }

        /** The chip icon's size in the layouts (15 dp). */
        private const val ICON_DP = 15f

        /** Resizes a chip icon (API 31+ only; older launchers keep the layout's 15 dp). */
        private fun sizeIcon(views: RemoteViews, id: Int, dp: Float) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                views.setViewLayoutWidth(id, dp, android.util.TypedValue.COMPLEX_UNIT_DIP)
                views.setViewLayoutHeight(id, dp, android.util.TypedValue.COMPLEX_UNIT_DIP)
            }
        }

        private fun groupedPoints(n: Int): String =
            java.text.NumberFormat.getIntegerInstance(java.util.Locale.US).format(n.toLong())

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

        private fun nextLocalMidnightMillis(now: Calendar): Long =
            (now.clone() as Calendar).apply {
                add(Calendar.DAY_OF_YEAR, 1)
                set(Calendar.HOUR_OF_DAY, 0); set(Calendar.MINUTE, 0)
                set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0)
            }.timeInMillis

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
