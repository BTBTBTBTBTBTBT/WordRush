package com.wordocious.app.data

import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.providers.builtin.Email
import io.github.jan.supabase.auth.user.UserInfo
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Columns
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * User profile row from the `profiles` table — mirrors the iOS Profile struct
 * and the web lib/auth-context.tsx Profile interface.
 */
@Serializable
data class Profile(
    val id: String,
    val username: String? = null,
    @SerialName("avatar_url") val avatarUrl: String? = null,
    @SerialName("is_pro") val isPro: Boolean = false,
    @SerialName("pro_expires_at") val proExpiresAt: String? = null,
    val level: Int = 1,
    val xp: Int = 0,
    @SerialName("current_streak") val currentStreak: Int = 0,
    @SerialName("best_streak") val bestStreak: Int = 0,
    @SerialName("total_wins") val totalWins: Int = 0,
    @SerialName("total_losses") val totalLosses: Int = 0,
    @SerialName("daily_login_streak") val dailyLoginStreak: Int = 0,
    @SerialName("best_daily_login_streak") val bestDailyLoginStreak: Int = 0,
    @SerialName("streak_shields") val streakShields: Int = 0,
    @SerialName("created_at") val createdAt: String? = null,
    @SerialName("gold_medals") val goldMedals: Int = 0,
    @SerialName("silver_medals") val silverMedals: Int = 0,
    @SerialName("bronze_medals") val bronzeMedals: Int = 0,
    @SerialName("has_onboarded") val hasOnboarded: Boolean = true,
    @SerialName("pro_prompt_shown") val proPromptShown: Boolean = false,
    @SerialName("last_played_at") val lastPlayedAt: String? = null,
    @SerialName("is_admin") val isAdmin: Boolean = false,
    // Personalization (migration 20260626000001) — all optional.
    val bio: String? = null,
    @SerialName("featured_achievement") val featuredAchievement: String? = null,
    @SerialName("accent_color") val accentColor: String? = null,
    @SerialName("favorite_mode") val favoriteMode: String? = null,
    @SerialName("avatar_emoji") val avatarEmoji: String? = null,
)

/**
 * Auth + profile service — Kotlin/Android analogue of the iOS AuthService.
 * Owns the Supabase client, session state, and the signed-in profile.
 * Mirrors apps/ios/Sources/AuthService.swift and web lib/auth-context.tsx.
 */
object AuthService {
    /** Web OAuth client ID — the Supabase Google provider's audience (same as iOS webClientID). */
    private const val GOOGLE_WEB_CLIENT_ID = "193086095286-2h2smgnt72veffaufh1nuruvlris79d9.apps.googleusercontent.com"

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val client get() = SupabaseConfig.client

    private val _profile = MutableStateFlow<Profile?>(null)
    val profile: StateFlow<Profile?> = _profile.asStateFlow()

    private val _isAuthenticated = MutableStateFlow(false)
    val isAuthenticated: StateFlow<Boolean> = _isAuthenticated.asStateFlow()

    private val _isLoading = MutableStateFlow(true)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    // Guest mode — chose "Play without an account". Lets a signed-out user reach
    // the app to play the daily single-player puzzle (Apple 5.1.1(v) / Google
    // Play). No session, so recording no-ops; account surfaces prompt sign-in.
    private val _isGuest = MutableStateFlow(false)
    val isGuest: StateFlow<Boolean> = _isGuest.asStateFlow()
    fun enterGuest() { _isGuest.value = true }
    /** Leave guest mode → the MainActivity gate shows AuthScreen so the guest
     *  can sign in (used by the "Sign in" prompts on account-only surfaces). */
    fun exitGuest() { _isGuest.value = false }

    val isProActive: Boolean
        get() {
            val p = _profile.value ?: return false
            if (!p.isPro) return false
            val exp = p.proExpiresAt ?: return true
            return try {
                java.time.Instant.parse(exp).isAfter(java.time.Instant.now())
            } catch (_: Exception) { true }
        }

    val userId: String? get() = _profile.value?.id

