package com.wordocious.app.ui

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import androidx.annotation.DrawableRes
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.painter.BitmapPainter
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.wordocious.app.R
import kotlin.math.max
import kotlin.math.roundToInt

/**
 * FINISH_SPEC BJ16 (founder 10-03: "There shouldn't be any plain text menus"): the 59 cast-color heading
 * titles (art-titlecast-<slug>, docs/design/brand/TITLE-INVENTORY.md) drawn in place of every sheet / popup /
 * page heading. [aspect] = the shipped image's width ÷ height (web lib/art.ts ART_SIZE).
 */
enum class Heading(@DrawableRes val res: Int, val label: String, val aspect: Float, val warm: Boolean = false) {
    SOLVED(R.drawable.art_titlecast_solved, "Solved!", 820f / 216f, warm = true),
    NOTTODAY(R.drawable.art_titlecast_nottoday, "Not Today", 1020f / 198f, warm = true),
    SHARE(R.drawable.art_titlecast_share, "Share", 661f / 190f, warm = true),
    SWEEP(R.drawable.art_titlecast_sweep, "Daily Sweep", 1029f / 172f, warm = true),
    OVERVIEW(R.drawable.art_titlecast_overview, "Overview", 975f / 204f),
    SHIELDS(R.drawable.art_titlecast_shields, "Shields", 839f / 204f, warm = true),
    SAVESTREAK(R.drawable.art_titlecast_savestreak, "Save Your Streak!", 1080f / 133f, warm = true),
    STREAKSAVED(R.drawable.art_titlecast_streaksaved, "Streak Saved!", 1080f / 164f, warm = true),
    PLAYEDTODAY(R.drawable.art_titlecast_playedtoday, "Played Today", 916f / 161f, warm = true),
    VSUSED(R.drawable.art_titlecast_vsused, "Daily VS Used", 932f / 162f, warm = true),
    ACHIEVEMENT(R.drawable.art_titlecast_achievement, "Achievement Unlocked!", 947f / 262f, warm = true),
    LETSPLAY(R.drawable.art_titlecast_letsplay, "Let's Play!", 785f / 136f, warm = true),
    INVITE(R.drawable.art_titlecast_invite, "Invite a Friend", 1080f / 139f, warm = true),
    EDITPROFILE(R.drawable.art_titlecast_editprofile, "Edit Profile", 907f / 160f, warm = true),
    MASCOT(R.drawable.art_titlecast_mascot, "Make Your Mascot", 1080f / 106f, warm = true),
    BOTS(R.drawable.art_titlecast_bots, "Bots", 951f / 389f),
    CHALLENGE(R.drawable.art_titlecast_challenge, "Challenge", 901f / 191f),
    FINDINGRIVAL(R.drawable.art_titlecast_findingrival, "Finding a Rival", 1080f / 167f, warm = true),
    MATCHFOUND(R.drawable.art_titlecast_matchfound, "Match Found!", 1080f / 182f, warm = true),
    WELCOMEBACK(R.drawable.art_titlecast_welcomeback, "Welcome Back!", 1080f / 170f),
    JOINTHEFUN(R.drawable.art_titlecast_jointhefun, "Join the Fun!", 1080f / 201f),
    RESETPASSWORD(R.drawable.art_titlecast_resetpassword, "Reset Password", 1080f / 159f),
    MAKEPROFILE(R.drawable.art_titlecast_makeprofile, "Make Your Profile", 1080f / 134f),
    USERNAME(R.drawable.art_titlecast_username, "Pick a Username", 1080f / 137f),
    YOUREIN(R.drawable.art_titlecast_yourein, "You're In!", 807f / 191f),
    TOUR_DAILY(R.drawable.art_titlecast_tour_daily, "Daily Games", 915f / 162f),
    TOUR_SCORE(R.drawable.art_titlecast_tour_score, "Score Big", 742f / 163f),
    TOUR_STREAK(R.drawable.art_titlecast_tour_streak, "Keep Your Streak", 1080f / 142f),
    TOUR_TOGETHER(R.drawable.art_titlecast_tour_together, "Play Together", 1080f / 163f),
    NUDGE(R.drawable.art_titlecast_nudge, "Nudge!", 760f / 197f, warm = true),
    INVITESENT(R.drawable.art_titlecast_invitesent, "Invite Sent!", 1080f / 182f, warm = true),
    NEWFRIENDS(R.drawable.art_titlecast_newfriends, "New Friends!", 1080f / 168f, warm = true),
    GIFTPRO(R.drawable.art_titlecast_giftpro, "Gift a Week of Pro", 1080f / 120f, warm = true),
    PROUNLOCKED(R.drawable.art_titlecast_prounlocked, "Pro Unlocked!", 958f / 165f, warm = true),
    INVITED(R.drawable.art_titlecast_invited, "You're Invited!", 990f / 160f, warm = true),
    YOUREPRO(R.drawable.art_titlecast_yourepro, "You're Pro", 774f / 149f),
    WELCOMEPRO(R.drawable.art_titlecast_welcomepro, "Welcome to Pro!", 1066f / 148f, warm = true),
    FREEWEEK(R.drawable.art_titlecast_freeweek, "Free Week of Pro!", 1080f / 125f, warm = true),
    PROPERK(R.drawable.art_titlecast_properk, "Pro Perk", 886f / 187f, warm = true),
    NEWPASSWORD(R.drawable.art_titlecast_newpassword, "New Password", 1080f / 149f),
    GAUNTLETCLEARED(R.drawable.art_titlecast_gauntletcleared, "Gauntlet Cleared!", 1080f / 117f, warm = true),
    LADDERCLEARED(R.drawable.art_titlecast_laddercleared, "Ladder Cleared!", 1080f / 116f, warm = true),
    ALREADYPLAYED(R.drawable.art_titlecast_alreadyplayed, "Already Played", 1080f / 117f, warm = true),
    LEVELUP(R.drawable.art_titlecast_levelup, "Level Up!", 1080f / 293f, warm = true),
    ARCHETYPES(R.drawable.art_titlecast_archetypes, "Archetypes", 1052f / 164f),
    H2H(R.drawable.art_titlecast_h2h, "Head to Head", 953f / 204f),
    TROPHYCASE(R.drawable.art_titlecast_trophycase, "Trophy Case", 1001f / 211f),
    PODIUM(R.drawable.art_titlecast_podium, "Podium", 654f / 188f),
    STREAKCAL(R.drawable.art_titlecast_streakcal, "Streak Calendar", 1017f / 163f),
    SUPPORT(R.drawable.art_titlecast_support, "Support", 877f / 204f),
    ABOUT(R.drawable.art_titlecast_about, "About", 683f / 208f),
    DELETEACCOUNT(R.drawable.art_titlecast_deleteaccount, "Delete Account", 910f / 156f),
    PROFILE(R.drawable.art_titlecast_profile, "Profile", 758f / 190f),
    PRIVATEMATCH(R.drawable.art_titlecast_privatematch, "Private Match", 1080f / 130f),
    OOPS(R.drawable.art_titlecast_oops, "Oops!", 599f / 167f, warm = true),
    NOTFOUND(R.drawable.art_titlecast_notfound, "Not Found", 936f / 158f),
    ROTATE(R.drawable.art_titlecast_rotate, "Rotate Your Phone", 1080f / 96f),
    DAILYCHALLENGE(R.drawable.art_titlecast_dailychallenge, "Daily Challenge", 1080f / 128f),
    ONASTREAK(R.drawable.art_titlecast_onastreak, "On a Streak!", 1080f / 184f),
    ;

