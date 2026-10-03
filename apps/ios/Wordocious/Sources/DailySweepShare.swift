import SwiftUI
import Supabase
import WordociousCore
#if canImport(UIKit)
import UIKit
#endif

// All-dailies share card (Daily Sweep / Flawless Victory) + its share flow.
// Mirrors web lib/share-image.ts drawDailySweepCard + lib/daily-share.ts. Keep
// the mode order, glyphs, and layout identical to web/Android.

/// One daily game's row in the all-dailies card.
struct DailySweepRow: Identifiable {
    let dbKey: String
    let modeLabel: String
    let accent: Color
    let glyph: String
    let won: Bool
    let guesses: Int
    let timeSeconds: Int
    let score: Int
    var id: String { dbKey }
}

/// DB game_mode → (share label, accent, glyph) in canonical daily order.
/// Order/accent/glyph are single-sourced from the mode catalog (modes.json →
/// ModeGen); only the shortened sweep-card label for ProperNoundle is local.
enum DailySweepCatalog {
    /// Sweep-card label override — "Proper" is shortened to fit the row width
    /// (the catalog shareLabel, used elsewhere, is the full "ProperNoundle").
    private static let labelOverride: [String: String] = ["PROPERNOUNDLE": "Proper"]

    static let modes: [(dbKey: String, label: String, accent: Color, glyph: String)] =
        ModeGen.sweep.map { m in
            let key = m.dbKey ?? ""
            return (dbKey: key, label: labelOverride[key] ?? m.shareLabel, accent: m.accent, glyph: m.glyph ?? "")
        }

    /// The More Games dailies, catalog order — the More Games Sweep card lists these.
    static let moreModes: [(dbKey: String, label: String, accent: Color, glyph: String)] =
        ModeGen.more.filter { $0.dailyEligible && $0.dbKey != nil }.map { m in
            (dbKey: m.dbKey!, label: labelOverride[m.dbKey!] ?? m.shareLabel, accent: m.accent, glyph: m.glyph ?? String(m.shortTitle.prefix(1)))
        }

    /// Build the ordered rows present in today's completions.
    static func rows(from byMode: [String: DailyCompletion], over list: [(dbKey: String, label: String, accent: Color, glyph: String)]? = nil) -> [DailySweepRow] {
        (list ?? modes).compactMap { m in
            guard let c = byMode[m.dbKey] else { return nil }
            return DailySweepRow(
                dbKey: m.dbKey, modeLabel: m.label, accent: m.accent, glyph: m.glyph,
                won: c.completed, guesses: c.guessCount,
                timeSeconds: Int(c.timeSeconds.rounded()), score: Int(c.score.rounded()))
        }
    }
}

/// 1080×1350 PNG card (web all-dailies design). FINISH_SPEC §E1: the Home
/// wallpaper, the DAILIES / PUZZLES title art, the headline, every played game
/// as a tinted row with its 3D game icon on a mini game card and the W / L badge,
/// three tinted stat windows (won · time · points, soft numbers) and a footer cast
/// pose that is not the page host. Static and always light (see ShareKit).
struct DailySweepCardView: View {
    let rows: [DailySweepRow]
    let won: Int
    let total: Int
    let totalTimeSeconds: Int
    let totalScore: Int
    let flawless: Bool
    let dateStr: String
    /// Headline override — the More Games Sweep card (founder, 2026-09-26) says
    /// "MORE GAMES SWEEP" / "FLAWLESS MORE GAMES" over the same layout.
    var title: String? = nil

    private var titleColors: [Color] {
        flawless ? [Color(hex: 0xF59E0B), Color(hex: 0xB45309)] : [Color(hex: 0x8B5CF6), Color(hex: 0xEC4899)]
    }

    /// The Puzzles card (its rows are the More Games dailies) vs the Wordocious one.
    private var isPuzzles: Bool {
        guard let first = rows.first?.dbKey else { return false }
        return DailySweepCatalog.moreModes.contains { $0.dbKey == first }
    }

    private var titleArt: String { isPuzzles ? "art-title-puzzles" : "art-title-dailies" }

    /// Title art at ~70% of the width (height from its aspect, capped).
    private var titleH: CGFloat {
        guard ArtAsset.exists(titleArt), let a = ArtAsset.aspect(titleArt), a > 0 else { return 0 }
        return min(200, 756 / a)
    }

