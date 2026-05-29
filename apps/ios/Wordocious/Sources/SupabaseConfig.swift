import Foundation

/// Supabase connection config. The anon (publishable) key is safe to ship in
/// the client — it's the same key embedded in the web bundle and is gated by
/// Row Level Security. Project: eniiqqsxpmuyrspvepiw.
enum SupabaseConfig {
    static let url = URL(string: "https://eniiqqsxpmuyrspvepiw.supabase.co")!

    /// TODO: paste the NEXT_PUBLIC_SUPABASE_ANON_KEY value here (the public
    /// anon key from the web app's env / Supabase dashboard → Settings → API).
    static let anonKey = "PASTE_ANON_KEY_HERE"

    static var isConfigured: Bool { anonKey != "PASTE_ANON_KEY_HERE" && !anonKey.isEmpty }
}
