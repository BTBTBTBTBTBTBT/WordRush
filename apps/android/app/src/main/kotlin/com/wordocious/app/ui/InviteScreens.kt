package com.wordocious.app.ui

// Pure helpers behind the friend-invite and gift-a-week-of-Pro screens
// (docs/FINISH_SPEC.md T1–T4; ui/InviteFinish.kt). No Compose, no Android:
// JVM-tested in InviteScreensTest. Twin of web lib/invite-screens.ts.
object InviteScreens {
    /** Gift-Pro invites a Pro player can have out at once (the referral program's slots). */
    const val GIFT_SLOTS = 3

    /** Days of Pro a gift unlocks. */
    const val GIFT_DAYS = 7

    /** An invite code split into the glossy letter tiles it is shown on (T1): uppercase letters and digits only. */
    fun codeTiles(code: String?): List<String> =
        (code ?: "").uppercase().filter { it in 'A'..'Z' || it in '0'..'9' }.map { it.toString() }

    /** The invite code at the end of an invite link (`…/vs/join/AB12CD` → `AB12CD`), or null. */
    fun codeFromInviteUrl(url: String?): String? =
        Regex("""/join/([A-Za-z0-9]+)/?(?:[?#].*)?$""").find(url ?: "")?.groupValues?.get(1)?.uppercase()

    /** Gift slots still free, from the count of open (pending, unexpired) gifts. */
    fun giftsLeft(openCount: Int, slots: Int = GIFT_SLOTS): Int =
        (slots - openCount.coerceAtLeast(0)).coerceIn(0, slots)

    /** [accepted] = watched requests that became friends (celebrate once); [watch] = ids to keep watching. */
    data class Tracked(val accepted: List<String>, val watch: List<String>)

    /**
     * The inviter's side of T3: which watched outgoing requests turned into friends,
     * and the ids to keep watching (every still-outgoing request). A watched id that
     * is neither still outgoing nor a friend was declined or canceled and is dropped.
     * Ids compare case-insensitively; returned ids keep their first spelling.
     */
    fun trackRequests(watched: List<String>, outgoing: Collection<String>, friends: Collection<String>): Tracked {
        val out = outgoing.mapTo(HashSet()) { it.lowercase() }
        val fr = friends.mapTo(HashSet()) { it.lowercase() }
        val wasWatched = watched.mapTo(HashSet()) { it.lowercase() }
        val accepted = ArrayList<String>()
        val watch = ArrayList<String>()
        val seen = HashSet<String>()
        for (id in watched + outgoing) {
            val k = id.lowercase()
            if (!seen.add(k)) continue
            if (k in fr) {
                if (k in wasWatched) accepted += id
            } else if (k in out) {
                watch += id
            }
        }
        return Tracked(accepted, watch)
    }

    /** The watched-requests list from storage (comma-separated; anything blank → empty; capped at 200). */
    fun parseWatched(raw: String?): List<String> =
        (raw ?: "").split(',').map { it.trim() }.filter { it.isNotEmpty() }.take(200)

    /** The watched-requests list for storage. */
    fun formatWatched(ids: List<String>): String = ids.take(200).joinToString(",")
}
