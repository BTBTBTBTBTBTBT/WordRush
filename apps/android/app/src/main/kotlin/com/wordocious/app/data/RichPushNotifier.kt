package com.wordocious.app.data

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.PorterDuff
import android.graphics.PorterDuffXfermode
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.app.Person
import androidx.core.content.FileProvider
import androidx.core.graphics.drawable.IconCompat
import com.wordocious.app.MainActivity
import com.wordocious.app.R
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

/**
 * Rich push, the Android half (FRIDAY-QUEUE item 34; iOS: WordociousPushService + WordociousPushContent).
 *
 * The server sends a DATA-ONLY message (`rich=1`) to builds that registered with device_tokens.rich_push, so
 * this builds the notification itself:
 *   - MessagingStyle with the FRIEND as a [Person]: their mascot (circular bitmap) is the avatar, the
 *     person's name is the server's title ("Ava played Hubbub", <= 28 chars, reads complete), the body is
 *     the detail. The game's art rides in the expanded view as the conversation's inline image.
 *   - accent color per game (the server picks it; Halloween orange in season), the monochrome W small icon
 *     (Halloween witch-hat variant in season)
 *   - grouping: one group per thread (friend / game) with a summary; the notification id comes from the
 *     thread, so rapid-fire moves in one game REPLACE each other instead of piling up
 *   - one tap opens the exact game (the `url` extra MainActivity already routes), plus a Play action
 */
object RichPushNotifier {
    private const val CHANNEL_ID = "friends-play"

    /**
     * What a rich data message carries, read defensively (item 39): a key an older server never sent is its default, a key
     * a newer server added is ignored, a color that doesn't parse is the brand purple, a non-https image is no image.
     * Pure, so the JVM tests can pin it (OldVersionCompatAppTest).
     */
    data class Fields(
        val title: String, val body: String, val url: String, val thread: String, val senderId: String,
        val gameId: String, val halloween: Boolean, val accent: Int, val senderAvatar: String?, val gameImage: String?,
    ) {
        companion object {
            const val BRAND_PURPLE = 0xFF7C3AED.toInt()

            /** "#rrggbb" to an opaque ARGB int; null when it isn't one. */
            fun parseHex(raw: String?): Int? {
                val s = raw?.trim()?.removePrefix("#") ?: return null
                if (s.length != 6) return null
                return s.toIntOrNull(16)?.let { 0xFF000000.toInt() or it }
            }

            private fun https(raw: String?): String? = raw?.trim()?.takeIf { it.startsWith("https://") && it.length > "https://".length }

            fun from(data: Map<String, String>): Fields = Fields(
                title = data["title"].orEmpty().ifBlank { "Wordocious" },
                body = data["body"].orEmpty(),
                url = data["url"].orEmpty(),
                thread = data["thread"].orEmpty().ifBlank { "wordocious" },
                senderId = data["senderId"].orEmpty(),
                gameId = data["gameId"].orEmpty(),
                halloween = data["halloween"] == "1",
                accent = parseHex(data["accent"]) ?: BRAND_PURPLE,
                senderAvatar = https(data["senderAvatar"]),
                gameImage = https(data["gameImage"]),
            )
        }
    }

    private fun ensureChannel(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val mgr = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        mgr.createNotificationChannel(
            NotificationChannel(CHANNEL_ID, "Friends and games", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "Your turn, challenges and reactions from friends"
            },
        )
    }

