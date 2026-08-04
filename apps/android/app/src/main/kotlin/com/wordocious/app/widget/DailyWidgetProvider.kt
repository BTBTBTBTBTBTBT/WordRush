package com.wordocious.app.widget

import android.app.AlarmManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.SystemClock
import android.view.View
import android.widget.RemoteViews
import com.wordocious.app.MainActivity
import com.wordocious.app.R
import java.util.Calendar

/**
 * "Daily Puzzles" home-screen widget — the Android twin of iOS
 * WordociousWidget.swift v2 (medium family): themed header, 5x2 mode-chip
 * grid, footer strip (wordmark · stats · live countdown to local midnight).
 *
 * Classic RemoteViews on purpose: the countdown is a Chronometer with
 * isCountDown — the one RemoteViews element that ticks every second without
 * waking the app (Glance has no equivalent) — and each unplayed chip carries
 * its own PendingIntent deep-linking into that mode's daily.
 *
 * Time-dependent looks (at-risk after 20:00, fresh after midnight, the
 * "3H LEFT" pill) flip via inexact AlarmManager broadcasts at the next of
 * 20/21/22/23/00 local — the RemoteViews analog of iOS's pre-scheduled
 * timeline entries. updatePeriodMillis (30 min) is the belt-and-braces
 * fallback (missed alarm, reboot).
 */
class DailyWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(context: Context, mgr: AppWidgetManager, ids: IntArray) {
        render(context, mgr, ids)
        scheduleNextFlip(context)
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

        // ── Theme (WidgetTheme.from, ported rule-for-rule) ──────────────────

        enum class Theme { FLAWLESS, SWEEP, MIDDAY, AT_RISK, FRESH }

        fun themeFrom(snap: WidgetBridge.Snapshot, now: Calendar): Theme {
            val played = snap.modes.count { it.played }
            if (snap.modes.isNotEmpty() && played >= snap.modes.size) {
                return if (snap.modes.all { it.won }) Theme.FLAWLESS else Theme.SWEEP
            }
            if (played == 0) {
                // Evening with a live streak and zero plays → nag. A zero streak
                // has nothing to lose, so it stays on the invitation look.
                val hour = now.get(Calendar.HOUR_OF_DAY)
                return if (hour >= 20 && snap.streak > 0) Theme.AT_RISK else Theme.FRESH
            }
            return Theme.MIDDAY
        }

        // Exact iOS hexes.
        private const val PURPLE = 0xFF7C3AED.toInt()          // #7c3aed
        private const val BRAND_LEAD = 0xFFA78BFA.toInt()      // #a78bfa (gradient lead — see note)
        private const val AMBER_LEAD = 0xFFD97706.toInt()      // #d97706
        private const val AMBER_DEEP = 0xFFB45309.toInt()      // #b45309
        private const val RISK_LEAD = 0xFFF59E0B.toInt()       // #f59e0b
        private const val MINT = 0xFF10B981.toInt()            // #10b981
        private const val MIDDAY_ICON = 0xFFC4A9FB.toInt()     // #c4a9fb
        private const val TEXT_SECONDARY = 0xFF6B7280.toInt()  // ≈ .secondary
        /** iOS Color.gray (#8E8E93) at 55% — applied via SRC_ATOP over the white
         *  chip fill, which composites to the same gray iOS shows over its bg. */
        private val LOST_GRAY = Color.argb(140, 142, 142, 147)

        private fun hex(s: String): Int =
            runCatching { Color.parseColor(if (s.startsWith("#")) s else "#$s") }.getOrDefault(PURPLE)

        private fun withAlpha(color: Int, alpha: Float): Int =
            Color.argb((alpha * 255).toInt(), Color.red(color), Color.green(color), Color.blue(color))

