package com.wordocious.app.data

import android.net.Uri
import com.wordocious.core.GameMode
import io.github.jan.supabase.auth.auth
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.launch

// App-link router — Android side of iOS DeepLink.swift. The manifest claims
// only wordocious.com/vs/join paths (a VS invite's recipient usually has the
// app); referral /join links stay in the browser on purpose, since their
// audience is brand-new users and redemption is a web flow.
//
// MainActivity feeds intents in; MainScreen collects [vsInvite] and presents
// the private match through the same state the pending-invites banner uses.
// (Line comments throughout: Kotlin block comments NEST, so a literal
// "slash-star" in a path wildcard inside KDoc breaks compilation.)
object DeepLinkRouter {
    /** (mode, inviteCode) resolved from a tapped app link; consumer clears it. */
    val vsInvite = MutableStateFlow<Pair<GameMode, String>?>(null)
    /** A recovery link established a session — show the native new-password dialog. */
    val showNewPassword = MutableStateFlow(false)
    /** Cross-device auth link (PKCE verifier on another client) — finish in the browser. */
    val browserFallback = MutableStateFlow<String?>(null)

    /** Returns true when the URI was ours (vs/join, auth/reset, auth/confirm). */
    fun handle(uri: Uri?): Boolean {
        uri ?: return false
        val host = uri.host?.lowercase() ?: return false
        if (host != "wordocious.com" && host != "www.wordocious.com") return false
        val parts = uri.pathSegments

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
}
