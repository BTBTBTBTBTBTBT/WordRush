import SwiftUI

/// Single-sourced static copy (FAQ / Help / About / Support), fetched from
/// wordocious.com/api/content so the prose stays in one place (web
/// lib/content/static-content.ts). Mirrors GuideService but PERSISTS the last
/// fetch to UserDefaults, so content renders offline after the first load.
/// Privacy + Terms are NOT here — they stay hardcoded in InfoPages for
/// offline / pre-sign-in compliance.
@MainActor
final class ContentService: ObservableObject {
    static let shared = ContentService()

    @Published private(set) var faq: [FaqSection] = []
    @Published private(set) var helpModes: [HelpMode] = []
    @Published private(set) var helpFaq: [FaqItem] = []
    @Published private(set) var about: [ContentSection] = []
    @Published private(set) var support: [ContentSection] = []

    private static let cacheKey = "static-content-cache-v1"
    private var loaded = false

    struct FaqItem: Codable, Identifiable { let q: String; let a: String; var id: String { q } }
    struct FaqSection: Codable, Identifiable { let heading: String; let items: [FaqItem]; var id: String { heading } }
    struct HelpMode: Codable, Identifiable { let title: String; let desc: String; let accent: String; let glyph: String?; var id: String { title } }
    struct ContentSubItem: Codable, Identifiable { let heading: String; let body: String; let accent: String?; var id: String { heading } }
    struct ContentSection: Codable, Identifiable { let heading: String; let paragraphs: [String]?; let items: [ContentSubItem]?; var id: String { heading } }
    struct Payload: Codable {
        let faq: [FaqSection]; let helpModes: [HelpMode]; let helpFaq: [FaqItem]
        let about: [ContentSection]; let support: [ContentSection]
    }

    init() { if let p = Self.readCache() { apply(p) } }

    /// Fetch once per launch (after the first success the cache also seeds init).
    func load() async {
        if loaded { return }
        guard let url = URL(string: "https://wordocious.com/api/content") else { return }
        guard let (data, _) = try? await URLSession.shared.data(from: url),
              let payload = try? JSONDecoder().decode(Payload.self, from: data) else { return }
        loaded = true
        apply(payload)
        Self.writeCache(data)
    }

    private func apply(_ p: Payload) {
        faq = p.faq; helpModes = p.helpModes; helpFaq = p.helpFaq; about = p.about; support = p.support
    }

    /// Help-sheet description for a mode title (nil until loaded → caller falls back).
    func helpDesc(forTitle title: String) -> String? { helpModes.first { $0.title == title }?.desc }

    private static func readCache() -> Payload? {
        guard let data = UserDefaults.standard.data(forKey: cacheKey) else { return nil }
        return try? JSONDecoder().decode(Payload.self, from: data)
    }
    private static func writeCache(_ data: Data) { UserDefaults.standard.set(data, forKey: cacheKey) }
}
