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

    private static let purple = Color(hex: 0x7C3AED)

    var body: some View {
        Group {
            if let rows, let last = rows.first {
                VStack(spacing: 0) {
                    LinearGradient(colors: [Self.purple, Color(hex: 0xEC4899)], startPoint: .leading, endPoint: .trailing)
                        .frame(height: 3)
                    VStack(alignment: .leading, spacing: 8) {
                        HStack(spacing: 8) {
                            Image(systemName: "flag.fill").font(.system(size: 14, weight: .bold))
                                .foregroundStyle(Self.purple)
                            Text("Weekly Race Finishes").font(Brand.font(14, .black)).foregroundStyle(Theme.textPrimary)
                            Spacer()
                            Text("\(rows.count) \(rows.count == 1 ? "week" : "weeks")")
                                .font(Brand.font(10, .bold)).foregroundStyle(Theme.textMuted)
                        }
                        HStack {
                            tally("🥇", count(rows, 1))
                            tally("🥈", count(rows, 2))
                            tally("🥉", count(rows, 3))
                        }
                        Text("\(WeeklyRace.weekLabel(last.weekStart)): finished \(WeeklyRace.ordinal(last.rank)) of \(last.circleSize) · \(last.points.formatted()) pts")
                            .font(Brand.font(10, .bold)).foregroundStyle(Theme.textMuted)
                            .frame(maxWidth: .infinity).multilineTextAlignment(.center)
                    }
                    .padding(.horizontal, 16).padding(.vertical, 12)
                }
                .background(RoundedRectangle(cornerRadius: 16).fill(Theme.surface))
                .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1.5))
                .clipShape(RoundedRectangle(cornerRadius: 16))
            }
        }
        .task(id: userId) { rows = await WeeklyRace.fetchFinishes(userId: userId) }
    }

    private func count(_ rows: [WeeklyRace.Row], _ rank: Int) -> Int { rows.filter { $0.rank == rank }.count }

    private func tally(_ medal: String, _ n: Int) -> some View {
        VStack(spacing: 2) {
            Text(medal).font(.system(size: 18))
            Text("\(n)").font(Brand.font(16, .black)).foregroundStyle(Theme.textPrimary)
        }
        .frame(maxWidth: .infinity)
    }
}
