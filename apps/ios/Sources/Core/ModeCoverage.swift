import Foundation

// FINISH_SPEC BJ12 (founder 10-03): every game reaches Stats and Friends
// Moments. Port of packages/core/src/mode-coverage.ts, pinned by
// mode-coverage-fixtures.json (ModeCoverageFixtureTests). The gap that
// prompted it: MedalService's Perfect switch named only the nine word modes,
// so no More Games puzzle ever earned a Perfect medal (or its Moment) on iOS.

public enum ModeCoverage {
    /// Does a finished solo daily earn the Perfect medal? The word modes keep
    /// their explicit rule; every More Games title (group "more", so a new
    /// puzzle is covered with no code change) is perfect at the catalog's
    /// guessBase with every board solved.
    public static func isPerfectDailyResult(gameMode: String, group: String?, guessBase: Int,
                                            guessCount: Int, boardsSolved: Int, totalBoards: Int,
                                            completed: Bool) -> Bool {
        guard completed else { return false }
        switch gameMode {
        case "DUEL", "PROPERNOUNDLE", "DUEL_6", "DUEL_7": return guessCount == 1
        case "QUORDLE", "SEQUENCE", "RESCUE": return boardsSolved == 4 && guessCount <= 4
        case "OCTORDLE": return boardsSolved == 8 && guessCount <= 8
        case "GAUNTLET": return boardsSolved == 21
        default:
            guard group == "more" else { return false }
            return guessCount >= 1 && guessCount <= guessBase && boardsSolved >= totalBoards
        }
    }

    private static let numberWords = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
                                      "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty"]

    /// "ten" for 10 — the Moments copy spells small counts out.
    public static func countWord(_ n: Int) -> String { n >= 0 && n < numberWords.count ? numberWords[n] : String(n) }

    /// The More Games Sweep moment; the count comes from the catalog (it was a literal "ten").
    public static func moreSweepMomentText(who: String, flawless: Bool, total: Int) -> String {
        flawless ? "\(who) — Flawless More Games, all \(countWord(total)) won"
                 : "\(who) — More Games Sweep, all \(countWord(total)) played"
    }

    /// A record moment's label: the fewest record reads through the mode ("Fewest Mistakes" for Sudocious).
    public static func recordMomentLabel(_ recordType: String, semantics: String?) -> String {
        switch recordType {
        case "fastest_win": return "Fastest Win"
        case "fewest_guesses": return ModeStats.fewestRecordLabel(semantics ?? "guesses")
        case "longest_streak": return "Longest Win Streak"
        case "most_games_played": return "Most Games Played"
        default: return recordType
        }
    }

    /// A record's value: the RECORD_LABELS formats, "fewest_guesses" through the mode ("1 guess", "0 mistakes", "Par").
    public static func recordValueText(_ recordType: String, value: Int, semantics: String?, guessBase: Int) -> String {
        let v = value
        switch recordType {
        case "fastest_win": return v < 60 ? "\(v)s" : "\(v / 60)m \(v % 60)s"
        case "fewest_guesses": return formatGuessStat(semantics: semantics ?? "guesses", guessBase: guessBase, guessCount: v)
        case "most_games_played": return "\(v) games"
        case "longest_streak": return "\(v) wins"
        case "most_gold_medals": return "\(v) golds"
        case "highest_level": return "Level \(v)"
        case "most_daily_completions": return "\(v) dailies"
        default: return "\(v)"
        }
    }

    /// The Moments headline for a medal or record — identical on every platform.
    public static func modeMomentHeadline(type: String, me: Bool, username: String, kind: String?,
                                          gameMode: String?, gameTitle: String?,
                                          semantics: String?, valueText: String?) -> String {
        let who = me ? "You" : username
        let game = gameTitle ?? gameMode ?? ""
        if type == "record" {
            let label = kind.map { recordMomentLabel($0, semantics: semantics) } ?? "record"
            let title = gameTitle.map { "\($0) " } ?? ""
            let value = (valueText?.isEmpty == false) ? " · \(valueText!)" : ""
            return "\(who) set the all-time \(title)\(label)\(value)"
        }
        let k = kind ?? ""
        if k == "gold" || k == "silver" || k == "bronze" { return "\(who) took \(k) in \(game)" }
        if k == "perfect" { return "\(who) played a perfect \(game)" }
        if k.hasPrefix("streak_") { return "\(who) hit a \(k.dropFirst(7))-day streak" }
        return "\(who) earned a medal in \(game)"
    }
}
