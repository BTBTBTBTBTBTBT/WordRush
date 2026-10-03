package com.wordocious.app.data

/**
 * Referral CREDIT notices on the "Gift a week of Pro" card (founder 10-03: "I need to be able to
 * X that so it goes away"): the inviter's settled rows ("<name> joined! +3 days", "<name>
 * subscribed! …") each get a dismiss X, plus a quiet "Clear all" at 2+. A dismissal sticks across
 * relaunches (a per-user local list keyed by the referral id, in SettingsPref) and devices (the
 * server flag via /api/referrals/dismiss). Mirrors web lib/referral-credits.ts + iOS ReferralCredits.
 */
object ReferralCredits {
    fun isCredit(status: String): Boolean = status == "redeemed" || status == "converted"

    fun showClearAll(statuses: List<String>): Boolean = statuses.count(::isCredit) >= 2

    fun key(userId: String): String = "referral-credits-dismissed:$userId"

    /** The stored list ("id,id,…") → set. */
    fun decode(raw: String?): Set<String> = raw.orEmpty().split(',').map { it.trim() }.filter { it.isNotEmpty() }.toSet()

    /** Adds [ids] to [raw] (keeps the newest 200) → the new stored string. */
    fun encode(raw: String?, ids: Collection<String>): String {
        val list = raw.orEmpty().split(',').map { it.trim() }.filter { it.isNotEmpty() }.toMutableList()
        for (id in ids) if (id !in list && ',' !in id) list += id
        return list.takeLast(200).joinToString(",")
    }

    fun read(userId: String): Set<String> = decode(SettingsPref.get(key(userId), ""))

    fun write(userId: String, ids: Collection<String>): Set<String> {
        val next = encode(SettingsPref.get(key(userId), ""), ids)
        SettingsPref.set(key(userId), next)
        return decode(next)
    }
}
