import SwiftUI
import WordociousCore

/// Identical port of apps/web/components/modals/help-modal.tsx — three tabs
/// (How to Play / Game Modes / FAQ), same copy, examples, and mode list.
struct HelpView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var tab: Tab
    private let showTabs: Bool
    @StateObject private var content = ContentService.shared

    init(initialTab: Tab = .howToPlay, showTabs: Bool = true) {
        _tab = State(initialValue: initialTab)
        self.showTabs = showTabs
    }

    enum Tab: String, CaseIterable {
        case howToPlay = "How to Play"
        case modes = "Game Modes"
        case faq = "FAQ"
    }

    /// FINISH_SPEC §C6: the tab's own title art (HOW TO PLAY / FAQ); Game Modes keeps
    /// the caps title with its host.
    private var art: ArtTitleName? {
        switch tab {
        case .howToPlay: return .howto
        case .faq: return .faq
        case .modes: return nil
        }
    }

    var body: some View {
        // §C6: the shared footer-page layout (back + help icons, the headline, cards).
        MenuScaffold(tab.rawValue, host: Mascots.help, art: art, help: tab == .faq ? .howToPlay : .faq) {
            VStack(spacing: 0) {
                // Tabs — hidden when the view is opened for a single section (e.g. FAQ
                // from the menu / footer), where the switcher makes no sense.
                if showTabs {
                    SoftSegmented(options: Tab.allCases.map { (key: $0, label: $0.rawValue) },
                                  selection: $tab, accessibilityLabel: "Help section")
                        .padding(.horizontal, 16).padding(.bottom, 10)
                }

                ScrollView {
                    VStack(alignment: .leading, spacing: 12) {
                        switch tab {
                        case .howToPlay:
                            InfoIntroCard(heading: "How to play", line: "Guess the word in as few tries as you can.")
                            howToPlay
                        case .modes:
                            InfoIntroCard(heading: "Game modes", line: "Every daily game, one tap away on Home.")
                            gameModes
                        case .faq:
                            InfoIntroCard(heading: "Questions and answers", line: "The things players ask us most.")
                            faq
                        }
                    }
                    .padding(.horizontal, 16).padding(.top, 4).padding(.bottom, 24)
                }
            }
        }
        .task { await content.load() }
    }

    // MARK: How to Play

    private var howToPlay: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Guess the 5-letter word. Each guess must be a valid word. After each guess, the tiles change color to show how close you are.")
                .font(Brand.font(14, .semibold)).foregroundStyle(FinishInk.secondary)

            exampleRow(["W","E","A","R","Y"], [.correct,.empty,.empty,.empty,.empty],
                       "W", Color(hex: 0x7C3AED), " is in the word and in the correct spot.")
            exampleRow(["P","I","L","L","S"], [.empty,.present,.empty,.empty,.empty],
                       "I", Theme.present, " is in the word but in the wrong spot.")
            exampleRow(["V","A","G","U","E"], [.empty,.empty,.empty,.absent,.empty],
                       "U", Theme.absent, " is not in the word at all.")

            Text("Daily puzzles reset at your local midnight. Every player gets the same word of the day so you can compare results.")
                .font(Brand.font(12, .semibold)).foregroundStyle(FinishInk.secondary)
                .padding(.horizontal, 12).padding(.vertical, 10)
                .frame(maxWidth: .infinity, alignment: .leading)
                .tintedPill(InfoPageStyle.gold, radius: 12)
        }
        .padding(16)
        .infoCard(InfoPageStyle.purple)
    }

    private func exampleRow(_ letters: [String], _ colors: [TileState], _ hi: String, _ hiColor: Color, _ rest: String) -> some View {
        VStack(spacing: 6) {
            HStack(spacing: 4) {
                // §B1: glossy tiles — the colored state, the rest typed (white face, purple ring).
                ForEach(Array(letters.enumerated()), id: \.offset) { i, l in
                    GlossyTile(face: colors[i] == .empty ? .typed : GlossyFace(revealed: colors[i]), letter: l, width: 36)
                }
            }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(letters.joined())
            (Text(hi).font(Brand.font(12, .bold)).foregroundColor(hiColor)
             + Text(rest).font(Brand.font(12, .semibold)).foregroundColor(FinishInk.secondary))
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
                        Text(mode.title).font(Brand.font(14, .black)).foregroundStyle(FinishInk.heading)
                        Text(content.helpDesc(forTitle: mode.title) ?? mode.desc).font(Brand.font(12, .semibold))
                            .foregroundStyle(FinishInk.secondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    Spacer(minLength: 0)
                }
                .padding(.horizontal, 12).padding(.vertical, 10)
                .frame(maxWidth: .infinity, alignment: .leading)
                // §C6: each game in its own color with its top bar.
                .infoCard(mode.accent)
            }
        }
    }

    // MARK: FAQ (single-sourced via ContentService → /api/content)

    private var faq: some View {
        // §C6: FAQ as question cards.
        VStack(alignment: .leading, spacing: 10) {
            ForEach(Array(content.helpFaq.enumerated()), id: \.element.id) { i, item in
                VStack(alignment: .leading, spacing: 4) {
                    Text(item.q).font(Brand.font(14, .black)).foregroundStyle(FinishInk.heading)
                        .fixedSize(horizontal: false, vertical: true)
                    Text(item.a).font(Brand.font(12, .semibold)).foregroundStyle(FinishInk.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(.horizontal, 14).padding(.vertical, 12)
                .frame(maxWidth: .infinity, alignment: .leading)
                .infoCard(i % 2 == 0 ? InfoPageStyle.purple : InfoPageStyle.pink)
            }
        }
    }
}
