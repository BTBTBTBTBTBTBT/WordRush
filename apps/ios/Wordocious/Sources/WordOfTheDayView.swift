import SwiftUI
import WordociousCore

/// "Word of the Day" card — ports the web WordOfTheDay component: picks a
/// deterministic daily word from the bundled solutions list and fetches its
/// definition from the free dictionaryapi.dev (no key), trying up to 20
/// words from today's index until one has a definition.
struct WordOfTheDayView: View {
    @State private var info: WordInfo?
    @State private var fetchedDay: Int?
    @Environment(\.scenePhase) private var scenePhase

    /// UTC day index — matches the web's `Math.floor(Date.now()/86400000)`.
    private var todayIndex: Int { Int(Date().timeIntervalSince1970 / 86400) }

    struct WordInfo {
        let word: String
        var phonetic: String? = nil
        var partOfSpeech: String? = nil
        var definition: String? = nil
    }

    var body: some View {
        Group {
            if let info {
                content(info)
            } else {
                placeholderCard
            }
        }
        // Re-fetch when the UTC day rolls over (the Home tab stays alive in the
        // TabView, so a one-shot `if info == nil` would show yesterday's word
        // forever). Including scenePhase in the id forces a re-check on foreground.
        .task(id: "\(todayIndex)-\(scenePhase)") {
            if fetchedDay != todayIndex {
                let fresh = await fetch()
                info = fresh
                fetchedDay = todayIndex
            }
        }
    }

    private func content(_ info: WordInfo) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack {
                HStack(spacing: 6) {
                    Image("book-open").renderingMode(.template).resizable().scaledToFit()
                        .frame(width: 12, height: 12).foregroundStyle(Theme.textMuted)
                    Text("WORD OF THE DAY").font(Brand.font(10, .heavy)).tracking(0.8)
                        .foregroundStyle(Theme.textMuted)
                }
                Spacer()
                Text("A new word every day").font(Brand.font(10, .bold))
                    .foregroundStyle(Color(hex: 0xC4B5FD))
            }
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text(info.word.prefix(1).uppercased() + info.word.dropFirst().lowercased())
                    .font(Brand.font(16, .black)).foregroundStyle(Theme.textPrimary)
                if let p = info.phonetic, !p.isEmpty {
                    Text(p).font(Brand.font(12, .bold)).foregroundStyle(Theme.textMuted)
                }
                if let pos = info.partOfSpeech, !pos.isEmpty {
                    Text(pos).font(Brand.font(10, .heavy)).italic().foregroundStyle(Theme.primary)
                }
            }
            if let def = info.definition, !def.isEmpty {
                Text(def).font(Brand.font(11, .bold)).foregroundStyle(Color(hex: 0x4B5563))
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 2)
            }
        }
        .padding(.horizontal, 12).padding(.vertical, 8)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 14).fill(Theme.surface))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Theme.border, lineWidth: 1.5))
    }

    private var placeholderCard: some View {
        RoundedRectangle(cornerRadius: 14).fill(Theme.surface)
            .overlay(RoundedRectangle(cornerRadius: 14).stroke(Theme.border, lineWidth: 1.5))
            .frame(height: 78)
            .overlay(ProgressView())
    }

    private func fetch() async -> WordInfo {
        let solutions = GameDictionary.shared.allSolutions()
        let daysSinceEpoch = todayIndex
        guard !solutions.isEmpty else { return WordInfo(word: "WORDS") }

        for offset in 0..<20 {
            let word = solutions[(daysSinceEpoch + offset) % solutions.count]
            if let info = await lookup(word) { return info }
        }
        return WordInfo(word: solutions[daysSinceEpoch % solutions.count])
    }

    private func lookup(_ word: String) async -> WordInfo? { await Self.definition(for: word) }

    /// Shared dictionaryapi.dev lookup (used by Word of the Day + post-game).
    static func definition(for word: String) async -> WordInfo? {
        guard let url = URL(string: "https://api.dictionaryapi.dev/api/v2/entries/en/\(word.lowercased())") else { return nil }
        guard let (data, resp) = try? await URLSession.shared.data(from: url),
              (resp as? HTTPURLResponse)?.statusCode == 200,
              let arr = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]],
              let entry = arr.first else { return nil }

        let phonetic = (entry["phonetics"] as? [[String: Any]])?.compactMap { $0["text"] as? String }.first
            ?? entry["phonetic"] as? String
        let meaning = (entry["meanings"] as? [[String: Any]])?.first
        let partOfSpeech = meaning?["partOfSpeech"] as? String
        let definition = (meaning?["definitions"] as? [[String: Any]])?.first?["definition"] as? String
        guard let definition, !definition.isEmpty else { return nil }
        return WordInfo(word: word, phonetic: phonetic, partOfSpeech: partOfSpeech, definition: definition)
    }
}
