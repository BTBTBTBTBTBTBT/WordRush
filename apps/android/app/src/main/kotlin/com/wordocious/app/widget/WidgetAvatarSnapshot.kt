package com.wordocious.app.widget

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.graphics.asAndroidBitmap
import com.wordocious.app.data.AuthService
import com.wordocious.app.data.AvatarDirectoryRules
import com.wordocious.app.data.HomeHostPick
import com.wordocious.app.data.MascotConfigRules
import com.wordocious.app.data.PlayerAvatars
import com.wordocious.app.ui.MascotComposer
import com.wordocious.app.ui.homeHostMascotKey
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.FlowPreview
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.debounce
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.util.concurrent.atomic.AtomicBoolean

/**
 * FINISH_SPEC BI13c (founder 10-03: "put the player's own mascot … on the widgets"), the iOS
 * WidgetAvatarSnapshot twin. RemoteViews can't compose avatars, so the app renders the player's
 * look ONCE into its files dir and the widget only draws that PNG:
 *  • a custom mascot → a full-body CUTOUT (the Home host's key: `cutout = true`, no tile,
 *    backdrop or frame) → [MASCOT_FILE];
 *  • an uploaded photo → the photo whole in its tier frame (never on a body) → [PHOTO_FILE];
 *  • guests / no custom look → neither (the widget keeps W).
 * Re-rendered on launch and on every own-look change; widgets re-render only when bytes change.
 */
object WidgetAvatarSnapshot {
    const val MASCOT_FILE = "widget-avatar-mascot.png"
    const val PHOTO_FILE = "widget-avatar-photo.png"
    private const val SIDE = 256

    private val started = AtomicBoolean(false)
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    private fun dir(context: Context) = File(context.filesDir, "widget").apply { mkdirs() }

    /** The pre-rendered own look (bitmap, isPhoto), or null → W / the cast. */
    fun load(context: Context): Pair<Bitmap, Boolean>? {
        val d = File(context.filesDir, "widget")
        for ((name, photo) in listOf(MASCOT_FILE to false, PHOTO_FILE to true)) {
            val f = File(d, name)
            if (f.exists()) BitmapFactory.decodeFile(f.path)?.let { return it to photo }
        }
        return null
    }

    @OptIn(FlowPreview::class)
    fun start(context: Context) {
        if (!started.compareAndSet(false, true)) return
        val app = context.applicationContext
        scope.launch {
            // The same pick the Good Morning host draws (snapshot state: an edit re-emits).
            val pick = snapshotFlow {
                val p = AuthService.profile.value
                if (p == null) HomeHostPick.W
                else AvatarDirectoryRules.hostPick(PlayerAvatars.ownFields(), level = p.level, pro = AuthService.isProActive)
            }
            pick.combine(AuthService.profile) { k, p -> k to p?.username }
                .distinctUntilChanged()
                .debounce(800)
                .collect { (k, name) -> runCatching { refresh(app, k, name) } }
        }
    }

    private suspend fun refresh(context: Context, pick: HomeHostPick, username: String?) {
        val (bmp, file) = when (pick) {
            HomeHostPick.W -> null to null
            is HomeHostPick.Mascot -> {
                val key = homeHostMascotKey(pick.config, MascotConfigRules.initialOf(username), SIDE, dark = false)
                MascotComposer.compose(context, key).asAndroidBitmap() to MASCOT_FILE
            }
            is HomeHostPick.Portrait -> (framedPhoto(context, pick.url, pick.frame) ?: return) to PHOTO_FILE
        }
        val png = bmp?.let { b -> java.io.ByteArrayOutputStream().also { b.compress(Bitmap.CompressFormat.PNG, 100, it) }.toByteArray() }
        var changed = false
        for (name in listOf(MASCOT_FILE, PHOTO_FILE)) {
            val f = File(dir(context), name)
            if (name == file && png != null) {
                if (!f.exists() || !f.readBytes().contentEquals(png)) {
                    val tmp = File(f.path + ".tmp")
                    tmp.writeBytes(png)
                    tmp.renameTo(f)
                    changed = true
                }
            } else if (f.exists()) {
                f.delete(); changed = true
            }
        }
        if (changed) withContext(Dispatchers.Main) { WidgetBridge.push(context) }
    }

    /** The Home host's portrait: the photo whole as a rounded square, inset by its frame. */
    private suspend fun framedPhoto(context: Context, url: String, frame: String?): Bitmap? {
        val req = coil.request.ImageRequest.Builder(context).data(url).allowHardware(false).size(SIDE).build()
        val res = coil.Coil.imageLoader(context).execute(req) as? coil.request.SuccessResult ?: return null
        val photo = (res.drawable as? android.graphics.drawable.BitmapDrawable)?.bitmap ?: return null
        val s = SIDE.toFloat()
        val out = Bitmap.createBitmap(SIDE, SIDE, Bitmap.Config.ARGB_8888)
        val c = Canvas(out)
        val drawn = frame?.takeIf { MascotComposer.frameColors(it) != null }
        val inset = if (drawn != null) MascotComposer.frameWidth(s) * 0.85f else 0f
        val inner = RectF(inset, inset, s - inset, s - inset)
        c.save()
        c.clipPath(Path().apply { val r = inner.width() * 0.22f; addRoundRect(inner, r, r, Path.Direction.CW) })
        // Center-crop the photo into the square.
        val side = minOf(photo.width, photo.height)
        val src = android.graphics.Rect((photo.width - side) / 2, (photo.height - side) / 2, (photo.width + side) / 2, (photo.height + side) / 2)
        c.drawBitmap(photo, src, inner, Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG))
        c.restore()
        if (drawn != null) MascotComposer.drawFrame(c, drawn, s, context)
        return out
    }
}
