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
import java.util.Calendar
import java.util.concurrent.TimeUnit

/**
 * Local daily-reminder notification — Android port of iOS NotificationService
 * (which mirrors the web's daily-reminder cron as an on-device local nudge).
 * One reminder at 18:00 local: "Your daily puzzles are ready — keep your
 * streak alive! 🔥".
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

    class ReminderWorker(context: Context, params: WorkerParameters) : Worker(context, params) {
        override fun doWork(): Result {
            // Respect the toggle even if a stale work request fires — and stop
            // the chain (Settings re-calls schedule() when toggled back on).
            if (!SettingsPref.get(SettingsPref.DAILY_REMINDER, false)) return Result.success()
            ensureChannel(applicationContext)
            val notification = NotificationCompat.Builder(applicationContext, CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle("Wordocious")
                .setContentText("Your daily puzzles are ready — keep your streak alive! 🔥")
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
