package com.wordocious.app.data

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
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
 * One repeating reminder at 18:00 local: "Your daily puzzles are ready — keep
 * your streak alive! 🔥". Scheduled with WorkManager (survives reboot).
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

    /** Schedule (or reschedule) the repeating 18:00-local reminder. */
    fun schedule(context: Context = App.instance) {
        ensureChannel(context)
        val now = Calendar.getInstance()
        val next = (now.clone() as Calendar).apply {
            set(Calendar.HOUR_OF_DAY, REMINDER_HOUR)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0)
            if (timeInMillis <= now.timeInMillis) add(Calendar.DAY_OF_YEAR, 1)
        }
        val request = PeriodicWorkRequestBuilder<ReminderWorker>(1, TimeUnit.DAYS)
            .setInitialDelay(next.timeInMillis - now.timeInMillis, TimeUnit.MILLISECONDS)
            .build()
        WorkManager.getInstance(context)
            .enqueueUniquePeriodicWork(WORK_NAME, ExistingPeriodicWorkPolicy.UPDATE, request)
    }

    fun cancel(context: Context = App.instance) {
        WorkManager.getInstance(context).cancelUniqueWork(WORK_NAME)
    }

    class ReminderWorker(context: Context, params: WorkerParameters) : Worker(context, params) {
        override fun doWork(): Result {
            // Respect the toggle even if a stale work request fires.
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
            return Result.success()
        }
    }
}
