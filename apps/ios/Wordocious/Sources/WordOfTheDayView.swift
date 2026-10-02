import SwiftUI
import WordociousCore

/// "Word of the Day" card — ports the web WordOfTheDay component. Since the home
/// redesign (founder-approved, 2026-10-01; spec §4) it is a three-choice quiz:
/// /api/wotd returns the day's word plus three definitions (one real, the same
/// two decoys for everyone). Before answering the definition stays hidden; a tap
/// shows a ~2.2 s right/wrong beat, then the card settles into the ordinary card
/// with ONLY the real definition, plus a small flame and the word streak after a
/// right answer. The wrong choices never come back that day. No quiz that day
/// (choices null) or no network → the plain card, as before.
struct WordOfTheDayView: View {
    @EnvironmentObject private var auth: AuthService
    @State private var info: WordInfo?
    @State private var fetchedDay: Int?
    @State private var showWords = false
    /// Today's saved quiz answer (signed in: word_quiz_answers; guest: this device).
    @State private var answer: HomeStreaksService.QuizAnswer?
    @State private var answerLoaded = false
    @State private var streak = 0
    /// The ~2.2 s right/wrong beat right after a pick.
    @State private var revealing = false
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.colorScheme) private var scheme

    private static let letters = ["A", "B", "C"]
    private static let revealNanos: UInt64 = 2_200_000_000

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
        /// The quiz (from /api/wotd): three definitions, the real one at `answer`.
        var choices: [String]? = nil
        var answer: Int? = nil
        /// The sense the quiz asks about (can differ from the card's part of speech).
        var quizPartOfSpeech: String? = nil
    }

    private struct Quiz { let choices: [String]; let answer: Int }

    private func quiz(_ info: WordInfo) -> Quiz? {
        guard let c = info.choices, c.count == 3, let a = info.answer, (0..<3).contains(a) else { return nil }
        return Quiz(choices: c, answer: a)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            header
            Group {
                if let info {
                    content(info)
                } else {
                    placeholderCard
                }
            }
            // Tappable → the full Word of the Day archive (web parity: the card links
            // to /words). While the quiz is asking, only "Past words" opens it, so a
            // near-miss on a choice never jumps to the archive.
            .contentShape(Rectangle())
            .onTapGesture { if !isAsking { showWords = true } }
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
        // Today's answer + word streak: per player and per day (sign-in/out reloads).
        .task(id: "\(LeaderboardService.todayLocal())-\(auth.profile?.id ?? "guest")") {
            answerLoaded = false
            let state = await HomeStreaksService.quizState(day: LeaderboardService.todayLocal())
            if !revealing { answer = state.today; streak = state.streak }
            answerLoaded = true
        }
        .sheet(isPresented: $showWords) { WordsView(navTitle: "Word of the Day").presentationDetents([.large]) }
    }

    private var isAsking: Bool {
        guard let info, quiz(info) != nil else { return false }
        return answerLoaded && answer == nil
    }

    private func pick(_ i: Int, _ info: WordInfo, _ q: Quiz) {
        guard answer == nil else { return }
        let result = HomeStreaksService.QuizAnswer(picked: i, correct: i == q.answer)
        Haptics.tap()
        answer = result
        streak = result.correct ? streak + 1 : 0
        revealing = true
        Task {
            try? await Task.sleep(nanoseconds: Self.revealNanos)
            withAnimation(Theme.animation(.easeInOut(duration: 0.2))) { revealing = false }
        }
        let day = LeaderboardService.todayLocal()
        Task { await HomeStreaksService.saveQuizAnswer(day: day, word: info.word, answer: result) }
    }

    private func content(_ info: WordInfo) -> some View {
        let q = quiz(info)
        let asking = q != nil && answerLoaded && answer == nil
        // With a quiz, the definition stays hidden until we know the player has answered (never flash it).
        let settled = q == nil || (answerLoaded && answer != nil)
        let definition = q.map { $0.choices[$0.answer] } ?? info.definition
        let pos = q != nil ? (info.quizPartOfSpeech ?? info.partOfSpeech) : info.partOfSpeech
        let showFlame = q != nil && (answer?.correct ?? false) && !revealing && streak > 0
        return VStack(alignment: .leading, spacing: 2) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text(info.word.prefix(1).uppercased() + info.word.dropFirst().lowercased())
                    .font(Brand.font(16, .black)).foregroundStyle(Theme.textPrimary)
                if let p = info.phonetic, !p.isEmpty {
                    Text(p).font(Brand.font(12, .bold)).foregroundStyle(Theme.textMuted)
                }
                if let pos, !pos.isEmpty {
                    Text(pos).font(Brand.font(10, .heavy)).italic().foregroundStyle(Theme.primary)
                }
                if showFlame {
                    Spacer(minLength: 4)
                    HStack(spacing: 2) {
                        FlameMark(size: 13)
                        Text("\(streak)").font(Brand.font(13, .black)).foregroundStyle(Color(hex: 0xC2410C))
                    }
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel("\(streak)-day word streak")
                }
            }
            if asking, let q {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Which one is it?").font(Brand.font(11, .heavy)).foregroundStyle(Color(hex: 0x4B5563))
                    ForEach(0..<3, id: \.self) { i in
                        Button { pick(i, info, q) } label: { choiceRow(i, q.choices[i]) }
                            .buttonStyle(.plain)
                    }
                }
                .padding(.top, 6)
            }
            if revealing, let q, let a = answer {
                resultPanel(a, q)
                    .padding(.top, 6)
                    .transition(.opacity)
            }
            if settled && !revealing, let def = definition, !def.isEmpty {
                Text(def).font(Brand.font(11, .bold)).foregroundStyle(Color(hex: 0x4B5563))
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 2)
            }
        }
        .padding(.horizontal, 12).padding(.vertical, 8)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 14).fill(Theme.surface).pageCardShadow())
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Theme.border, lineWidth: 1.5))
    }

    /// ART_SPEC §12 / §19.2: the whole-cast WORD OF THE DAY art as a section header
    /// ABOVE the card, centered on the DAILIES / PUZZLES width rule, with a small
    /// centered "Past words" link under it.
    private var header: some View {
        let link = scheme == .dark ? Color(hex: 0xC4B5FD) : Theme.primary
        return VStack(spacing: 0) {
            SectionTitleArt(.wotd)
            Button { showWords = true } label: {
                HStack(spacing: 2) {
                    Text("Past words").font(Brand.font(11, .heavy)).foregroundStyle(link)
                    Image(systemName: "chevron.right").font(.system(size: 9, weight: .black)).foregroundStyle(link)
                }
                .padding(.vertical, 6).padding(.horizontal, 8)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .fixedSize()
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 2)
    }

    private func choiceRow(_ i: Int, _ text: String) -> some View {
        HStack(spacing: 8) {
            Text(Self.letters[i]).font(Brand.font(10, .black)).foregroundStyle(Color(hex: 0x5B21B6))
                .frame(width: 20, height: 20)
                .background(Circle().fill(Color(hex: 0xEDE9FE)))
            Text(text).font(Brand.font(12, .bold)).foregroundStyle(Theme.textPrimary)
                .multilineTextAlignment(.leading)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 10).padding(.vertical, 6)
        .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 10).fill(Theme.surface))
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color(hex: 0xDDD6FE), lineWidth: 1.5))
        .contentShape(Rectangle())
        .accessibilityLabel("Choice \(Self.letters[i]): \(text)")
    }

    private func resultPanel(_ a: HomeStreaksService.QuizAnswer, _ q: Quiz) -> some View {
        let ink = a.correct ? Color(hex: 0x15803D) : Color(hex: 0xB91C1C)
        return HStack(spacing: 8) {
            Image(systemName: "sparkles").font(.system(size: 18, weight: .bold)).foregroundStyle(ink)
            VStack(alignment: .leading, spacing: 1) {
                Text(a.correct ? "Nice! You knew it." : "Not this time.")
                    .font(Brand.font(14, .black)).foregroundStyle(ink)
                Text(a.correct
                        ? "Word streak: \(streak)"
                        : "You picked \(Self.letters[a.picked]). It's \(Self.letters[q.answer]): \(q.choices[q.answer])")
                    .font(Brand.font(11, .heavy)).foregroundStyle(ink)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 10).padding(.vertical, 8)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 10).fill(a.correct ? Color(hex: 0xDCFCE7) : Color(hex: 0xFEE2E2)))
        .accessibilityElement(children: .combine)
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
        .background(RoundedRectangle(cornerRadius: 14).fill(Theme.surface).pageCardShadow())
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Theme.border, lineWidth: 1.5))
    }

    // MARK: - Day-keyed UserDefaults cache (one fetch per day)

    /// v2: entries carry the quiz (choices/answer); v1 entries (definition only) are ignored.
    private static let cacheKey = "wotdCache.v2"

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
            definition: dict["definition"] as? String,
            choices: dict["choices"] as? [String],
            answer: dict["answer"] as? Int,
            quizPartOfSpeech: dict["quizPartOfSpeech"] as? String
        )
        return (info, dict["resolved"] as? Bool ?? false)
    }

    static func storeCached(_ info: WordInfo, day: Int, resolved: Bool) {
        var dict: [String: Any] = ["day": day, "word": info.word, "resolved": resolved]
        if let p = info.phonetic { dict["phonetic"] = p }
        if let pos = info.partOfSpeech { dict["partOfSpeech"] = pos }
        if let d = info.definition { dict["definition"] = d }
        if let c = info.choices { dict["choices"] = c }
        if let a = info.answer { dict["answer"] = a }
        if let qp = info.quizPartOfSpeech { dict["quizPartOfSpeech"] = qp }
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
        // Home redesign (founder, 2026-10-01): /api/wotd first — the same entry
        // as the archive plus the day's quiz. The /api/words walk and the local
        // walk below stay as fallbacks (the plain card, no quiz).
        if let quizDay = await Self.serverQuizToday() { return quizDay }
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

    private struct WotdPayload: Decodable {
        let word: String
        let phonetic: String?
        let partOfSpeech: String?
        let definition: String?
        let choices: [String]?
        let answer: Int?
        let quizPartOfSpeech: String?
    }

    /// Today's word + quiz from /api/wotd for the LOCAL date (the server's clock is UTC).
    private static func serverQuizToday() async -> WordInfo? {
        var comps = URLComponents(string: "https://wordocious.com/api/wotd")
        comps?.queryItems = [URLQueryItem(name: "date", value: LeaderboardService.todayLocal())]
        guard let url = comps?.url else { return nil }
        var req = URLRequest(url: url)
        req.cachePolicy = .reloadIgnoringLocalCacheData
        req.timeoutInterval = 8
        guard let (data, resp) = try? await Net.api.data(for: req),
              (resp as? HTTPURLResponse)?.statusCode == 200,
              let p = try? JSONDecoder().decode(WotdPayload.self, from: data),
              !p.word.isEmpty, let def = p.definition, !def.isEmpty else { return nil }
        func nonEmpty(_ s: String?) -> String? { (s ?? "").isEmpty ? nil : s }
        let quizOK = (p.choices?.count == 3) && p.answer.map { (0..<3).contains($0) } == true
        return WordInfo(word: p.word, phonetic: nonEmpty(p.phonetic), partOfSpeech: nonEmpty(p.partOfSpeech),
                        definition: def,
                        choices: quizOK ? p.choices : nil, answer: quizOK ? p.answer : nil,
                        quizPartOfSpeech: quizOK ? nonEmpty(p.quizPartOfSpeech) : nil)
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
        guard let (data, _) = try? await Net.api.data(for: req),
              let payload = try? JSONDecoder().decode(ArchivePayload.self, from: data),
              let e = payload.words.first(where: { $0.date == LeaderboardService.todayLocal() })
        else { return nil }
        return WordInfo(word: e.word,
                        phonetic: e.phonetic.isEmpty ? nil : e.phonetic,
                        partOfSpeech: e.partOfSpeech.isEmpty ? nil : e.partOfSpeech,
                        definition: e.definition.isEmpty ? nil : e.definition)
    }

    private func lookup(_ word: String) async -> WordInfo? { await WordDefinitions.definition(for: word) }
}

