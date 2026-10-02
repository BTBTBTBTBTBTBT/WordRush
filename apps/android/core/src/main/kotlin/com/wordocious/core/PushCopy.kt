package com.wordocious.core

/**
 * Push + reminder copy in the fun cast voice (docs/FINISH_SPEC.md AE): a byte-for-byte port
 * of packages/core/src/push-copy.ts, pinned by push-copy-fixtures.json. ONE bank shared by
 * the web/API server pushes and the native local reminders. Short, American spelling, no em
 * dashes.
 */
object PushCopy {
    enum class Kind(val key: String) {
        FRIEND_BEAT("friendBeat"),
        YOUR_TURN("yourTurn"),
        STREAK_REMINDER("streakReminder"),
        SHIELD_USED("shieldUsed"),
        CHALLENGE_RECEIVED("challengeReceived"),
        FRIEND_REQUEST("friendRequest"),
        GIFT_RECEIVED("giftReceived"),
        DAILY_READY("dailyReady"),
    }

    /** Each push's body template. {name} = the sender, {game} = the game's display name, {days} = streak days. */
    val BANK: Map<Kind, String> = mapOf(
        Kind.FRIEND_BEAT to "{name} just beat your {game} time ⚡ Your move!",
        Kind.YOUR_TURN to "{name} played. Your turn! 🎯",
        Kind.STREAK_REMINDER to "Your 🔥 {days}-day streak misses you! One quick game?",
        Kind.SHIELD_USED to "A shield saved your streak 🛡️ Phew!",
        Kind.CHALLENGE_RECEIVED to "{name} challenged you to {game} ⚔️",
        Kind.FRIEND_REQUEST to "{name} wants to be friends! 🎉",
        Kind.GIFT_RECEIVED to "{name} gifted you a week of Pro 🎁",
        Kind.DAILY_READY to "Today's puzzles are fresh 🌅",
    )

    /** The push's title line (the app name, so the body carries the voice). */
    const val TITLE = "Wordocious"

    fun kindOf(key: String): Kind? = Kind.entries.firstOrNull { it.key == key }

    /** The body for a push: the template with {name} / {game} / {days} filled ("A friend" when no name). */
    fun text(kind: Kind, name: String? = null, game: String? = null, days: Int? = null): String =
        BANK.getValue(kind)
            .replace("{name}", (name ?: "").trim().ifEmpty { "A friend" })
            .replace("{game}", (game ?: "").trim().ifEmpty { "Wordocious" })
            .replace("{days}", (days ?: 0).toString())
}
