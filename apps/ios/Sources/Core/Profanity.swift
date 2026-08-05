import Foundation

/// UGC profanity screening — Swift port of packages/core/src/username.ts.
///
/// Two consumers:
///   1. Usernames (EditProfileView): client-side pre-check for instant
///      feedback. The AUTHORITY is the database trigger
///      (supabase/manual-migrations/20260805000001_username_guard_db.sql) —
///      profile writes go straight to PostgREST, so this copy is UX only.
///   2. ProperNoundle guesses (ProperNoundleVM.submit): proper nouns can't be
///      dictionary-validated, so any typed string used to become permanent
///      board art (completed cards, share images, VS relay) —
///      "PENISPENISP" shipped that way on 2026-07-31.
///
/// Policy (keep in lockstep with the TS module, the SQL trigger and the
/// Kotlin port — ProfanityParityTests mirrors username.test.ts):
///   Tier 1 (`blockedSubstrings`): slurs + strong profanity, matched as
///     SUBSTRINGS of the collapsed form after known-innocent carrier words
///     (Scunthorpe, Hitchcock, Dickens…) are stripped.
///   Tier 2 (`blockedTokens`): mild-but-crude words that occur inside real
///     names (ASS in Cassandra, TIT in Titan) — matched only as whole tokens,
///     split at camelCase boundaries and non-letters. Usernames only; a PN
///     guess is one unbroken letter run so token boundaries don't exist.
public enum Profanity {
    /// Mirrors USERNAME_BLOCKED_SUBSTRINGS.
    public static let blockedSubstrings: [String] = [
        "NEGRO", "NIGER", "NIGGA", "NIGGER", "CHINK", "SPICK", "SPIC", "KIKES", "KIKE",
        "WETBACK", "GOOKS", "GOOK", "DAGOS", "DAGO", "WOPS", "COON", "COONS",
        "TRANNY", "TRANNIES", "FAGGOT", "FAGGY", "FAGS", "DYKES", "DYKE",
        "RETARD", "RETARDS", "CRIPPLE", "MONGOLOID", "SHEMALE", "HEEBS", "HEEB",
        "PAKIS", "PAKI", "ABBOS", "ABBO", "SLANT", "ZIPPERHEAD", "RAGHEAD", "TOWELHEAD",
        "CUNT", "FUCK", "SHIT", "PORN", "RAPE", "RAPIST", "PEDO", "PAEDO", "NAZI", "HITLER",
        "DICK", "COCK", "PENIS", "PUSSY", "BITCH", "WANK", "DILDO", "WHORE", "SLUT",
        "CLIT", "TWAT", "JIZZ", "BLOWJOB",
    ]

    /// Mirrors USERNAME_ALLOWED_CONTAINING — stripped from the name BEFORE the
    /// substring scan (the Scunthorpe problem). Stripping rather than
    /// exact-match allowlisting keeps compounds working: Scunthorpe_Fan
    /// passes, ScunthorpeCUNT still fails.
    public static let allowedContaining: [String] = [
        "SCUNTHORPE", "PENISTONE", "SHITAKE", "SHIITAKE", "LIGHTWATER",
        "CLITHEROE", "ASSASSIN", "ASSISI", "COCKBURN", "HANCOCK", "BABCOCK",
        "MATSUSHITA", "THERAPIST", "ARSENAL", "SUSSEX", "MIDDLESEX", "ESSEX",
        "DICKENS", "DICKINSON", "DICKSON", "RIDDICK", "PEACOCK", "HITCHCOCK",
        "WOODCOCK", "GAMECOCK", "SHUTTLECOCK", "COCKATOO", "COCKPIT", "COCKTAIL",
        "COCKER", "HERACLITUS", "ATWATER", "SWANK",
    ]

    /// Mirrors USERNAME_BLOCKED_TOKENS.
    public static let blockedTokens: Set<String> = [
        "ASS", "ARSE", "ANAL", "BALLS", "DAMN", "PISS", "TIT", "TITS",
        "BOOB", "BOOBS", "SEX",
    ]

    /// Leet substitutions undone before matching (mirrors the TS LEET map).
    private static let leet: [Character: Character] = [
        "0": "O", "1": "I", "!": "I", "|": "I", "3": "E", "4": "A", "@": "A",
        "5": "S", "$": "S", "7": "T", "8": "B", "9": "G", "6": "G", "+": "T",
    ]

    /// Fold to the comparison form: uppercase, leet undone, non-letters
    /// dropped, repeated letters collapsed (mirrors normalizeUsername).
    public static func normalize(_ raw: String) -> String {
        let substituted = raw.uppercased().map { leet[$0] ?? $0 }
        let lettersOnly = substituted.filter { $0 >= "A" && $0 <= "Z" }
        var out = [Character]()
        for ch in lettersOnly where ch != out.last { out.append(ch) }
        return String(out)
    }

    /// Tier-1 scan, shared by usernames and PN guesses.
    public static func containsBlockedTerm(_ raw: String) -> Bool {
        var normalized = normalize(raw)
        for safe in allowedContaining {
            normalized = normalized.replacingOccurrences(of: normalize(safe), with: "")
        }
        return blockedSubstrings.contains { normalized.contains(normalize($0)) }
    }

    /// Tier-2 token split: camelCase boundaries become separators, then any
    /// non-letter delimits (mirrors usernameTokens).
    public static func tokens(_ raw: String) -> [String] {
        var spaced = ""
        var prev: Character? = nil
        for ch in raw {
            if let p = prev, p.isLowercase, ch.isUppercase { spaced.append(" ") }
            spaced.append(ch)
            prev = ch
        }
        return spaced.uppercased()
            .split(whereSeparator: { !($0 >= "A" && $0 <= "Z") })
            .map(String.init)
    }

    /// Full username validation: shape first, then content. Returns a
    /// user-facing error (never quoting the matched term) or nil when OK.
    /// Mirrors validateUsername in packages/core/src/username.ts.
    public static func usernameError(_ raw: String) -> String? {
        let trimmed = raw.trimmingCharacters(in: .whitespaces)
        if trimmed.count < 3 || trimmed.count > 20 {
            return "Username must be 3-20 characters"
        }
        let allowed = CharacterSet(charactersIn: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 ._-")
        if trimmed.unicodeScalars.contains(where: { !allowed.contains($0) }) {
            return "Use letters, numbers, spaces, and . _ - only"
        }
        if !trimmed.contains(where: { $0.isLetter || $0.isNumber }) {
            return "Username needs at least one letter or number"
        }
        if containsBlockedTerm(trimmed) || tokens(trimmed).contains(where: { blockedTokens.contains($0) }) {
            return "That username isn’t available. Please choose another."
        }
        return nil
    }

    /// ProperNoundle guess screening (mirrors pnGuessBlocked): rejected like
    /// an invalid word when the guess contains a tier-1 term. The ANSWER is
    /// exempt: if the puzzle's own answer trips the scan (Ice Spice contains
    /// SPIC), screening is skipped for that whole puzzle — the player must be
    /// able to type the answer, and near-guesses in that letter-space are
    /// legitimate.
    public static func pnGuessBlocked(guess: String, answer: String) -> Bool {
        if containsBlockedTerm(answer) { return false }
        return containsBlockedTerm(guess)
    }
}
