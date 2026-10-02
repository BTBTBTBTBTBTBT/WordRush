import SwiftUI
import UIKit
import WordociousCore

// The art pass (founder 2026-10-02; spec docs/ART_SPEC.md). ONE shared kit for the
// new images (web components/ui/art, Android ui/ArtKit.kt): the Leaderboard day
// titles (§1), the whole-cast page titles (§2), the glossy 3D game icons (§3) and
// the W / L / ✓ completion badges (§4). The extra UI icons (§5) join the Icon3D set
// in HeaderKit.swift. Art is presentation only: every caller keeps its behavior.

/// Whether an image set ships in the bundle (cached), so a missing piece of art
/// falls back to the old text / glyph instead of drawing blank.
enum ArtAsset {
    private static let lock = NSLock()
    private static var known: [String: Bool] = [:]

    static func exists(_ name: String) -> Bool {
        lock.lock(); defer { lock.unlock() }
        if let hit = known[name] { return hit }
        let found = UIImage(named: name) != nil
        known[name] = found
        return found
    }
}

// MARK: - §1 Leaderboard day titles

/// `art-day-<weekday>`: the day's title lettering with that day's host, one graphic.
enum DayTitleArt {
    /// Sunday first, matching core `LeaderboardTitle.weekdayTitles`.
    private static let days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
    /// The art's own words, for VoiceOver.
    private static let labels = ["Sunday Superstars", "Monday Masters", "Tuesday Titans", "Wednesday Wizards",
                                 "Thursday Thunder", "Friday\u{2019}s Finest", "Saturday Stars"]

    /// The art for a core `leaderboardTitle` string: a weekday title maps to its
    /// day's graphic; a holiday title ("<HOLIDAY> HEROES") or missing art → nil
    /// (the caller keeps the text treatment).
    static func forTitle(_ title: String) -> (asset: String, label: String)? {
        guard let i = LeaderboardTitle.weekdayTitles.firstIndex(of: title), i < days.count else { return nil }
        let asset = "art-day-\(days[i])"
        return ArtAsset.exists(asset) ? (asset, labels[i]) : nil
    }
}

/// The day title graphic, centered, height-capped (≈96–120 pt), never stretched.
struct DayTitleArtView: View {
    let asset: String
    let label: String
    var maxHeight: CGFloat = 112

    var body: some View {
        Image(asset)
            .resizable()
            .interpolation(.high)
            .scaledToFit()
            .frame(maxWidth: 420, maxHeight: maxHeight)
            .frame(maxWidth: .infinity)
            .accessibilityLabel(label)
            .accessibilityAddTraits(.isHeader)
    }
}

// MARK: - §2 Whole-cast page titles

/// `art-title-<page>`: page lettering with the whole cast perched on it.
enum ArtTitleName: String, CaseIterable {
    case friends, stats, records, vs, puzzles, wotd, settings, howto, gopro, moregames

    var assetName: String { "art-title-\(rawValue)" }

    /// The title text the art carries (its accessibility label, and the text
    /// fallback when the art is missing).
    var label: String {
        switch self {
        case .friends: return "Friends"
        case .stats: return "Stats"
        case .records: return "All-Time Records"
        case .vs: return "VS Battle"
        case .puzzles: return "Puzzles"
        case .wotd: return "Word of the Day"
        case .settings: return "Settings"
        case .howto: return "How to Play"
        case .gopro: return "Go Pro"
        case .moregames: return "More Games"
        }
    }
}

/// A page title as art: fills the offered width up to `maxWidth` (≈420 pt), the
/// height follows the aspect ratio, never stretched. Labeled with the title text;
/// falls back to the gradient caps `PageTitle` if the image is missing.
struct ArtTitle: View {
    let name: ArtTitleName
    var maxWidth: CGFloat = 420
    var label: String? = nil
    /// Fallback text colors (the page's accent).
    var colors: [Color] = PageHeaderStyle.purplePink

    init(_ name: ArtTitleName, maxWidth: CGFloat = 420, label: String? = nil,
         colors: [Color] = PageHeaderStyle.purplePink) {
        self.name = name
        self.maxWidth = maxWidth
        self.label = label
        self.colors = colors
    }

    var body: some View {
        if ArtAsset.exists(name.assetName) {
            Image(name.assetName)
                .resizable()
                .interpolation(.high)
                .scaledToFit()
                .frame(maxWidth: maxWidth)
                .accessibilityLabel(label ?? name.label)
                .accessibilityAddTraits(.isHeader)
        } else {
            PageTitle(label ?? name.label, colors: colors)
        }
    }
}

// MARK: - §3 Game icons

/// `game-<mode id>`: the glossy 3D game icon (256 sq), decorative.
struct GameArtImage: View {
    let asset: String
    let size: CGFloat

    var body: some View {
        Image(asset)
            .resizable()
            .interpolation(.high)
            .scaledToFit()
            .frame(width: size, height: size)
            .accessibilityHidden(true)
    }
}

// MARK: - §4 Completion badges

/// The daily result badge: `icon3d-badge-w` (won) / `icon3d-badge-l` (lost) /
/// `icon3d-badge-check` (done, result unknown) at 26 pt, labeled for VoiceOver.
struct ResultBadge: View {
    enum Kind { case win, loss, done }
    let kind: Kind
    var size: CGFloat = 26

    init(_ kind: Kind, size: CGFloat = 26) {
        self.kind = kind
        self.size = size
    }

    /// Won / lost from a Bool.
    init(won: Bool, size: CGFloat = 26) {
        self.init(won ? .win : .loss, size: size)
    }

    var body: some View {
        switch kind {
        case .win: Icon3D(.badgeW, size: size, label: "Won")
        case .loss: Icon3D(.badgeL, size: size, label: "Lost")
        case .done: Icon3D(.badgeCheck, size: size, label: "Played")
        }
    }
}
