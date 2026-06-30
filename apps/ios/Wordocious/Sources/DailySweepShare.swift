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
        ModeGen.daily.map { m in
            let key = m.dbKey ?? ""
            return (dbKey: key, label: labelOverride[key] ?? m.shareLabel, accent: m.accent, glyph: m.glyph ?? "")
        }

    /// Build the ordered rows present in today's completions.
    static func rows(from byMode: [String: DailyCompletion]) -> [DailySweepRow] {
        modes.compactMap { m in
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
                    .font(.custom("Nunito", size: 56).weight(.black))
                    .foregroundStyle(LinearGradient(colors: [Color(hex: 0xA78BFA), Color(hex: 0xEC4899)],
                                                    startPoint: .leading, endPoint: .trailing))
                    .padding(.top, 44)
                Text(flawless ? "FLAWLESS VICTORY" : "DAILY SWEEP")
                    .font(.custom("Nunito", size: 52).weight(.black))
                    .foregroundStyle(LinearGradient(colors: titleColors, startPoint: .leading, endPoint: .trailing))
                    .padding(.top, 12)
                Text("\(won)/\(total) won · \(fmt(totalTimeSeconds)) · \(totalScore) pts · \(dateStr)")
                    .font(.custom("Nunito", size: 26).weight(.bold)).foregroundStyle(textMuted)
                    .padding(.top, 14)

                Spacer(minLength: 28)
                VStack(spacing: 16) {
                    ForEach(rows) { row in rowView(row) }
                }
                .padding(.horizontal, 90)
                Spacer(minLength: 20)

                Text("wordocious.com").font(.custom("Nunito", size: 22).weight(.bold))
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
                Text(r.modeLabel).font(.custom("Nunito", size: 30).weight(.black)).foregroundStyle(textDark)
                Text("\(r.won ? "\(r.guesses)g" : "X") · \(fmt(r.timeSeconds)) · \(r.score) pts")
                    .font(.custom("Nunito", size: 21).weight(.bold)).foregroundStyle(textMuted)
            }
            Spacer()
            Text(r.won ? "✓" : "✗").font(.custom("Nunito", size: 48).weight(.black))
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
        if let icon = homeModes.first(where: { $0.dbKey == r.dbKey })?.icon {
            switch icon {
            case .asset(let name), .original(let name):
                Image(name).renderingMode(.template).resizable().scaledToFit()
                    .frame(width: 38, height: 38).foregroundStyle(.white)
            case .roman(let text):
                Text(text).font(.custom("Nunito", size: text.count >= 3 ? 26 : 32).weight(.black)).foregroundStyle(.white)
            case .hand(let name, let number):
                ZStack(alignment: .center) {
                    Image(name).renderingMode(.template).resizable().scaledToFit()
                        .frame(width: 44, height: 46).foregroundStyle(.white)
                    Text(number).font(.custom("Nunito", size: 22).weight(.black)).foregroundStyle(r.accent)
                        .offset(y: 9)
                }
            }
        } else {
            Text(r.glyph).font(.custom("Nunito", size: r.glyph.count >= 3 ? 24 : 30).weight(.black)).foregroundStyle(.white)
        }
    }

    private func fmt(_ s: Int) -> String { "\(s / 60):\(String(format: "%02d", s % 60))" }
}

extension ShareService {
    /// Render + share the all-dailies card. Uploads to share-images and links
    /// the /s OG page with m=DailySweep params (web app/s/[...key] parity).
    @MainActor
    static func shareDailySweep(byMode: [String: DailyCompletion]) {
        #if canImport(UIKit)
        let rows = DailySweepCatalog.rows(from: byMode)
        guard !rows.isEmpty else { return }
        let totals = DailyTotals(byMode)
        let f = DateFormatter(); f.dateFormat = "MMM d"; f.locale = Locale(identifier: "en_US")
        let card = DailySweepCardView(
            rows: rows, won: totals.won, total: totals.total,
            totalTimeSeconds: Int(totals.totalTimeSeconds.rounded()),
            totalScore: Int(totals.totalScore.rounded()), flawless: totals.flawless,
            dateStr: f.string(from: Date()))
        let renderer = ImageRenderer(content: card)
        renderer.proposedSize = .init(card.size)
        renderer.scale = 1
        guard let image = renderer.uiImage, let png = image.pngData() else { return }

        Task {
            let url = await uploadDailySweepURL(png: png, totals: totals)
            await MainActor.run {
                var items: [Any] = [image]
                if let url { items.append(url) }
                present(items: items)
            }
        }
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
            try await client.storage.from("share-images").upload(
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
        let client = AuthService.shared.client
        guard let uid = (try? await client.auth.session.user.id.uuidString)?.lowercased() else { return nil }
        let f = DateFormatter(); f.locale = Locale(identifier: "en_US_POSIX")
        f.calendar = Calendar(identifier: .gregorian); f.dateFormat = "yyyy-MM-dd"; f.timeZone = .current
        let dateStr = f.string(from: Date())
        let key = "\(uid)/DailySweep-\(dateStr)"
        do {
            try await client.storage.from("share-images").upload(
                "\(key).png", data: png, options: FileOptions(contentType: "image/png", upsert: true))
        } catch { return nil }

        let totalTime = Int(totals.totalTimeSeconds.rounded())
        let totalScore = Int(totals.totalScore.rounded())
        let q: [String: String] = [
            "m": "DailySweep",
            "sweep": totals.flawless ? "flawless" : "sweep",
            "won": "\(totals.won)", "tot": "\(totals.total)",
            "t": "\(totalTime)", "pts": "\(totalScore)",
            "w": "1080", "h": "1350",
            "v": "\(totals.flawless ? "f" : "s")\(totals.won)-\(totalTime)-\(totalScore)",
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
                    .font(.custom("Nunito", size: 50).weight(.black))
                    .foregroundStyle(LinearGradient(colors: [Color(hex: 0xA78BFA), Color(hex: 0xEC4899)],
                                                    startPoint: .leading, endPoint: .trailing))
                    .padding(.top, 64)
                Text(input.username)
                    .font(.custom("Nunito", size: 76).weight(.black)).foregroundStyle(accent)
                    .lineLimit(1).minimumScaleFactor(0.5).padding(.horizontal, 80).padding(.top, 18)
                Text("Level \(input.level) · \(input.tier)")
                    .font(.custom("Nunito", size: 30).weight(.bold)).foregroundStyle(textMuted)
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

                Text("wordocious.com").font(.custom("Nunito", size: 24).weight(.bold))
                    .foregroundStyle(Color(hex: 0x9CA3AF)).padding(.bottom, 48)
            }
        }
        .frame(width: size.width, height: size.height)
    }

    private func statTile(_ value: String, _ label: String) -> some View {
        VStack(spacing: 8) {
            Text(value).font(.custom("Nunito", size: 60).weight(.black))
                .foregroundStyle(accent).lineLimit(1).minimumScaleFactor(0.5)
            Text(label).font(.custom("Nunito", size: 26).weight(.bold)).foregroundStyle(textMuted)
        }
        .frame(maxWidth: .infinity).padding(.vertical, 40)
        .background(RoundedRectangle(cornerRadius: 28).fill(.white))
        .overlay(RoundedRectangle(cornerRadius: 28).stroke(Color(hex: 0xE5E7EB), lineWidth: 3))
    }
}
