import SwiftUI
import WordociousCore

/// Identical port of apps/web/components/modals/help-modal.tsx — three tabs
/// (How to Play / Game Modes / FAQ), same copy, examples, and mode list.
struct HelpView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var tab: Tab
    @StateObject private var content = ContentService.shared

    init(initialTab: Tab = .howToPlay) { _tab = State(initialValue: initialTab) }

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
        .task { await content.load() }
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
                        Text(content.helpDesc(forTitle: mode.title) ?? mode.desc).font(Brand.font(12, .semibold))
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

    // MARK: FAQ (single-sourced via ContentService → /api/content)

    private var faq: some View {
        VStack(alignment: .leading, spacing: 12) {
            ForEach(content.helpFaq) { item in
                VStack(alignment: .leading, spacing: 2) {
                    Text(item.q).font(Brand.font(14, .black)).foregroundStyle(Theme.textPrimary)
                    Text(item.a).font(Brand.font(12, .semibold)).foregroundStyle(Theme.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
    }
}