    /** Restore session from local storage on app start. */
    fun initialize() {
        scope.launch {
            try {
                client.auth.awaitInitialization()
                val user = runCatching { client.auth.currentUserOrNull() }.getOrNull()
                if (user != null) {
                    loadProfile(user.id)
                    _isAuthenticated.value = true; _isGuest.value = false; SettingsPref.set(HAD_SESSION, true)
                }
            } catch (_: Exception) {
                // No session — stay unauthenticated
            } finally {
                _isLoading.value = false
            }
        }
    }

    /** Email + password sign in. Returns null on success, error message on failure. */
    /**
     * Native Google sign-in — Credential Manager -> Google ID token ->
     * Supabase signInWithIdToken (same flow as iOS GoogleSignIn; Supabase
     * Google provider has "Skip nonce checks" ON, required because neither
     * SDK exposes a nonce parameter). Uses the WEB OAuth client ID as the
     * audience, like iOS. Returns null on success, else an error message.
     *
     * Console prerequisite: an ANDROID OAuth client (package com.wordocious.app
     * + signing SHA-1) must exist in the same Google Cloud project for
     * Credential Manager to vend tokens on-device.
     */
    suspend fun signInWithGoogle(context: android.content.Context): String? {
        return try {
            val option = com.google.android.libraries.identity.googleid.GetGoogleIdOption.Builder()
                .setFilterByAuthorizedAccounts(false)
                .setServerClientId(GOOGLE_WEB_CLIENT_ID)
                .build()
            val request = androidx.credentials.GetCredentialRequest.Builder()
                .addCredentialOption(option)
                .build()
            val result = androidx.credentials.CredentialManager.create(context)
                .getCredential(context, request)
            val googleCred = com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
                .createFrom(result.credential.data)
            client.auth.signInWith(io.github.jan.supabase.auth.providers.builtin.IDToken) {
                idToken = googleCred.idToken
                provider = io.github.jan.supabase.auth.providers.Google
            }
            val user = client.auth.currentUserOrNull() ?: return "Authentication failed"
            loadProfile(user.id)
            _isAuthenticated.value = true; _isGuest.value = false; SettingsPref.set(HAD_SESSION, true)
            null
        } catch (e: androidx.credentials.exceptions.GetCredentialCancellationException) {
            null // user dismissed the sheet — not an error
        } catch (e: Exception) {
            e.message?.take(120) ?: "Google sign-in failed"
        }
    }

    suspend fun signInWithEmail(email: String, password: String): String? {
        return try {
            client.auth.signInWith(Email) {
                this.email = email
                this.password = password
            }
            val user = client.auth.currentUserOrNull() ?: return "Authentication failed"
            loadProfile(user.id)
            _isAuthenticated.value = true; _isGuest.value = false; SettingsPref.set(HAD_SESSION, true)
            null
        } catch (e: Exception) {
            e.message?.take(120) ?: "Sign in failed"
        }
    }

    /**
     * Email + password sign up. Returns null on success (auto-signed-in), or a
     * message. When the project requires email confirmation, sign-up succeeds but
     * no session is created until the user clicks the email link — we surface that
     * as a confirmation prompt rather than a failure (matches the web flow).
     */
    suspend fun signUpWithEmail(email: String, password: String, username: String): String? {
        return try {
            val result = client.auth.signUpWith(Email) {
                this.email = email
                this.password = password
                data = kotlinx.serialization.json.buildJsonObject {
                    put("username", kotlinx.serialization.json.JsonPrimitive(username))
                }
            }
            val user = client.auth.currentUserOrNull()
            when {
                user != null -> {
                    loadProfile(user.id)
                    _isAuthenticated.value = true; _isGuest.value = false; SettingsPref.set(HAD_SESSION, true)
                    null
                }
                result != null -> "Check your email to confirm your account, then sign in."
                else -> "Registration failed"
            }
        } catch (e: Exception) {
            e.message?.take(120) ?: "Sign up failed"
        }
    }

