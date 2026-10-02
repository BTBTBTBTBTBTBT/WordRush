package com.wordocious.app.ui

import androidx.annotation.DrawableRes
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.Dp
import com.wordocious.app.R

// FINISH_SPEC AL addendum 2 (founder 10-02: "I don't want any of those phone emojis …
// match the aesthetic"): no system emoji as icons anywhere in the app UI. Every spot
// that used to print an emoji (🔥 🏆 🛡 👑 ✓ ✗ ⭐ ⚡ 🥇 🥈 🥉 💎 🔒 ⚔️ 🎯 🎉 …) draws one
// of these instead: the 3D icon set or the badge / medal art, decorative (the text
// beside it carries the meaning for TalkBack). Emoji stay only in plain-text channels
// (share caption text, push text), player-chosen avatar emoji and the stored reaction
// glyphs — guarded by NoEmojiInUiTest.

/** The art that stands in for a UI emoji. */
enum class GlyphArt(@DrawableRes val res: Int) {
    FLAME(R.drawable.icon3d_flame),
    TROPHY(R.drawable.icon3d_trophy),
    SHIELD(R.drawable.icon3d_shield),
    CROWN(R.drawable.icon3d_crown),
    CHECK(R.drawable.icon3d_badge_check),
    MISS(R.drawable.icon3d_badge_l),
    LOCK(R.drawable.icon3d_lock),
    BELL(R.drawable.icon3d_bell),
    /** Points / stars: the new gold star. */
    STAR(R.drawable.art_badge_icon_star_sprite),
    /** Speed / time stats: the gold bolt. */
    ZAP(R.drawable.art_badge_icon_zap_sprite),
    GOLD(R.drawable.art_medal_gold),
    SILVER(R.drawable.art_medal_silver),
    BRONZE(R.drawable.art_medal_bronze),
    MEDAL(R.drawable.art_badge_medal),
    DIAMOND(R.drawable.art_badge_level_diamond),
    SWORDS(R.drawable.art_badge_swords),
    TARGET(R.drawable.art_badge_target),
    SPARKLES(R.drawable.art_badge_sparkles),
    TRENDING(R.drawable.art_badge_trending_up),
    CALENDAR(R.drawable.art_badge_calendar),
    GRID(R.drawable.art_badge_grid);

    companion object {
        /** Podium place 1/2/3 -> gold / silver / bronze medal art (else null). */
        fun medal(place: Int): GlyphArt? = when (place) { 1 -> GOLD; 2 -> SILVER; 3 -> BRONZE; else -> null }
    }
}

/** One [GlyphArt] at [size]; decorative unless [contentDescription] labels it. */
@Composable
fun GlyphArtImage(glyph: GlyphArt, size: Dp, modifier: Modifier = Modifier, contentDescription: String? = null) {
    Image(painterResource(glyph.res), contentDescription = contentDescription, modifier = modifier.size(size))
}

/** A code-drawn soft color swatch (the 🟩 / 🟨 legend squares, in our tile colors). */
@Composable
fun GlyphSwatch(color: Color, size: Dp, modifier: Modifier = Modifier) {
    Box(modifier.size(size).background(color, RoundedCornerShape(size * 0.28f)))
}

/** The emoji test shared by [withoutEmoji] and NoEmojiInUiTest: pictographs, dingbats, symbols, VS16 / ZWJ. */
object EmojiRanges {
    fun isEmoji(cp: Int): Boolean =
        cp in 0x1F000..0x1FAFF || // pictographs, emoticons, transport, symbols & pictographs ext.
            cp in 0x2600..0x27BF || // misc symbols + dingbats (★ ✓ ✗ ⚡ ⚔ ✅ ❌ ✨ …)
            cp in 0x2300..0x23FF || // misc technical (⏰ ⏱ ⌛)
            cp in 0x2B00..0x2BFF || // ⬛ ⭐ …
            cp == 0xFE0F || cp == 0x200D || cp == 0x20E3 || // presentation selector, ZWJ, keycap
            cp in 0x1F1E6..0x1F1FF // regional indicators (flags)
}

/**
 * [text] with its emoji removed (the in-app rendering of copy that also travels as a
 * plain-text message, e.g. the canned taunts): "🧹 Swept it." → "Swept it.".
 */
fun withoutEmoji(text: String): String {
    val sb = StringBuilder()
    var i = 0
    while (i < text.length) {
        val cp = text.codePointAt(i)
        if (!EmojiRanges.isEmoji(cp)) sb.appendCodePoint(cp)
        i += Character.charCount(cp)
    }
    return sb.toString().replace(Regex(" {2,}"), " ").trim()
}
