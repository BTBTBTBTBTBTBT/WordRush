import Foundation

/// FINISH_SPEC §S4: share copy — short, fun, makes sense, no em dashes, American
/// spelling, never mean. 1:1 port of packages/core/src/share-captions.ts; pinned by
/// share-captions-fixtures.json. The line is picked deterministically so web, iOS
/// and Android agree:
///
///   key   = "\(date)|\(game)"   (date = the result's YYYY-MM-DD, game = its display name)
///   hash  = FNV-1a 32-bit over the key's UTF-16 code units (start 2166136261,
///           h ^= c; h = h * 16777619 mod 2^32)
///   index = hash % bank.count
///
/// Then the {placeholders} are filled (a missing value becomes ""); a RESULT share
/// with a streak of 3+ appends " 🔥 Day {d}" (invites never do).
public enum ShareCaptions {
    public enum Kind: String, CaseIterable, Codable {
        case win, multiWin, flawless, lose, sweep, gauntletWin, gauntletLose, vsWin, vsLose, vsDraw, invite, vsInvite

        var isResult: Bool { self != .invite && self != .vsInvite }
    }

    /// The caption bank, by kind. Order matters (the hash indexes it).
    public static let bank: [Kind: [String]] = [
        .win: [
            "{game} solved in {n} guesses. Your move 😎",
            "Cracked {game} in {t} ⚡ Beat that!",
            "{game} in {n}. The letters never stood a chance.",
        ],
        .multiWin: ["All {b} {game} boards cleared in {n} guesses 🧠✨"],
        .flawless: ["Flawless {game}! 💎 Not one wasted guess."],
        .lose: [
            "{game} got me today 😅 Can you crack it?",
            "So close on {game}! Think you can do better?",
        ],
        .sweep: ["Swept every Wordocious daily today 🧹✨"],
        .gauntletWin: ["Cleared all 5 Gauntlet stages 🏆"],
        .gauntletLose: ["Reached stage {k} of the Gauntlet. Can you go further?"],
        .vsWin: ["Beat {opp} at {game} ⚔️"],
        .vsLose: ["{opp} edged me at {game}. Rematch incoming 🔁"],
        .vsDraw: ["{opp} and I tied at {game}. Rematch? ⚔️"],
        .invite: ["Come play Wordocious with me! 🎉 {url}"],
        .vsInvite: ["Race me at {game}! ⚡ {url}"],
    ]

    /// Toasts after a share falls back to the clipboard / a download.
    public static let copiedToast = "Image copied! Paste it anywhere 📋"
    public static let savedToast = "Saved! Share it anywhere 🖼️"

    /// FNV-1a 32-bit over UTF-16 code units.
    public static func hash(_ key: String) -> UInt32 {
        var h: UInt32 = 2166136261
        for c in key.utf16 {
            h ^= UInt32(c)
            h = h &* 16777619
        }
        return h
    }

    public struct Vars: Equatable {
        public var date: String
        public var game: String
        public var n: String? = nil
        public var t: String? = nil
        public var b: String? = nil
        /// Streak day (3+ appends " 🔥 Day {d}" to result shares).
        public var d: Int? = nil
        public var k: String? = nil
        public var opp: String? = nil
        public var url: String? = nil

        public init(date: String, game: String, n: String? = nil, t: String? = nil, b: String? = nil, d: Int? = nil,
                    k: String? = nil, opp: String? = nil, url: String? = nil) {
            self.date = date; self.game = game; self.n = n; self.t = t; self.b = b; self.d = d
            self.k = k; self.opp = opp; self.url = url
        }
    }

    /// The bank index for a kind + key.
    public static func index(_ kind: Kind, date: String, game: String) -> Int {
        let count = bank[kind]?.count ?? 1
        return Int(hash("\(date)|\(game)") % UInt32(count))
    }

    /// The caption: the deterministic pick, filled in, plus the streak suffix.
    public static func caption(_ kind: Kind, _ v: Vars) -> String {
        guard let lines = bank[kind], !lines.isEmpty else { return "" }
        let line = lines[index(kind, date: v.date, game: v.game)]
        let values: [String: String?] = ["game": v.game, "date": v.date, "n": v.n, "t": v.t, "b": v.b,
                                         "d": v.d.map(String.init), "k": v.k, "opp": v.opp, "url": v.url]
        var out = ""
        var rest = Substring(line)
        while let open = rest.firstIndex(of: "{") {
            out += rest[..<open]
            let after = rest[rest.index(after: open)...]
            if let close = after.firstIndex(of: "}"),
               after[..<close].allSatisfy({ $0.isLetter || $0.isNumber || $0 == "_" }), !after[..<close].isEmpty {
                let name = String(after[..<close])
                if let entry = values[name] { out += entry ?? "" }
                rest = after[after.index(after: close)...]
            } else {
                out += "{"
                rest = after
            }
        }
        out += rest
        if kind.isResult, let d = v.d, d >= 3 { out += " 🔥 Day \(d)" }
        return out
    }
}

/// Call-site conveniences over `ShareCaptions` (the app's share sheets and invites).
public enum ShareCopy {
    public enum Outcome: Equatable {
        case win(guesses: Int, time: String)
        case multiWin(boards: Int, guesses: Int)
        case flawless
        case lose
        case sweep
        case gauntletCleared
        case gauntletReached(stage: Int)
        case vsWin(opponent: String)
        case vsLoss(opponent: String)
        case vsDraw(opponent: String)
    }

    public static let imageCopiedToast = ShareCaptions.copiedToast
    public static let imageSavedToast = ShareCaptions.savedToast

    /// The caption for a result (`date` = the result's YYYY-MM-DD, `game` = its display name).
    public static func caption(_ outcome: Outcome, game: String, date: String, streak: Int = 0) -> String {
        var v = ShareCaptions.Vars(date: date, game: game, d: streak > 0 ? streak : nil)
        let kind: ShareCaptions.Kind
        switch outcome {
        case .win(let n, let t): kind = .win; v.n = "\(n)"; v.t = t
        case .multiWin(let b, let n): kind = .multiWin; v.b = "\(b)"; v.n = "\(n)"
        case .flawless: kind = .flawless
        case .lose: kind = .lose
        case .sweep: kind = .sweep
        case .gauntletCleared: kind = .gauntletWin
        case .gauntletReached(let k): kind = .gauntletLose; v.k = "\(k)"
        case .vsWin(let opp): kind = .vsWin; v.opp = opp
        case .vsLoss(let opp): kind = .vsLose; v.opp = opp
        case .vsDraw(let opp): kind = .vsDraw; v.opp = opp
        }
        return ShareCaptions.caption(kind, v)
    }

    /// "Come play Wordocious with me! 🎉 <url>".
    public static func invite(url: String, date: String = "", game: String = "Wordocious") -> String {
        ShareCaptions.caption(.invite, .init(date: date, game: game, url: url))
    }

    /// "Race me at <Game>! ⚡ <url>".
    public static func vsInvite(game: String, url: String, date: String = "") -> String {
        ShareCaptions.caption(.vsInvite, .init(date: date, game: game, url: url))
    }
}