        // Cell view ids, grid order (0–8 modes, 9 = themed extra cell).
        private val CELL = intArrayOf(
            R.id.w_cell0, R.id.w_cell1, R.id.w_cell2, R.id.w_cell3, R.id.w_cell4,
            R.id.w_cell5, R.id.w_cell6, R.id.w_cell7, R.id.w_cell8, R.id.w_cell9,
        )
        private val CELL_BG = intArrayOf(
            R.id.w_cell0_bg, R.id.w_cell1_bg, R.id.w_cell2_bg, R.id.w_cell3_bg, R.id.w_cell4_bg,
            R.id.w_cell5_bg, R.id.w_cell6_bg, R.id.w_cell7_bg, R.id.w_cell8_bg, R.id.w_cell9_bg,
        )
        private val CELL_DASH = intArrayOf(
            R.id.w_cell0_dash, R.id.w_cell1_dash, R.id.w_cell2_dash, R.id.w_cell3_dash, R.id.w_cell4_dash,
            R.id.w_cell5_dash, R.id.w_cell6_dash, R.id.w_cell7_dash, R.id.w_cell8_dash, R.id.w_cell9_dash,
        )
        private val CELL_ICON = intArrayOf(
            R.id.w_cell0_icon, R.id.w_cell1_icon, R.id.w_cell2_icon, R.id.w_cell3_icon, R.id.w_cell4_icon,
            R.id.w_cell5_icon, R.id.w_cell6_icon, R.id.w_cell7_icon, R.id.w_cell8_icon, R.id.w_cell9_icon,
        )
        private val CELL_GLYPH = intArrayOf(
            R.id.w_cell0_glyph, R.id.w_cell1_glyph, R.id.w_cell2_glyph, R.id.w_cell3_glyph, R.id.w_cell4_glyph,
            R.id.w_cell5_glyph, R.id.w_cell6_glyph, R.id.w_cell7_glyph, R.id.w_cell8_glyph, R.id.w_cell9_glyph,
        )
        private val CELL_LABEL = intArrayOf(
            R.id.w_cell0_label, R.id.w_cell1_label, R.id.w_cell2_label, R.id.w_cell3_label, R.id.w_cell4_label,
            R.id.w_cell5_label, R.id.w_cell6_label, R.id.w_cell7_label, R.id.w_cell8_label, R.id.w_cell9_label,
        )

