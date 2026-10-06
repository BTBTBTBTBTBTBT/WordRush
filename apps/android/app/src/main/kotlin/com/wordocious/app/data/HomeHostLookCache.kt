package com.wordocious.app.data

import com.wordocious.core.AvatarConfig
import com.wordocious.core.avatarToJson
import com.wordocious.core.validateAvatar
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

// Founder (2.7.1): "the purple guy populates the main square during the intro and then it just
// changes suddenly to your mascot. Can that always just be populated by your mascot?"
//
// The Good Morning host's last known look for the signed-in player, persisted locally
// (SettingsPref), so the very first frame — under the cold-start intro — is their own host:
//  • written whenever the live own look resolves (a fresh profile load, a Dressing Room /
//    Edit Profile save via PlayerAvatars.patchOwn) — HomeHostPrewarm runs the writer;
//  • read at launch, honored only for the same user id once the id is known;
//  • cleared on sign-out (AuthService.clearSignedInState) and when no session restores.
// Pure rules (which look shows, crossfade or not, the stored shape) live in [HomeHostLookRules]
// (HomeHostLookRulesTest).

/** One persisted host look: whose it is, the name its mascot initial reads, and the pick. */
data class CachedHostLook(val userId: String, val username: String?, val pick: HomeHostPick)

/** What the host draws this frame. [inviteAllowed] false = no "Make me yours!" bubble yet (look unknown). */
data class HomeHostDecision(
    val pick: HomeHostPick,
    val username: String?,
    val inviteAllowed: Boolean,
    val fromCache: Boolean,
)

/** Pure, JVM-testable rules for the host look cache. */
object HomeHostLookRules {
    /** The soft swap when the live look differs from the one on screen (never a hard pop). */
    const val CROSSFADE_MS = 200

    const val PREF_KEY = "home-host-look-v1"

    private const val KIND_PHOTO = "photo"
    private const val KIND_MASCOT = "mascot"
    private const val KIND_PLAIN = "plain"

    private val json = Json { ignoreUnknownKeys = true; isLenient = true }

    /** The cache entry counts for [userId] (null = not known yet → the last signed-in player's). */
    fun honors(cache: CachedHostLook, userId: String?): Boolean {
        val id = AvatarDirectoryRules.idKey(userId) ?: return true
        return AvatarDirectoryRules.idKey(cache.userId) == id
    }

    /**
     * Which host to draw.
     *  • guests → W (the invite rule itself keeps guests bubble-free);
     *  • the live look is known ([loaded]: a fresh profile load this launch) → the live pick;
     *  • still loading → the cached look for this user; else a custom look the launch-painted
     *    profile row already shows; else the plain W with NO bubble until we know.
     * [live] is the pick derived from the current profile (possibly the launch-painted row),
     * null when there is no profile yet.
     */
    fun decide(
        cache: CachedHostLook?,
        live: HomeHostPick?,
        liveUserId: String?,
        liveUsername: String?,
        loaded: Boolean,
        guest: Boolean,
    ): HomeHostDecision {
        if (guest) return HomeHostDecision(HomeHostPick.W, null, inviteAllowed = true, fromCache = false)
        if (loaded) return HomeHostDecision(live ?: HomeHostPick.W, liveUsername, inviteAllowed = true, fromCache = false)
        val honored = cache?.takeIf { honors(it, liveUserId) }
        if (honored != null) {
            return HomeHostDecision(honored.pick, liveUsername ?: honored.username, inviteAllowed = true, fromCache = true)
        }
        if (live != null && live !is HomeHostPick.W) return HomeHostDecision(live, liveUsername, inviteAllowed = true, fromCache = false)
        return HomeHostDecision(HomeHostPick.W, liveUsername, inviteAllowed = false, fromCache = false)
    }

    /** A soft crossfade only when a host is already on screen and the next one differs. */
    fun crossfades(shown: HomeHostPick?, next: HomeHostPick): Boolean = shown != null && shown != next

    /** Whether a newly resolved live look needs writing (first write, other user, or a change). */
    fun needsWrite(stored: CachedHostLook?, next: CachedHostLook): Boolean = stored != next

    fun encode(look: CachedHostLook): String = buildJsonObject {
        put("v", 1)
        put("uid", look.userId)
        look.username?.let { put("name", it) }
        when (val p = look.pick) {
            is HomeHostPick.Portrait -> {
                put("kind", KIND_PHOTO)
                put("url", p.url)
                p.frame?.let { put("frame", it) }
            }
            is HomeHostPick.Mascot -> {
                put("kind", KIND_MASCOT)
                put("config", avatarToJson(p.config))
            }
            HomeHostPick.W -> put("kind", KIND_PLAIN)
        }
    }.toString()

    /** The stored entry, or null for "" / malformed / an unknown shape. */
    fun decode(text: String?): CachedHostLook? {
        val t = text?.trim()?.takeIf { it.isNotEmpty() } ?: return null
        val o = runCatching { json.parseToJsonElement(t) }.getOrNull() as? JsonObject ?: return null
        fun str(k: String) = (o[k] as? JsonPrimitive)?.takeIf { it.isString }?.content
        val uid = str("uid")?.takeIf { it.isNotBlank() } ?: return null
        val pick = when (str("kind")) {
            KIND_PHOTO -> HomeHostPick.Portrait(str("url")?.takeIf { it.isNotBlank() } ?: return null, str("frame"))
            // AvatarConfig() as the fallback: the integrated parts a config omits read "none", as stored.
            KIND_MASCOT -> HomeHostPick.Mascot(validateAvatar(o["config"] as? JsonObject ?: return null, AvatarConfig()))
            KIND_PLAIN -> HomeHostPick.W
            else -> return null
        }
        return CachedHostLook(uid, str("name"), pick)
    }
}

/** The SettingsPref-backed cache (one slot: the last signed-in player's look, with their id). */
object HomeHostLookCache {
    @Volatile private var memo: Pair<String, CachedHostLook?>? = null

    fun read(): CachedHostLook? = runCatching {
        val raw = SettingsPref.get(HomeHostLookRules.PREF_KEY, "")
        memo?.takeIf { it.first == raw }?.second ?: HomeHostLookRules.decode(raw).also { memo = raw to it }
    }.getOrNull()

    fun write(look: CachedHostLook) {
        if (!HomeHostLookRules.needsWrite(read(), look)) return
        runCatching {
            val raw = HomeHostLookRules.encode(look)
            SettingsPref.set(HomeHostLookRules.PREF_KEY, raw)
            memo = raw to look
        }
    }

    fun clear() {
        runCatching { SettingsPref.remove(HomeHostLookRules.PREF_KEY) }
        memo = "" to null
    }
}
