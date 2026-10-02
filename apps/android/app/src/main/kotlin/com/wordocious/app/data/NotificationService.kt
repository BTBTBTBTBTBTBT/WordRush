package com.wordocious.app.data

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import com.wordocious.app.App
import com.wordocious.app.R
import io.github.jan.supabase.auth.auth
import java.util.Calendar
import java.util.concurrent.TimeUnit

/**
 * Local daily-reminder notification — Android port of iOS NotificationService
 * (which mirrors the web's daily-reminder cron as an on-device local nudge).
 * One reminder at 18:00 local, copy from core PushCopy (FINISH_SPEC AE): "Your 🔥
 * 12-day streak misses you! One quick game?" / "Today's puzzles are fresh 🌅".
 *
 * Implemented as a SELF-RESCHEDULING ONE-SHOT WorkManager chain rather than a
 * fixed-24h PeriodicWorkRequest: the worker recomputes the next wall-clock
 * 18:00 on every run, so a DST shift (or any UTC-offset change) never skews
 * the reminder to 17:00/19:00 — matching iOS's wall-clock
 * UNCalendarNotificationTrigger. [TimeChangeReceiver] re-anchors the chain on
 * timezone/clock-change broadcasts.
 */
object NotificationService {
    private const val WORK_NAME = "daily-reminder"
    private const val CHANNEL_ID = "daily-reminder"
    private const val REMINDER_HOUR = 18 // matches iOS reminderHour

    fun ensureChannel(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val mgr = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        mgr.createNotificationChannel(
            NotificationChannel(CHANNEL_ID, "Daily Reminders", NotificationManager.IMPORTANCE_DEFAULT).apply {
                description = "A daily nudge to play today's puzzles"
            }
        )
    }

    /** Milliseconds from now until the next wall-clock 18:00 in the CURRENT timezone. */
    private fun delayToNextReminderMs(): Long {
        val now = Calendar.getInstance()
        val next = (now.clone() as Calendar).apply {
            set(Calendar.HOUR_OF_DAY, REMINDER_HOUR)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
            if (timeInMillis <= now.timeInMillis) add(Calendar.DAY_OF_YEAR, 1)
        }
        return next.timeInMillis - now.timeInMillis
    }

    /** Schedule (or re-anchor) the one-shot 18:00-local reminder; the worker
     *  re-enqueues itself for the following day's 18:00 after firing. */
    fun schedule(context: Context = App.instance) {
        ensureChannel(context)
        val request = OneTimeWorkRequestBuilder<ReminderWorker>()
            .setInitialDelay(delayToNextReminderMs(), TimeUnit.MILLISECONDS)
            .build()
        WorkManager.getInstance(context)
            .enqueueUniqueWork(WORK_NAME, ExistingWorkPolicy.REPLACE, request)
    }

    fun cancel(context: Context = App.instance) {
        WorkManager.getInstance(context).cancelUniqueWork(WORK_NAME)
    }

    /**
     * U1: how many of today's 9 dailies are already done, checked AT fire time
     * (Android advantage over iOS's schedule-ahead local notifications).
     * Order: day-keyed SharedPreferences cache first (free), then a short
     * network fetch (the worker often runs in a cold process, so the Supabase
     * session is restored first so AuthService.userId resolves). ANY error or
     * timeout FAILS OPEN to 0 — a redundant reminder beats a silently missed
     * one; only a positively-confirmed full sweep skips the post.
     */
    private fun completedDailiesToday(): Int {
        val cached = runCatching { DailyCompletionsService.readCache() }.getOrElse { emptyMap() }
        if (cached.size >= DailyCompletionsService.TOTAL_DAILY_MODES) return cached.size
        val fetched = runCatching {
            kotlinx.coroutines.runBlocking {
                kotlinx.coroutines.withTimeoutOrNull(6_000L) {
                    val client = SupabaseConfig.client
                    client.auth.awaitInitialization()
                    val uid = client.auth.currentUserOrNull()?.id
                    // Cold process: profile (→ AuthService.userId) isn't loaded;
                    // fetchTodayCompletions needs it. Also refreshes the cached
                    // daily streak used for the reminder copy below.
                    if (uid != null && AuthService.userId == null) AuthService.loadProfile(uid)
                    DailyCompletionsService.fetchTodayCompletions()
                }
            }
        }.getOrNull()
        return maxOf(cached.size, fetched?.size ?: 0)
    }