    /** Builds + posts the notification from an FCM data map. Blocking (two short downloads): call off the main thread. */
    fun show(context: Context, data: Map<String, String>) {
        if (!NotificationManagerCompat.from(context).areNotificationsEnabled()) return
        ensureChannel(context)

        val f = Fields.from(data)
        val title = f.title
        val body = f.body
        val url = f.url
        val thread = f.thread
        val senderId = f.senderId
        val halloween = f.halloween
        val accent = f.accent

        val avatar = download(f.senderAvatar)?.let { circle(it) }
        val gameArt = download(f.gameImage)

        val sender = Person.Builder()
            .setName(title)   // the person's name IS the complete title line
            .setKey(senderId.ifBlank { thread })
            .apply { avatar?.let { setIcon(IconCompat.createWithBitmap(it)) } }
            .build()
        val me = Person.Builder().setName("You").build()

        val style = NotificationCompat.MessagingStyle(me)
            .addMessage(NotificationCompat.MessagingStyle.Message(body, System.currentTimeMillis(), sender))
        // The game's art as the inline image of the message (rendered in the expanded notification).
        inlineImageUri(context, gameArt, f.gameId)?.let { uri ->
            style.addMessage(NotificationCompat.MessagingStyle.Message("", System.currentTimeMillis(), sender).setData("image/png", uri))
        }

        val id = thread.hashCode()   // one slot per thread: rapid-fire moves in a game replace each other
        val open = PendingIntent.getActivity(
            context, id,
            Intent(context, MainActivity::class.java)
                .setAction(Intent.ACTION_MAIN)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
                .putExtra("url", url),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val group = "wordocious-$thread"
        val small = if (halloween) R.drawable.ic_stat_wordocious_halloween else R.drawable.ic_stat_wordocious

        val n = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(small)
            .setColor(accent)
            .setStyle(style)
            .setContentTitle(title)
            .setContentText(body)
            .apply { avatar?.let { setLargeIcon(it) } }
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setGroup(group)
            .setAutoCancel(true)
            .setContentIntent(open)
            .addAction(0, "Play", open)
            .build()

        // The summary lets several friends' pushes bundle (Android 7+ groups by this key).
        val summary = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(small)
            .setColor(accent)
            .setStyle(NotificationCompat.InboxStyle().setSummaryText("Wordocious"))
            .setGroup(group)
            .setGroupSummary(true)
            .setAutoCancel(true)
            .setContentIntent(open)
            .build()

        runCatching {
            val nm = NotificationManagerCompat.from(context)
            nm.notify(id, n)
            nm.notify(group.hashCode(), summary)
        }
    }

    // ── Images ──────────────────────────────────────────────────────────

    private fun download(url: String?): Bitmap? {
        if (url.isNullOrBlank() || !url.startsWith("https://")) return null
        return runCatching {
            val conn = URL(url).openConnection() as HttpURLConnection
            conn.connectTimeout = 8000
            conn.readTimeout = 8000
            try {
                if (conn.responseCode != 200) null else conn.inputStream.use { BitmapFactory.decodeStream(it) }
            } finally {
                conn.disconnect()
            }
        }.getOrNull()
    }

    /** A circular crop for the Person icon (the mascot is a rounded square; the system masks it anyway). */
    private fun circle(src: Bitmap): Bitmap {
        val size = minOf(src.width, src.height)
        val out = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
        val c = Canvas(out)
        val p = Paint(Paint.ANTI_ALIAS_FLAG)
        c.drawCircle(size / 2f, size / 2f, size / 2f, p)
        p.xfermode = PorterDuffXfermode(PorterDuff.Mode.SRC_IN)
        c.drawBitmap(src, (size - src.width) / 2f, (size - src.height) / 2f, p)
        return out
    }

    /** Writes the game art under cacheDir/push and returns a FileProvider uri System UI may read, or null. */
    private fun inlineImageUri(context: Context, art: Bitmap?, gameId: String): Uri? {
        if (art == null) return null
        return runCatching {
            val dir = File(context.cacheDir, "push").apply { mkdirs() }
            val safe = gameId.filter { it.isLetterOrDigit() || it == '-' || it == '_' }.ifBlank { "game" }
            val file = File(dir, "game-$safe.png")
            file.outputStream().use { art.compress(Bitmap.CompressFormat.PNG, 100, it) }
            val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
            context.grantUriPermission("com.android.systemui", uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
            uri
        }.getOrNull()
    }
}
