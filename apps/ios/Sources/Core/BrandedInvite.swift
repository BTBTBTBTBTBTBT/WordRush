import Foundation

/// Branded one-link invites (FRIDAY-QUEUE 9f) — mirrored 1:1 from packages/core/src/branded-invite.ts
/// (pinned by BrandedInviteTests). Gate: FlagsService.shared.isLive(BrandedInvite.switchKey).
///
///   wordocious.com/vs/<CODE>      a live VS invite OR a race-my-run challenge
///   wordocious.com/friend/<CODE>  a friend / gift invite (the referral code)
public enum BrandedInvite {
    public static let switchKey = "branded_invites"
    public static let origin = "https://wordocious.com"
    public static let alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    public static let vsCodeLength = 8
    public static let reservedVsSegments = ["bots", "live", "join", "challenge", "friend"]

    public enum Kind: String, Equatable { case vs, friend }
    public struct Parsed: Equatable {
        public let kind: Kind
        public let code: String
        public init(kind: Kind, code: String) { self.kind = kind; self.code = code }
    }

    /// Uppercase, keep only letters and digits.
    public static func clean(_ raw: String?) -> String {
        String((raw ?? "").uppercased().unicodeScalars.filter { ($0.value >= 65 && $0.value <= 90) || ($0.value >= 48 && $0.value <= 57) }.map(Character.init))
    }

    public static func isVsCode(_ code: String) -> Bool {
        code.count == vsCodeLength && code.allSatisfy { alphabet.contains($0) }
    }

    public static func isFriendCode(_ code: String) -> Bool {
        (4...16).contains(code.count) && code.allSatisfy { ("A"..."Z").contains(String($0)) || ("2"..."9").contains(String($0)) }
    }

    public static func url(_ kind: Kind, _ code: String) -> String {
        "\(origin)/\(kind == .vs ? "vs" : "friend")/\(clean(code))"
    }

    /// A bare path segment that is a branded VS code (and not a static /vs page).
    public static func isBrandedVsCode(_ segment: String) -> Bool {
        !reservedVsSegments.contains(segment.lowercased()) && isVsCode(clean(segment))
    }

    /// Accepts the one-link form and the old forms (/vs/join/<CODE>, /vs/challenge/<CODE>, /join/<CODE>).
    public static func parse(_ input: String) -> Parsed? {
        var path = input.trimmingCharacters(in: .whitespacesAndNewlines)
        if let r = path.range(of: #"^https?://(www\.)?wordocious\.com"#, options: [.regularExpression, .caseInsensitive]) {
            path = String(path[r.upperBound...])
            if path.isEmpty { path = "/" }
        }
        if let q = path.firstIndex(where: { $0 == "?" || $0 == "#" }) { path = String(path[..<q]) }
        let parts = path.split(separator: "/").map(String.init)
        if parts.count == 2, parts[0].lowercased() == "vs" {
            if reservedVsSegments.contains(parts[1].lowercased()) { return nil }
            let code = clean(parts[1])
            return isVsCode(code) ? Parsed(kind: .vs, code: code) : nil
        }
        if parts.count == 3, parts[0].lowercased() == "vs", ["join", "challenge"].contains(parts[1].lowercased()) {
            let code = clean(parts[2])
            return isVsCode(code) ? Parsed(kind: .vs, code: code) : nil
        }
        if parts.count == 2, ["friend", "join"].contains(parts[0].lowercased()) {
            let code = clean(parts[1])
            return isFriendCode(code) ? Parsed(kind: .friend, code: code) : nil
        }
        return nil
    }

    /// "Have a code?": a bare VS code or any invite link.
    public static func parseTyped(_ input: String) -> Parsed? {
        if let p = parse(input) { return p }
        let code = clean(input)
        return isVsCode(code) ? Parsed(kind: .vs, code: code) : nil
    }

    public enum Variant { case live, race, friend }

    /// The short text beside the link (no separate code line).
    public static func shareLine(_ v: Variant, sender: String, game: String? = nil) -> String {
        let g = game ?? "a game"
        switch v {
        case .live: return "\(sender) wants to race you in \(g)"
        case .race: return "\(sender) challenged you to beat their \(g) run"
        case .friend: return "\(sender) invited you to Wordocious"
        }
    }
}
