package com.wordocious.app.data

import android.net.Uri
import com.wordocious.core.GameMode
import io.github.jan.supabase.auth.auth
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.launch

// App-link router — Android side of iOS DeepLink.swift. The manifest claims
// wordocious.com/vs/join + /vs/challenge paths (a VS invite's recipient usually has the
// app) and the referral /join/<CODE> links: the native landing keeps the code across a
// sign-up (signup attribution) and redeems it once signed in; without the app, the web.
//
// MainActivity feeds intents in; MainScreen collects [vsInvite] and presents
// the private match through the same state the pending-invites banner uses.
// (Line comments throughout: Kotlin block comments NEST, so a literal
// "slash-star" in a path wildcard inside KDoc breaks compilation.)
object DeepLinkRouter {
    /** (mode, inviteCode) resolved from a tapped app link; consumer clears it. */
    val vsInvite = MutableStateFlow<Pair<GameMode, String>?>(null)
    /** An async challenge code to race (/vs/challenge/<code>, VS overhaul §4);
     *  MainScreen opens the race flow and clears it. */
    val vsChallenge = MutableStateFlow<String?>(null)
    /** The "someone's looking" push (/vs/live/<MODE>, VS overhaul §13): MainScreen
     *  opens that mode's live search (same as LIVE in the lobby) and clears it. */
    val vsLive = MutableStateFlow<GameMode?>(null)
    /** A referral / gift-a-week invite (wordocious.com/join/<CODE>): the native landing
     *  (ui/JoinLanding.kt) shows it and clears it. The code is also kept in
     *  [JoinLandingRules.PENDING_KEY] until redeemed, so a sign-up in between keeps it. */
    val referralCode = MutableStateFlow<String?>(null)
    /** A recovery link established a session — show the native new-password dialog. */
    val showNewPassword = MutableStateFlow(false)
    /** Cross-device auth link (PKCE verifier on another client) — finish in the browser. */
    val browserFallback = MutableStateFlow<String?>(null)
    /** A widget chip asked for this mode's daily (wordocious://daily/KEY —
     *  iOS DeepLink.swift's daily route); MainScreen consumes and clears it. */
    val dailyMode = MutableStateFlow<GameMode?>(null)
    /** The small widget's tap (wordocious://home): show the Home tab (founder 10-05). */
    val homeRequest = MutableStateFlow(false)
    /** A Friends pocket game to open (/friends/games/<id> — the push url, Friends
     *  overhaul §7); MainScreen opens the game screen and clears it. */
    val friendlyGame = MutableStateFlow<String?>(null)

    /** Returns true when the URI was ours (vs/join, auth/reset, auth/confirm,
     *  or the widget's wordocious://daily/KEY). */
    fun handle(uri: Uri?): Boolean {
        uri ?: return false
        val host = uri.host?.lowercase() ?: return false

        // Widget chips: wordocious://daily/DUEL etc. Explicit intents from our
        // own PendingIntents, so no manifest intent-filter is involved.
        if (uri.scheme == "wordocious" && host == "home") {
            homeRequest.value = true
            return true
        }
        if (uri.scheme == "wordocious" && host == "daily") {
            val key = uri.pathSegments.firstOrNull() ?: return false
            val mode = runCatching { GameMode.valueOf(key) }.getOrNull() ?: return false
            dailyMode.value = mode
            return true
        }

        if (host != "wordocious.com" && host != "www.wordocious.com") return false
        val parts = uri.pathSegments

        // Referral invite: /join/<CODE> (web app/join/[code]; codes are [A-Z2-9]{4,16}).
        if (parts.size == 2 && parts[0] == "join") {
            val code = JoinLandingRules.normalize(parts[1]) ?: return false
            SettingsPref.set(JoinLandingRules.PENDING_KEY, code)
            referralCode.value = code
            return true
        }

        if (parts.size == 3 && parts[0] == "vs" && parts[1] == "challenge") {
            vsChallenge.value = parts[2].uppercase()
            return true
        }

        // Push only (the manifest doesn't claim /friends/games): a pocket game's screen.
        if (parts.size == 3 && parts[0] == "friends" && parts[1] == "games") {
            val id = parts[2]
            if (!Regex("^[0-9a-fA-F-]{36}$").matches(id)) return false
            friendlyGame.value = id.lowercase()
            return true
        }

        // Push only (the manifest doesn't claim /vs/live): a VS mode's live queue.
        if (parts.size == 3 && parts[0] == "vs" && parts[1] == "live") {
            val key = parts[2].uppercase()
            if (key !in com.wordocious.core.VsLobby.VS_MODE_ORDER) return false
            vsLive.value = runCatching { GameMode.valueOf(key) }.getOrNull() ?: return false
            return true
        }

        // Branded one-link invite (9f): wordocious.com/vs/<8-char CODE> is a live VS invite OR a
        // race-my-run challenge; the server knows which. Try the live invite, then the challenge.
        if (parts.size == 2 && parts[0] == "vs") {
            val code = parts[1].uppercase()
            if (code.length != 8 || code.any { it !in "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" }) return false
            CoroutineScope(Dispatchers.IO).launch {
                val modeStr = InviteService.lookupMode(code)
                val mode = modeStr?.let { runCatching { GameMode.valueOf(it) }.getOrNull() }
                if (mode != null) vsInvite.value = mode to code else vsChallenge.value = code
            }
            return true
        }

        if (parts.size == 3 && parts[0] == "vs" && parts[1] == "join") {
            val code = parts[2].uppercase()
            CoroutineScope(Dispatchers.IO).launch {
                // Same resolution path as the lobby's join-by-code field.
                val modeStr = InviteService.lookupMode(code)
                val mode = modeStr?.let { runCatching { GameMode.valueOf(it) }.getOrNull() } ?: return@launch
                vsInvite.value = mode to code
            }
            return true
        }

        // Auth links: exchange the one-time code in-app when THIS device
        // requested the email (PKCE verifier in local storage); otherwise
        // fall back to the branded web page in a browser.
        if (parts.size == 2 && parts[0] == "auth" && (parts[1] == "reset" || parts[1] == "confirm")) {
            val isReset = parts[1] == "reset"
            val code = uri.getQueryParameter("code")
            CoroutineScope(Dispatchers.IO).launch {
                val ok = code != null && runCatching {
                    SupabaseConfig.client.auth.exchangeCodeForSession(code)
                }.isSuccess
                if (ok) {
                    if (isReset) showNewPassword.value = true
                    // Confirm: the session listener signs the user in — done.
                } else {
                    browserFallback.value = uri.toString()
                }
            }
            return true
        }

        return false
    }

    /**
     * A tapped push: the system-drawn FCM notification hands the launcher the
     * message's data as intent extras, so the server's `url` arrives here
     * (e.g. "/vs/challenge/ABCD2345", "/vs/live/DUEL", "/friends/games/<id>"). Only the
     * VS and pocket-game routes are handled; any other url just opens the app.
     */
    fun handlePushUrl(url: String?): Boolean {
        val path = url?.trim()?.takeIf { it.startsWith("/vs/") || it.startsWith("/friends/games/") } ?: return false
        return handle(Uri.parse("https://wordocious.com$path"))
    }
}
