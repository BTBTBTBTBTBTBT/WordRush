package com.wordocious.core

/**
 * Branded one-link invites (FRIDAY-QUEUE 9f) — mirrored 1:1 from packages/core/src/branded-invite.ts
 * (pinned by BrandedInviteTest). Gate: FlagsService.isLive(BrandedInvite.SWITCH_KEY).
 *
 *   wordocious.com/vs/<CODE>      a live VS invite OR a race-my-run challenge
 *   wordocious.com/friend/<CODE>  a friend / gift invite (the referral code)
 */
object BrandedInvite {
    const val SWITCH_KEY = "branded_invites"
    const val ORIGIN = "https://wordocious.com"
    const val ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    const val VS_CODE_LENGTH = 8
    val RESERVED_VS_SEGMENTS = listOf("bots", "live", "join", "challenge", "friend")

    enum class Kind { VS, FRIEND }
    data class Parsed(val kind: Kind, val code: String)

    /** Uppercase, keep only letters and digits. */
    fun clean(raw: String?): String = (raw ?: "").uppercase().filter { it in 'A'..'Z' || it in '0'..'9' }

    fun isVsCode(code: String): Boolean = code.length == VS_CODE_LENGTH && code.all { it in ALPHABET }
    fun isFriendCode(code: String): Boolean = code.length in 4..16 && code.all { it in 'A'..'Z' || it in '2'..'9' }

    fun url(kind: Kind, code: String): String = "$ORIGIN/${if (kind == Kind.VS) "vs" else "friend"}/${clean(code)}"

    /** A bare path segment that is a branded VS code (and not a static /vs page). */
    fun isBrandedVsCode(segment: String): Boolean =
        segment.lowercase() !in RESERVED_VS_SEGMENTS && isVsCode(clean(segment))

    /** Accepts the one-link form and the old forms (/vs/join/<CODE>, /vs/challenge/<CODE>, /join/<CODE>). */
    fun parse(input: String): Parsed? {
        var path = input.trim()
        Regex("^https?://(www\\.)?wordocious\\.com", RegexOption.IGNORE_CASE).find(path)?.let {
            path = path.substring(it.range.last + 1).ifEmpty { "/" }
        }
        path = path.substringBefore('?').substringBefore('#')
        val parts = path.split('/').filter { it.isNotEmpty() }
        if (parts.size == 2 && parts[0].lowercase() == "vs") {
            if (parts[1].lowercase() in RESERVED_VS_SEGMENTS) return null
            val code = clean(parts[1])
            return if (isVsCode(code)) Parsed(Kind.VS, code) else null
        }
        if (parts.size == 3 && parts[0].lowercase() == "vs" && parts[1].lowercase() in listOf("join", "challenge")) {
            val code = clean(parts[2])
            return if (isVsCode(code)) Parsed(Kind.VS, code) else null
        }
        if (parts.size == 2 && parts[0].lowercase() in listOf("friend", "join")) {
            val code = clean(parts[1])
            return if (isFriendCode(code)) Parsed(Kind.FRIEND, code) else null
        }
        return null
    }

    /** "Have a code?": a bare VS code or any invite link. */
    fun parseTyped(input: String): Parsed? {
        parse(input)?.let { return it }
        val code = clean(input)
        return if (isVsCode(code)) Parsed(Kind.VS, code) else null
    }

    enum class Variant { LIVE, RACE, FRIEND }

    /** The short text beside the link (no separate code line). */
    fun shareLine(v: Variant, sender: String, game: String? = null): String {
        val g = game ?: "a game"
        return when (v) {
            Variant.LIVE -> "$sender wants to race you in $g"
            Variant.RACE -> "$sender challenged you to beat their $g run"
            Variant.FRIEND -> "$sender invited you to Wordocious"
        }
    }
}
