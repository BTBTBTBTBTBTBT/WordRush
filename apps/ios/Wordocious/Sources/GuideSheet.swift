import SwiftUI
import WordociousCore

/// One mode's strategy guide (the public /guides/[slug] content, minus the
/// "Keep reading" links). Fetched from the web so the prose stays single-sourced
/// in lib/guide-content.ts.
struct ModeGuide: Decodable, Identifiable {
    let slug: String
    let title: String
    let accent: String
    let tagline: String
    let facts: [Fact]
    let rules: [String]
    let scoring: [String]
    let tips: [Tip]
    /// "The buttons" card (More Games §19): one row per on-screen control.
    var controls: [Control]? = nil

    var id: String { slug }
    struct Fact: Decodable { let label: String; let value: String }
    struct Tip: Decodable { let heading: String; let body: String }
    struct Control: Decodable { let icon: String; let label: String; let body: String }

    var accentColor: Color {
        let hex = accent.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
        return UInt(hex, radix: 16).map { Color(hex: $0) } ?? Theme.primary
    }
}

/// Loads + memory-caches the per-mode guides from the web JSON endpoint.
@MainActor
final class GuideService: ObservableObject {
    static let shared = GuideService()
    private init() {}

    @Published private(set) var guides: [String: ModeGuide] = [:]
    private var loaded = false

    /// GameMode → guide slug — from the catalog (modes.json guideSlug), so a new
    /// game can never fall back to Classic's rules (More Games §19).
    static func slug(for mode: GameMode) -> String {
        ModeGen.byDbKey(mode.rawValue)?.guideSlug ?? mode.rawValue.lowercased()
    }

    private struct Payload: Decodable { let guides: [ModeGuide] }

    /// The guides bundled with this build (guides.generated.json, written by
    /// apps/web/scripts/gen-guides-json.ts from lib/guide-content.ts) — the
    /// in-game "?" renders immediately and never depends on production having
    /// the entry yet; the network copy replaces it when it arrives.
    private func loadBundled() {
        guard guides.isEmpty,
              let url = Bundle.main.url(forResource: "guides.generated", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let payload = try? JSONDecoder().decode(Payload.self, from: data) else { return }
        guides = Dictionary(uniqueKeysWithValues: payload.guides.map { ($0.slug, $0) })
    }

    func load() async {
        loadBundled()
        guard !loaded else { return }
        guard let url = URL(string: "https://wordocious.com/api/guides") else { return }
        guard let (data, _) = try? await Net.api.data(from: url),
              let payload = try? JSONDecoder().decode(Payload.self, from: data) else { return }
        // Merge: the network copy wins per slug; bundled-only entries (a game
        // production has not published yet) stay.
        for g in payload.guides { guides[g.slug] = g }
        loaded = true
    }

    func guide(for mode: GameMode) -> ModeGuide? { guides[Self.slug(for: mode)] }
}

/// In-game help sheet (FINISH_SPEC §AF): the R1 card — the game's host pose on a
/// soft glow, the game title art, 3–4 short steps each with a tiny glossy-tile
/// example, a candy "Got it" (the app tour lives only in Settings → Help, founder 10-07) — over the full guide (facts /
/// How it works / The buttons / How scoring works / Strategy) behind a "Full guide"
/// disclosure. Presented via `.sheet`, so it keeps the native drag-to-dismiss
/// grabber + swipe-down close.
struct GuideSheet: View {
    let mode: GameMode
    @Environment(\.dismiss) private var dismiss
    @Environment(\.accessibilityReduceMotion) private var envReduceMotion
    @ObservedObject private var service = GuideService.shared
    @State private var showFull: Bool
    @State private var heroIn = false
    @State private var opened = false

    /// `startExpanded`: open with the full guide showing (e.g. from a Guides list).
    init(mode: GameMode, startExpanded: Bool = false) {
        self.mode = mode
        _showFull = State(initialValue: startExpanded)
    }

