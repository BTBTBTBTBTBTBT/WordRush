package com.wordocious.app.data

import android.content.Context
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Columns
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable

/**
 * 13+ age check state (FRIDAY-QUEUE item 29). Rules: [AgeCheck]; screens: ui/AgeCheckScreen.kt. Mirrors
 * iOS AgeCheckStore.swift. Owns what the device remembers and everything that must wait for it:
 *
 *  - the answer sticks on the device ("under" can never be retried with a different year)
 *  - nothing is created or stored for an under-13 player: no account, no guest profile, no push token,
 *    no crash reports — Sentry (manifest auto-init is OFF), ads and FCM registration start only through
 *    [startServices]
 *  - signed-in accounts mirror the answer to the server (POST /api/account/age; the age_confirmed_13
 *    column is not user-writable). An existing account that answers "under" is signed out; the server
 *    purges it after a grace window.
 *  - the `age_check` off-switch (admin > Ops > Feature flags) turns the whole thing off
 */
object AgeCheckStore {
    private const val KEY = "age-check"
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    private val _stored = MutableStateFlow<AgeCheck.Stored?>(null)
    val stored: StateFlow<AgeCheck.Stored?> = _stored.asStateFlow()

    /** A signed-in account on a fresh device may already be confirmed server-side; true once we know. */
    private val _serverCheckDone = MutableStateFlow(false)
    val serverCheckDone: StateFlow<Boolean> = _serverCheckDone.asStateFlow()

    /**
     * Recovery from a mistaken "under" (2026-10-12): a sign-in that started from the lockout's "A grown-up? Sign in" is
     * pending its server check (in memory only); [recoveryFailed] is the lockout screen's one explanatory line.
     */
    private val _recoveryPending = MutableStateFlow(false)
    val recoveryPending: StateFlow<Boolean> = _recoveryPending.asStateFlow()
    private val _recoveryFailed = MutableStateFlow(false)
    val recoveryFailed: StateFlow<Boolean> = _recoveryFailed.asStateFlow()

    private var startedServices = false
    private var syncing = false
    @Volatile private var loaded = false

    /** Reads the stored answer (idempotent). Call before anything that must wait for the check. */
    fun load() {
        if (loaded) return
        loaded = true
        _stored.value = AgeCheck.parse(SettingsPref.get(KEY, ""))
    }

    /** Passed on this device, or the off-switch is off (fail open: unknown flags = the check is live). */
    val isCleared: Boolean
        get() { load(); return _stored.value?.state == AgeCheck.State.OK || !FlagsService.isLive("age_check") }

    val isUnder: Boolean
        get() { load(); return _stored.value?.state == AgeCheck.State.UNDER }

    fun answer(context: Context, year: Int) {
        load()
        if (_stored.value != null) return   // never overwritten: no retry with a different year
        val s = when (AgeCheck.verdict(year)) {
            AgeCheck.Verdict.INVALID -> return
            AgeCheck.Verdict.PASS -> AgeCheck.Stored(AgeCheck.State.OK, year)
            AgeCheck.Verdict.UNDER -> AgeCheck.Stored(AgeCheck.State.UNDER, year)
        }
        SettingsPref.set(KEY, AgeCheck.encode(s))
        _stored.value = s
        if (s.state == AgeCheck.State.OK) startServices(context)
        syncWithServer()
    }

    /** Sentry + ads + FCM: only after the check passes (also called from the launch coroutine). */
    fun startServices(context: Context) {
        if (!isCleared || startedServices) return
        startedServices = true
        startSentry(context.applicationContext)
        runCatching { com.google.firebase.messaging.FirebaseMessaging.getInstance().isAutoInitEnabled = true }
        PushRegistration.register()
    }

    /** Manifest auto-init is off (the DSN stays in the release manifest), so crash reporting is started here. */
    fun startSentry(context: Context) {
        runCatching { io.sentry.android.core.SentryAndroid.init(context) }
    }

