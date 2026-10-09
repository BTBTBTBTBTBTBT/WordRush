package com.wordocious.app.data

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RadialGradient
import android.graphics.RectF
import android.graphics.Shader
import com.wordocious.app.R
import com.wordocious.core.ShareHero

/**
 * Item 46: the share cards' HERO BAND, drawn. The SENDER's own mascot (the one avatar resolver), big and posed by the
 * result (core [ShareHero]: cheer + crown on a win, jump on a gold glow for a flawless, a good-sport shrug on a loss, a
 * wave otherwise), on a soft glow (gold for a flawless, orange in the Halloween season). A photo avatar shows as its
 * framed portrait (ShareAvatars). A guest has no band. Static: a share image is rendered once.
 */
object ShareHeroArt {
    /** A signed-in player (or an explicit owner) has a mascot to celebrate with; a guest's card has no band. */
    fun available(userId: String?, username: String?): Boolean =
        userId != null || username != null || AuthService.profile.value != null

    fun draw(context: Context, c: Canvas, result: ShareHero.Result, top: Float, userId: String?, username: String?) {
        val p = AuthService.profile.value
        val uid = userId ?: p?.id
        val name = username ?: p?.username
        val halloween = com.wordocious.app.ui.SeasonSkins.current() == "halloween"
        val spec = ShareHero.spec(result, halloween)
        val cx = ShareCard.W / 2f
        val h = ShareHero.HEIGHT
        val cy = top + h / 2f
        val glow = runCatching { Color.parseColor(spec.glow) }.getOrDefault(0xFFA78BFA.toInt())

        // The soft glow behind the mascot.
        val r = h * 0.62f
        val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            shader = RadialGradient(
                cx, cy, r,
                intArrayOf(withAlpha(glow, 0.55f), withAlpha(glow, 0.18f), withAlpha(glow, 0f)),
                floatArrayOf(0f, 0.55f, 1f), Shader.TileMode.CLAMP,
            )
        }
        c.drawCircle(cx, cy, r, paint)
        if (spec.gold) {
            val ring = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                style = Paint.Style.STROKE; strokeWidth = 8f; color = withAlpha(0xFFF59E0B.toInt(), 0.85f)
            }
            c.drawCircle(cx, cy, h * 0.47f, ring)
        }

        // The mascot, posed (a cutout: no tile). A photo avatar falls back to ShareAvatars' framed portrait.
        val side = h * 0.9f
        val left = cx - side / 2f
        val mTop = cy - side / 2f
        runCatching {
            val resolved = PlayerAvatars.resolve(AvatarFields(userId = uid, username = name))
            if (resolved.photoUrl != null) {
                ShareAvatars.draw(context, c, cx - side * 0.4f, cy - side * 0.4f, side * 0.8f, uid, name)
            } else {
                val cfg = resolved.config.copy(pose = spec.pose)
                val key = com.wordocious.app.ui.MascotKey.of(
                    cfg, MascotConfigRules.initialOf(name), 200f, side.toInt().coerceAtLeast(1), dark = false,
                    cutout = true, forcePose = true,
                )
                com.wordocious.app.ui.MascotComposer.draw(context, c, left, mTop, side, key)
            }
        }
        if (spec.crown) {
            val cw = h * 0.3f
            val ox = cx + side * 0.12f
            val oy = top + h * 0.02f
            c.save()
            c.rotate(-7f, ox + cw / 2f, oy + cw / 2f)
            ShareFinish.drawArtInto(context, c, R.drawable.icon3d_crown, RectF(ox, oy, ox + cw, oy + cw))
            c.restore()
        }
    }

    private fun withAlpha(color: Int, a: Float): Int =
        Color.argb((a * 255f).toInt().coerceIn(0, 255), Color.red(color), Color.green(color), Color.blue(color))
}
