package com.wordocious.app.data

import android.content.ClipData
import android.content.ClipboardManager
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import android.provider.Telephony
import android.widget.Toast
import com.wordocious.core.ShareChannelId
import com.wordocious.core.ShareSheetChannel

/**
 * The share sheet's channel mechanics (docs/review/share-sheet-plan.md §2, Android column).
 *
 * Every app channel is `ACTION_SEND image/png` + `setPackage(app)` + EXTRA_STREAM (the FileProvider uri from
 * [ShareHelper.writePng]) + ClipData + a read grant, plus `EXTRA_TEXT` only when the model's channel carries a
 * `text` (X: caption + tracked link; Messages / WhatsApp / Facebook are the picture alone, FINISH_SPEC S1).
 * Copy link = the clipboard, Save image = MediaStore, More = the system chooser. A channel whose app is not
 * installed is hidden ([isAvailable]); the matching `<queries>` entries are in the manifest.
 */
object ShareChannels {
    const val WHATSAPP = "com.whatsapp"
    const val X = "com.twitter.android"
    const val FACEBOOK = "com.facebook.katana"

    /** The app a package channel targets (messages = the default SMS app, looked up at send time). */
    private fun packageFor(context: Context, id: ShareChannelId): String? = when (id) {
        ShareChannelId.MESSAGES -> runCatching { Telephony.Sms.getDefaultSmsPackage(context) }.getOrNull()
        ShareChannelId.WHATSAPP -> WHATSAPP
        ShareChannelId.X -> X
        ShareChannelId.FACEBOOK -> FACEBOOK
        else -> null
    }

    private fun installed(context: Context, pkg: String): Boolean = runCatching {
        context.packageManager.getLaunchIntentForPackage(pkg) != null
    }.getOrDefault(false)

    /** Whether the tile shows on this device (apps hide when not installed; Save needs MediaStore scoped storage). */
    fun isAvailable(context: Context, id: ShareChannelId): Boolean = when (id) {
        ShareChannelId.COPY, ShareChannelId.MORE -> true
        ShareChannelId.SAVE -> Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
        ShareChannelId.MESSAGES, ShareChannelId.WHATSAPP, ShareChannelId.X, ShareChannelId.FACEBOOK ->
            packageFor(context, id)?.let { installed(context, it) } == true
        else -> false
    }

    /** The image intent for an app channel, or null when its app is missing. */
    fun appIntent(context: Context, channel: ShareSheetChannel, uri: Uri): Intent? {
        val pkg = packageFor(context, channel.id) ?: return null
        val intent = Intent(Intent.ACTION_SEND).apply {
            type = "image/png"
            setPackage(pkg)
            putExtra(Intent.EXTRA_STREAM, uri)
            channel.text?.let { putExtra(Intent.EXTRA_TEXT, it) }
            clipData = ClipData.newUri(context.contentResolver, "Wordocious", uri)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        // An explicit package never resolves a chooser, so grant the app its read up front.
        runCatching { context.grantUriPermission(pkg, uri, Intent.FLAG_GRANT_READ_URI_PERMISSION) }
        return intent
    }

    /** Launches an app channel; false (and a toast) when the app refuses. */
    fun sendToApp(context: Context, channel: ShareSheetChannel, uri: Uri): Boolean {
        val intent = appIntent(context, channel, uri) ?: return false
        return runCatching { context.startActivity(intent); true }.getOrElse {
            Toast.makeText(context, "${channel.label} couldn't open", Toast.LENGTH_SHORT).show()
            false
        }
    }

    /** Copy link: the tracked link to the clipboard + a toast (Android 13+ also shows its own preview). */
    fun copyLink(context: Context, link: String): Boolean {
        val cm = context.getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager ?: return false
        cm.setPrimaryClip(ClipData.newPlainText("Wordocious", link))
        Toast.makeText(context, "Link copied", Toast.LENGTH_SHORT).show()
        return true
    }

    /** Save image: MediaStore insert into Pictures/Wordocious (API 29+, no permission). */
    fun saveImage(context: Context, bitmap: Bitmap, name: String): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return false
        val resolver = context.contentResolver
        val values = ContentValues().apply {
            put(MediaStore.Images.Media.DISPLAY_NAME, name)
            put(MediaStore.Images.Media.MIME_TYPE, "image/png")
            put(MediaStore.Images.Media.RELATIVE_PATH, "Pictures/Wordocious")
            put(MediaStore.Images.Media.IS_PENDING, 1)
        }
        val uri = runCatching { resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values) }.getOrNull() ?: return false
        val ok = runCatching {
            resolver.openOutputStream(uri)?.use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) } == true
        }.getOrDefault(false)
        if (!ok) { runCatching { resolver.delete(uri, null, null) }; return false }
        runCatching {
            resolver.update(uri, ContentValues().apply { put(MediaStore.Images.Media.IS_PENDING, 0) }, null, null)
        }
        Toast.makeText(context, "Saved to Photos", Toast.LENGTH_SHORT).show()
        return true
    }

    /** More: the system chooser with the image only (today's path). */
    fun more(context: Context, uri: Uri, title: String): Boolean = runCatching {
        context.startActivity(Intent.createChooser(ShareHelper.imageIntent(context, listOf(uri)), title).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_GRANT_READ_URI_PERMISSION)
        })
        true
    }.getOrDefault(false)
}
