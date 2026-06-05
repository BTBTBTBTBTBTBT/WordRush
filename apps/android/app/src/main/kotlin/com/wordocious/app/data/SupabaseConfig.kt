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
            install(Auth)
            install(Postgrest)
            install(Storage)
            // Android HTTP engine
            httpEngine = Android.create()
        }
    }
}
