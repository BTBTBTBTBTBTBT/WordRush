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
)

/**
 * Auth + profile service — Kotlin/Android analogue of the iOS AuthService.
 * Owns the Supabase client, session state, and the signed-in profile.
 * Mirrors apps/ios/Sources/AuthService.swift and web lib/auth-context.tsx.
 */
object AuthService {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val client get() = SupabaseConfig.client

    private val _profile = MutableStateFlow<Profile?>(null)
    val profile: StateFlow<Profile?> = _profile.asStateFlow()

    private val _isAuthenticated = MutableStateFlow(false)
    val isAuthenticated: StateFlow<Boolean> = _isAuthenticated.asStateFlow()

    private val _isLoading = MutableStateFlow(true)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

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
                    _isAuthenticated.value = true
                }
            } catch (_: Exception) {
                // No session — stay unauthenticated
            } finally {
                _isLoading.value = false
            }
        }
    }

    /** Email + password sign in. Returns null on success, error message on failure. */
    suspend fun signInWithEmail(email: String, password: String): String? {
        return try {
            client.auth.signInWith(Email) {
                this.email = email
                this.password = password
            }
            val user = client.auth.currentUserOrNull() ?: return "Authentication failed"
            loadProfile(user.id)
            _isAuthenticated.value = true
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
                    _isAuthenticated.value = true
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
        _profile.value = null
        _isAuthenticated.value = false
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
}
