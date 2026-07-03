import SwiftUI

/// Shared visual grammar for the Profile + Records stat pages — ports
/// components/profile/stat-kit.tsx. Every section uses SectionHeader; every
/// stat cell uses StatCell inside a StatGrid; every chart sits in a ChartCard;
/// every Pro gate uses ProLockOverlay. One look, defined once.

/// Uppercase tracked section label with an accent tick + optional right control.
struct SectionHeader<Right: View>: View {
    let label: String
    var accent: Color = Theme.primary
    @ViewBuilder var right: Right

    init(_ label: String, accent: Color = Theme.primary, @ViewBuilder right: () -> Right) {
        self.label = label
        self.accent = accent
        self.right = right()
    }

    var body: some View {
        HStack {
            HStack(spacing: 8) {
                Capsule().fill(accent).frame(width: 4, height: 14)
                Text(label.uppercased()).font(Brand.font(11, .black)).tracking(1.6)
                    .foregroundStyle(Theme.textMuted)
            }
            Spacer()
            right
        }
    }
}

extension SectionHeader where Right == EmptyView {
    init(_ label: String, accent: Color = Theme.primary) {
        self.init(label, accent: accent) { EmptyView() }
    }
}

/// The standard card surface: 16pt radius, 1.5pt border, optional 3pt top
/// accent bar (mode color), like the leaderboard card.
struct KitCard<Content: View>: View {
    var accent: Color? = nil
    var padded: Bool = true
    @ViewBuilder var content: Content

    init(accent: Color? = nil, padded: Bool = true, @ViewBuilder content: () -> Content) {
        self.accent = accent
        self.padded = padded
        self.content = content()
    }

    var body: some View {
        VStack(spacing: 0) {
            if let accent { Rectangle().fill(accent).frame(height: 3) }
            content.padding(padded ? 16 : 0).frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(RoundedRectangle(cornerRadius: 16).fill(Theme.surface))
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1.5))
    }
}

/// One stat: icon, big value, small uppercase label, optional sub line.
struct StatCell: View {
    let icon: String?
    let label: String
    let value: String
    var sub: String? = nil
    var color: Color? = nil
    /// When set, the big value counts up from 0 on appear (F4). `value` stays
    /// the fallback for Reduced Motion / non-integer cells.
    var countUp: Int? = nil
    var countSuffix: String = ""

    var body: some View {
        VStack(spacing: 2) {
            if let icon {
                Image(systemName: icon).font(.system(size: 16))
                    .foregroundStyle(color ?? Theme.textMuted)
            }
            if let n = countUp {
                CountUpNumber(value: n, suffix: countSuffix, font: Brand.font(18, .black),
                              color: icon == nil ? (color ?? Theme.textPrimary) : Theme.textPrimary)
            } else {
                Text(value).font(Brand.font(18, .black))
                    .foregroundStyle(icon == nil ? (color ?? Theme.textPrimary) : Theme.textPrimary)
            }
            Text(label.uppercased()).font(Brand.font(9, .bold)).tracking(0.4)
                .foregroundStyle(Theme.textMuted)
            // Always reserve the sub line so grids of cells stay equal-height.
            Text(sub ?? " ").font(Brand.font(9, .bold)).foregroundStyle(Theme.textMuted)
        }
        .frame(maxWidth: .infinity)
    }
}

/// Grid of StatCells on one KitCard (defaults 4-up like the summary row).
struct StatGrid: View {
    let stats: [StatCell]
    var cols: Int = 4
    var accent: Color? = nil

    var body: some View {
        KitCard(accent: accent) {
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: cols), spacing: 12) {
                ForEach(Array(stats.enumerated()), id: \.offset) { _, s in s }
            }
        }
    }
}

/// Chart frame: title row + optional timeframe hint + consistent empty state.
struct ChartCard<Content: View>: View {
    let title: String
    var hint: String? = nil
    /// When set, renders the empty-state message instead of children.
    var empty: String? = nil
    var accent: Color? = nil
    @ViewBuilder var content: Content

    init(title: String, hint: String? = nil, empty: String? = nil, accent: Color? = nil,
         @ViewBuilder content: () -> Content) {
        self.title = title
        self.hint = hint
        self.empty = empty
        self.accent = accent
        self.content = content()
    }

