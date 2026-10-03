package com.wordocious.app.data

import android.content.Context
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import com.wordocious.core.AvatarConfig

/**
 * FINISH_SPEC BJ5 — share images draw THE resolved avatar too (PlayerAvatars → core
 * resolveAvatar): a bot keeps its cast art; a player's custom photo when it can be drawn
 * synchronously (Coil's disk cache already holds it from the screen), else their mascot
 * (always light, the offscreen MascotComposer). Rounded square (AN6), never a letter tile.
 */
object ShareAvatars {
    /** The resolved mascot config for a share (never null; photo players get their mascot's config). */
    fun mascotConfig(userId: String?, username: String?, castId: String? = null): AvatarConfig =
        PlayerAvatars.resolve(AvatarFields(userId = userId, username = username, castId = castId)).config

    /**
     * Draw [username]'s avatar [d] px square at ([left], [top]). [avatarUrl] "bot:<id>" draws
     * the bot's art; [castId] (when given) is an explicit worn hero for the row.
     */
    fun draw(
        context: Context, c: Canvas, left: Float, top: Float, d: Float,
        userId: String?, username: String?, avatarUrl: String? = null, castId: String? = null,
    ) {
        val dst = RectF(left, top, left + d, top + d)
        if (avatarUrl?.startsWith("bot:") == true) {
            ShareFinish.drawArtInto(context, c, BotArt.res(avatarUrl.removePrefix("bot:")), dst)
            return
        }
        val resolved = PlayerAvatars.resolve(AvatarFields(userId = userId, username = username, avatarUrl = avatarUrl, castId = castId))
        val photo = resolved.photoUrl?.let { url -> runCatching { cachedPhoto(context, url) }.getOrNull() }
        if (photo != null) {
            // BJ5 photo rule: a framed PORTRAIT (never on a mascot body) — the chosen frame, else
            // the signed-in player's tier frame; the photo sits inside the frame.
            val own = PlayerAvatars.isOwn(userId, username)
            val frame = AvatarDirectoryRules.portraitFrame(
                resolved.config.frame, pro = false, level = if (own) AuthService.profile.value?.level else null,
            )
            val inset = if (frame != null) com.wordocious.app.ui.MascotComposer.frameWidth(d) * 0.85f else 0f
            val inner = RectF(dst.left + inset, dst.top + inset, dst.right - inset, dst.bottom - inset)
            c.save()
            val r = inner.width() * 0.22f
            c.clipPath(Path().apply { addRoundRect(inner, r, r, Path.Direction.CW) })
            // Center-crop the photo into the square.
            val s = minOf(photo.width, photo.height)
            val src = android.graphics.Rect((photo.width - s) / 2, (photo.height - s) / 2, (photo.width + s) / 2, (photo.height + s) / 2)
            c.drawBitmap(photo, src, inner, Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG))
            c.restore()
            if (frame != null) {
                c.save(); c.translate(left, top)
                com.wordocious.app.ui.MascotComposer.drawFrame(c, frame, d, context)
                c.restore()
            }
            return
        }
        val key = com.wordocious.app.ui.MascotKey.of(
            resolved.config, MascotConfigRules.initialOf(username), 200f, d.toInt().coerceAtLeast(1), dark = false,
        )
        com.wordocious.app.ui.MascotComposer.draw(context, c, left, top, d, key)
    }

    /** The photo from Coil's disk cache (the on-screen avatar loaded it), or null — never a network wait. */
    private fun cachedPhoto(context: Context, url: String): android.graphics.Bitmap? {
        val cache = coil.Coil.imageLoader(context).diskCache ?: return null
        val snap = cache.openSnapshot(url) ?: return null
        return snap.use { BitmapFactory.decodeFile(it.data.toFile().absolutePath) }
    }
}