    /** The lockout's "A grown-up? Sign in" was tapped: the next sign-in is checked against its account's server flag. */
    fun beginRecovery() {
        if (!isUnder) return
        _recoveryPending.value = true
        _recoveryFailed.value = false
    }

    /**
     * Confirmed -> the stored "under" becomes a passing "ok" and the app carries on. Otherwise the account is signed out
     * again and NOTHING is posted for it (it must not be flagged or purged just for trying).
     */
    private suspend fun finishRecovery(confirmed: Boolean?) {
        _recoveryPending.value = false
        when (val d = AgeRecovery.decide(confirmed)) {
            is AgeRecovery.Decision.Unlock -> {
                _recoveryFailed.value = false
                SettingsPref.set(KEY, AgeCheck.encode(d.stored))
                _stored.value = d.stored
                _serverCheckDone.value = true
                startServices(com.wordocious.app.App.instance)
            }
            AgeRecovery.Decision.StayLocked -> {
                _recoveryFailed.value = true
                AuthService.signOut()
            }
        }
    }

    @Serializable
    private data class AgeRow(
        @kotlinx.serialization.SerialName("age_confirmed_13") val confirmed: Boolean? = null,
    )

    /**
     * For a signed-in account: adopt a server confirmation on a fresh device, mirror a device answer up,
     * and sign an under-13 account out. Safe to call repeatedly.
     */
    fun syncWithServer() {
        // A recovery sign-in may have no profile row yet (a brand-new account): the session's user id is enough to look.
        val uid = AuthService.userId
            ?: (if (_recoveryPending.value) runCatching { SupabaseConfig.client.auth.currentUserOrNull()?.id }.getOrNull() else null)
            ?: return
        if (syncing) return
        syncing = true
        scope.launch {
            try {
                val row = runCatching {
                    SupabaseConfig.client.postgrest["profiles"]
                        .select(Columns.raw("age_confirmed_13")) { filter { eq("id", uid) } }
                        .decodeSingleOrNull<AgeRow>()
                }.getOrNull()
                val confirmed = row?.confirmed ?: false
                _serverCheckDone.value = true

                val local = _stored.value
                // A sign-in that started from the under-13 lockout: the account's flag decides (never posts the under answer).
                if (local?.state == AgeCheck.State.UNDER && _recoveryPending.value) {
                    finishRecovery(row?.confirmed)
                    return@launch
                }
                // The server keeps only the yes/no flag (no birth year); a confirmed account adopts a passing year here.
                if (local == null && confirmed) {
                    val s = AgeCheck.Stored(AgeCheck.State.OK, java.time.LocalDate.now().year - 18)
                    SettingsPref.set(KEY, AgeCheck.encode(s))
                    _stored.value = s
                    startServices(com.wordocious.app.App.instance)
                    return@launch
                }
                val s = local ?: return@launch
                if (s.state == AgeCheck.State.OK && confirmed) return@launch
                if (!post(s.year)) return@launch
                if (s.state == AgeCheck.State.UNDER) AuthService.signOut()
            } finally {
                syncing = false
            }
        }
    }

    /** POST /api/account/age. False only on a transport/server failure (retry next launch). */
    private suspend fun post(year: Int): Boolean = withContext(Dispatchers.IO) {
        val token = runCatching { SupabaseConfig.client.auth.currentSessionOrNull()?.accessToken }.getOrNull()
            ?: return@withContext false
        runCatching {
            val conn = java.net.URL("https://wordocious.com/api/account/age").openConnection() as java.net.HttpURLConnection
            conn.requestMethod = "POST"
            conn.setRequestProperty("Authorization", "Bearer $token")
            conn.setRequestProperty("Content-Type", "application/json")
            conn.doOutput = true
            conn.connectTimeout = 15000
            conn.readTimeout = 15000
            conn.outputStream.use { it.write("""{"year":$year}""".toByteArray()) }
            val ok = conn.responseCode in 200..299
            conn.disconnect()
            ok
        }.getOrDefault(false)
    }
}
