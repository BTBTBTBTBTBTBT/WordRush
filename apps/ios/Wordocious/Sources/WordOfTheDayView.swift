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

    /// Words never FEATURED as Word of the Day — the home card prints the word
    /// with its dictionary definition, and these read as clinical anatomy,
    /// excretion, drugs, or (BLOOD) a street gang. They remain valid puzzle
    /// ANSWERS; dropping them from the solutions list would shift every later
    /// day's index and rewrite played history. Mirror of
    /// packages/core/src/wotd-blocklist.ts — keep the two in step.
    private static let blocked: Set<String> = [
        "HYMEN",
        "OVARY",
        "PUBIC",
        "GROIN",
        "BOSOM",
        "FECES",
        "FECAL",
        "URINE",
        "VOMIT",
        "ENEMA",
        "BOWEL",
        "MUCUS",
        "OPIUM",
        "BOOZE",
        "LEPER",
        "TUMOR",
        "ULCER",
        "BLOOD",
    ]

    private func fetch() async -> WordInfo {
        // SERVER FIRST: /api/words is rendered by the same lib/word-of-day.ts
        // module as the Past Words archive, so taking today's entry from it
        // makes the card and the archive agree BY CONSTRUCTION. The local walk
        // below survives as the offline fallback only. (Before this, the card
        // checked definitions against live dictionaryapi.dev while the server
        // checked its committed word-definitions.json — different dictionary,
        // different skip pattern, and the founder's phone featured SHIRE while
        // Past Words said OTTER for the same day.)
        if let server = await Self.serverToday() { return server }
        // Pool for THIS displayed local date — pre-cutover dates keep the legacy
        // word (matches the archive), curated after.
        let solutions = GameDictionary.shared.solutionPool(forDateKey: LeaderboardService.todayLocal())
        let daysSinceEpoch = todayIndex
        guard !solutions.isEmpty else { return WordInfo(word: "WORDS") }

        for offset in 0..<20 {
            let word = solutions[(daysSinceEpoch + offset) % solutions.count]
            if Self.blocked.contains(word.uppercased()) { continue }
            if let info = await lookup(word) { return info }
        }
        // Last-resort fallback: walk forward to the first non-blocked word so a
        // day where all 20 candidates lack definitions still can't surface one.
        let fallback = (0..<solutions.count)
            .lazy
            .map { solutions[(daysSinceEpoch + $0) % solutions.count] }
            .first { !Self.blocked.contains($0.uppercased()) }
        return WordInfo(word: fallback ?? solutions[daysSinceEpoch % solutions.count])
    }

    private struct ArchivePayload: Decodable {
        struct Entry: Decodable {
            let date: String
            let word: String
            let phonetic: String
            let partOfSpeech: String
            let definition: String
        }
        let words: [Entry]
    }

    /// Today's entry from the server archive, matched by LOCAL date key.
    /// reloadIgnoringLocalCacheData: URLSession's shared cache honors the
    /// response's max-age and served hour-stale content (§193) — the day-keyed
    /// wotdCache above already limits this to one network hit per day.
    private static func serverToday() async -> WordInfo? {
        guard let url = URL(string: "https://wordocious.com/api/words") else { return nil }
        var req = URLRequest(url: url)
        req.cachePolicy = .reloadIgnoringLocalCacheData
        req.timeoutInterval = 8
        guard let (data, _) = try? await URLSession.shared.data(for: req),
              let payload = try? JSONDecoder().decode(ArchivePayload.self, from: data),
              let e = payload.words.first(where: { $0.date == LeaderboardService.todayLocal() })
        else { return nil }
        return WordInfo(word: e.word,
                        phonetic: e.phonetic.isEmpty ? nil : e.phonetic,
                        partOfSpeech: e.partOfSpeech.isEmpty ? nil : e.partOfSpeech,
                        definition: e.definition.isEmpty ? nil : e.definition)
    }

    private func lookup(_ word: String) async -> WordInfo? { await Self.definition(for: word) }

    /// Shared dictionaryapi.dev lookup (used by Word of the Day + post-game).
    /// §250: the committed local dictionary (bundled word-definitions.json —
    /// the same dataset the web ships). Loaded once, off the main thread on
    /// first use. Covers the 5-letter solution lists today; the API below is
    /// only the fallback for words outside it, so a dictionaryapi.dev outage
    /// (founder, Aug 29: blank EQUAL on Home, blank ERMINE on the win card)
    /// can no longer blank covered words.
    private struct LocalSense: Decodable { let pos: String?; let def: String? }
    private struct LocalRecord: Decodable { let miss: Bool?; let phonetic: String?; let senses: [LocalSense]? }
    private static let localDict: [String: LocalRecord] = {
        guard let url = Bundle.main.url(forResource: "word-definitions", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let dict = try? JSONDecoder().decode([String: LocalRecord].self, from: data) else { return [:] }
        return dict
    }()

    static func localDefinition(for word: String) -> WordInfo? {
        guard let rec = localDict[word.lowercased()], rec.miss != true,
              let sense = rec.senses?.first, let def = sense.def, !def.isEmpty else { return nil }
        return WordInfo(word: word, phonetic: rec.phonetic, partOfSpeech: sense.pos, definition: def)
    }

    static func definition(for word: String) async -> WordInfo? {
        if let local = localDefinition(for: word) { return local }
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
