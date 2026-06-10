package com.wordocious.app.data

import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Columns
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Streak-shield logic — Android port of web lib/shield-service.ts.
 * A streak is "at risk" when >20h have passed since last play AND the local
 * calendar day rolled over; using a shield decrements streak_shields and
 * refreshes last_played_at so the streak survives.
 */
object ShieldService {
    private val client get() = SupabaseConfig.client

    fun isStreakAtRisk(lastPlayedAt: String?): Boolean {
        if (lastPlayedAt == null) return false
        return runCatching {
            val last = java.time.Instant.parse(
                if (lastPlayedAt.endsWith("Z") || lastPlayedAt.contains('+')) lastPlayedAt else lastPlayedAt + "Z",
            )
            val hoursSince = java.time.Duration.between(last, java.time.Instant.now()).toMinutes() / 60.0
            if (hoursSince > 20) {
                val lastLocalDay = last.atZone(java.time.ZoneId.systemDefault()).toLocalDate().toString()
                lastLocalDay != com.wordocious.app.todayLocalDate()
            } else {
                false
            }
        }.getOrDefault(false)
    }

    @Serializable
    private data class ShieldRow(
        @SerialName("streak_shields") val shields: Int = 0,
    )

    /** Spend one shield to preserve the streak. Returns true on success. */
    suspend fun useShield(userId: String): Boolean = runCatching {
        val p = client.postgrest["profiles"]
            .select(Columns.raw("streak_shields")) { filter { eq("id", userId) }; limit(1) }
            .decodeSingleOrNull<ShieldRow>() ?: return false
        if (p.shields <= 0) return false
        client.postgrest["profiles"].update({
            set("streak_shields", p.shields - 1)
            set("last_played_at", java.time.Instant.now().toString())
        }) { filter { eq("id", userId) } }
        true
    }.getOrDefault(false)

    /** Decline: let the streak reset (web sets daily_login_streak = 0). */
    suspend fun declineStreak(userId: String) {
        runCatching {
            client.postgrest["profiles"].update({ set("daily_login_streak", 0) }) {
                filter { eq("id", userId) }
            }
        }
    }
}
