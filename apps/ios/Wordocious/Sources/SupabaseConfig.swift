import Foundation

/// Supabase connection config. The anon (publishable) key is safe to ship in
/// the client — it's the same key embedded in the web bundle and is gated by
/// Row Level Security. Project: eniiqqsxpmuyrspvepiw.
enum SupabaseConfig {
    static let url = URL(string: "https://eniiqqsxpmuyrspvepiw.supabase.co")!

    /// Public anon (publishable) key — same key shipped in the web bundle,
    /// gated by Row Level Security. Safe to embed in the client.
    static let anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVuaWlxcXN4cG11eXJzcHZlcGl3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5NTYwMjksImV4cCI6MjA4OTUzMjAyOX0.1_KbkFzL1eHm2xcnLmfzal5TCnFNhCYgPgklG6w4vSQ"

    static var isConfigured: Bool { !anonKey.isEmpty }
}
