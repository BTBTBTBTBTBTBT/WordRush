package com.wordocious.app.data

import io.github.jan.supabase.createSupabaseClient
import io.github.jan.supabase.auth.Auth
import io.github.jan.supabase.postgrest.Postgrest
import io.github.jan.supabase.serializer.KotlinXSerializer
import io.github.jan.supabase.storage.Storage
import io.ktor.client.engine.android.Android
import kotlinx.serialization.json.Json

/**
 * Supabase client — same project as iOS (eniiqqsxpmuyrspvepiw).
 * The anon key is the same key shipped in the web bundle, gated by Row Level
 * Security. Safe to embed in the client.
 * Mirrors apps/ios/Wordocious/Sources/SupabaseConfig.swift.
 */
object SupabaseConfig {
    const val URL = "https://eniiqqsxpmuyrspvepiw.supabase.co"
    const val ANON_KEY =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVuaWlxcXN4cG11eXJzcHZlcGl3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5NTYwMjksImV4cCI6MjA4OTUzMjAyOX0.1_KbkFzL1eHm2xcnLmfzal5TCnFNhCYgPgklG6w4vSQ"

    val client by lazy {
        createSupabaseClient(
            supabaseUrl = URL,
            supabaseKey = ANON_KEY,
        ) {
            // Tolerate extra/missing columns when decoding (we `select *` like the web).
            defaultSerializer = KotlinXSerializer(Json {
                ignoreUnknownKeys = true
                coerceInputValues = true
            })
            // scheme/host define the redirect Supabase sends the browser back
            // to after a web OAuth round-trip: wordocious://auth-callback.
            // Needed by the browser fallback in AuthService.signInWithGoogle —
            // when Credential Manager can't mint a token (a device Google
            // account stuck in "reauth required" kills EVERY on-device path),
            // the browser flow still works because it authenticates against the
            // user's Google session, not the device account.
            // MUST be listed in Supabase → Authentication → URL Configuration →
            // Redirect URLs, or Supabase refuses the redirect.
            install(Auth) {
                scheme = "wordocious"
                host = "auth-callback"
            }
            install(Postgrest)
            install(Storage)
            // Android HTTP engine
            httpEngine = Android.create()
        }
    }
}
