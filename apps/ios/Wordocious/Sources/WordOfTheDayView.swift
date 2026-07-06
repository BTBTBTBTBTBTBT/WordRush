import SwiftUI
import WordociousCore

/// "Word of the Day" card — ports the web WordOfTheDay component: picks a
/// deterministic daily word from the bundled solutions list and fetches its
/// definition from the free dictionaryapi.dev (no key), trying up to 20
/// words from today's index until one has a definition.
struct WordOfTheDayView: View {
    @State private var info: WordInfo?
    @State private var fetchedDay: Int?
    @State private var showWords = false
    @Environment(\.scenePhase) private var scenePhase

    /// Day index of the LOCAL calendar date (not Date()/86400, which rolls at
    /// UTC midnight — 7 PM Central — and flipped the home card to tomorrow's
    /// word mid-evening while the Words archive still showed today's). Parse
    /// todayLocal() (yyyy-MM-dd) with a UTC formatter — the same idiom as
    /// ProperNoundleEngine.daysSinceEpoch; matches web commit ad2ef44.
    private var todayIndex: Int {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.calendar = Calendar(identifier: .gregorian)
        f.dateFormat = "yyyy-MM-dd"
        f.timeZone = TimeZone(identifier: "UTC")
        guard let d = f.date(from: LeaderboardService.todayLocal()) else {
            return Int(Date().timeIntervalSince1970 / 86400)
        }
        return Int(d.timeIntervalSince1970 / 86400)
    }

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
                // Day-keyed disk cache: the word only changes at the UTC day
                // rollover, so after the first successful fetch of the day every
                // subsequent home entry renders instantly with ZERO network.
                if let (cached, resolved) = Self.loadCached(day: todayIndex) {
                    info = cached
                    if resolved {
                        fetchedDay = todayIndex
                        return
                    }
                    // Unresolved (no-definition) day: render the cached word
                    // instantly — no skeleton — then retry the lookup silently
                    // below (same foreground-retry semantics as before).
                }
                let fresh = await fetch()
                info = fresh
                // Only cache the day once we actually got a definition. If every
                // dictionaryapi.dev lookup failed (transient network / 429 from the
                // rapid burst), leave fetchedDay unset so the next foreground or day
                // re-check retries — otherwise a momentary failure leaves the bare
                // word (e.g. "Baton") definition-less until midnight.
                if let def = fresh.definition, !def.isEmpty {
                    fetchedDay = todayIndex
                    Self.storeCached(fresh, day: todayIndex, resolved: true)
                } else {
                    // Store the no-definition fallback too (marked unresolved) so a
                    // flaky dictionaryapi.dev day doesn't refetch 20 words per visit;
                    // the resolved flag lets a later visit still try once more.
                    Self.storeCached(fresh, day: todayIndex, resolved: false)
                }
            }
        }
        // Tappable → the full Word of the Day archive (web parity: the card links
        // to /words). presentationDetents large so the list has room.
        .contentShape(Rectangle())
        .onTapGesture { showWords = true }
        .sheet(isPresented: $showWords) { WordsView(navTitle: "Word of the Day").presentationDetents([.large]) }
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
                HStack(spacing: 2) {
                    Text("Past words").font(Brand.font(10, .bold)).foregroundStyle(Color(hex: 0xC4B5FD))
                    Image(systemName: "chevron.right").font(.system(size: 8, weight: .black)).foregroundStyle(Color(hex: 0xC4B5FD))
                }
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
        // Web parity: structural animate-pulse skeleton (label bar, word bar,
        // definition bar) instead of a centered spinner.
        VStack(alignment: .leading, spacing: 8) {
            SkeletonBlock(height: 10, width: 110, cornerRadius: 5)
            SkeletonBlock(height: 16, width: 70, cornerRadius: 6)
            SkeletonBlock(height: 10, cornerRadius: 5)
        }
        .padding(12)
        .frame(maxWidth: .infinity, minHeight: 78, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 14).fill(Theme.surface))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Theme.border, lineWidth: 1.5))
    }

    // MARK: - Day-keyed UserDefaults cache (one dictionary fetch per day)

    private static let cacheKey = "wotdCache.v1"

    /// Returns today's cached word info plus whether the definition lookup had
    /// actually succeeded (`resolved`). Entries from a previous day are ignored.
    static func loadCached(day: Int) -> (WordInfo, resolved: Bool)? {
        guard let dict = UserDefaults.standard.dictionary(forKey: cacheKey),
              dict["day"] as? Int == day,
              let word = dict["word"] as? String, !word.isEmpty else { return nil }
        let info = WordInfo(
            word: word,
            phonetic: dict["phonetic"] as? String,
            partOfSpeech: dict["partOfSpeech"] as? String,
            definition: dict["definition"] as? String
        )
        return (info, dict["resolved"] as? Bool ?? false)
    }

    static func storeCached(_ info: WordInfo, day: Int, resolved: Bool) {
        var dict: [String: Any] = ["day": day, "word": info.word, "resolved": resolved]
        if let p = info.phonetic { dict["phonetic"] = p }
        if let pos = info.partOfSpeech { dict["partOfSpeech"] = pos }
        if let d = info.definition { dict["definition"] = d }
        UserDefaults.standard.set(dict, forKey: cacheKey)
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
