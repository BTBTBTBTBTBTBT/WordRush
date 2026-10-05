package com.wordocious.app.data

/**
 * FINISH_SPEC BF1 (founder 10-02: "I never know when I get achievements"): achievements awarded
 * anywhere — this game's client check, the server, a cron, another device — celebrate ONCE.
 * On launch and on every return to the foreground the user's earned keys are diffed against a
 * locally stored "seen" set; unseen ones queue the unlock popup (oldest first) and become seen.
 * The very first run of this logic seeds "seen" with everything already earned (no flood).
 */
object AchievementSeen {
    private fun prefKey(userId: String) = "achievements-seen-v1:$userId"

    /** The outcome of one diff: what to celebrate (in order) and the new seen set. */
    data class Diff(val celebrate: List<String>, val seen: Set<String>)

    /**
     * Pure: [earned] (key → unlocked-at, ISO, sortable) against [seen] (null = never seeded).
     * First run → nothing to celebrate, everything seen. Otherwise every unseen key, oldest
     * first (key order breaks ties), and the union as the new seen set.
     */
    fun diff(earned: Map<String, String>, seen: Set<String>?): Diff {
        if (seen == null) return Diff(emptyList(), earned.keys)
        val fresh = earned.entries.filter { it.key !in seen }
            .sortedWith(compareBy<Map.Entry<String, String>> { it.value }.thenBy { it.key })
            .map { it.key }
        return Diff(fresh, seen + earned.keys)
    }

    fun load(userId: String): Set<String>? {
        val raw = SettingsPref.get(prefKey(userId), "\u0000")
        if (raw == "\u0000") return null
        return raw.split(',').filter { it.isNotBlank() }.toSet()
    }

    fun save(userId: String, seen: Set<String>) = SettingsPref.set(prefKey(userId), seen.sorted().joinToString(","))

    /** The signed-in player's seen set right now (empty when signed out / never seeded). */
    fun seenNow(): Set<String> = AuthService.userId?.let { load(it) }.orEmpty()

    /** A client-side unlock was just queued: it never celebrates again from the diff. */
    fun markSeen(keys: Collection<String>) {
        val uid = AuthService.userId ?: return
        val cur = load(uid) ?: return // not seeded yet: the next diff seeds everything anyway
        save(uid, cur + keys)
    }

    /** Fetch + diff + queue (launch / foreground). Network failures change nothing. */
    suspend fun check() {
        val uid = AuthService.userId ?: return
        val earned = AchievementService.fetchEarnedOrNull(uid) ?: return
        val d = diff(earned, load(uid))
        save(uid, d.seen)
        com.wordocious.app.ui.BadgeMoments.unlockedCount = earned.size
        // A SYNC source is always late: it waits for a calm moment (CelebrationGate, 2026-10-03).
        if (d.celebrate.isNotEmpty()) com.wordocious.app.ui.BadgeMoments.achievements(
            d.celebrate, fromDiff = true,
            late = CelebrationGate.isLate(CelebrationGate.Source.SYNC, 0L, System.currentTimeMillis()),
        )
    }
}