    var body: some View {
        KitCard(accent: accent) {
            VStack(alignment: .leading, spacing: 8) {
                HStack(alignment: .firstTextBaseline) {
                    Text(title).font(Brand.font(12, .black)).foregroundStyle(Theme.textPrimary)
                    Spacer()
                    if let hint {
                        Text(hint).font(Brand.font(9, .bold)).foregroundStyle(Theme.textMuted)
                    }
                }
                if let empty {
                    Text(empty).font(Brand.font(11, .bold)).foregroundStyle(Theme.textMuted)
                        .frame(maxWidth: .infinity).padding(.vertical, 24)
                        .multilineTextAlignment(.center)
                } else {
                    content
                }
            }
        }
    }
}

/// The single Pro gate: blurred content + lock pill that opens ProView.
struct ProLockOverlay<Content: View>: View {
    var label: String = "Unlock with Pro"
    @ViewBuilder var content: Content
    @State private var showPro = false

    init(label: String = "Unlock with Pro", @ViewBuilder content: () -> Content) {
        self.label = label
        self.content = content()
    }

    var body: some View {
        ZStack {
            content
                .blur(radius: 3).opacity(0.6)
                .allowsHitTesting(false)
                .accessibilityHidden(true)
            Button { showPro = true } label: {
                HStack(spacing: 6) {
                    Image(systemName: "lock.fill").font(.system(size: 11, weight: .bold))
                    Text(label).font(Brand.font(11, .black))
                }
                .foregroundStyle(.white)
                .padding(.horizontal, 12).padding(.vertical, 7)
                .background(Capsule().fill(LinearGradient(
                    colors: [Color(hex: 0xA78BFA), Color(hex: 0xEC4899)],
                    startPoint: .leading, endPoint: .trailing)))
            }
            .buttonStyle(.plain)
        }
        .sheet(isPresented: $showPro) { ProView() }
    }
}

/// Tactile press feedback (F2): a subtle scale-down + light haptic on touch,
/// so profile buttons/chips feel responsive like the game keyboard. Reusable
/// across the app via `.buttonStyle(PressableStyle())`.
struct PressableStyle: ButtonStyle {
    var scale: CGFloat = 0.96
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? scale : 1)
            .animation(Theme.animation(.easeOut(duration: 0.12)), value: configuration.isPressed)
            .onChange(of: configuration.isPressed) { pressed in
                if pressed { Haptics.tap() }
            }
    }
}

/// A number that counts up from 0 to `value` on first appear (F4). For the
/// marquee profile stats — respects Reduced Motion (snaps to final).
struct CountUpNumber: View {
    let value: Int
    var suffix: String = ""
    var font: Font
    var color: Color
    @State private var shown = 0

    var body: some View {
        Text("\(shown)\(suffix)")
            .font(font).foregroundStyle(color)
            .monospacedDigit()
            .onAppear {
                guard !Theme.reduceMotion, value > 0 else { shown = value; return }
                let steps = min(value, 24)
                let stepDur = 0.5 / Double(steps)
                for i in 1...steps {
                    DispatchQueue.main.asyncAfter(deadline: .now() + stepDur * Double(i)) {
                        shown = Int((Double(value) * Double(i) / Double(steps)).rounded())
                    }
                }
            }
            .onChange(of: value) { shown = $0 }   // toggle/refresh → snap, no re-count
    }
}

/// F3: fades + rises a self-fetching card in the moment its data lands, instead
/// of popping. Drive with a token that changes when loading completes (e.g.
/// `loaded` bool or row count). Reserves nothing — pair with a min-height
/// placeholder where layout shift matters.
extension View {
    func asyncEntrance(_ token: some Equatable) -> some View {
        self.transition(.opacity.combined(with: .offset(y: 8)))
            .animation(Theme.animation(.easeOut(duration: 0.3)), value: token)
    }
}

// MARK: - Session stats memo (P-cache)

/// Session-lived, type-erased memo for the profile dashboards' fetch results —
/// SWR-style: a `.task` seeds its @State from here (instant repaint when the
/// user re-enters the tab or re-taps a mode), then fetches fresh exactly as
/// before and stores the result back. Purely additive: what is fetched and how
/// it renders are unchanged. Key by a stable string that includes the user id,
/// mode and play type, e.g. "guessDist:\(uid):\(mode):\(playType)".
@MainActor
final class StatsMemo {
    static let shared = StatsMemo()
    private var store: [String: Any] = [:]
    private init() {}

    func get<T>(_ key: String) -> T? { store[key] as? T }
    func set<T>(_ key: String, _ value: T) { store[key] = value }
}
