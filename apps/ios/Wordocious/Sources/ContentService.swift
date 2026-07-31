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

    /// Refresh the remote copy. The on-disk cache seeds `init`, so the screen
    /// still renders instantly — this only decides how fast an EDIT reaches a
    /// phone.
    ///
    /// It used to return early once per launch AND go through
    /// `URLSession.shared`, which honours the response's `max-age=3600`. Two
    /// layers of staleness on top of each other: a backgrounded app never
    /// refetched at all, and even a cold launch could serve an hour-old copy.
    /// Editing this content is supposed to be a deploy, not a release — a new
    /// How to Play section was live on the web and still missing on the phone.
    /// Fetch every time, and go past the URL cache to do it; the payload is a
    /// few KB and these screens are opened rarely.
    func load() async {
        guard let url = URL(string: "https://wordocious.com/api/content") else { return }
        var req = URLRequest(url: url)
        req.cachePolicy = .reloadIgnoringLocalCacheData
        guard let (data, _) = try? await URLSession.shared.data(for: req),
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
