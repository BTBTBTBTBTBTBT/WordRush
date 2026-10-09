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

    @Serializable
    private data class AgeRow(
        @kotlinx.serialization.SerialName("age_confirmed_13") val confirmed: Boolean? = null,
        @kotlinx.serialization.SerialName("age_birth_year") val year: Int? = null,
    )

    /**
     * For a signed-in account: adopt a server confirmation on a fresh device, mirror a device answer up,
     * and sign an under-13 account out. Safe to call repeatedly.
     */
    fun syncWithServer() {
        val uid = AuthService.userId ?: return
        if (syncing) return
        syncing = true
        scope.launch {
            try {
                val row = runCatching {
                    SupabaseConfig.client.postgrest["profiles"]
                        .select(Columns.raw("age_confirmed_13, age_birth_year")) { filter { eq("id", uid) } }
                        .decodeSingleOrNull<AgeRow>()
                }.getOrNull()
                val confirmed = row?.confirmed ?: false
                _serverCheckDone.value = true

                val local = _stored.value
                val serverYear = row?.year
                if (local == null && confirmed && serverYear != null && AgeCheck.verdict(serverYear) == AgeCheck.Verdict.PASS) {
                    val s = AgeCheck.Stored(AgeCheck.State.OK, serverYear)
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