    class ReminderWorker(context: Context, params: WorkerParameters) : Worker(context, params) {
        override fun doWork(): Result {
            // Respect the toggle even if a stale work request fires — and stop
            // the chain (Settings re-calls schedule() when toggled back on).
            if (!SettingsPref.get(SettingsPref.DAILY_REMINDER, false)) return Result.success()
            // ANY daily played today → the streak is already secure, so there's
            // nothing to nudge about. (Was ">= all 9", which nagged players who
            // had locked in their streak with one puzzle — and the copy below
            // told them it was at risk, which was false.) Skip the post but
            // STILL reschedule tomorrow's check.
            if (completedDailiesToday() > 0) {
                schedule(applicationContext)
                return Result.success()
            }
            // U1: name the daily-login streak when it's worth protecting (>= 3) —
            // same field the profile SnapshotHero "Daily" stat shows. In-memory
            // profile first, then the persisted copy (cold process).
            val streak = AuthService.profile.value?.dailyLoginStreak
                ?: SettingsPref.get(AuthService.CACHED_DAILY_STREAK, 0)
            // All-caps headline voice (FLAWLESS VICTORY!, DAILY SWEEP!) — Android
            // owns the notification chrome, so the branding is the icon plus the
            // voice. Kept in step with iOS NotificationService + the web cron.
            // §244: a live flawless run outranks the login streak — the harder
            // thing to lose gets the headline. Cached (day-stamped); 0 when stale.
            val flawless = MatchStatsService.cachedFlawlessStreak()
            // FINISH_SPEC AE: the streak + daily lines come from the shared cast-voice bank
            // (core PushCopy = packages/core push-copy.ts), titled with the app name so the body
            // carries the voice. The flawless-run line has no bank entry yet and keeps its copy.
            val title = when {
                flawless >= 2 -> "FLAWLESS STREAK AT RISK! 🏆"
                else -> com.wordocious.core.PushCopy.TITLE
            }
            val body = when {
                flawless >= 2 -> "$flawless straight days winning every daily. Win them all today to make it ${flawless + 1}."
                streak >= 3 -> com.wordocious.core.PushCopy.text(com.wordocious.core.PushCopy.Kind.STREAK_REMINDER, days = streak)
                else -> com.wordocious.core.PushCopy.text(com.wordocious.core.PushCopy.Kind.DAILY_READY)
            }
            ensureChannel(applicationContext)
            // FINISH_SPEC K2: the white W-mascot small icon, the brand purple accent, and a
            // cast pose as the large icon that fits the message (S racing the clock for a
            // streak at risk, O2 gasping at a flawless run on the line, W waving hello).
            val pose = when {
                flawless >= 2 -> R.drawable.art_pose_o2_gasp
                streak >= 3 -> R.drawable.art_pose_s_stopwatch
                else -> R.drawable.art_pose_w_wave
            }
            val large = runCatching { android.graphics.BitmapFactory.decodeResource(applicationContext.resources, pose) }.getOrNull()
            val notification = NotificationCompat.Builder(applicationContext, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_stat_wordocious)
                .setColor(0xFF7C3AED.toInt())
                .apply { if (large != null) setLargeIcon(large) }
                .setContentTitle(title)
                .setContentText(body)
                .setAutoCancel(true)
                .setContentIntent(
                    android.app.PendingIntent.getActivity(
                        applicationContext, 0,
                        applicationContext.packageManager.getLaunchIntentForPackage(applicationContext.packageName),
                        android.app.PendingIntent.FLAG_IMMUTABLE,
                    )
                )
                .build()
            runCatching {
                androidx.core.app.NotificationManagerCompat.from(applicationContext)
                    .notify(1001, notification)
            }
            // Self-reschedule for tomorrow's wall-clock 18:00 (recomputed in the
            // CURRENT timezone, so DST shifts re-anchor automatically). Done
            // last: REPLACE cancels the running unique work, which could
            // interrupt this thread before the notification posts.
            schedule(applicationContext)
            return Result.success()
        }
    }
}

/**
 * Re-anchors the reminder when the device timezone or clock changes — the
 * pending one-shot was enqueued with a fixed delay computed in the OLD zone.
 * Registered in the manifest for TIMEZONE_CHANGED / TIME_SET.
 */
class TimeChangeReceiver : android.content.BroadcastReceiver() {
    override fun onReceive(context: Context, intent: android.content.Intent) {
        if (intent.action != android.content.Intent.ACTION_TIMEZONE_CHANGED &&
            intent.action != android.content.Intent.ACTION_TIME_CHANGED
        ) return
        if (SettingsPref.get(SettingsPref.DAILY_REMINDER, false)) {
            NotificationService.schedule(context.applicationContext)
        }
    }
}
