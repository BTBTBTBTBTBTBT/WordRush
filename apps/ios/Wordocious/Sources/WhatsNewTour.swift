import SwiftUI
import WordociousCore

// FRIDAY-QUEUE item 41 (iOS): the one-time "What's new in 2.8" tour for players who update (never brand-new ones).
// Six short pages, each a bubble-lettered title over a framed illustration (the art/driver tutorial frame,
// `art-tut-frame`), two plain lines, page dots, Next, and Skip on every page but the last. Pages + the decision
// are WordociousCore WhatsNew (parity with core whats-new.ts); "seen" is the synced tutorials list
// (TutorialsSeen, key `whats-new-28`). Gate: the `whats_new_28` off-switch. Web: whats-new-tour.tsx.

/// Decides (once the profile + seen list are known) and tells Home whether to present the tour.
@MainActor
enum WhatsNewGate {
    static func decide() async -> WhatsNew.Decision {
        await TutorialsSeen.shared.refresh()
        let auth = AuthService.shared
        let p = auth.profile
        let d = WhatsNew.decision(live: FlagsService.shared.isLive(WhatsNew.flag), seen: TutorialsSeen.shared.seen,
                                  signedIn: auth.isAuthenticated, hasOnboarded: p.map { $0.hasOnboarded }, createdAt: p?.createdAt)
        if d == .record { TutorialsSeen.shared.mark(WhatsNew.key) }
        return d
    }
}

struct WhatsNewTour: View {
    let onClose: () -> Void
    @State private var index = 0
    @Environment(\.accessibilityReduceMotion) private var envReduce

    private let pages = WhatsNew.pages(for: "ios")
    private static let palettes: [HeadlinePalette] = [.leaderboard, .home, .stats, .friends, .vs, .leaderboard]

    var body: some View {
        let page = pages[min(index, pages.count - 1)]
        let last = index >= pages.count - 1
        VStack(spacing: 12) {
            Text("NEW IN 2.8").font(Brand.font(11, .black)).tracking(1.6).foregroundStyle(FinishInk.secondary)
                .padding(.top, 8)
            BubbleTextView(text: page.title, palette: Self.palettes[index % Self.palettes.count], maxSize: 28, minSize: 18)
                .frame(maxWidth: .infinity)
                .accessibilityAddTraits(.isHeader)
            ZStack {
                Image("art-tut-frame").resizable().scaledToFit()
                art(page.art)
            }
            .frame(width: 240, height: 246)
            .id(page.id)
            .transition(envReduce ? .opacity : .asymmetric(insertion: .scale(scale: 0.85).combined(with: .opacity), removal: .opacity))
            VStack(spacing: 6) {
                ForEach(page.lines, id: \.self) { l in
                    Text(l).font(Brand.font(15, .bold)).foregroundStyle(FinishInk.secondary)
                        .multilineTextAlignment(.center).fixedSize(horizontal: false, vertical: true)
                }
            }
            .padding(.horizontal, 8)
            HStack(spacing: 8) {
                ForEach(pages.indices, id: \.self) { i in
                    Image(i == index ? "art-tut-dot-on" : "art-tut-dot-off").resizable().scaledToFit().frame(width: 14, height: 14)
                }
            }
            .accessibilityHidden(true)
            Button { advance(last) } label: { CandyLabel(title: last ? "Let's go!" : "Next", symbol: last ? "checkmark" : "arrow.right") }
                .buttonStyle(CandyButtonStyle(variant: .purple, size: .medium, fullWidth: false))
            if !last {
                Button { Haptics.light(); onClose() } label: { CandyLabel(title: "Skip") }
                    .buttonStyle(QuietButtonStyle(size: .small))
            }
        }
        .padding(.horizontal, 20).padding(.bottom, 20)
        .frame(maxWidth: 420).frame(maxWidth: .infinity)
        .pageBackground(.home)
        .animation(envReduce ? nil : .spring(response: 0.4, dampingFraction: 0.8), value: index)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("What's new in Wordocious 2.8")
    }

    private func advance(_ last: Bool) {
        Haptics.light()
        if last { onClose() } else { index += 1 }
    }

    @ViewBuilder private func art(_ a: WhatsNew.Art) -> some View {
        switch a {
        case .mascot:
            StageOwnMascot(size: 150)
        case .art(let name):
            ArtThumbs.image(name, points: 160).resizable().interpolation(.high).scaledToFit().frame(height: 140)
        case .icons(let names):
            HStack(spacing: 10) {
                ForEach(names, id: \.self) { n in GameArtImage(asset: n, size: names.count == 1 ? 120 : 76) }
            }
        }
    }
}