        /** Snapshot iconAsset → bundled drawable (the SAME assets the home menu
         *  uses; keep in step with ui.modeIconRes). null → ModeGlyph textGlyph
         *  fallback, exactly like iOS. */
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
            else -> null
        }

        // ── Render ──────────────────────────────────────────────────────────

        fun render(context: Context, mgr: AppWidgetManager, ids: IntArray) {
            val snap = WidgetBridge.loadSnapshot(context)
            val now = Calendar.getInstance()
            val theme = themeFrom(snap, now)
            for (id in ids) mgr.updateAppWidget(id, build(context, snap, theme, now))
        }

        private fun build(
            context: Context,
            snap: WidgetBridge.Snapshot,
            theme: Theme,
            now: Calendar,
        ): RemoteViews {
            val views = RemoteViews(context.packageName, R.layout.widget_daily)
            val done = snap.modes.count { it.played }

            // Themed background (gradient fill + 2.5dp gradient frame + halo,
            // baked into per-theme layer-list drawables).
            views.setInt(R.id.widget_root, "setBackgroundResource", when (theme) {
                Theme.FLAWLESS -> R.drawable.widget_bg_flawless
                Theme.SWEEP -> R.drawable.widget_bg_sweep
                Theme.MIDDAY -> R.drawable.widget_bg_midday
                Theme.AT_RISK -> R.drawable.widget_bg_atrisk
                Theme.FRESH -> R.drawable.widget_bg_fresh
            })

            renderHeader(views, snap, theme, now)
            renderCells(context, views, snap, theme, done)
            renderFooter(views, snap, theme, done, now)

            // Anywhere that isn't a chip opens the app plainly.
            views.setOnClickPendingIntent(R.id.widget_root, openAppIntent(context, 0))
            return views
        }

        private fun renderHeader(views: RemoteViews, snap: WidgetBridge.Snapshot, theme: Theme, now: Calendar) {
            // Gradient text is impossible in RemoteViews — titles use the
            // gradient's LEADING color (documented compromise vs iOS).
            data class H(val title: String, val titleColor: Int, val icon: Int, val iconColor: Int, val trailing: Boolean)
            val h = when (theme) {
                Theme.FLAWLESS -> H("FLAWLESS VICTORY!", AMBER_LEAD, R.drawable.ic_w_trophy, AMBER_DEEP, true)
                Theme.SWEEP -> H("DAILY SWEEP!", BRAND_LEAD, R.drawable.ic_w_sparkles, PURPLE, true)
                Theme.MIDDAY -> H("DAILY PUZZLES", BRAND_LEAD, R.drawable.ic_w_sparkles, MIDDAY_ICON, true)
                Theme.AT_RISK -> H("STREAK AT RISK", RISK_LEAD, R.drawable.ic_w_warning, RISK_LEAD, false)
                Theme.FRESH -> H("FRESH PUZZLES!", MINT, R.drawable.ic_w_sparkles, MINT, true)
            }
            views.setTextViewText(R.id.w_title, h.title)
            views.setTextColor(R.id.w_title, h.titleColor)
            views.setImageViewResource(R.id.w_icon_lead, h.icon)
            views.setInt(R.id.w_icon_lead, "setColorFilter", h.iconColor)
            views.setImageViewResource(R.id.w_icon_trail, h.icon)
            views.setInt(R.id.w_icon_trail, "setColorFilter", h.iconColor)
            views.setViewVisibility(R.id.w_icon_trail, if (h.trailing) View.VISIBLE else View.GONE)

            // StreakBadge (flame + count) sits at the trailing edge everywhere.
            views.setTextViewText(R.id.w_streak, "${snap.streak}")

            // "3H LEFT" pill — at-risk only; the hourly 20–23h alarms keep it honest.
            if (theme == Theme.AT_RISK) {
                val secs = ((nextLocalMidnightMillis(now) - now.timeInMillis) / 1000).coerceAtLeast(0)
                val hours = Math.ceil(secs / 3600.0).toInt()
                views.setTextViewText(R.id.w_pill, if (hours <= 1) "LAST HOUR" else "${hours}H LEFT")
                views.setViewVisibility(R.id.w_pill, View.VISIBLE)
            } else {
                views.setViewVisibility(R.id.w_pill, View.GONE)
            }
        }

        private fun renderCells(
            context: Context,
            views: RemoteViews,
            snap: WidgetBridge.Snapshot,
            theme: Theme,
            done: Int,
        ) {
            for (i in 0 until 9) {
                val m = snap.modes.getOrNull(i) ?: continue
                val accent = hex(m.colorHex)
                views.setTextViewText(CELL_LABEL[i], m.title)
                views.setTextColor(CELL_LABEL[i], TEXT_SECONDARY)
                if (m.played) {
                    // Solid accent tile + white check (gray tile + x when lost).
                    views.setInt(CELL_BG[i], "setColorFilter", if (m.won) accent else LOST_GRAY)
                    views.setInt(CELL_BG[i], "setImageAlpha", 255)
                    views.setViewVisibility(CELL_DASH[i], View.GONE)
                    views.setViewVisibility(CELL_GLYPH[i], View.GONE)
                    views.setViewVisibility(CELL_ICON[i], View.VISIBLE)
                    views.setImageViewResource(CELL_ICON[i], if (m.won) R.drawable.ic_w_check else R.drawable.ic_w_x)
                    views.setInt(CELL_ICON[i], "setColorFilter", Color.WHITE)
                    views.setOnClickPendingIntent(CELL[i], openAppIntent(context, 1 + i))
                } else {
                    // The "door": white ~72% tile, dashed accent border, the
                    // mode's own home-menu icon — a tap target into that daily.
                    views.setInt(CELL_BG[i], "setColorFilter", Color.WHITE)
                    views.setInt(CELL_BG[i], "setImageAlpha", 184) // 0.72
                    views.setViewVisibility(CELL_DASH[i], View.VISIBLE)
                    views.setInt(CELL_DASH[i], "setColorFilter", withAlpha(accent, 0.55f))
                    val res = assetRes(m.iconAsset)
                    val density = context.resources.displayMetrics.density
                    if (res != null && m.iconKind == "hand" && m.iconText != null) {
                        // Brand hand + digit overlay (iOS ModeIconView `.hand`):
                        // the icon ImageView and glyph TextView share the chip
                        // FrameLayout, so both can show at once — accent hand
                        // line-art with the accent digit centered over the palm,
                        // nudged down via top padding (RemoteViews has no offset).
                        views.setViewVisibility(CELL_ICON[i], View.VISIBLE)
                        views.setImageViewResource(CELL_ICON[i], res)
                        views.setInt(CELL_ICON[i], "setColorFilter", accent)
                        views.setViewVisibility(CELL_GLYPH[i], View.VISIBLE)
                        views.setTextViewText(CELL_GLYPH[i], m.iconText)
                        views.setTextColor(CELL_GLYPH[i], accent)
                        // DIP, not SP: the chip is a fixed 32dp square, so the
                        // user's font scale must not grow the digit out of it.
                        views.setTextViewTextSize(CELL_GLYPH[i], android.util.TypedValue.COMPLEX_UNIT_DIP, 9f)
                        views.setViewPadding(CELL_GLYPH[i], 0, (7f * density).toInt(), 0, 0)
                    } else if (res != null && (m.iconKind == "asset" || m.iconKind == "original" || m.iconKind == "hand")) {
                        views.setViewVisibility(CELL_GLYPH[i], View.GONE)
                        views.setViewVisibility(CELL_ICON[i], View.VISIBLE)
                        views.setImageViewResource(CELL_ICON[i], res)
                        views.setInt(CELL_ICON[i], "setColorFilter", accent)
                    } else {
                        // ModeGlyph.textGlyph: roman text / digit / glyph, accent,
                        // smaller when longer than 2 chars (VIII). DIP on purpose —
                        // fixed 32dp chip, font scale must not overflow it.
                        val t = m.iconText ?: m.glyph
                        views.setViewVisibility(CELL_ICON[i], View.GONE)
                        views.setViewVisibility(CELL_GLYPH[i], View.VISIBLE)
                        views.setTextViewText(CELL_GLYPH[i], t)
                        views.setTextColor(CELL_GLYPH[i], accent)
                        views.setTextViewTextSize(
                            CELL_GLYPH[i], android.util.TypedValue.COMPLEX_UNIT_DIP,
                            if (t.length > 2) 10f else 13f,
                        )
                    }
                    // Deep link into that mode's daily; ProperNoundle has no
                    // programmatic daily launch path (iOS parity) → plain open.
                    views.setOnClickPendingIntent(
                        CELL[i],
                        if (m.key != "PROPERNOUNDLE") dailyIntent(context, 1 + i, m.key)
                        else openAppIntent(context, 1 + i),
                    )
                }
            }

            // 10th cell, by theme: celebration when swept, remaining count
            // mid-day, the shield stash when the streak's on the line, sparkle at dawn.
            val i = 9
            data class X(val icon: Int, val tint: Int, val label: String)
            val x = when (theme) {
                Theme.FLAWLESS, Theme.SWEEP -> X(R.drawable.ic_w_party, PURPLE, "Done!")
                Theme.MIDDAY -> X(R.drawable.ic_w_hourglass, PURPLE, "${snap.modes.size - done} left")
                Theme.AT_RISK -> X(
                    R.drawable.ic_shield, AMBER_LEAD,
                    if ((snap.shields ?: 0) > 0) "${snap.shields} shields" else "No shields",
                )
                Theme.FRESH -> X(R.drawable.ic_w_sparkles, MINT, "${snap.modes.size} to play")
            }
            views.setInt(CELL_BG[i], "setColorFilter", withAlpha(x.tint, 0.12f))
            views.setInt(CELL_BG[i], "setImageAlpha", 255)
            views.setViewVisibility(CELL_DASH[i], View.GONE)
            views.setViewVisibility(CELL_GLYPH[i], View.GONE)
            views.setViewVisibility(CELL_ICON[i], View.VISIBLE)
            views.setImageViewResource(CELL_ICON[i], x.icon)
            views.setInt(CELL_ICON[i], "setColorFilter", x.tint)
            views.setTextViewText(CELL_LABEL[i], x.label)
            views.setTextColor(CELL_LABEL[i], TEXT_SECONDARY)
            views.setOnClickPendingIntent(CELL[i], openAppIntent(context, 10))
        }

        private fun renderFooter(
            views: RemoteViews,
            snap: WidgetBridge.Snapshot,
            theme: Theme,
            done: Int,
            now: Calendar,
        ) {
            val points = groupedPoints(snap.points ?: 0)
            views.setTextViewText(R.id.w_stat, when (theme) {
                Theme.FLAWLESS, Theme.SWEEP -> "${mmss(snap.seconds ?: 0)} · $points pts"
                Theme.MIDDAY -> "$done/${snap.modes.size} · $points pts"
                Theme.AT_RISK -> "Play 1 to keep the streak"
                Theme.FRESH -> "A brand-new board awaits"
            })

            // The live countdown: android.widget.Chronometer counting down to
            // local midnight — ticks every second with zero refresh budget.
            val tint = if (theme == Theme.AT_RISK) AMBER_LEAD else PURPLE
            views.setInt(R.id.w_hourglass, "setColorFilter", tint)
            views.setTextColor(R.id.w_countdown, tint)
            val remainingMs = nextLocalMidnightMillis(now) - System.currentTimeMillis()
            views.setChronometerCountDown(R.id.w_countdown, true)
            views.setChronometer(R.id.w_countdown, SystemClock.elapsedRealtime() + remainingMs, null, true)
        }

        private fun groupedPoints(n: Int): String =
            java.text.NumberFormat.getIntegerInstance(java.util.Locale.US).format(n.toLong())

        private fun mmss(seconds: Int): String = "%d:%02d".format(seconds / 60, seconds % 60)

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

        // ── Timed state flips (the RemoteViews timeline) ────────────────────

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

        /** Inexact alarm at the next of 20:00/21:00/22:00/23:00/00:00 local —
         *  each firing re-renders and schedules the next (no exact-alarm
         *  permission needed; a few minutes of drift is fine for a look flip). */
        fun scheduleNextFlip(context: Context) {
            val now = Calendar.getInstance()
            val candidates = (20..23).map { h ->
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