    /** Sign out and clear session. */
    suspend fun signOut() {
        try {
            client.auth.signOut()
        } catch (_: Exception) {}
        // Purge per-account local state so the next session (guest or another
        // account) never inherits this user's daily results — the home grid seeds
        // from the completions cache and the completed-daily card reads local saves.
        runCatching { DailyCompletionsService.clearCache() }
        runCatching { GamePersistence.clearAll() }
        _profile.value = null
        _isAuthenticated.value = false
        _isGuest.value = false
        SettingsPref.set(HAD_SESSION, false)
    }

    /** Persisted hint that the LAST run had a real session — lets MainActivity
     *  render the home immediately on the next launch (while the session quietly
     *  restores) instead of flashing the loading spinner. Cleared on sign-out. */
    const val HAD_SESSION = "had-session"
    fun hadPersistedSession(): Boolean = SettingsPref.get(HAD_SESSION, false)

    /**
     * Delete the account via the web's service-role endpoint (same as iOS):
     * POST https://wordocious.com/api/account/delete with the Supabase Bearer
     * token — the endpoint cascades user_stats/matches/daily_results/medals/
     * achievements/profile then the auth user. Signs out locally on success.
     */
    suspend fun deleteAccount(): Boolean = kotlinx.coroutines.withContext(Dispatchers.IO) {
        val token = client.auth.currentSessionOrNull()?.accessToken ?: return@withContext false
        runCatching {
            val conn = java.net.URL("https://wordocious.com/api/account/delete")
                .openConnection() as java.net.HttpURLConnection
            conn.requestMethod = "POST"
            conn.setRequestProperty("Authorization", "Bearer $token")
            conn.connectTimeout = 15000
            conn.readTimeout = 15000
            val ok = conn.responseCode in 200..299
            conn.disconnect()
            if (ok) signOut()
            ok
        }.getOrDefault(false)
    }

    /** Persist pro-prompt dismissal cross-device (web pro-prompt-modal dismiss). */
    fun markProPromptShown() {
        val uid = userId ?: return
        scope.launch {
            runCatching {
                client.postgrest["profiles"].update({ set("pro_prompt_shown", true) }) { filter { eq("id", uid) } }
            }
            refreshProfile()
        }
    }

    /** Load profile row from `profiles` table. */
    suspend fun loadProfile(userId: String) {
        try {
            // select * (like the web) so missing/extra columns never break decoding;
            // Profile fields are all defaulted so absent columns fall back gracefully.
            val result = client.postgrest["profiles"]
                .select {
                    filter { eq("id", userId) }
                    limit(1)
                }
                .decodeSingleOrNull<Profile>()
            _profile.value = result
        } catch (e: Exception) {
            // Profile might not exist yet for new sign-ups — that's fine
        }
    }

    /** Refresh profile (e.g. after recording a game result). */
    fun refreshProfile() {
        val uid = userId ?: return
        scope.launch { loadProfile(uid) }
    }

    /**
     * Write Pro entitlement after a verified Play Billing purchase — mirrors
     * iOS AuthService.applyProGrant and web purchase-service fulfillSubscription:
     * is_pro=true + pro_expires_at, plus +addShields streak shields for
     * monthly/yearly (0 for the day pass and for launch/restore reconciles).
     */
    suspend fun applyProGrant(expiresAtIso: String, addShields: Int) {
        val uid = userId ?: runCatching { client.auth.currentUserOrNull()?.id }.getOrNull() ?: return
        val shields = (_profile.value?.streakShields ?: 0) + maxOf(0, addShields)
        runCatching {
            client.postgrest["profiles"].update({
                set("is_pro", true)
                set("pro_expires_at", expiresAtIso)
                set("streak_shields", shields)
            }) { filter { eq("id", uid) } }
        }
        loadProfile(uid)
    }

    /**
     * DEV-ONLY (is_admin-gated in the UI): flip `is_pro` for the "Simulate Pro"
     * toggle — 1:1 with the web profile-page button. Writes the column directly
     * (client-writable until the lock-pro migration) then refreshes the profile.
     */
    fun setProDev(value: Boolean) {
        val uid = userId ?: return
        scope.launch {
            runCatching {
                client.postgrest["profiles"].update({ set("is_pro", value) }) { filter { eq("id", uid) } }
            }
            loadProfile(uid)
        }
    }
}