/// Shared definition lookup (Word of the Day + post-game DefinitionCard).
/// The 4.7 MB word-definitions.json used to be a lazy static on the View,
/// decoded on the MAIN thread by the first win card — a visible hitch
/// (founder, 2026-09-29). It lives here, off any actor: `localDict` is a
/// thread-safe lazy static, AppWarmup decodes it on a utility thread a couple
/// of seconds after launch, and `definition(for:)` is nonisolated async, so a
/// lookup before the warm-up lands decodes off-main instead of blocking.
enum WordDefinitions {
    typealias WordInfo = WordOfTheDayView.WordInfo

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

    /// Forces the decode (AppWarmup calls this on a utility thread).
    static func prewarm() { _ = localDict.count }

    private static func localDefinition(for word: String) -> WordInfo? {
        // §259: lead with the best sense, not the file's first (NASTY led with
        // "Something nasty."). The dataset is pre-ranked; this is the read-time guard.
        guard let rec = localDict[word.lowercased()], rec.miss != true,
              let sense = SenseRank.rank(word, rec.senses ?? [], def: { $0.def }).first,
              let def = sense.def, !def.isEmpty else { return nil }
        return WordInfo(word: word, phonetic: rec.phonetic, partOfSpeech: sense.pos, definition: def)
    }

    /// Local dictionary first, dictionaryapi.dev as the fallback.
    static func definition(for word: String) async -> WordInfo? {
        if let local = localDefinition(for: word) { return local }
        guard let url = URL(string: "https://api.dictionaryapi.dev/api/v2/entries/en/\(word.lowercased())") else { return nil }
        guard let (data, resp) = try? await Net.api.data(from: url),
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
