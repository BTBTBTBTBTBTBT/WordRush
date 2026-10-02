import SwiftUI
import UserNotifications

/// FINISH_SPEC §K1: in-app notices in the new look. A push that arrives while the app
/// is open (friend beat you, challenge received / result, nudge, race lead change,
/// friend request, streak reminders) shows as a tinted card in the event's color with
/// its top bar, a small cast pose that fits the event (§A7), the headline in Nunito
/// Black and a candy action (View / Play) that opens the push's link. It slides in
/// with a spring, squishes on tap, swipes up to dismiss and leaves on its own after
/// a few seconds. Reduce Motion: a fade. (Before this, a push in the foreground was
/// simply not shown.)
struct InAppNotice: Identifiable, Equatable {
    let id = UUID()
    let title: String
    let body: String
    /// The push's in-app path ("/vs/challenge/<code>", "/friends", …).
    let url: String?

    /// The event family, read from the link and the words.
    enum Kind { case challenge, beatYou, win, nudge, friend, streak, other }

    var kind: Kind {
        let t = (title + " " + body).lowercased()
        let u = url?.lowercased() ?? ""
        if t.contains("beat you") || t.contains("passed you") || t.contains("overtook") { return .beatYou }
        if u.contains("/vs/") || t.contains("challenge") { return .challenge }
        if t.contains("nudge") || t.contains("waiting on you") || t.contains("your turn") { return .nudge }
        if t.contains("streak") { return .streak }
        if t.contains("won") || t.contains("winner") || t.contains("you lead") || t.contains("1st") { return .win }
        if u.contains("friend") || t.contains("friend") { return .friend }
        return .other
    }

    var accent: Color {
        switch kind {
        case .challenge: return Color(hex: 0x0D9488)
        case .beatYou: return Color(hex: 0xEC4899)
        case .win: return Color(hex: 0xF5A524)
        case .nudge: return Color(hex: 0x8B5CF6)
        case .friend: return Color(hex: 0xEC4899)
        case .streak: return Color(hex: 0xF97316)
        case .other: return Color(hex: 0x7C3AED)
        }
    }

    /// The pose that fits the event (§K1: O2 gasp for "beat you", S ready for a
    /// challenge, O1 cheer for a win, R for a nudge…).
    var pose: (MascotID, String) {
        switch kind {
        case .beatYou: return (.o2, "gasp")
        case .challenge: return (.s, "ready")
        case .win: return (.o1, "cheer")
        case .nudge: return (.r, "wake")
        case .friend: return (.i, "giggle")
        case .streak: return (.s, "stopwatch")
        case .other: return (.w, "wave")
        }
    }

    var actionLabel: String { kind == .challenge || kind == .nudge || kind == .streak ? "Play" : "View" }
}

@MainActor
final class InAppNoticeCenter: ObservableObject {
    static let shared = InAppNoticeCenter()
    @Published private(set) var current: InAppNotice?
    private var hideTask: Task<Void, Never>?

    private init() {}

    func show(_ notice: InAppNotice) {
        current = notice
        Feedback.notify()   // §U: notify · light
        hideTask?.cancel()
        hideTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: 5_500_000_000)
            guard !Task.isCancelled, self?.current?.id == notice.id else { return }
            self?.dismiss()
        }
    }

    func dismiss() {
        hideTask?.cancel()
        current = nil
    }

    /// Opens the notice's link like a tapped push.
    func open(_ notice: InAppNotice) {
        dismiss()
        if let url = notice.url { DeepLink.shared.handle(pushPath: url) }
    }
}

/// The notice card, pinned under the status bar (mounted once at the app root).
struct InAppNoticeOverlay: View {
    @ObservedObject private var center = InAppNoticeCenter.shared
    @Environment(\.accessibilityReduceMotion) private var envReduce
    @State private var drag: CGFloat = 0

    var body: some View {
        let still = envReduce || Theme.reduceMotion
        VStack {
            if let n = center.current {
                card(n)
                    .offset(y: min(0, drag))
                    .gesture(DragGesture(minimumDistance: 8)
                        .onChanged { drag = $0.translation.height }
                        .onEnded { v in
                            if v.translation.height < -30 { center.dismiss() }
                            drag = 0
                        })
                    .transition(still ? .opacity : .move(edge: .top).combined(with: .opacity))
                    .padding(.horizontal, 12).padding(.top, 4)
            }
            Spacer(minLength: 0)
        }
        .animation(still ? .easeInOut(duration: 0.2) : .spring(response: 0.42, dampingFraction: 0.72), value: center.current)
    }

    private func card(_ n: InAppNotice) -> some View {
        Button { center.open(n) } label: {
            HStack(spacing: 10) {
                PoseImage(n.pose.0, n.pose.1, height: 52)
                VStack(alignment: .leading, spacing: 2) {
                    Text(n.title).font(Brand.font(15, .black)).foregroundStyle(FinishInk.heading)
                        .lineLimit(2).fixedSize(horizontal: false, vertical: true)
                    if !n.body.isEmpty {
                        Text(n.body).font(Brand.font(12, .bold)).foregroundStyle(FinishInk.secondary)
                            .lineLimit(3).fixedSize(horizontal: false, vertical: true)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                if n.url != nil {
                    CandyLabel(title: n.actionLabel)
                        .environment(\.candyInk, CandyInk(quiet: false, size: 13))
                        .padding(.horizontal, 12).frame(minHeight: 32)
                        .background(Capsule().fill(LinearGradient(colors: [Color(hex: 0xA66BFF), Color(hex: 0x6D28D9)],
                                                                  startPoint: .top, endPoint: .bottom)))
                        .overlay(Capsule().strokeBorder(Color(hex: 0xF5C542), lineWidth: 1))
                        .background(Capsule().fill(Color.black.mixed(over: Color(hex: 0x6D28D9), 0.35)).offset(y: 3))
                }
            }
            .padding(.horizontal, 12).padding(.vertical, 10)
            .tintedCard(accent: n.accent, bar: [n.accent, n.accent.wash(0.55)], radius: 18, barHeight: 6, tint: 0.12, line: 0.32)
            .shadow(color: n.accent.opacity(0.25), radius: 12, x: 0, y: 6)
        }
        .buttonStyle(.squish)
        .accessibilityElement(children: .combine)
        .accessibilityHint(n.url != nil ? "Opens it" : "")
        .accessibilityAction(named: "Dismiss") { center.dismiss() }
    }
}