    // §S2: the canvas is sized to its rows (4:5 … 9:16).
    private var rowGap: CGFloat { rows.count > 8 ? 10 : 12 }
    private var rowH: CGFloat { rows.count > 8 ? 84 : 92 }
    private var rowsH: CGFloat {
        let n = CGFloat(max(rows.count, 1))
        return rowH * n + rowGap * (n - 1)
    }
    private let castW: CGFloat = 972
    private var fixedH: CGFloat {
        40 + titleH + 8 + 112 + 40 + 26 + 30 + 120 + 40 + ShareCastWordmark.height(castW) + 40
    }
    var size: CGSize { CGSize(width: 1080, height: min(1920, max(1350, fixedH + rowsH)).rounded()) }

    var body: some View {
        ZStack {
            ShareWall(tint: .home)
            VStack(spacing: 0) {
                if titleH > 0 {
                    ShareArt.title(titleArt, height: titleH, maxWidth: 756).padding(.top, 40)
                }
                Text(title ?? (flawless ? "FLAWLESS VICTORY" : "DAILY SWEEP"))
                    .font(Brand.fixedFont(48, .black))
                    .foregroundStyle(LinearGradient(colors: titleColors, startPoint: .leading, endPoint: .trailing))
                    .shadow(color: .white.opacity(0.85), radius: 0, x: 0, y: 3)
                    // The home share titles the card with the banner headline
                    // ("WORDOCIOUS SWEPT! 10 PUZZLES LEFT"): two lines, then shrink.
                    .multilineTextAlignment(.center).lineLimit(2).minimumScaleFactor(0.5)
                    .padding(.horizontal, 48)
                    .frame(height: 112)
                    .padding(.top, titleH > 0 ? 8 : 48)
                ShareDateLine(text: ShareCast.dateLine(dateStr), size: 28)
                    .frame(height: 40)

                VStack(spacing: rowGap) {
                    ForEach(rows) { row in rowView(row) }
                }
                .padding(.horizontal, 64)
                .frame(maxHeight: .infinity)
                .padding(.top, 26)

                ShareStatRow(items: [
                    ("\(won)/\(total)", "WON", .purple),
                    (fmt(totalTimeSeconds), "TIME", .blue),
                    (totalScore.formatted(), "POINTS", .gold),
                ], height: 120)
                .padding(.horizontal, 54)
                .padding(.top, 30)
                ShareCastWordmark(width: castW)
                    .padding(.top, 40)
                    .padding(.bottom, 40)
            }
        }
        .frame(width: size.width, height: size.height)
    }

    /// One game: a tinted row in its accent with the 3D game icon on a mini game
    /// card, the name + its numbers, and the W / L badge art.
    private func rowView(_ r: DailySweepRow) -> some View {
        let shape = RoundedRectangle(cornerRadius: min(28, rowH * 0.32), style: .continuous)
        let icon = rowH - 18
        return HStack(spacing: 20) {
            ShareIconTile(accent: r.accent, icon: ShareCast.gameIcon(dbKey: r.dbKey), fallback: r.glyph, size: icon)
            VStack(alignment: .leading, spacing: 0) {
                Text(r.modeLabel).font(Brand.fixedFont(min(30, rowH * 0.38), .black)).foregroundStyle(ShareInk.heading)
                    .lineLimit(1).minimumScaleFactor(0.6)
                Text("\(r.won ? "\(r.guesses)g" : "X") · \(fmt(r.timeSeconds)) · \(r.score.formatted()) pts")
                    .font(Brand.fixedFont(min(22, rowH * 0.28), .bold)).foregroundStyle(ShareInk.muted)
                    .lineLimit(1).minimumScaleFactor(0.6)
            }
            Spacer(minLength: 8)
            ShareResultBadge(won: r.won, size: min(56, rowH * 0.62))
        }
        .padding(.horizontal, 18)
        .frame(maxWidth: .infinity)
        .frame(height: rowH)
        .background(
            ZStack(alignment: .leading) {
                shape.fill(r.accent.wash(0.08))
                r.accent.frame(width: 8)
            }
            .clipShape(shape)
        )
        .overlay(shape.strokeBorder(r.accent.wash(0.26), lineWidth: 3))
        .shadow(color: Color(hex: 0x3C1E6E).opacity(0.08), radius: 8, x: 0, y: 6)
    }

    private func fmt(_ s: Int) -> String { "\(s / 60):\(String(format: "%02d", s % 60))" }
}

