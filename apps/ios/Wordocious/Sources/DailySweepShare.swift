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

/// 1080×1350 PNG card matching the web all-dailies design.
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

    private let bg = Color(hex: 0xF8F7FF)
    private let textMuted = Color(hex: 0x6B7280)
    private let textDark = Color(hex: 0x1A1A2E)
    private let winFG = Color(hex: 0x7C3AED), winBG = Color(hex: 0xF5F3FF)
    private let lossFG = Color(hex: 0xDC2626), lossBG = Color(hex: 0xFEE2E2)

    var size: CGSize { CGSize(width: 1080, height: 1350) }

    private var titleColors: [Color] {
        flawless ? [Color(hex: 0xFBBF24), Color(hex: 0xB45309)] : [Color(hex: 0xA78BFA), Color(hex: 0xEC4899)]
    }

    var body: some View {
        ZStack {
            bg
            VStack(spacing: 0) {
                Text("WORDOCIOUS")
                    .font(Brand.font(56, .black))
                    .foregroundStyle(LinearGradient(colors: [Color(hex: 0xA78BFA), Color(hex: 0xEC4899)],
                                                    startPoint: .leading, endPoint: .trailing))
                    .padding(.top, 44)
                Text(title ?? (flawless ? "FLAWLESS VICTORY" : "DAILY SWEEP"))
                    .font(Brand.font(52, .black))
                    .foregroundStyle(LinearGradient(colors: titleColors, startPoint: .leading, endPoint: .trailing))
                    // The home share titles the card with the banner headline
                    // ("WORDOCIOUS SWEPT! 10 PUZZLES LEFT"): two lines, then shrink.
                    .multilineTextAlignment(.center).lineLimit(2).minimumScaleFactor(0.5)
                    .padding(.horizontal, 48)
                    .padding(.top, 12)
                Text("\(won)/\(total) won · \(fmt(totalTimeSeconds)) · \(totalScore) pts · \(dateStr)")
                    .font(Brand.font(26, .bold)).foregroundStyle(textMuted)
                    .padding(.top, 14)

                Spacer(minLength: 28)
                VStack(spacing: 16) {
                    ForEach(rows) { row in rowView(row) }
                }
                .padding(.horizontal, 90)
                Spacer(minLength: 20)

                Text("wordocious.com").font(Brand.font(22, .bold))
                    .foregroundStyle(Color(hex: 0x9CA3AF)).padding(.bottom, 40)
            }
        }
        .frame(width: size.width, height: size.height)
    }

    private func rowView(_ r: DailySweepRow) -> some View {
        HStack(spacing: 22) {
            ZStack {
                RoundedRectangle(cornerRadius: 16).fill(r.accent).frame(width: 72, height: 72)
                shareGlyph(r)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(r.modeLabel).font(Brand.font(30, .black)).foregroundStyle(textDark)
                Text("\(r.won ? "\(r.guesses)g" : "X") · \(fmt(r.timeSeconds)) · \(r.score) pts")
                    .font(Brand.font(21, .bold)).foregroundStyle(textMuted)
            }
            Spacer()
            Text(r.won ? "✓" : "✗").font(Brand.font(48, .black))
                .foregroundStyle(r.won ? winFG : lossFG)
        }
        .padding(.horizontal, 24).padding(.vertical, 16)
        .frame(maxWidth: .infinity)
        .background(RoundedRectangle(cornerRadius: 20).fill(r.won ? winBG : lossBG))
        .overlay(RoundedRectangle(cornerRadius: 20).stroke(r.won ? winFG : lossFG, lineWidth: 3))
    }

    /// The mode's real game icon (lucide / hand / roman numeral — same source as
    /// the home cards + celebration modal), drawn in WHITE on the accent badge so
    /// the shared card shows recognizable game icons, not bare letter glyphs.
    /// Falls back to the glyph text if the mode isn't found.
    @ViewBuilder
    private func shareGlyph(_ r: DailySweepRow) -> some View {
        // homeModes alone left the ten More Games titles as letter glyphs (founder, 2026-09-28).
        if let icon = (homeModes + moreModes).first(where: { $0.dbKey == r.dbKey })?.icon {
            switch icon {
            case .asset(let name), .original(let name):
                Image(name).renderingMode(.template).resizable().scaledToFit()
                    .frame(width: 38, height: 38).foregroundStyle(.white)
            case .roman(let text):
                Text(text).font(Brand.font(CGFloat(text.count >= 3 ? 26 : 32), .black)).foregroundStyle(.white)
            case .hand(let name, let number):
                ZStack(alignment: .center) {
                    Image(name).renderingMode(.template).resizable().scaledToFit()
                        .frame(width: 44, height: 46).foregroundStyle(.white)
                    Text(number).font(Brand.font(22, .black)).foregroundStyle(r.accent)
                        .offset(y: 9)
                }
            case .symbol(let name):
                Image(systemName: name).font(.system(size: 30, weight: .bold)).foregroundStyle(.white)
            }
        } else {
            Text(r.glyph).font(Brand.font(CGFloat(r.glyph.count >= 3 ? 24 : 30), .black)).foregroundStyle(.white)
        }
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
    private static func render(_ card: DailySweepCardView) -> (image: UIImage, png: Data)? {
        let renderer = ImageRenderer(content: card)
        renderer.proposedSize = .init(card.size)
        renderer.scale = 1
        guard let image = renderer.uiImage, let png = image.pngData() else { return nil }
        return (image, png)
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
    /// ("PUZZLES · N/10" mid-day). Uploads the card and links its /s OG page
    /// (m=MoreSweep) exactly like the Daily Sweep — a bare wordocious.com link
    /// made Messages unfurl the generic home page image instead of the card
    /// (founder, 2026-09-26). `title` overrides the headline (the home share).
    @MainActor
    static func shareMoreSweep(byMode: [String: DailyCompletion], title: String? = nil) {
        #if canImport(UIKit)
        guard let card = moreCard(byMode: byMode, title: title), let r = render(card) else { return }
        let t = moreTotals(byMode: byMode)
        let flawless = moreSweepTier(byMode: byMode) == .flawless
        Task {
            let url = await uploadSweepURL(
                png: r.png, shareMode: "MoreSweep", flawless: flawless, won: t.won, total: t.total,
                totalTime: Int(t.totalTimeSeconds.rounded()), totalScore: Int(t.totalScore.rounded()))
            await MainActor.run {
                var items: [Any] = [r.image]
                if let url { items.append(url) }
                present(items: items)
            }
        }
        #endif
    }

    /// Render + share the all-dailies card. Uploads to share-images and links
    /// the /s OG page with m=DailySweep params (web app/s/[...key] parity).
    /// `title` overrides the headline (the home share uses the banner headline).
    @MainActor
    static func shareDailySweep(byMode: [String: DailyCompletion], title: String? = nil) {
        #if canImport(UIKit)
        guard let card = wordCard(byMode: byMode, title: title), let r = render(card) else { return }
        let totals = DailyTotals(byMode)
        Task {
            let url = await uploadDailySweepURL(png: r.png, totals: totals)
            await MainActor.run {
                var items: [Any] = [r.image]
                if let url { items.append(url) }
                present(items: items)
            }
        }
        #endif
    }

    /// The home banner's share button (redesign, founder 2026-10-01; mirrors web
    /// daily-share.ts shareTodayProgress): today's progress so far, mid-day or
    /// done. The Wordocious card titled with the banner headline, plus the Puzzles
    /// card when any Puzzles were played — both images in ONE share sheet (a single
    /// 18-row card is too cramped to read). Only one group played → that card alone,
    /// titled with the headline, through its usual upload + OG link.
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
        present(items: [a.image, b.image])
        #endif
    }

    // MARK: - Profile stats share card (Wave B P4) ────────────────────────────

    /// Render + share the profile stats card. Mirrors web lib/share-image.ts
    /// drawProfileCard + the /s OG page m=Profile params.
    @MainActor
    static func shareProfile(_ input: ProfileShareInput) {
        #if canImport(UIKit)
        let card = ProfileShareCardView(input: input)
        let renderer = ImageRenderer(content: card)
        renderer.proposedSize = .init(card.size)
        renderer.scale = 1
        guard let image = renderer.uiImage, let png = image.pngData() else { return }
        Task {
            let url = await uploadProfileURL(png: png, input: input)
            await MainActor.run {
                var items: [Any] = [image]
                if let url { items.append(url) }
                present(items: items)
            }
        }
        #endif
    }

    private static func uploadProfileURL(png: Data, input: ProfileShareInput) async -> URL? {
        let client = AuthService.shared.client
        guard let uid = (try? await client.auth.session.user.id.uuidString)?.lowercased() else { return nil }
        let f = DateFormatter(); f.locale = Locale(identifier: "en_US_POSIX")
        f.calendar = Calendar(identifier: .gregorian); f.dateFormat = "yyyy-MM-dd"; f.timeZone = .current
        let dateStr = f.string(from: Date())
        let key = "\(uid)/Profile-\(dateStr)"
        do {
            try await AuthService.shared.uploadClient.storage.from("share-images").upload(
                "\(key).png", data: png, options: FileOptions(contentType: "image/png", upsert: true))
        } catch { return nil }
        let q: [String: String] = [
            "m": "Profile", "w": "1080", "h": "1080",
            "v": "p\(input.totalWins)-\(input.currentStreak)-\(input.achievementsUnlocked)",
        ]
        var comps = URLComponents(string: "https://wordocious.com/s/\(key)")
        comps?.queryItems = q.map { URLQueryItem(name: $0.key, value: $0.value) }
        return comps?.url
    }

    private static func uploadDailySweepURL(png: Data, totals: DailyTotals) async -> URL? {
        await uploadSweepURL(
            png: png, shareMode: "DailySweep", flawless: totals.flawless, won: totals.won, total: totals.total,
            totalTime: Int(totals.totalTimeSeconds.rounded()), totalScore: Int(totals.totalScore.rounded()))
    }

    /// Upload an all-dailies card to share-images under `<uid>/<shareMode>-<date>`
    /// and build its /s OG link (web share-page-copy.ts reads m=DailySweep and
    /// m=MoreSweep with the same won/tot/t/pts params).
    private static func uploadSweepURL(png: Data, shareMode: String, flawless: Bool, won: Int, total: Int, totalTime: Int, totalScore: Int) async -> URL? {
        let client = AuthService.shared.client
        guard let uid = (try? await client.auth.session.user.id.uuidString)?.lowercased() else { return nil }
        let f = DateFormatter(); f.locale = Locale(identifier: "en_US_POSIX")
        f.calendar = Calendar(identifier: .gregorian); f.dateFormat = "yyyy-MM-dd"; f.timeZone = .current
        let dateStr = f.string(from: Date())
        let key = "\(uid)/\(shareMode)-\(dateStr)"
        do {
            try await AuthService.shared.uploadClient.storage.from("share-images").upload(
                "\(key).png", data: png, options: FileOptions(contentType: "image/png", upsert: true))
        } catch { return nil }
        let q: [String: String] = [
            "m": shareMode,
            "sweep": flawless ? "flawless" : "sweep",
            "won": "\(won)", "tot": "\(total)",
            "t": "\(totalTime)", "pts": "\(totalScore)",
            "w": "1080", "h": "1350",
            "v": "\(flawless ? "f" : "s")\(won)-\(totalTime)-\(totalScore)",
        ]
        var comps = URLComponents(string: "https://wordocious.com/s/\(key)")
        comps?.queryItems = q.map { URLQueryItem(name: $0.key, value: $0.value) }
        return comps?.url
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
}

/// 1080×1080 profile stats PNG matching web drawProfileCard (wordmark, accent
/// username, Level·Tier, a 2×3 grid of stat tiles).
struct ProfileShareCardView: View {
    let input: ProfileShareInput
    var size: CGSize { CGSize(width: 1080, height: 1080) }

    private let bg = Color(hex: 0xF8F7FF)
    private let textMuted = Color(hex: 0x6B7280)
    private let textDark = Color(hex: 0x1A1A2E)
    private var accent: Color { Color(hex: input.accentHex) }

    private var tiles: [(String, String)] {
        [
            ("\(input.totalWins)", "Total Wins"),
            ("\(input.winRate)%", "Win Rate"),
            ("\(input.currentStreak)", "Win Streak"),
            ("\(input.dailyStreak)", "Daily Streak"),
            ("\(input.gold)·\(input.silver)·\(input.bronze)", "Medals G·S·B"),
            ("\(input.achievementsUnlocked)/\(input.achievementsTotal)", "Achievements"),
        ]
    }

    var body: some View {
        ZStack {
            bg
            VStack(spacing: 0) {
                Text("WORDOCIOUS")
                    .font(Brand.font(50, .black))
                    .foregroundStyle(LinearGradient(colors: [Color(hex: 0xA78BFA), Color(hex: 0xEC4899)],
                                                    startPoint: .leading, endPoint: .trailing))
                    .padding(.top, 64)
                Text(input.username)
                    .font(Brand.font(76, .black)).foregroundStyle(accent)
                    .lineLimit(1).minimumScaleFactor(0.5).padding(.horizontal, 80).padding(.top, 18)
                Text("Level \(input.level) · \(input.tier)")
                    .font(Brand.font(30, .bold)).foregroundStyle(textMuted)
                    .padding(.top, 8)

                Spacer(minLength: 40)
                VStack(spacing: 24) {
                    ForEach(0..<3, id: \.self) { r in
                        HStack(spacing: 24) {
                            statTile(tiles[r * 2].0, tiles[r * 2].1)
                            statTile(tiles[r * 2 + 1].0, tiles[r * 2 + 1].1)
                        }
                    }
                }
                .padding(.horizontal, 80)
                Spacer(minLength: 30)

                Text("wordocious.com").font(Brand.font(24, .bold))
                    .foregroundStyle(Color(hex: 0x9CA3AF)).padding(.bottom, 48)
            }
        }
        .frame(width: size.width, height: size.height)
    }

    private func statTile(_ value: String, _ label: String) -> some View {
        VStack(spacing: 8) {
            Text(value).font(Brand.font(60, .black))
                .foregroundStyle(accent).lineLimit(1).minimumScaleFactor(0.5)
            Text(label).font(Brand.font(26, .bold)).foregroundStyle(textMuted)
        }
        .frame(maxWidth: .infinity).padding(.vertical, 40)
        .background(RoundedRectangle(cornerRadius: 28).fill(.white))
        .overlay(RoundedRectangle(cornerRadius: 28).stroke(Color(hex: 0xE5E7EB), lineWidth: 3))
    }
}
