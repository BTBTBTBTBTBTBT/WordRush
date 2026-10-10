import SwiftUI
import Supabase

/// The Sunday finish (Stats + Friends redesign D3.3, founder 2026-09-26, bible
/// §294) — the weekly friends race is SETTLED once per (viewer, week) SERVER-
/// side by /api/friends into weekly_race_results; natives only render it.
/// This file holds the shared ordinal helper (twin of lib/weekly-race.ts) and
/// the Stats All-time card over the settled rows (twin of
/// components/stats/weekly-finishes.tsx).
enum WeeklyRace {
    /// "You finished 2nd of 6" — the ordinal shared by the banner and the card.
    static func ordinal(_ n: Int) -> String {
        let v = n % 100
        if (11...13).contains(v) { return "\(n)th" }
        switch n % 10 {
        case 1: return "\(n)st"; case 2: return "\(n)nd"; case 3: return "\(n)rd"
        default: return "\(n)th"
        }
    }

    /// One settled week — the owner's row of weekly_race_results.
    struct Row: Decodable, Equatable {
        let weekStart: String
        let rank: Int
        let points: Int
        let circleSize: Int
        let winnerPoints: Int?
        enum CodingKeys: String, CodingKey {
            case rank, points
            case weekStart = "week_start"
            case circleSize = "circle_size"
            case winnerPoints = "winner_points"
        }
    }

    /// The viewer's settled weeks, newest first (RLS: owner + accepted
    /// friends read). No-throw: [] on any failure.
    static func fetchFinishes(userId: String) async -> [Row] {
        (try? await AuthService.shared.client.from("weekly_race_results")
            .select("week_start, rank, points, circle_size, winner_points")
            .eq("user_id", value: userId)
            .order("week_start", ascending: false)
            .limit(52)
            .execute().value) ?? []
    }

    /// "Sep 15–Sep 21" — the local Mon–Sun range of a settled week (the
    /// web card's toLocaleDateString month/day pair).
    static func weekLabel(_ weekStart: String) -> String {
        let p = DateFormatter(); p.dateFormat = "yyyy-MM-dd"; p.timeZone = .current
        guard let mon = p.date(from: weekStart),
              let sun = Calendar.current.date(byAdding: .day, value: 6, to: mon) else { return weekStart }
        let f = DateFormatter(); f.locale = Locale(identifier: "en_US"); f.dateFormat = "MMM d"
        return "\(f.string(from: mon))–\(f.string(from: sun))"
    }
}

/// Weekly Race Finishes — the Stats All-time card (D3.3): how many times you
/// won, placed and showed across the settled weeks, and the last result in
/// words. Hidden until the first week settles.
struct WeeklyFinishesCard: View {
    let userId: String
    @State private var rows: [WeeklyRace.Row]?

    /// Session memo in the first frame (founder, 2026-09-29: the card popped in on every
    /// All-time visit — it had no cache at all).
    init(userId: String) {
        self.userId = userId
        _rows = State(initialValue: StatsMemo.shared.get("weeklyFinishes:\(userId)"))
    }

    private static let purple = Color(hex: 0x7C3AED)

    var body: some View {
        Group {
            if let rows, let last = rows.first {
                // FINISH_SPEC §A1 / §A2: a tinted gold card with its top bar, the
                // medal tallies as tinted tiles with soft numbers.
                VStack(alignment: .leading, spacing: 10) {
                    HStack(spacing: 8) {
                        Icon3D(.trophy, size: 22)
                        BubbleLabel("Weekly Race Finishes", color: FinishInk.purple.bubbleInk, size: 15, minScale: 0.5)
                        Spacer()
                        Text("\(rows.count) \(rows.count == 1 ? "week" : "weeks")")
                            .font(Brand.font(10, .heavy)).foregroundStyle(FinishInk.secondary)
                    }
                    HStack(spacing: 8) {
                        tally("gold", count(rows, 1), Color(hex: 0xF5A524), "first")
                        tally("silver", count(rows, 2), Color(hex: 0xAAB3C5), "second")
                        tally("bronze", count(rows, 3), Color(hex: 0xD9844A), "third")
                    }
                    Text("\(WeeklyRace.weekLabel(last.weekStart)): finished \(WeeklyRace.ordinal(last.rank)) of \(last.circleSize) · \(last.points.formatted()) pts")
                        .font(Brand.font(10, .bold)).foregroundStyle(FinishInk.secondary)
                        .frame(maxWidth: .infinity).multilineTextAlignment(.center)
                }
                .padding(.horizontal, 16).padding(.vertical, 12)
                .tintedCard(accent: Color(hex: 0xF5A524), bar: [Color(hex: 0xF5A524), Color(hex: 0xFFD166)], barHeight: 6)
            }
        }
        .task(id: userId) {
            let fresh = await WeeklyRace.fetchFinishes(userId: userId)
            rows = fresh
            StatsMemo.shared.set("weeklyFinishes:\(userId)", fresh)
        }
    }

    private func count(_ rows: [WeeklyRace.Row], _ rank: Int) -> Int { rows.filter { $0.rank == rank }.count }

    private func tally(_ medal: String, _ n: Int, _ accent: Color, _ place: String) -> some View {
        VStack(spacing: 2) {
            // §AM3: the glossy medal art, never the emoji.
            MedalArt(kind: medal, size: 24, fallbackColor: accent)
            Text("\(n)").softNumber(20)
        }
        .frame(maxWidth: .infinity).padding(.vertical, 8)
        .tintedPill(accent, radius: 14)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Finished \(place) \(n) \(n == 1 ? "time" : "times")")
    }
}
