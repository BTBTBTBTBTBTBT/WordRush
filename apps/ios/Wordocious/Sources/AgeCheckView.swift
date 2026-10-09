import SwiftUI
import WordociousCore

/// The neutral, on-brand 13+ age check (FRIDAY-QUEUE item 29): D (glasses + pencil) SAYS ONE question —
/// "What year were you born?" — in a comic speech bubble set in our bubble lettering, on a year wheel with NO default and
/// no hint that 13 matters. The live WORDOCIOUS cast row stays at the top; below it D and the birthday cake stand on one
/// soft floor as ONE scene (docs/design/brand/2.8/agecheck + bubbles; the canonical cast art placed as is).
/// State, storage, the server mirror and the service gating live in AgeCheckStore.

/// Root overlay: sits above the whole app until this device has answered (and forever for "under").
/// 2026-10-10: a returning signed-in player used to see a solid black screen forever. The placeholder is now the normal
/// app background, lasts at most `AgeGate.maxWaitMs` (a timer on a real full-size container), and the server lookup runs
/// off the persisted session, not off a profile that loads only after the launch gate.
struct AgeGateOverlay: View {
    @ObservedObject private var store = AgeCheckStore.shared
    @ObservedObject private var auth = AuthService.shared
    @ObservedObject private var flags = FlagsService.shared
    /// Milliseconds since the gate appeared (set once, by the timer below).
    @State private var elapsedMs = 0

    private var view: AgeGate.View {
        AgeGate.view(stored: store.stored?.state, live: flags.isLive("age_check"), hadSession: AuthService.hadPersistedSession,
                     serverCheckDone: store.serverCheckDone, elapsedMs: elapsedMs)
    }