    /** The box at [height] (≤ [maxWidth] wide), aspect kept; two-line art (aspect < 3.2) draws taller. */
    fun box(height: Dp, maxWidth: Dp): Pair<Dp, Dp> {
        val h = if (aspect < 3.2f) height * 1.3f else height
        val w = minOf(maxWidth.value, h.value * aspect)
        return w.dp to (w / aspect).dp
    }

    companion object {
        /** Sheet / popup heading height (BJ16: 44–56 dp). */
        val POPUP_HEIGHT: Dp = 48.dp
        val MAX_WIDTH: Dp = 300.dp
    }
}

/**
 * BJ16 the heading bitmaps, decoded with an inSampleSize and then scaled to the exact display
 * pixels (never the 1080 px source on screen). [prewarm] decodes the tap-presented titles off main
 * at launch (App.onCreate), so a popup never decodes its title on the frame that presents it.
 */
object HeadingArtCache {
    private val cache = object : android.util.LruCache<Long, ImageBitmap>(8 * 1024 * 1024) {
        override fun sizeOf(key: Long, value: ImageBitmap): Int = value.width * value.height * 4
    }

    fun get(context: Context, heading: Heading, widthPx: Int): ImageBitmap? {
        val key = (heading.ordinal.toLong() shl 20) or widthPx.toLong()
        cache.get(key)?.let { return it }
        val bmp = runCatching {
            val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true; inScaled = false }
            BitmapFactory.decodeResource(context.resources, heading.res, bounds)
            if (bounds.outWidth <= 0) return@runCatching null
            val src = BitmapFactory.decodeResource(
                context.resources, heading.res,
                BitmapFactory.Options().apply { inScaled = false; inSampleSize = ArtBitmaps.sampleSizeFor(bounds.outWidth, 1, widthPx) },
            ) ?: return@runCatching null
            val h = max(1, (src.height * widthPx.toFloat() / src.width).roundToInt())
            val out = if (src.width == widthPx) src else Bitmap.createScaledBitmap(src, widthPx, h, true)
            out.prepareToDraw()
            out
        }.getOrNull() ?: return null
        return bmp.asImageBitmap().also { cache.put(key, it) }
    }

    /** Decode every tap-presented heading at its popup size. Call off main. */
    fun prewarm(context: Context, density: Float) {
        for (h in Heading.entries) if (h.warm) {
            val (w, _) = h.box(Heading.POPUP_HEIGHT, Heading.MAX_WIDTH)
            get(context, h, max(1, (w.value * density).roundToInt()))
        }
    }
}

/**
 * BJ16 a heading drawn as its cast-color lettering, centered, [height] tall (≤ [maxWidth] wide, and
 * never wider than the room it is given). TalkBack reads [contentDescription] (the title text) as a heading.
 */
@Composable
fun HeadingArt(
    heading: Heading,
    modifier: Modifier = Modifier,
    height: Dp = Heading.POPUP_HEIGHT,
    maxWidth: Dp = Heading.MAX_WIDTH,
    contentDescription: String = heading.label,
    alignment: Alignment = Alignment.Center,
) {
    BoxWithConstraints(modifier.fillMaxWidth(), contentAlignment = alignment) {
        val (w, h) = heading.box(height, minOf(maxWidth, this.maxWidth))
        val context = LocalContext.current
        val px = with(LocalDensity.current) { w.roundToPx() }.coerceAtLeast(1)
        val bitmap = remember(heading, px) { HeadingArtCache.get(context, heading, px) }
        val painter = if (bitmap != null) remember(bitmap) { BitmapPainter(bitmap) } else painterResource(heading.res)
        Image(
            painter,
            contentDescription = contentDescription,
            contentScale = ContentScale.Fit,
            modifier = Modifier.size(w, h).semantics { heading() },
        )
    }
}
