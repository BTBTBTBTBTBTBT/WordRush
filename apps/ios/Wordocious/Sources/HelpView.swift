import SwiftUI
import WordociousCore

/// Identical port of apps/web/components/modals/help-modal.tsx — three tabs
/// (How to Play / Game Modes / FAQ), same copy, examples, and mode list.
struct HelpView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var tab: Tab = .howToPlay

    enum Tab: String, CaseIterable {
        case howToPlay = "How to Play"
        case modes = "Game Modes"
        case faq = "FAQ"
    }

    var body: some View {
        VStack(spacing: 0) {
            // Top accent bar (purple → pink → amber)
            LinearGradient(colors: [Color(hex: 0xA78BFA), Color(hex: 0xEC4899), Color(hex: 0xFBBF24)],
                           startPoint: .leading, endPoint: .trailing)
                .frame(height: 6)

            HStack {
                Text(tab.rawValue).font(Brand.font(20, .black)).foregroundStyle(Theme.wordmarkGradient)
                Spacer()
                Button { dismiss() } label: {
                    Image(systemName: "xmark").font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(Theme.textMuted)
                }
            }
            .padding(.horizontal, 20).padding(.top, 16)

            // Tabs
            HStack(spacing: 4) {
                ForEach(Tab.allCases, id: \.self) { t in
                    Button { tab = t } label: {
                        Text(t.rawValue).font(Brand.font(12, .bold))
                            .foregroundStyle(tab == t ? Theme.surface : Theme.textSecondary)
                            .padding(.horizontal, 12).padding(.vertical, 6)
                            .background(Capsule().fill(tab == t ? Theme.textPrimary : Theme.surfaceAlt))
                    }
                    .buttonStyle(.plain)
                }
                Spacer()
            }
            .padding(.horizontal, 20).padding(.top, 12).padding(.bottom, 8)

            ScrollView {
                Group {
                    switch tab {
                    case .howToPlay: howToPlay
                    case .modes: gameModes
                    case .faq: faq
                    }
                }
                .padding(.horizontal, 20).padding(.bottom, 20)
            }
        }
        .background(Theme.surface.ignoresSafeArea())
    }

    // MARK: How to Play

    private var howToPlay: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Guess the 5-letter word. Each guess must be a valid word. After each guess, the tiles change color to show how close you are.")
                .font(Brand.font(14, .semibold)).foregroundStyle(Theme.textSecondary)

            exampleRow(["W","E","A","R","Y"], [.correct,.empty,.empty,.empty,.empty],
                       "W", Color(hex: 0x7C3AED), " is in the word and in the correct spot.")
            exampleRow(["P","I","L","L","S"], [.empty,.present,.empty,.empty,.empty],
                       "I", Theme.present, " is in the word but in the wrong spot.")
            exampleRow(["V","A","G","U","E"], [.empty,.empty,.empty,.absent,.empty],
                       "U", Theme.absent, " is not in the word at all.")

            Text("Daily puzzles reset at your local midnight. Every player gets the same word of the day so you can compare results.")
                .font(Brand.font(12, .semibold)).foregroundStyle(Theme.textSecondary)
                .padding(.horizontal, 12).padding(.vertical, 10)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(RoundedRectangle(cornerRadius: 12).fill(Theme.background))
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.border, lineWidth: 1))
        }
    }

    private func exampleRow(_ letters: [String], _ colors: [TileState], _ hi: String, _ hiColor: Color, _ rest: String) -> some View {
        VStack(spacing: 6) {
            HStack(spacing: 4) {
                ForEach(Array(letters.enumerated()), id: \.offset) { i, l in
                    let filled = colors[i] != .empty
                    Text(l).font(Brand.font(14, .black))
                        .foregroundStyle(filled ? .white : Theme.textPrimary)
                        .frame(width: 36, height: 36)
                        .background(RoundedRectangle(cornerRadius: 4).fill(filled ? Theme.tileColor(for: colors[i]) : Color.white))
                        .overlay(RoundedRectangle(cornerRadius: 4).stroke(filled ? Theme.tileColor(for: colors[i]) : Color(hex: 0xD1D5DB), lineWidth: 2))
                }
            }
            (Text(hi).font(Brand.font(12, .bold)).foregroundColor(hiColor)
             + Text(rest).font(Brand.font(12, .semibold)).foregroundColor(Theme.textSecondary))
                .frame(maxWidth: .infinity)
        }
    }

    // MARK: Game Modes

    private var gameModes: some View {
        VStack(spacing: 8) {
            ForEach(homeModes) { mode in
                HStack(alignment: .top, spacing: 12) {
                    ModeIconView(icon: mode.icon, accent: mode.accent, box: 32)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(mode.title).font(Brand.font(14, .black)).foregroundStyle(Theme.textPrimary)
                        Text(helpDesc[mode.id] ?? mode.desc).font(Brand.font(12, .semibold))
                            .foregroundStyle(Theme.textSecondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    Spacer(minLength: 0)
                }
                .padding(.horizontal, 12).padding(.vertical, 10)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(RoundedRectangle(cornerRadius: 12).fill(Theme.surfaceHover))
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.divider, lineWidth: 1))
            }
        }
    }

    private let helpDesc: [String: String] = [
        "practice": "1 word, 6 guesses. The original formula.",
        "vs": "Race an opponent in real-time. First to solve wins.",
        "quordle": "4 words at once. 9 guesses total. Each guess applies to all 4 boards.",
        "octordle": "8 words at once. 13 guesses. Same idea, bigger challenge.",
        "sequence": "4 words solved in order. Solve one to unlock the next. 10 guesses total.",
        "rescue": "4 boards with pre-filled hints to get you started. 6 guesses to solve them all.",
        "six": "Guess a 6-letter word in 7 tries. Same rules as Classic, bigger vocabulary.",
        "seven": "Guess a 7-letter word in 8 tries. The ultimate single-word challenge.",
        "gauntlet": "5 stages of increasing difficulty — Classic through OctoWord. Survive them all.",
        "propernoundle": "Guess famous names instead of dictionary words. Themed daily puzzles.",
    ]

    // MARK: FAQ

    private let faqItems: [(String, String)] = [
        ("How are scores calculated?", "Solving earns a 1,000-point base, plus a speed bonus (your mode's time cap minus your solve time — faster is better) and a completion bonus of up to 200, scaled by how many boards you solved. Six, Seven, and ProperNoundle also add a guess bonus for solving in fewer guesses. Example: a Classic solve in 27s scores 1,000 + 273 (speed) + 200 (completion) = 1,473. Your daily-leaderboard rank is based on this composite score."),
        ("Do hints affect my score?", "Yes. In Six, Seven, and ProperNoundle you can reveal a hint, but each one is subtracted from your score — 120 points per hint in ProperNoundle and 150 in Six and Seven. Hints never push a winning score below zero, and modes without hint buttons are unaffected."),
        ("How do XP and levels work?", "Win = 100 XP, loss = 25 XP. Bonuses: +50 for a win streak, +50 for a daily challenge, and medal XP (gold +100, silver +50, bronze +25). Play all 9 of the day's puzzles for a Daily Sweep (+200 XP), and win every one for a Flawless Victory (+400 XP more — 600 total). Every 1,000 XP = 1 level."),
        ("How do medals work?", "Finish in the top three of a mode's daily leaderboard to earn a gold, silver, or bronze medal, with extra medals for streak milestones and perfect games. Your medal tally is shown on your profile."),
        ("Are there achievements?", "Yes — 70 achievements to unlock across beginner, consistency, skill, social, and collection challenges, from your First Win to a flawless Gauntlet run, 30-day streaks, winning 50 games in a single mode, and big medal hauls. They unlock automatically as you play, and your full collection (with progress toward each one) lives on your profile."),
        ("What's a streak?", "Play at least one daily puzzle each day to build your daily streak. Puzzles reset at your local midnight, and missing a day resets the streak — unless a Streak Shield saves it."),
        ("What are Streak Shields?", "A Streak Shield automatically protects your streak the first time you miss a day. You earn shields through gameplay milestones, and your current count appears in the header."),
        ("What does PRO unlock?", "PRO removes all ads and unlocks unlimited replays (free players get one play per mode per day), Unlimited mode for endless fresh puzzles, deep Pro Insights stats, and VS extras like sending invites and rematches."),
        ("Do daily puzzles use the same words for everyone?", "Yes! Every player gets the same daily puzzles, so you can compare results on the leaderboard."),
    ]

    private var faq: some View {
        VStack(alignment: .leading, spacing: 12) {
            ForEach(Array(faqItems.enumerated()), id: \.offset) { _, item in
                VStack(alignment: .leading, spacing: 2) {
                    Text(item.0).font(Brand.font(14, .black)).foregroundStyle(Theme.textPrimary)
                    Text(item.1).font(Brand.font(12, .semibold)).foregroundStyle(Theme.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
    }
}