    var body: some View {
        let v = view
        ZStack {
            // A real, full-size container: the timer and the server lookup hang off it (a 0 x 0 view never ran them).
            Color.clear.ignoresSafeArea().allowsHitTesting(false)
            switch v {
            case .under:
                AgeCheckUnderView().transition(.opacity)
            case .question:
                AgeCheckQuestionView { store.answer(year: $0) }.transition(.opacity)
            case .placeholder:
                // The normal app background, never black.
                PageBackground(tint: .home).ignoresSafeArea()
            case .pass:
                EmptyView()
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .allowsHitTesting(v != .pass)
        // Mirrors the account's server flag / answer (idempotent); re-runs when the session / profile arrives.
        .task(id: "\(auth.profile?.id ?? "")|\(auth.isAuthenticated)|\(auth.isLoading)") { await store.syncWithServer() }
        .task {
            try? await Task.sleep(nanoseconds: UInt64(AgeGate.maxWaitMs) * 1_000_000)
            elapsedMs = AgeGate.maxWaitMs
        }
        .animation(.easeOut(duration: 0.2), value: store.stored)
    }
}

struct AgeCheckQuestionView: View {
    let onAnswer: (Int) -> Void
    private let years = AgeCheck.years()
    /// 0 = the neutral placeholder row (no default); 1... = years[index - 1].
    @State private var row = 0

    var body: some View {
        ZStack {
            // The app's own wall (the season's wall in season), so the scene sits in the same world as Home.
            PageBackground(tint: .home, lightOnly: true).ignoresSafeArea()
            ScrollView {
                VStack(spacing: 12) {
                    // The live WORDOCIOUS cast row stays on top; the question lives below it.
                    LivingCastHeader(pro: false)
                        .padding(.top, 4)

                    AgeAskScene()

                    wheel

                    Button {
                        guard row > 0 else { return }
                        onAnswer(years[row - 1])
                    } label: { CandyLabel(title: "Continue") }
                        .buttonStyle(CastButtonStyle(color: .purple, size: .large))
                        .disabled(row == 0)
                }
                .padding(.horizontal, 20).padding(.vertical, 12)
                .frame(maxWidth: 420)
                .frame(maxWidth: .infinity)
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityAddTraits(.isModal)
    }

    private var wheel: some View {
        // In season the wheel is the same black-violet glass as D's bubble, so it belongs to the night scene.
        let night = CastSkin.season != nil
        let edge = night ? Color(red: 0.165, green: 0.063, blue: 0.251).opacity(0.80) : Color(red: 0.77, green: 0.71, blue: 0.99).opacity(0.6)
        let mid = night ? Color(red: 0.247, green: 0.106, blue: 0.369).opacity(0.88) : Color(red: 0.914, green: 0.835, blue: 1.0)
        return ZStack {
            RoundedRectangle(cornerRadius: 34, style: .continuous)
                .fill(LinearGradient(colors: [edge, mid, edge], startPoint: .top, endPoint: .bottom))
                .overlay(RoundedRectangle(cornerRadius: 34, style: .continuous)
                    .strokeBorder(night ? Color.orange.opacity(0.35) : .clear, lineWidth: 1.5))
                .shadow(color: (night ? Color.orange : Color(red: 0.486, green: 0.227, blue: 0.929)).opacity(0.22), radius: 14, y: 8)
            // The gold answer band.
            RoundedRectangle(cornerRadius: 22, style: .continuous)
                .fill(LinearGradient(colors: [Color.yellow.opacity(0.55), Color.orange.opacity(0.32)],
                                     startPoint: .top, endPoint: .bottom))
                .frame(height: 46).padding(.horizontal, -6)
                .shadow(color: Color.orange.opacity(0.45), radius: 10)
                .allowsHitTesting(false)
            Picker("Year you were born", selection: $row) {
                // Neutral placeholder: no year is ever pre-selected.
                Text("\u{2022}  \u{2022}  \u{2022}")
                    .font(.system(size: 22, weight: .black, design: .rounded))
                    .foregroundColor(night ? Color(red: 1.0, green: 0.86, blue: 0.55) : Color(red: 0.357, green: 0.129, blue: 0.714)).tag(0)
                ForEach(Array(years.enumerated()), id: \.offset) { i, y in
                    Text(String(y))
                        .font(.system(size: 26, weight: .black, design: .rounded))
                        .foregroundColor(night ? Color(red: 1.0, green: 0.86, blue: 0.55) : Color(red: 0.357, green: 0.129, blue: 0.714))
                        .tag(i + 1)
                }
            }
            .pickerStyle(.wheel)
            .labelsHidden()
        }
        .frame(width: 168, height: 190)
    }
}

/// A soft elliptical contact shadow on the shared floor.
private struct AgeContact: View {
    var width: CGFloat
    var body: some View {
        Ellipse()
            .fill(RadialGradient(colors: [Color(red: 0.298, green: 0.114, blue: 0.584).opacity(0.30), .clear],
                                 center: .center, startRadius: 0, endRadius: width * 0.5))
            .frame(width: width, height: 16)
            .allowsHitTesting(false)
    }
}

/// The speech bubble (tail toward D) with a line of bubble lettering inside. Halloween: the black-violet candy bubble.
private struct AgeSpeechBubble: View {
    let text: String
    let halloween: Bool
    var body: some View {
        Image(halloween ? "age-bubble-halloween" : "age-bubble")
            .resizable().scaledToFit()
            .overlay {
                GeometryReader { g in
                    BubbleTextView(text: text, palette: halloween ? .celebration : .home, maxSize: 46, minSize: 20, alignment: .center)
                        .frame(width: g.size.width * 0.82, height: g.size.height * (halloween ? 0.62 : 0.64))
                        .position(x: g.size.width / 2, y: g.size.height * (halloween ? 0.40 : 0.41))
                }
            }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(text.capitalized)
            .accessibilityAddTraits(.isHeader)
    }
}

/// The one scene: D says the question; the cake sits beside him on the same floor, same lighting.
private struct AgeAskScene: View {
    private var halloween: Bool { CastSkin.season != nil }
    var body: some View {
        VStack(spacing: 0) {
            AgeSpeechBubble(text: "WHAT YEAR WERE YOU BORN?", halloween: halloween)
                .frame(maxWidth: 286)
                .frame(maxWidth: .infinity, alignment: .leading)
            GeometryReader { g in
                let w = g.size.width
                ZStack(alignment: .bottomLeading) {
                    // the shared soft floor
                    Ellipse()
                        .fill(RadialGradient(colors: [Color(red: 0.77, green: 0.71, blue: 0.99).opacity(0.65), .clear],
                                             center: .center, startRadius: 0, endRadius: w * 0.48))
                        .frame(width: w * 0.92, height: 34)
                        .position(x: w / 2, y: g.size.height - 17)
                    // One group, not two pictures: the cake stands IN FRONT of D (overlapping him), both on one
                    // contact shadow, and the candles throw a warm glow onto him.
                    AgeContact(width: w * 0.62).position(x: w * 0.60, y: g.size.height - 8)
                    Image(CastSkin.assetName(for: .d)).resizable().scaledToFit().frame(width: 142, height: 142)
                        .position(x: w * 0.70, y: g.size.height - 6 - 71)
                    Circle()
                        .fill(RadialGradient(colors: [Color(red: 1.0, green: 0.78, blue: 0.35).opacity(0.55), .clear],
                                             center: .center, startRadius: 0, endRadius: 46))
                        .frame(width: 92, height: 92)
                        .blendMode(.plusLighter)
                        .position(x: w * 0.47, y: g.size.height - 78)
                        .allowsHitTesting(false)
                    Image("age-cake").resizable().scaledToFit().frame(width: 84)
                        .shadow(color: Color(red: 0.298, green: 0.114, blue: 0.584).opacity(0.25), radius: 4, y: 2)
                        .position(x: w * 0.47, y: g.size.height - 46)
                }
                .accessibilityHidden(true)
            }
            .frame(maxWidth: 318).frame(height: 150)
            .padding(.top, 8)   // the tail stops just above D's head (never tucked behind him or his hat)
        }
    }
}

/// The kind scene for an under-13 answer: the lettered headline, a rainbow and the whole cast waving on one floor.
private struct AgeSeeYouScene: View {
    @Environment(\.accessibilityReduceMotion) private var envReduce
    @State private var up = false
    private let back: [MascotID] = [.r, .o2, .c, .u, .i]
    private let front: [MascotID] = [.w, .o1, .d, .o3, .s]

    private func hero(_ id: MascotID, _ k: Int, _ w: CGFloat) -> some View {
        Image(id.assetName).resizable().scaledToFit().frame(width: w)
            .rotationEffect(.degrees(up ? (k % 2 == 0 ? -3 : 2.5) : 0), anchor: .bottom)
            .offset(y: up ? -w * 0.04 : 0)
            .animation(Motion.calm(envReduce) ? nil : .easeInOut(duration: 1.2).repeatForever(autoreverses: true).delay(Double(k) * 0.14), value: up)
    }

    var body: some View {
        VStack(spacing: 0) {
            Image("age-bunting").resizable().scaledToFit().frame(width: 190)
            BubbleTextView(text: "13 AND UP \u{00B7} SEE YOU SOON!", palette: .home, maxSize: 36, minSize: 22, alignment: .center)
                .padding(.top, -62)
            GeometryReader { g in
                let w = g.size.width
                let hw = w * 0.24
                ZStack(alignment: .top) {
                    Image("age-rainbow").resizable().scaledToFit().frame(width: w * 0.70)
                    VStack(spacing: -hw * 0.30) {
                        HStack(spacing: -hw * 0.16) { ForEach(Array(back.enumerated()), id: \.offset) { hero($1, $0, hw) } }
                        HStack(spacing: -hw * 0.16) { ForEach(Array(front.enumerated()), id: \.offset) { hero($1, $0 + 5, hw) } }
                    }
                    .padding(.top, w * 0.70 * 163 / 229 - w * 0.12)
                    .background(alignment: .bottom) {
                        Ellipse()
                            .fill(RadialGradient(colors: [Color(red: 0.77, green: 0.71, blue: 0.99).opacity(0.7), .clear],
                                                 center: .center, startRadius: 0, endRadius: w * 0.5))
                            .frame(width: w * 0.96, height: 44).offset(y: 6)
                    }
                }
                .frame(width: w, height: g.size.height, alignment: .top)
            }
            .frame(maxWidth: 318).frame(height: 300)
            .padding(.top, 10)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("13 and up. See you soon! The Wordocious cast waves from under a rainbow.")
        .onAppear { up = true }
    }
}

/// The kind screen for an under-13 answer: nothing is created, the answer sticks on this device.
struct AgeCheckUnderView: View {
    var body: some View {
        ZStack {
            // The app's own wall (the season's wall in season), so the scene sits in the same world as Home.
            PageBackground(tint: .home, lightOnly: true).ignoresSafeArea()
            ScrollView {
                VStack(spacing: 12) {
                    // The live WORDOCIOUS cast row stays on top.
                    LivingCastHeader(pro: false).padding(.top, 4)
                    AgeSeeYouScene()
                    Text("Wordocious is for players 13 and up. We would love to play with you when you are older!")
                        .font(.system(size: 15, weight: .bold, design: .rounded))
                        .foregroundColor(Color(red: 0.357, green: 0.129, blue: 0.714))
                        .multilineTextAlignment(.center)
                    if let mail = URL(string: "mailto:\(AgeCheck.supportEmail)") {
                        Link("Parents: questions or corrections? \(AgeCheck.supportEmail)", destination: mail)
                            .font(.system(size: 12, weight: .semibold, design: .rounded))
                            .multilineTextAlignment(.center)
                    }
                }
                .padding(.horizontal, 20).padding(.vertical, 12)
                .frame(maxWidth: 420)
                .frame(maxWidth: .infinity)
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityAddTraits(.isModal)
    }
}