    private var still: Bool { Mascots.reduceMotion(envReduceMotion) }
    /// Continuous motion (the example loops) also rests in Low Power Mode (§AD).
    private var restful: Bool { still || ProcessInfo.processInfo.isLowPowerModeEnabled }

    var body: some View {
        NavigationStack {
            Group {
                if let g = service.guide(for: mode) {
                    content(g)
                } else {
                    CastLoader(label: "LOADING GUIDE", showTips: false)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                }
            }
            .pageBackground(.home)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    HeaderCircleButton(.symbol("xmark"), size: 32, label: "Done") { dismiss() }
                }
            }
        }
        .task { await service.load() }
        .onAppear {
            guard !opened else { return }
            opened = true
            // §U: a popup / sheet opening plays the `whoosh`.
            Feedback.whoosh()
            if still { heroIn = true } else {
                withAnimation(.spring(response: 0.5, dampingFraction: 0.55).delay(0.08)) { heroIn = true }
            }
        }
    }

    @ViewBuilder
    private func content(_ g: ModeGuide) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                card(g)
                fullGuideToggle(g)
                if showFull {
                    fullGuide(g)
                        .transition(still ? .opacity : .opacity.combined(with: .move(edge: .top)))
                }
            }
            .padding(.horizontal, 16).padding(.top, 4).padding(.bottom, 24)
            .frame(maxWidth: 520)
            .frame(maxWidth: .infinity)
        }
    }

    // MARK: §AF the R1 card

    private func card(_ g: ModeGuide) -> some View {
        let accent = g.accentColor
        let dark = Theme.isDark
        let shape = RoundedRectangle(cornerRadius: 28, style: .continuous)
        let steps = GuideQuickSteps.steps(for: g)
        return VStack(spacing: 12) {
            hero(accent)

            // The game's title art (labeled with the game's name + header trait);
            // without the art, the title as text.
            if let art = GameTitleArt.forMode(mode) {
                GameTitleArtView(asset: art.asset, label: art.label, maxHeight: 64, alignment: .center)
                    .frame(maxWidth: .infinity)
            } else {
                Text(g.title.uppercased()).font(Brand.font(26, .black))
                    .foregroundStyle(LinearGradient(colors: ModeStyle.gradient(mode), startPoint: .leading, endPoint: .trailing))
                    .lineLimit(1).minimumScaleFactor(0.6)
                    .accessibilityLabel(g.title)
                    .accessibilityAddTraits(.isHeader)
            }
            Text(g.tagline).font(Brand.font(13, .bold)).foregroundStyle(FinishInk.secondary)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.horizontal, 4)

            // The steps on a tinted inner tray (accent 8%, no border line).
            VStack(alignment: .leading, spacing: 14) {
                ForEach(steps.indices, id: \.self) { i in
                    stepRow(i + 1, steps[i], accent: accent)
                }
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(dark ? accent.opacity(0.12) : accent.wash(0.08)))

            Button { dismiss() } label: { CandyLabel(title: "Got it", symbol: "checkmark") }
                .buttonStyle(CandyButtonStyle(variant: .purple, size: .large))
                .padding(.top, 2)
        }
        .padding(.horizontal, 18).padding(.top, 20).padding(.bottom, 18)
        .background {
            // §R1: the accent at ~10% → ~4% over warm cream (dark: a deep accent
            // tint) + the rainbow top bar.
            ZStack(alignment: .top) {
                if dark {
                    shape.fill(Theme.surface)
                    shape.fill(LinearGradient(colors: [accent.opacity(0.24), accent.opacity(0.08)], startPoint: .top, endPoint: .bottom))
                } else {
                    shape.fill(LinearGradient(colors: [accent.mixed(over: Color(hex: 0xFFF8F1), 0.10),
                                                       accent.mixed(over: Color(hex: 0xFFF8F1), 0.04)],
                                              startPoint: .top, endPoint: .bottom))
                }
                LinearGradient(colors: [Color(hex: 0xA78BFA), Color(hex: 0xEC4899), Color(hex: 0xFBBF24)],
                               startPoint: .leading, endPoint: .trailing)
                    .frame(height: 8)
            }
            .clipShape(shape)
        }
        .overlay(shape.stroke(dark ? accent.opacity(0.35) : accent.wash(0.28), lineWidth: 1.5))
        .shadow(color: accent.opacity(0.28), radius: 22, x: 0, y: 10)
        .padding(.top, 6)
    }

    /// The game's host in its "ready" pose on a soft radial glow with a ground
    /// shadow, springing in once (fallback: the hero image; no host → W).
    private func hero(_ accent: Color) -> some View {
        let host = Mascots.host(mode) ?? .w
        return ZStack(alignment: .bottom) {
            RadialGradient(colors: [accent.opacity(Theme.isDark ? 0.42 : 0.30), accent.opacity(0)],
                           center: .center, startRadius: 4, endRadius: 96)
                .frame(width: 220, height: 150)
                .allowsHitTesting(false)
            Ellipse().fill(Color(hex: 0x3C1E6E).opacity(Theme.isDark ? 0.35 : 0.14))
                .frame(width: 84, height: 12).blur(radius: 3)
                .offset(y: -2)
            PoseImage(host, "ready", height: 118)
                .padding(.bottom, 6)
                .scaleEffect(heroIn ? 1 : 0.82, anchor: .bottom)
                .opacity(heroIn ? 1 : 0)
        }
        .frame(height: 140)
        .frame(maxWidth: .infinity)
        .accessibilityHidden(true)
    }

    private func stepRow(_ n: Int, _ step: GuideStep, accent: Color) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Text("\(n)").softNumber(15)
                .frame(width: 28, height: 28)
                .background(Circle().fill(Theme.isDark ? accent.opacity(0.22) : accent.wash(0.16)))
                .overlay(Circle().stroke(Theme.isDark ? accent.opacity(0.45) : accent.wash(0.34), lineWidth: 1.5))
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 8) {
                Text(GuideQuickSteps.render(step.text))
                    .font(Brand.font(14, .bold)).foregroundStyle(FinishInk.heading)
                    .fixedSize(horizontal: false, vertical: true)
                    .accessibilityLabel("Step \(n). \(GuideQuickSteps.render(step.text))")
                if let ex = step.example {
                    GuideExampleView(example: ex, still: restful)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    // MARK: The full guide

    private func fullGuideToggle(_ g: ModeGuide) -> some View {
        Button {
            withAnimation(still ? nil : .spring(response: 0.4, dampingFraction: 0.85)) { showFull.toggle() }
        } label: {
            HStack(spacing: 8) {
                Image(systemName: "book.fill").font(.system(size: 13, weight: .black))
                    .foregroundStyle(g.accentColor)
                Text("FULL GUIDE").font(Brand.font(12, .black)).tracking(1.2).foregroundStyle(FinishInk.heading)
                Spacer(minLength: 0)
                Text(showFull ? "Hide" : "Rules, scoring, strategy")
                    .font(Brand.font(12, .bold)).foregroundStyle(FinishInk.secondary)
                Image(systemName: "chevron.down").font(.system(size: 12, weight: .black))
                    .foregroundStyle(FinishInk.secondary)
                    .rotationEffect(.degrees(showFull ? 180 : 0))
            }
            .padding(.horizontal, 16).padding(.top, 15).padding(.bottom, 11)
            .frame(maxWidth: .infinity)
            .tintedPill(g.accentColor, radius: 16)
            .contentShape(Rectangle())
        }
        .buttonStyle(.squish)
        .accessibilityLabel("Full guide")
        .accessibilityValue(showFull ? "Expanded" : "Collapsed")
        .accessibilityHint("Rules, the buttons, scoring and strategy")
    }

    @ViewBuilder
    private func fullGuide(_ g: ModeGuide) -> some View {
        VStack(alignment: .leading, spacing: 14) {
                // Quick facts (2-col grid of label/value chips)
                LazyVGrid(columns: [GridItem(.flexible(), spacing: 8), GridItem(.flexible(), spacing: 8)], spacing: 8) {
                    ForEach(g.facts.indices, id: \.self) { i in
                        VStack(alignment: .leading, spacing: 2) {
                            Text(g.facts[i].label.uppercased()).font(Brand.font(9, .black)).tracking(0.6).foregroundStyle(FinishInk.secondary)
                            Text(g.facts[i].value).font(Brand.font(13, .black)).foregroundStyle(FinishInk.heading)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, 12).padding(.top, 13).padding(.bottom, 9)
                        // §A1: the facts as tinted chips with the game's accent bar.
                        .tintedPill(g.accentColor, radius: 14)
                    }
                }

                section("How it works", accent: g.accentColor) { paragraphs(g.rules) }
                // "The buttons" (founder round 13): every on-screen control, with
                // the SAME icon the button carries, its label, and what it costs.
                if let controls = g.controls, !controls.isEmpty {
                    section("The buttons", accent: g.accentColor) {
                        VStack(alignment: .leading, spacing: 12) {
                            ForEach(controls.indices, id: \.self) { i in
                                HStack(alignment: .top, spacing: 10) {
                                    Image(systemName: Self.symbol(controls[i].icon)).font(.system(size: 14, weight: .bold))
                                        .foregroundStyle(g.accentColor).frame(width: 28, height: 28)
                                        .background(RoundedRectangle(cornerRadius: 8).fill(g.accentColor.opacity(0.1)))
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(controls[i].label).font(Brand.font(12, .black)).foregroundStyle(FinishInk.heading)
                                        Text(controls[i].body).font(Brand.font(12, .regular)).foregroundStyle(FinishInk.secondary).lineSpacing(2)
                                    }
                                }
                            }
                        }
                    }
                }
                section("How scoring works", accent: g.accentColor) { paragraphs(g.scoring) }
                section("Strategy", accent: g.accentColor) {
                    VStack(alignment: .leading, spacing: 14) {
                        ForEach(g.tips.indices, id: \.self) { i in
                            VStack(alignment: .leading, spacing: 3) {
                                Text(g.tips[i].heading).font(Brand.font(12, .black)).foregroundStyle(g.accentColor)
                                Text(g.tips[i].body).font(Brand.font(12, .regular)).foregroundStyle(FinishInk.secondary).lineSpacing(2)
                            }
                        }
                    }
                }
        }
    }

    /// §A1 / §C6: a guide section as a tinted card in the game's color with its top bar.
    private func section<C: View>(_ title: String, accent: Color, @ViewBuilder _ inner: () -> C) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title).font(Brand.font(14, .black)).foregroundStyle(FinishInk.heading)
            inner()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .tintedCard(accent: accent, bar: [accent])
    }

    private func paragraphs(_ ps: [String]) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            ForEach(ps.indices, id: \.self) { i in
                Text(ps[i]).font(Brand.font(12, .regular)).foregroundStyle(FinishInk.secondary).lineSpacing(2)
            }
        }
    }

    /// lucide icon name (as written in guide-content.ts) → the SF Symbol the
    /// game's button actually carries, so the sheet shows the SAME icon.
    static func symbol(_ lucide: String) -> String {
        switch lucide {
        case "undo-2": return "arrow.uturn.backward"
        case "eraser": return "eraser"
        case "pencil": return "pencil"
        case "lightbulb": return "lightbulb"
        case "shuffle": return "shuffle"
        case "check": return "checkmark"
        case "delete": return "delete.left"
        case "eye": return "eye"
        case "list": return "list.bullet"
        case "corner-down-left": return "return"
        case "check-check": return "checkmark.circle"
        case "flag": return "flag"
        case "x-circle": return "xmark.circle"
        case "check-circle-2": return "checkmark.circle.fill"
        case "tag": return "tag"
        case "link-2": return "link"
        case "arrow-left-right": return "arrow.left.arrow.right"
        default: return "circle"
        }
    }
}