extension ShareService {
    /// The Puzzles card's title: the tier copy once all ten are done, "PUZZLES · N/10"
    /// for a partly played day. The ten More Games dailies are "Puzzles" in share
    /// copy (founder, 2026-10-01: home redesign).
    static func puzzlesCardTitle(byMode: [String: DailyCompletion]) -> String {
        switch moreSweepTier(byMode: byMode) {
        case .flawless: return "PUZZLES FLAWLESS"
        case .sweep: return "PUZZLES SWEEP"
        case nil:
            let t = moreTotals(byMode: byMode)
            return "PUZZLES · \(t.completed)/\(t.total)"
        }
    }

    #if canImport(UIKit)
    @MainActor
    private static func render(_ card: DailySweepCardView) -> UIImage? {
        renderCard(card, size: card.size)
    }

    private static func cardDate() -> String {
        let f = DateFormatter(); f.dateFormat = "MMM d"; f.locale = Locale(identifier: "en_US")
        return f.string(from: Date())
    }

    /// The Puzzles (More Games) card over whatever was played today.
    @MainActor
    private static func moreCard(byMode: [String: DailyCompletion], title: String?) -> DailySweepCardView? {
        let rows = DailySweepCatalog.rows(from: byMode, over: DailySweepCatalog.moreModes)
        guard !rows.isEmpty else { return nil }
        let t = moreTotals(byMode: byMode)
        return DailySweepCardView(
            rows: rows, won: t.won, total: t.total,
            totalTimeSeconds: Int(t.totalTimeSeconds.rounded()),
            totalScore: Int(t.totalScore.rounded()), flawless: moreSweepTier(byMode: byMode) == .flawless,
            dateStr: cardDate(), title: title ?? puzzlesCardTitle(byMode: byMode))
    }

    /// The all-dailies (Wordocious) card over whatever was played today.
    @MainActor
    private static func wordCard(byMode: [String: DailyCompletion], title: String?) -> DailySweepCardView? {
        let rows = DailySweepCatalog.rows(from: byMode)
        guard !rows.isEmpty else { return nil }
        let totals = DailyTotals(byMode)
        return DailySweepCardView(
            rows: rows, won: totals.won, total: totals.total,
            totalTimeSeconds: Int(totals.totalTimeSeconds.rounded()),
            totalScore: Int(totals.totalScore.rounded()), flawless: totals.flawless,
            dateStr: cardDate(), title: title)
    }
    #endif

    /// Puzzles Sweep / Flawless share (founder, 2026-09-26): the same card over
    /// the ten More Games dailies, headed "PUZZLES SWEEP" / "PUZZLES FLAWLESS"
    /// ("PUZZLES · N/10" mid-day). §S1: the image only (no hosted link).
    /// `title` overrides the headline (the home share).
    @MainActor
    static func shareMoreSweep(byMode: [String: DailyCompletion], title: String? = nil) {
        #if canImport(UIKit)
        guard let card = moreCard(byMode: byMode, title: title), let image = render(card) else { return }
        presentImages([image], game: "Puzzles")
        #endif
    }

    /// Render + share the all-dailies card — §S1: the image only.
    /// `title` overrides the headline (the home share uses the banner headline).
    @MainActor
    static func shareDailySweep(byMode: [String: DailyCompletion], title: String? = nil) {
        #if canImport(UIKit)
        guard let card = wordCard(byMode: byMode, title: title), let image = render(card) else { return }
        presentImages([image], game: "Sweep")
        #endif
    }

    /// The home banner's share button (redesign, founder 2026-10-01; mirrors web
    /// daily-share.ts shareTodayProgress): today's progress so far, mid-day or
    /// done. The Wordocious card titled with the banner headline, plus the Puzzles
    /// card when any Puzzles were played — both images in ONE share sheet (a single
    /// 18-row card is too cramped to read). Only one group played → that card alone.
    @MainActor
    static func shareTodayProgress(byMode: [String: DailyCompletion], headline: String) {
        #if canImport(UIKit)
        let hasWord = !DailySweepCatalog.rows(from: byMode).isEmpty
        let hasMore = !DailySweepCatalog.rows(from: byMode, over: DailySweepCatalog.moreModes).isEmpty
        if !hasMore { shareDailySweep(byMode: byMode, title: headline); return }
        if !hasWord { shareMoreSweep(byMode: byMode, title: headline); return }
        guard let a = wordCard(byMode: byMode, title: headline).flatMap(render),
              let b = moreCard(byMode: byMode, title: nil).flatMap(render) else {
            shareDailySweep(byMode: byMode, title: headline); return
        }
        presentImages([a, b], game: "Today")
        #endif
    }

