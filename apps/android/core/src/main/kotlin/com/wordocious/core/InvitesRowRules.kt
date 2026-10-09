package com.wordocious.core

/**
 * The Invites row's data rules (FRIDAY-QUEUE 9f), mirrored from apps/web/lib/invites-row.ts
 * (pinned by InvitesRowRulesTest): merge pending live VS invites and incoming race-my-run
 * challenges into one newest-first list, minus the ones the player declined on this device.
 */
data class InviteRowItem(
    val variant: Variant,
    val code: String,
    /** GameMode name (e.g. "DUEL"). */
    val gameMode: String,
    val sender: String,
    val senderId: String,
    val raceLine: String? = null,
    /** match_invites.id (live only), for the decline write. */
    val inviteId: String? = null,
    val createdAtMs: Long,
) {
    enum class Variant { LIVE, RACE }
    val key: String get() = "${variant.name.lowercase()}:$code"
}

object InvitesRowRules {
    const val DISMISSED_KEY = "wr_dismissed_invites"

    fun build(items: List<InviteRowItem>, dismissed: Collection<String>): List<InviteRowItem> {
        val gone = dismissed.map { it.uppercase() }.toSet()
        return items.filter { it.code.uppercase() !in gone }.sortedByDescending { it.createdAtMs }
    }

    /** "solved in 4 · 1:12" or "a run to beat" (core raceLine). */
    fun raceLine(solved: Boolean, guesses: Int, timeMs: Long): String {
        if (!solved) return "a run to beat"
        val total = maxOf(0, Math.round(timeMs / 1000.0).toInt())
        return "solved in $guesses · ${total / 60}:${(total % 60).toString().padStart(2, '0')}"
    }
}
