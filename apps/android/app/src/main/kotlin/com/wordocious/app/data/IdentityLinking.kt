package com.wordocious.app.data

/**
 * Linked sign-ins (founder, 2026-09-30; web lib/identity-linking.ts parity). A tester who signed
 * up with Google later used Sign in with Apple, and Apple's Hide My Email relay made Supabase
 * create a second account. Settings lists the sign-ins on the account and links Google onto it
 * with supabase-kt manual linking (auth.linkIdentity → /user/identities/authorize, browser round
 * trip back to wordocious://auth-callback). Apple can't be linked here: the Supabase Apple
 * provider is configured for native iOS only (no web Services ID), so Android points to iOS.
 *
 * Pure helpers only — JVM-tested in IdentityLinkingTest.
 */
object IdentityLinking {
    /** Providers Android can link (Apple goes through the iOS app). */
    val LINKABLE = listOf("google")

    fun providerLabel(provider: String): String = when (provider) {
        "google" -> "Google"
        "apple" -> "Apple"
        "email" -> "Email"
        "facebook" -> "Facebook"
        else -> if (provider.isEmpty()) "Unknown" else provider.replaceFirstChar { it.uppercaseChar() }
    }

    /** Apple's Hide My Email relay (the address that caused the duplicate). */
    fun isHideMyEmail(email: String?): Boolean =
        email != null && email.trim().endsWith("@privaterelay.appleid.com", ignoreCase = true)

    /** Never offer Unlink on the account's last way in. */
    fun canUnlink(identityCount: Int): Boolean = identityCount > 1

    data class RedirectError(val code: String, val description: String)

    /** Error params on an OAuth return (query or #fragment; query wins). */
    fun readRedirectError(uri: String): RedirectError? {
        val parsed = runCatching { java.net.URI(uri) }.getOrNull() ?: return null
        fun params(raw: String?): Map<String, String> = raw.orEmpty().split('&').mapNotNull { part ->
            val i = part.indexOf('=')
            if (i <= 0) return@mapNotNull null
            val k = part.substring(0, i)
            val v = runCatching { java.net.URLDecoder.decode(part.substring(i + 1), "UTF-8") }.getOrDefault(part.substring(i + 1))
            k to v
        }.toMap()
        val query = params(parsed.rawQuery)
        val hash = params(parsed.rawFragment)
        fun pick(k: String) = query[k] ?: hash[k] ?: ""
        val code = pick("error_code").ifEmpty { pick("error") }
        val description = pick("error_description")
        if (code.isEmpty() && description.isEmpty()) return null
        return RedirectError(code.ifEmpty { "unspecified_error" }, description)
    }

    private fun accountNoun(provider: String?) = when (provider) {
        "apple" -> "That Apple ID"
        "google" -> "That Google account"
        else -> "That sign-in"
    }

    fun linkErrorMessage(code: String, description: String, provider: String?): String {
        val c = code.lowercase()
        val d = description.lowercase()
        val label = provider?.let { providerLabel(it) }
        return when {
            c == "identity_already_exists" || "already linked" in d || "already exists" in d ->
                "${accountNoun(provider)} is already used by another Wordocious account. Sign in with it and delete that account in Settings, then link it here."
            c == "manual_linking_disabled" || "manual linking" in d ->
                "Linking sign-ins isn’t available yet. Please try again later."
            c == "access_denied" || "cancel" in d || "denied" in d ->
                "${label ?: "Sign-in"} linking was canceled."
            c == "provider_disabled" || "provider is not enabled" in d ->
                "${label ?: "That provider"} sign-in isn’t available right now."
            description.isNotEmpty() -> description
            else -> "Couldn’t link ${label ?: "that sign-in"}. Please try again."
        }
    }

    fun unlinkErrorMessage(code: String, description: String): String = when (code.lowercase()) {
        "single_identity_not_deletable" -> "This is your only way to sign in, so it can’t be removed."
        "identity_not_found" -> "That sign-in was already removed."
        "email_conflict_identity_not_deletable" -> "This sign-in carries your account email, so it can’t be removed right now."
        else -> description.ifEmpty { "Couldn’t remove that sign-in. Please try again." }
    }
}
