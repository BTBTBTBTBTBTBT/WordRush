import SwiftUI
import WordociousCore

/// How to Play for a pocket game (FRIDAY-QUEUE 9c + 12, 2.8 wave 3): three short steps, each with a
/// tiny picture built from the shipped art-pocket-* pieces, the win line and how turns work with a
/// friend. Opened by the "?" in the game's top-right corner and, the first time a player opens ANY
/// pocket game, by itself once ("Let's play!" instead of "Got it"; closing records it as seen,
/// synced). Words and art names come from PocketHelp (WordociousCore, pinned by
/// pocket-help-fixtures.json). Android: PocketHelpSheet.kt · web: components/friends/pocket-help-card.tsx.
struct PocketHelpSheet: View {
    let kind: FriendlyKind
    @Environment(\.dismiss) private var dismiss
    @Environment(\.accessibilityReduceMotion) private var envReduceMotion
    /// First look at this game's card: decided once, on open.
    @State private var firstPlay = false
    @State private var opened = false
    @State private var shown = false

    private var still: Bool { Mascots.reduceMotion(envReduceMotion) }
    private var accent: Color { FriendsKit.tileAccent(kind) }

    var body: some View {
        NavigationStack {
            ScrollView {
                if let help = PocketHelp.help[kind] {
                    card(help)
                        .padding(.horizontal, 16).padding(.top, 4).padding(.bottom, 24)
                        .frame(maxWidth: 520)
                        .frame(maxWidth: .infinity)
                }
            }
            .pageBackground(.friends, lightOnly: true)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    HeaderCircleButton(.symbol("xmark"), size: 32, label: "Done") { dismiss() }
                }
            }
        }
        .onAppear {
            guard !opened else { return }
            opened = true
            firstPlay = TutorialsSeen.shared.shouldAutoShow(PocketHelp.tutorialKey(kind))
            Feedback.whoosh()
            if still { shown = true } else { withAnimation(.easeOut(duration: 0.4)) { shown = true } }
        }
        .onDisappear { if firstPlay { TutorialsSeen.shared.mark(PocketHelp.tutorialKey(kind)) } }
    }

    private func card(_ help: PocketHelpCard) -> some View {
        let shape = RoundedRectangle(cornerRadius: 28, style: .continuous)
        return VStack(spacing: 14) {
            title(help)
            VStack(alignment: .leading, spacing: 14) {
                ForEach(Array(help.steps.enumerated()), id: \.offset) { i, step in
                    stepRow(i + 1, step)
                        .opacity(shown ? 1 : 0)
                        .offset(y: shown || still ? 0 : 8)
                        .animation(still ? nil : .easeOut(duration: 0.3).delay(0.05 * Double(i)), value: shown)
                }
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(accent.vsWash(0.10)))
            line(art: .asset("art-badge-trophy"), text: help.win)
            line(art: .icon(.bell), text: help.turns)
            Button { dismiss() } label: {
                CandyLabel(title: firstPlay ? PocketHelp.buttonFirst : PocketHelp.buttonAgain, symbol: "checkmark")
            }
            .buttonStyle(CandyButtonStyle(variant: .purple, size: .large))
            .padding(.top, 2)
        }
        .padding(.horizontal, 18).padding(.top, 20).padding(.bottom, 18)
        .background(shape.fill(cardFill))
        .clipShape(shape)
        .shadow(color: accent.opacity(0.18), radius: 14, y: 6)
    }

    /// The card: the accent at ~10% to ~4% over warm cream, or (Halloween) a deeper tint of the season's night card, so the
    /// season's light inks read on it (wave 5).
    private var cardFill: LinearGradient {
        let night = FriendsInk.nightCard
        let base = night ?? Color(hex: 0xFFF8F1)
        let k = night == nil ? (0.10, 0.04) : (PocketHelpLook.nightTop, PocketHelpLook.nightBottom)
        return LinearGradient(colors: [accent.mixed(over: base, k.0), accent.mixed(over: base, k.1)], startPoint: .top, endPoint: .bottom)
    }

    /// The game's title art (labeled), else its name in the live lettering.
    @ViewBuilder private func title(_ help: PocketHelpCard) -> some View {
        let art = FriendsKit.pocketTitleAsset(kind)
        if ArtAsset.exists(art) {
            Image(art).resizable().interpolation(.high).scaledToFit()
                .frame(maxWidth: .infinity, maxHeight: 76)
                .accessibilityLabel(help.title).accessibilityAddTraits(.isHeader)
        } else {
            LiveHeadline(text: help.title, palette: .friends, size: 30, maxLines: 1, minimumScale: 0.5)
                .frame(maxWidth: .infinity)
        }
    }

    private func stepRow(_ n: Int, _ step: PocketHelpStep) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Text("\(n)").font(Brand.font(14, .black)).foregroundStyle(.white)
                .frame(width: 26, height: 26)
                .background(Circle().fill(LinearGradient(colors: [accent.mixed(over: .white, 0.35), accent],
                                                         startPoint: .top, endPoint: .bottom)))
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 8) {
                Text(step.text).font(Brand.font(14, .heavy)).foregroundStyle(FriendsInk.heading)
                    .fixedSize(horizontal: false, vertical: true)
                picture(step.picture)
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Step \(n). \(step.text)")
    }

    /// The step's tiny picture: the art pieces left to right, a small joiner word between two pieces.
    private func picture(_ pic: PocketHelpPicture) -> some View {
        HStack(spacing: 6) {
            ForEach(Array(pic.art.enumerated()), id: \.offset) { i, name in
                if i > 0, i - 1 < pic.joiners.count {
                    Text(pic.joiners[i - 1]).font(Brand.font(11, .black)).foregroundStyle(FriendsInk.muted)
                }
                if ArtAsset.exists(name) {
                    Image(name).resizable().interpolation(.high).scaledToFit()
                        .frame(width: 40, height: 40).accessibilityHidden(true)
                }
            }
        }
    }

    /// A small lines' icon: the app's art (the trophy badge, the 3D bell), never an SF Symbol.
    private enum LineArt { case asset(String), icon(Icon3DName) }

    private func line(art: LineArt, text: String) -> some View {
        HStack(alignment: .top, spacing: 8) {
            Group {
                switch art {
                case .asset(let name):
                    Image(name).resizable().interpolation(.high).scaledToFit().frame(width: 22, height: 22)
                case .icon(let icon):
                    Icon3D(icon, size: 22)
                }
            }
            .frame(width: 24).accessibilityHidden(true)
            Text(text).font(Brand.font(13, .bold)).foregroundStyle(FriendsInk.heading)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 2)
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 4)
    }
}

/// Wave 5: how much of the game's accent the pocket help card washes over the season's night card (top, bottom) —
/// SeasonContrastTests checks the inks against both.
enum PocketHelpLook {
    static let nightTop = 0.16
    static let nightBottom = 0.07
}
