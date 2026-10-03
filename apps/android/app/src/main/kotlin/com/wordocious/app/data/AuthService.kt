package com.wordocious.app.data

import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.handleDeeplinks
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
import kotlinx.coroutines.sync.withLock
import io.github.jan.supabase.auth.status.SessionStatus
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
    /** §228: 'admin' | 'tester' accounts never request ads (see AdsManager). */
    @SerialName("role") val role: String? = null,
    @SerialName("is_banned") val isBanned: Boolean = false,
    // Personalization (migration 20260626000001) — all optional.
    val bio: String? = null,
    @SerialName("featured_achievement") val featuredAchievement: String? = null,
    @SerialName("accent_color") val accentColor: String? = null,
    @SerialName("favorite_mode") val favoriteMode: String? = null,
    @SerialName("avatar_emoji") val avatarEmoji: String? = null,
    // FINISH_SPEC AH (additive; the columns may not exist yet → null): the cast
    // character worn as the avatar ("w", "o1", … AvatarCast.IDS) and the chosen
    // level-tier frame ("bronze" … "diamond").
    @SerialName("avatar_cast_id") val avatarCastId: String? = null,
    @SerialName("avatar_frame") val avatarFrame: String? = null,
    // FINISH_SPEC AN3 (additive; the column may not exist yet → null): the
    // build-your-own mascot (core AvatarConfig, read with validateAvatar).
    @SerialName("avatar_config") val avatarConfig: kotlinx.serialization.json.JsonElement? = null,
    // PRIVATE PROFILES (migration 20260806000001): world-readable flag; when
    // true, other players see only the teaser card and the four
    // /api/profile/[id]/* endpoints 403 for them.
    @SerialName("is_private") val isPrivate: Boolean = false,
    // §294 (Friends D3.5): per-event friends push prefs — race / challenge /
    // nudge / feed → false when turned off; a missing key means ON. Nullable
    // so a profile row without the column never breaks decoding.
    @SerialName("notification_prefs") val notificationPrefs: Map<String, Boolean>? = null,
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
    fun enterGuest() {
        // Guest is its own save owner — never inherit the boards of whoever was
        // signed in on this device before.
        claimSavesFor("guest")
        _isGuest.value = true
    }

    private const val LAST_OWNER = "last-save-owner"

    /** Hand local saves to [owner] ("guest" or a user id), wiping them only when
     *  they belonged to somebody else. The home grid seeds from the completions
     *  cache and the completed-daily card reads local saves, so without this a
     *  guest — or a second account on a shared phone — inherits the previous
     *  player's boards. */
    fun claimSavesFor(owner: String) {
        val previous = SettingsPref.get(LAST_OWNER, "")
        if (previous.isNotEmpty() && previous != owner) {
            runCatching { DailyCompletionsService.clearCache() }
            runCatching { GamePersistence.clearAll() }
            // BI19: persisted screen caches + optimistic results belong to the previous owner.
            runCatching { AppCache.clearForOwnerChange() }
            runCatching { StatsMemo.clear() }
        }
        SettingsPref.set(LAST_OWNER, owner)
    }

    /** Upgrade path: builds before the ownership change wiped saves on SIGN-OUT,
     *  so a device sitting signed out has no owner recorded AND — under that old
     *  behavior — no saves worth keeping. Anything still on disk in that state is
     *  unattributable, and leaving it would hand the next account to sign in
     *  someone else's boards. Discard once, then let the normal claim take over.
     *  Only ever runs when no owner has been recorded yet. */
    fun discardUnattributedSaves() {
        if (SettingsPref.get(LAST_OWNER, "").isNotEmpty()) return
        runCatching { DailyCompletionsService.clearCache() }
        runCatching { GamePersistence.clearAll() }
    }
    /** Leave guest mode → the MainActivity gate shows AuthScreen so the guest
     *  can sign in (used by the "Sign in" prompts on account-only surfaces). */
    fun exitGuest() { _isGuest.value = false }

    /**
     * Mirror the values the header paints so the NEXT launch can paint them
     * immediately. The profile row arrives a beat after launch; until it does
     * the streak and shield pills were absent and the PRO badge was off, so
     * they all visibly popped in a second late on every cold start. iOS fixed
     * the Pro half of this on 2026-07-29 and Android never got the port.
     *
     * The Pro EXPIRY is stored rather than a boolean, so a lapsed subscription
     * cannot ride the cache past its end date.
     */
    private fun cacheHeaderValues(p: Profile) {
        SettingsPref.set(CACHED_DAILY_STREAK, p.dailyLoginStreak)
        SettingsPref.set(CACHED_SHIELDS, p.streakShields)
        val until = if (!p.isPro) "" else (p.proExpiresAt ?: PRO_NO_EXPIRY)
        SettingsPref.set(CACHED_PRO_UNTIL, until)
        // Home-screen widget: streak/shields ride the profile, which lands a
        // beat after the completions fetch — re-snapshot so the widget's flame
        // never shows the previous launch's number (iOS reads headerStreak at
        // every update; this is the Android push equivalent).
        runCatching { com.wordocious.app.widget.WidgetBridge.update(DailyCompletionsService.readCache()) }
    }

    /** Last known streak, or null when nothing has been cached (first launch). */
    val headerStreak: Int?
        get() = _profile.value?.dailyLoginStreak
            ?: SettingsPref.get(CACHED_SHIELDS, -1).let {
                if (it < 0) null else SettingsPref.get(CACHED_DAILY_STREAK, 0)
            }

    /** Last known shield count, or null when nothing has been cached. */
    val headerShields: Int?
        get() = _profile.value?.streakShields
            ?: SettingsPref.get(CACHED_SHIELDS, -1).takeIf { it >= 0 }

    /** Cached entitlement for the launch window — still expiry-checked here, so
     *  a canceled subscription can't linger. */
    private val cachedProActive: Boolean
        get() {
            val until = SettingsPref.get(CACHED_PRO_UNTIL, "")
            if (until.isEmpty()) return false
            if (until == PRO_NO_EXPIRY) return true
            val instant = parseTimestamp(until) ?: return false
            return instant.isAfter(java.time.Instant.now())
        }

    /** §228 (the AdSense disablement): developer and beta-tester accounts must
     *  never generate ad traffic. Admin or 'tester' role = no ads. */
    val isAdsExempt: Boolean
        get() = _profile.value?.let { it.isAdmin || it.role == "admin" || it.role == "tester" } ?: false

    val isProActive: Boolean
        get() {
            val p = _profile.value ?: return cachedProActive
            if (!p.isPro) return false
            val exp = p.proExpiresAt ?: return true // legacy rows w/o expiry
            // FAIL CLOSED on an unparseable expiry (matches web lib/pro.ts). The
            // old `Instant.parse(...) catch → true` did two things wrong: it
            // rejected PostgREST's offset format (2026-…+00:00, not the …Z
            // Instant.parse needs) AND treated the resulting exception as
            // "active" — so any Pro row stayed Pro forever, ads never came back.
            val instant = parseTimestamp(exp) ?: return false
            return instant.isAfter(java.time.Instant.now())
        }

    /** Parse a PostgREST `timestamptz` to an Instant, or null if malformed.
     *  PostgREST returns a numeric offset (…+00:00, possibly with microseconds);
     *  OffsetDateTime accepts both that and the …Z form the client writes.
     *  Callers must fail CLOSED on null. */
    fun parseTimestamp(s: String): java.time.Instant? =
        runCatching { java.time.OffsetDateTime.parse(s).toInstant() }
            .recoverCatching { java.time.Instant.parse(s) }
            .getOrNull()

    val userId: String? get() = _profile.value?.id

    /** Current Supabase access token — the VS socket handshake sends this so the
     *  server can verify identity instead of trusting a client-supplied id. */
    val accessToken: String? get() = runCatching { client.auth.currentSessionOrNull()?.accessToken }.getOrNull()

    /** Restore session from local storage on app start. */
    fun initialize() {
        // §241 (founder, on iOS but same window here): the profile row lands a
        // beat after a cold start; paint the last known row immediately and let
        // the real fetch overwrite it. Reverted below if no session restores.
        if (hadPersistedSession() && _profile.value == null) {
            cachedProfileRow()?.let { _profile.value = it; _isAuthenticated.value = true; runCatching { CastAvatars.recordOwn(it) } }
        }
        startSessionWatch()
        scope.launch {
            try {
                client.auth.awaitInitialization()
                val user = runCatching { client.auth.currentUserOrNull() }.getOrNull()
                if (user != null) {
                    // loadProfile claims save ownership for this user; false = banned (it
                    // already signed out).
                    if (loadProfile(user.id)) {
                        _isAuthenticated.value = true; _isGuest.value = false; SettingsPref.set(HAD_SESSION, true)
                    }
                } else {
                    // 2026-10-03 (the outage sign-out): "no current user" is NOT "no session".
                    // supabase-kt reports a refresh that failed on the network or a 5xx as
                    // RefreshFailure, and currentUserOrNull() is null until it recovers — this
                    // branch used to treat that as signed out, wipe the cached profile and
                    // HAD_SESSION, and show the sign-in screen. Classify first.
                    val stored = storedSessionOrNull()
                    val outcome = when {
                        stored == null -> AuthSessionPolicy.Outcome.NO_SESSION
                        // The library keeps it and retries on its own.
                        client.auth.sessionStatus.value is SessionStatus.RefreshFailure -> AuthSessionPolicy.Outcome.TRANSIENT
                        // NotAuthenticated with a session still on disk: the library gave up on
                        // a non-5xx error (SessionGuard kept the session). Ask the server once.
                        // (null = refreshed; currentUserOrNull below picks it up.)
                        else -> probeStoredSession(stored) ?: AuthSessionPolicy.Outcome.TRANSIENT
                    }
                    val restored = runCatching { client.auth.currentUserOrNull() }.getOrNull()
                    when {
                        // The probe refreshed it.
                        restored != null -> if (loadProfile(restored.id)) {
                            _isAuthenticated.value = true; _isGuest.value = false; SettingsPref.set(HAD_SESSION, true)
                        }
                        AuthSessionPolicy.keepsUserSignedIn(outcome, hasStoredSession = stored != null) -> keepSignedInOffline()
                        outcome == AuthSessionPolicy.Outcome.REVOKED -> signOut(callServer = false)
                        else -> {
                            // No session — the optimistic paint (if any) was wrong.
                            _profile.value = null
                            _isAuthenticated.value = false
                            SettingsPref.set(HAD_SESSION, false)
                            SettingsPref.set(CACHED_PROFILE_JSON, "")
                            discardUnattributedSaves()
                        }
                    }
                }
            } catch (_: Exception) {
                // Restore threw — leave whatever the optimistic paint showed; a later
                // refresh / foreground settles it. Never a sign-out on an exception.
            } finally {
                initDone = true
                _isLoading.value = false
            }
        }
    }

    // ── Session recovery (2026-10-03, the outage sign-out) ──────────────────────
    //
    // A refresh that fails on the network or a 5xx keeps the user signed in: the cached
    // profile stays, isAuthenticated stays, HAD_SESSION stays. supabase-kt retries those on
    // its own (RefreshFailure → every AuthConfig.retryDelay, plus loadFromStorage on every
    // foreground). It gives up on any OTHER error (clearSession → NotAuthenticated), which
    // SessionGuard stops from deleting the stored session; [runRecoveryProbe] then refreshes
    // that stored session itself with backoff (5 s, 15 s, 30 s, 60 s, then 60 s), on foreground
    // and when the network returns, and only a REVOKED classification ends the session.
    //
    // The probe never runs while the library's own retry loop is live (RefreshFailure): two
    // refreshers holding the same refresh token can trip GoTrue's reuse detection and revoke
    // the whole session.

    @Volatile private var initDone = false
    @Volatile private var recovering = false
    @Volatile private var signingOut = false
    private var recoveryAttempt = 0
    private var probeJob: kotlinx.coroutines.Job? = null
    private val probeLock = kotlinx.coroutines.sync.Mutex()
    private var sessionWatchStarted = false

    private suspend fun storedSessionOrNull(): io.github.jan.supabase.auth.user.UserSession? =
        runCatching { SessionGuard.loadSession() }.getOrNull()

    /** Keep the signed-in state through a transient failure: the cached profile (painted from
     *  CACHED_PROFILE_JSON at launch) stays, and so does HAD_SESSION. */
    private fun keepSignedInOffline() {
        recovering = true
        _isAuthenticated.value = true
        _isGuest.value = false
        SettingsPref.set(HAD_SESSION, true)
        // A no-op while the library's own retry loop runs (RefreshFailure); otherwise this
        // is the next try of the stored session.
        scheduleRecoveryProbe(AuthSessionPolicy.retryDelaySeconds(recoveryAttempt++) * 1000L)
    }

    /** Refreshes [stored] directly. Null = refreshed and imported (the library owns it again);
     *  otherwise the classified failure. */
    private suspend fun probeStoredSession(stored: io.github.jan.supabase.auth.user.UserSession): AuthSessionPolicy.Outcome? =
        try {
            val fresh = client.auth.refreshSession(stored.refreshToken)
            client.auth.importSession(fresh)
            null
        } catch (e: kotlinx.coroutines.CancellationException) {
            throw e
        } catch (e: Exception) {
            classifyRefreshError(e)
        }

    private fun classifyRefreshError(e: Throwable): AuthSessionPolicy.Outcome {
        val rest = e as? io.github.jan.supabase.exceptions.RestException
        val code = (e as? io.github.jan.supabase.auth.exception.AuthRestException)?.errorCode?.value ?: rest?.error
        return AuthSessionPolicy.classify(
            errorCode = code,
            httpStatus = rest?.statusCode,
            // Anything that isn't an HTTP response (IOException, UnknownHost, ConnectException,
            // ktor timeouts, supabase HttpRequestException) is the network.
            isNetworkError = rest == null,
            isSessionMissing = false,
            message = e.message,
        )
    }

    /** One collector for the whole process: refresh failures never sign out; a library
     *  give-up hands the stored session to the recovery probe; a recovered session reloads the
     *  profile. */
    private fun startSessionWatch() {
        if (sessionWatchStarted) return
        sessionWatchStarted = true
        registerNetworkCallback()
        scope.launch {
            client.auth.sessionStatus.collect { st ->
                when (st) {
                    is SessionStatus.Authenticated -> {
                        recoveryAttempt = 0
                        if (recovering && !signingOut) {
                            recovering = false
                            val uid = st.session.user?.id ?: runCatching { client.auth.currentUserOrNull()?.id }.getOrNull()
                            if (uid != null && loadProfile(uid)) {
                                _isAuthenticated.value = true; _isGuest.value = false; SettingsPref.set(HAD_SESSION, true)
                            }
                        }
                    }
                    // Network / 5xx: the library keeps the session and retries — stay signed in.
                    is SessionStatus.RefreshFailure -> {
                        if (_isAuthenticated.value) recovering = true
                    }
                    is SessionStatus.NotAuthenticated -> {
                        if (!st.isSignOut && initDone && !signingOut && _isAuthenticated.value) {
                            recovering = true
                            scheduleRecoveryProbe(0)
                        }
                    }
                    else -> Unit
                }
                Unit
            }
        }
    }

    private fun scheduleRecoveryProbe(delayMs: Long) {
        probeJob?.cancel()
        probeJob = scope.launch {
            kotlinx.coroutines.delay(delayMs)
            runRecoveryProbe()
        }
    }

    private suspend fun runRecoveryProbe(): Unit = probeLock.withLock {
        if (!recovering || signingOut || !_isAuthenticated.value) return@withLock
        // The library is refreshing (or already has a session): it owns this attempt.
        if (client.auth.sessionStatus.value !is SessionStatus.NotAuthenticated) return@withLock
        val stored = storedSessionOrNull()
        if (stored == null) {
            // Only a sign-out may delete it (SessionGuard), so this is a finished sign-out.
            signOut(callServer = false)
            return@withLock
        }
        when (probeStoredSession(stored)) {
            null -> { recoveryAttempt = 0 } // imported; the Authenticated status reloads the profile
            AuthSessionPolicy.Outcome.REVOKED -> {
                runCatching { io.sentry.Sentry.captureMessage("auth: refresh token revoked, signing out") }
                signOut(callServer = false)
            }
            AuthSessionPolicy.Outcome.NO_SESSION -> signOut(callServer = false)
            AuthSessionPolicy.Outcome.TRANSIENT -> {
                val wait = AuthSessionPolicy.retryDelaySeconds(recoveryAttempt++)
                scheduleRecoveryProbe(wait * 1000L)
            }
        }
        Unit
    }

    /** App foreground (MainActivity.onResume): retry a stranded session now. Waits a beat so
     *  the library's own foreground loadFromStorage goes first. */
    fun onForeground() {
        if (recovering) scheduleRecoveryProbe(1_500)
    }

    private fun registerNetworkCallback() {
        runCatching {
            val cm = com.wordocious.app.App.instance
                .getSystemService(android.content.Context.CONNECTIVITY_SERVICE) as android.net.ConnectivityManager
            cm.registerDefaultNetworkCallback(object : android.net.ConnectivityManager.NetworkCallback() {
                override fun onAvailable(network: android.net.Network) {
                    if (recovering) scheduleRecoveryProbe(1_500)
                }
            })
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
            val manager = androidx.credentials.CredentialManager.create(context)

            // Two shots, because the bottom-sheet flow reports "No credentials
            // available" for reasons that have nothing to do with the user:
            // Play Services applies a 24h cooldown after the sheet is dismissed
            // a couple of times, and it stays empty while a newly-registered
            // signing SHA-1 propagates. GetSignInWithGoogleOption is the flow
            // Google actually recommends behind an explicit "Continue with
            // Google" button — it opens the full account picker instead of the
            // sheet, and is subject to neither. Both hand back a
            // GoogleIdTokenCredential, so the rest of this is unchanged.
            val idOption = com.google.android.libraries.identity.googleid.GetGoogleIdOption.Builder()
                .setFilterByAuthorizedAccounts(false)
                .setServerClientId(GOOGLE_WEB_CLIENT_ID)
                .build()
            val buttonOption = com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption
                .Builder(GOOGLE_WEB_CLIENT_ID)
                .build()

            suspend fun request(option: androidx.credentials.CredentialOption) =
                manager.getCredential(
                    context,
                    androidx.credentials.GetCredentialRequest.Builder()
                        .addCredentialOption(option)
                        .build(),
                )

            val result = try {
                request(idOption)
            } catch (_: androidx.credentials.exceptions.NoCredentialException) {
                request(buttonOption)
            }
            val googleCred = com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
                .createFrom(result.credential.data)
            client.auth.signInWith(io.github.jan.supabase.auth.providers.builtin.IDToken) {
                idToken = googleCred.idToken
                provider = io.github.jan.supabase.auth.providers.Google
            }
            val user = client.auth.currentUserOrNull() ?: return "Authentication failed"
            if (!loadProfile(user.id)) return "This account has been suspended."
            _isAuthenticated.value = true; _isGuest.value = false; SettingsPref.set(HAD_SESSION, true)
            null
        } catch (e: androidx.credentials.exceptions.GetCredentialCancellationException) {
            // A real dismissal is silent by design. But Play Services ALSO
            // reports some genuine failures as a cancellation, which is
            // indistinguishable here and looks to the user like the button did
            // nothing — the first Play tester picked his account and the screen
            // just sat there. Report it so the real cause is visible remotely;
            // a user who actually tapped away costs one harmless event.
            val detail = "${e.type} ${e.errorMessage ?: e.message ?: ""}"
            runCatching { io.sentry.Sentry.captureMessage("google sign-in canceled: $detail") }
            // Play Services raises TYPE_USER_CANCELED for "Account reauth
            // failed" — the Google account on the DEVICE is in a state where it
            // cannot mint a token and needs re-verification. Nothing to do with
            // our client config; confirmed via Sentry on a Galaxy S23 / Android
            // 16 after the tester reported picking an account and landing back
            // on an empty sign-in screen. Say so instead of failing silently.
            if (detail.contains("reauth", ignoreCase = true)) {
                // "Account reauth failed" means the DEVICE's Google account
                // can't mint a token. Every Credential Manager option — the
                // bottom sheet AND the account picker — is dead in that state,
                // so retrying on-device is pointless. The browser flow is not:
                // it authenticates against the user's Google session in the
                // browser and never touches the device account. Hand off to it
                // rather than dead-ending the user on an error they'd have to
                // fix in system Settings.
                startBrowserGoogleSignIn(context)
                null
            } else {
                null // a genuine dismissal stays silent
            }
        } catch (e: androidx.credentials.exceptions.NoCredentialException) {
            // Both on-device flows came back empty — no usable Google account,
            // or a signing SHA-1 that hasn't propagated yet. Same conclusion as
            // the reauth case: nothing on-device can succeed, but the browser
            // can. Go there instead of telling the user to go add an account.
            runCatching { io.sentry.Sentry.captureMessage("google sign-in: no credential, using browser fallback") }
            startBrowserGoogleSignIn(context)
            null
        } catch (e: Exception) {
            // Everything else, with the exception TYPE — "nothing happened" and
            // a truncated message are not enough to act on from a text thread.
            runCatching { io.sentry.Sentry.captureException(e) }
            e.message?.take(120) ?: "Google sign-in failed (${e.javaClass.simpleName})"
        }
    }

    /**
     * Browser Google sign-in — the fallback for every state Credential Manager
     * can't get out of.
     *
     * The first real Play tester hit "Account reauth failed": the Google
     * account ON THE DEVICE was in a state where Play Services would not mint
     * an ID token. That kills the bottom sheet and the account picker alike,
     * because both go through Credential Manager, and no amount of retrying or
     * reconfiguring on our side changes it — the previous build's only answer
     * was an error message asking him to go fix it in system Settings.
     *
     * This flow doesn't use the device account at all. Supabase opens Google's
     * consent page in a Custom Tab, the user picks the account with their
     * BROWSER Google session, and Google redirects to wordocious://auth-callback
     * (the manifest intent-filter), where completeBrowserSignIn picks the
     * session up. Same provider, same Supabase user, same `profiles` row — the
     * only difference is which side of the device mints the token.
     *
     * Fire-and-forget: the result arrives via the deep link, not a return value.
     */
    private fun startBrowserGoogleSignIn(context: android.content.Context) {
        SettingsPref.remove(PENDING_LINK) // a sign-in, not a link round trip
        scope.launch {
            runCatching {
                client.auth.signInWith(
                    io.github.jan.supabase.auth.providers.Google,
                )
            }.onFailure { e ->
                runCatching { io.sentry.Sentry.captureException(e) }
            }
        }
    }

    /**
     * Return leg of startBrowserGoogleSignIn. Called from MainActivity for
     * every intent; a no-op unless this one carries a Supabase session.
     *
     * The profile load and the authenticated flip have to happen HERE too —
     * the browser path never returns through signInWithGoogle, so nothing else
     * would ever run them and the user would land back on a sign-in screen
     * holding a perfectly good session.
     */
    fun completeBrowserSignIn(intent: android.content.Intent) {
        if (completeIdentityLink(intent)) return
        client.handleDeeplinks(intent) { _ ->
            scope.launch {
                val uid = client.auth.currentUserOrNull()?.id ?: return@launch
                if (!loadProfile(uid)) return@launch   // suspended account
                _isAuthenticated.value = true
                _isGuest.value = false
                SettingsPref.set(HAD_SESSION, true)
            }
        }
    }

    // ── Linked sign-ins (founder, 2026-09-30; web components/settings/linked-sign-ins.tsx) ──

    /** One sign-in attached to the account (Supabase identity). */
    data class LinkedIdentity(val identityId: String, val provider: String, val email: String?)
    /** A result line under Settings › Linked sign-ins; [ok] = green, else red. */
    data class LinkNotice(val ok: Boolean, val text: String)

    private val _identities = MutableStateFlow<List<LinkedIdentity>?>(null)
    /** null = not loaded yet. */
    val identities: StateFlow<List<LinkedIdentity>?> = _identities.asStateFlow()
    private val _linkNotice = MutableStateFlow<LinkNotice?>(null)
    val linkNotice: StateFlow<LinkNotice?> = _linkNotice.asStateFlow()
    fun clearLinkNotice() { _linkNotice.value = null }

    /** Provider of a link round trip in flight (persisted: the process may die behind the browser). */
    private const val PENDING_LINK = "pending-identity-link"

    /** Reads the account's identities fresh from the server; false on failure. */
    suspend fun loadIdentities(): Boolean = kotlinx.coroutines.withContext(Dispatchers.IO) {
        runCatching {
            val user = client.auth.retrieveUserForCurrentSession(updateSession = true)
            _identities.value = user.identities.orEmpty().map { id ->
                val email = (id.identityData?.get("email") as? kotlinx.serialization.json.JsonPrimitive)
                    ?.takeIf { it.isString }?.content?.takeIf { it.isNotEmpty() }
                LinkedIdentity(id.identityId ?: id.id, id.provider, email)
            }
            true
        }.getOrElse { false }
    }

    /**
     * Link Google onto the signed-in account: supabase-kt manual linking opens Google in a Custom
     * Tab and the provider returns to wordocious://auth-callback, where [completeIdentityLink]
     * reads the outcome. Returns an error message when the round trip can't start.
     */
    suspend fun linkGoogle(): String? {
        _linkNotice.value = null
        SettingsPref.set(PENDING_LINK, "google")
        return try {
            client.auth.linkIdentity(io.github.jan.supabase.auth.providers.Google)
            null
        } catch (e: Exception) {
            SettingsPref.remove(PENDING_LINK)
            val code = (e as? io.github.jan.supabase.auth.exception.AuthRestException)?.errorCode?.value ?: ""
            IdentityLinking.linkErrorMessage(code, e.message.orEmpty().take(160), "google")
        }
    }

    /** Remove one sign-in (never the last). Returns an error message, or null on success. */
    suspend fun unlinkIdentity(identity: LinkedIdentity): String? {
        val count = _identities.value?.size ?: 0
        if (!IdentityLinking.canUnlink(count)) return IdentityLinking.unlinkErrorMessage("single_identity_not_deletable", "")
        return try {
            client.auth.unlinkIdentity(identity.identityId)
            // The access token's identity claims are stale until a refresh.
            runCatching { client.auth.refreshCurrentSession() }
            loadIdentities()
            null
        } catch (e: Exception) {
            val code = (e as? io.github.jan.supabase.auth.exception.AuthRestException)?.errorCode?.value ?: ""
            IdentityLinking.unlinkErrorMessage(code, e.message.orEmpty().take(160))
        }
    }

    /**
     * Return leg of [linkGoogle]. True when this intent was a link round trip (handled here):
     * GoTrue's error params (identity_already_exists → "That Google account is already used by
     * another Wordocious account…") become the notice; on success the refreshed session is
     * imported and the identity list reloaded.
     */
    private fun completeIdentityLink(intent: android.content.Intent): Boolean {
        val provider = SettingsPref.get(PENDING_LINK, "")
        val data = intent.data ?: return false
        if (provider.isEmpty() || data.scheme != "wordocious" || data.host != "auth-callback") return false
        SettingsPref.remove(PENDING_LINK)
        // Cold process (killed behind the browser): let the normal sign-in leg restore the session.
        if (!_isAuthenticated.value) return false
        val label = IdentityLinking.providerLabel(provider)
        IdentityLinking.readRedirectError(data.toString())?.let { err ->
            _linkNotice.value = LinkNotice(false, IdentityLinking.linkErrorMessage(err.code, err.description, provider))
            return true
        }
        client.handleDeeplinks(intent) { _ ->
            scope.launch {
                loadIdentities()
                _linkNotice.value = if (_identities.value.orEmpty().any { it.provider == provider })
                    LinkNotice(true, "$label is now linked. You can sign in with it on any device.")
                else LinkNotice(false, "$label wasn’t linked. Please try again.")
            }
        }
        return true
    }

    suspend fun signInWithEmail(email: String, password: String): String? {
        return try {
            client.auth.signInWith(Email) {
                this.email = email
                this.password = password
            }
            val user = client.auth.currentUserOrNull() ?: return "Authentication failed"
            if (!loadProfile(user.id)) return "This account has been suspended."
            _isAuthenticated.value = true; _isGuest.value = false; SettingsPref.set(HAD_SESSION, true)
            null
        } catch (e: Exception) {
            e.message?.take(120) ?: "Sign in failed"
        }
    }

    /**
     * Emails a recovery link that opens the web reset page (wordocious.com/auth/reset).
     * The link finishes in the browser — the web page handles the recovery session
     * and new-password form. Also the only way an OAuth-only account (Google signup,
     * no password) can gain a password. Always returns null: confirming which
     * addresses exist would let anyone probe the user list (web/iOS parity).
     */
    suspend fun resetPassword(email: String): String? {
        runCatching {
            client.auth.resetPasswordForEmail(email, redirectUrl = "https://wordocious.com/auth/reset")
        }
        return null
    }

    /**
     * Email + password sign up. Returns null on success (auto-signed-in), or a
     * message. When the project requires email confirmation, sign-up succeeds but
     * no session is created until the user clicks the email link — we surface that
     * as a confirmation prompt rather than a failure (matches the web flow).
     */
    /**
     * Outcome of an email sign-up.
     *
     * [ConfirmEmail] is a SUCCESS. It used to be returned as a plain String
     * alongside the real errors, and the caller rendered every non-null return
     * in the red error card — so creating an account correctly looked like it
     * had failed.
     */
    sealed interface SignUpOutcome {
        object SignedIn : SignUpOutcome
        object ConfirmEmail : SignUpOutcome
        data class Failed(val message: String) : SignUpOutcome
    }

    suspend fun signUpWithEmail(email: String, password: String, username: String): SignUpOutcome {
        return try {
            // Confirmation links land on /auth/confirm — a path the app claims
            // as an app link, so tapping the email on this phone confirms
            // in-app; the branded web page is the no-app fallback.
            val result = client.auth.signUpWith(Email, redirectUrl = "https://wordocious.com/auth/confirm") {
                this.email = email
                this.password = password
                data = kotlinx.serialization.json.buildJsonObject {
                    put("username", kotlinx.serialization.json.JsonPrimitive(username))
                }
            }
            val user = client.auth.currentUserOrNull()
            when {
                user != null -> {
                    if (!loadProfile(user.id)) return SignUpOutcome.Failed("This account has been suspended.")
                    _isAuthenticated.value = true; _isGuest.value = false; SettingsPref.set(HAD_SESSION, true)
                    SignUpOutcome.SignedIn
                }
                // Email confirmation is ON, so there is no session yet. The
                // account WAS created — the caller shows the green banner.
                result != null -> SignUpOutcome.ConfirmEmail
                else -> SignUpOutcome.Failed("Registration failed")
            }
        } catch (e: Exception) {
            SignUpOutcome.Failed(e.message?.take(120) ?: "Sign up failed")
        }
    }

    /** Sign out and clear session. [callServer] false = the token is already dead (revoked):
     *  skip the logout call and just clear locally. */
    suspend fun signOut(callServer: Boolean = true) {
        signingOut = true
        recovering = false
        // (Never cancel the probe that is running this sign-out itself.)
        val self = kotlin.coroutines.coroutineContext[kotlinx.coroutines.Job]
        probeJob?.takeIf { it != self }?.cancel()
        try {
            // SessionGuard only lets the stored session be deleted inside this block. The
            // explicit clearSession covers a logout call that threw before clearing.
            SessionGuard.allowingDelete {
                if (callServer) {
                    try {
                        client.auth.signOut()
                    } catch (_: Exception) {}
                }
                runCatching { client.auth.clearSession() }
            }
            clearSignedInState()
        } finally {
            signingOut = false
        }
    }

    private fun clearSignedInState() {
        // NOTE: local saves are deliberately NOT purged here. Purging on
        // sign-OUT meant signing out and straight back in as the same person
        // destroyed their in-progress boards. The cross-account leak this
        // guarded against is now closed on the sign-IN side by claimSavesFor,
        // which only wipes when the save owner actually changes.
        _profile.value = null
        _identities.value = null
        _linkNotice.value = null
        SettingsPref.remove(PENDING_LINK)
        _isAuthenticated.value = false
        _isGuest.value = false
        SettingsPref.set(HAD_SESSION, false)
        SettingsPref.set(CACHED_DAILY_STREAK, 0)
        SettingsPref.set(CACHED_SHIELDS, -1)
        SettingsPref.set(CACHED_PRO_UNTIL, "")
        SettingsPref.set(CACHED_PROFILE_JSON, "")
    }

    /** Persisted copy of the profile's daily-login streak (the SnapshotHero
     *  "Daily" stat) — lets the 18:00 ReminderWorker personalize its copy even
     *  in a cold process where the in-memory profile hasn't restored yet.
     *  Refreshed on every loadProfile; zeroed on sign-out. */
    const val CACHED_DAILY_STREAK = "cached-daily-streak"
    /** -1 means "never cached", which has to stay distinct from a real 0. */
    const val CACHED_SHIELDS = "cached-streak-shields"
    /** ISO-8601 expiry of the last known Pro window; "" = not Pro / unknown. */
    const val CACHED_PRO_UNTIL = "cached-pro-until"
    /** §241: the whole last-known profile row as JSON; "" = never cached. */
    const val CACHED_PROFILE_JSON = "cached-profile-json"
    private val profileJson = kotlinx.serialization.json.Json { ignoreUnknownKeys = true }

    /** Last cached profile row, or null when absent/corrupt. */
    private fun cachedProfileRow(): Profile? {
        val raw = SettingsPref.get(CACHED_PROFILE_JSON, "")
        if (raw.isEmpty()) return null
        return runCatching { profileJson.decodeFromString(Profile.serializer(), raw) }.getOrNull()
    }
    /** Sentinel expiry for a Pro row with no end date (legacy/lifetime). */
    private const val PRO_NO_EXPIRY = "9999-12-31T00:00:00Z"

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

    /** Load profile row from `profiles` table. Returns false when the account
     *  is banned — the session is refused and signed out (mirrors iOS
     *  AuthService.handleSignedIn's is_banned check); callers in the sign-in /
     *  session-restore flows must NOT mark the user authenticated in that case. */
    suspend fun loadProfile(userId: String): Boolean {
        try {
            // select * (like the web) so missing/extra columns never break decoding;
            // Profile fields are all defaulted so absent columns fall back gracefully.
            val result = client.postgrest["profiles"]
                .select {
                    filter { eq("id", userId) }
                    limit(1)
                }
                .decodeSingleOrNull<Profile>()
            if (result?.isBanned == true) {
                signOut()
                return false
            }
            // Same user back after a sign-out keeps their boards; a different
            // account (or a hand-off from guest play) starts clean.
            claimSavesFor(userId)
            // 2026-10-03: an empty read for the user we already hold (a request that went out
            // with the anon key while the session refresh was failing) must not null the
            // profile — userId reads it, and a null profile looks signed out everywhere. A
            // brand-new sign-up with no row yet still lands null as before.
            if (result == null && _profile.value?.id == userId) return true
            _profile.value = result
            // AH: the player's character / frame for every avatar on screen.
            runCatching { CastAvatars.recordOwn(result) }
            result?.let {
                cacheHeaderValues(it)
                // §241: whole-row launch cache, cleared only on sign-out or a
                // failed restore — never on a null assignment.
                runCatching { SettingsPref.set(CACHED_PROFILE_JSON, profileJson.encodeToString(Profile.serializer(), it)) }
            }
            stampPresence(userId)
        } catch (e: Exception) {
            // Profile might not exist yet for new sign-ups — that's fine
        }
        return true
    }

    /** Version/platform/last-seen stamp, once per process — powers the admin
     *  portal's build-adoption view. Fire-and-forget: must never block or fail
     *  sign-in, and the columns may lag the 20260801 manual migration. */
    private var presenceStamped = false
    private fun stampPresence(userId: String) {
        if (presenceStamped) return
        presenceStamped = true
        scope.launch {
            runCatching {
                val ctx = com.wordocious.app.App.instance
                val info = ctx.packageManager.getPackageInfo(ctx.packageName, 0)
                val code = androidx.core.content.pm.PackageInfoCompat.getLongVersionCode(info)
                val version = "${info.versionName} ($code)"
                client.postgrest["profiles"].update({
                    set("app_version", version)
                    set("app_platform", "android")
                    set("last_seen_at", java.time.Instant.now().toString())
                    // §294/§296: the client's IANA timezone for a future server-side reminder
                    // on the Monday race boundary (profiles.timezone, additive).
                    set("timezone", java.util.TimeZone.getDefault().id)
                }) { filter { eq("id", userId) } }
            }
        }
    }

    /** Refresh profile (e.g. after recording a game result). */
    fun refreshProfile() {
        val uid = userId ?: return
        scope.launch { loadProfile(uid) }
    }

    /**
     * Write Pro entitlement after a verified Play Billing purchase / restore —
     * mirrors iOS AuthService.applyProGrant and web stripe-fulfillment:
     * is_pro=true + pro_expires_at, never shrinking an existing window.
     *
     * Returns false if the write did not land, so the caller can leave the
     * purchase unconsumed and retry — a swallowed failure here permanently
     * loses a paid entitlement.
     *
     * This deliberately does NOT write `streak_shields`. It used to add +4 on a
     * purchase while the Play RTDN webhook added its own +4, so a subscriber
     * banked 8 a period instead of 4; and since the column is client-writable,
     * the client half was the forgeable one. Paid shields are server-only now
     * (PAYMENTS_RUNBOOK "streak shields"). Dropping the write also retires a
     * live hazard: the old read-modify-write took the total from the in-memory
     * profile, which is null during the launch reconcile race, and would then
     * store `addShields` alone — zeroing a paying subscriber's balance.
     */
    suspend fun applyProGrant(expiresAtIso: String): Boolean {
        val uid = userId ?: runCatching { client.auth.currentUserOrNull()?.id }.getOrNull() ?: return false
        // Never shrink a longer stored window. Play tells us what Play sold;
        // pro_expires_at also carries referral rewards (+3d per redemption, +90d
        // when a referred friend goes annual), admin comps and stacked Day
        // Passes. Overwriting it took a player holding 97 banked days who then
        // bought monthly down to 30 — 67 days destroyed with nothing to restore
        // them from. If the profile hasn't loaded we have no window to preserve;
        // the RTDN webhook re-reads the row itself and is the real backstop.
        val target = parseTimestamp(expiresAtIso)
        val existing = _profile.value?.proExpiresAt?.let { parseTimestamp(it) }
        val effective =
            if (target != null && existing != null && existing.isAfter(target)) existing.toString()
            else expiresAtIso
        val ok = runCatching {
            client.postgrest["profiles"].update({
                set("is_pro", true)
                set("pro_expires_at", effective)
            }) { filter { eq("id", uid) } }
        }.isSuccess
        loadProfile(uid)
        return ok
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