    // MARK: - Profile stats share card (Wave B P4) ────────────────────────────

    /// Render + share the profile stats card — §S1: the image only.
    @MainActor
    static func shareProfile(_ input: ProfileShareInput) {
        #if canImport(UIKit)
        var input = input
        if input.castId == nil { input.castId = CastAvatars.shared.lookFor(input.username)?.castId }
        let card = ProfileShareCardView(input: input)
        guard let image = renderCard(card, size: card.size) else { return }
        presentImages([image], game: "Stats")
        #endif
    }
}

/// Payload for the profile stats share card.
struct ProfileShareInput {
    let username: String
    let level: Int
    let tier: String
    let accentHex: UInt
    let totalWins: Int
    let winRate: Int
    let currentStreak: Int
    let dailyStreak: Int
    let gold: Int
    let silver: Int
    let bronze: Int
    let achievementsUnlocked: Int
    let achievementsTotal: Int
    /// FINISH_SPEC §AH: the worn cast hero; nil = the player's recorded look (CastAvatars).
    var castId: String? = nil
}

/// 1080×1080 profile stats PNG (web drawProfileCard: wordmark, accent username,
/// Level·Tier, a 2×3 grid of stats). FINISH_SPEC §E1: the Home wallpaper, the six
/// stats as tinted windows with top bars and soft numbers, and a footer cast pose
/// (not the Home host). Static and always light (see ShareKit).
struct ProfileShareCardView: View {
    let input: ProfileShareInput
    /// §S2: 4:5 (the content fits it; the clamp's floor).
    var size: CGSize { CGSize(width: 1080, height: 1350) }

    private var accent: Color { Color(hex: input.accentHex) }

    private var tiles: [(String, String, ShareStatWindow.Tone)] {
        [
            ("\(input.totalWins)", "TOTAL WINS", .purple),
            ("\(input.winRate)%", "WIN RATE", .blue),
            ("\(input.currentStreak)", "WIN STREAK", .pink),
            ("\(input.dailyStreak)", "DAILY STREAK", .gold),
            ("\(input.gold)·\(input.silver)·\(input.bronze)", "MEDALS G·S·B", .teal),
            ("\(input.achievementsUnlocked)/\(input.achievementsTotal)", "ACHIEVEMENTS", .green),
        ]
    }

    private let titleArt = "art-title-stats"

    var body: some View {
        ZStack {
            ShareWall(tint: .home)
            VStack(spacing: 0) {
                if ArtAsset.exists(titleArt), let a = ArtAsset.aspect(titleArt), a > 0 {
                    ShareArt.title(titleArt, height: min(200, 756 / a), maxWidth: 756).padding(.top, 40)
                }
                // BJ5: the player's own avatar (the one resolver: photo / mascot / cast / frame)
                // beside the name — it used to draw only a worn cast hero.
                HStack(spacing: 18) {
                    AvatarView(url: nil, username: input.username, size: 96, castId: AvatarCastRules.normalize(input.castId),
                               alwaysLight: true)
                    Text(input.username)
                        .font(Brand.fixedFont(76, .black)).foregroundStyle(accent)
                        .shadow(color: .white.opacity(0.85), radius: 0, x: 0, y: 3)
                        .lineLimit(1).minimumScaleFactor(0.5)
                }
                .padding(.horizontal, 80).padding(.top, 14)
                // §V3: the tier badge beside the level line.
                HStack(spacing: 14) {
                    Image(LevelTier.forLevel(input.level).assetName)
                        .resizable().interpolation(.high).scaledToFit()
                        .frame(width: 72, height: 72)
                    ShareDateLine(text: "Level \(input.level) · \(input.tier)", size: 30)
                        .fixedSize()
                }
                .padding(.top, 6)

                Spacer(minLength: 24)
                VStack(spacing: 22) {
                    ForEach(0..<3, id: \.self) { r in
                        HStack(spacing: 22) {
                            ShareStatWindow(value: tiles[r * 2].0, label: tiles[r * 2].1, tone: tiles[r * 2].2, height: 160)
                            ShareStatWindow(value: tiles[r * 2 + 1].0, label: tiles[r * 2 + 1].1, tone: tiles[r * 2 + 1].2, height: 160)
                        }
                    }
                }
                .padding(.horizontal, 64)
                Spacer(minLength: 24)

                ShareCastWordmark(width: 972)
                    .padding(.bottom, 40)
            }
        }
        .frame(width: size.width, height: size.height)
    }
}
