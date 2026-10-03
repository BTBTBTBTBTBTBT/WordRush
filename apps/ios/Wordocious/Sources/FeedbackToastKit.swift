import SwiftUI
import WordociousCore

// FINISH_SPEC §BI9 (founder 10-02: "The popups need to be finished, look at hubbub
// how it shows the +5, that needs to be engaging as a colorful graphic and perhaps
// even a small animation"). The in-game feedback popup, one shared kit:
//   • SCORE ("+N" / "Pangram! +N"): a glossy gold candy pill (rainbow for a
//     pangram) with a white rim, a 3D star, a big white "+N" with a dark-purple
//     edge and a word-quality label (Good! / Nice! / Great! / Amazing! / PANGRAM!).
//     Spring pop 0.6 → ~1.08 → 1, a one-shot sparkle burst, then a 12 pt float-up
//     fade (~1.1 s total).
//   • MESSAGE: a calm soft candy pill with a glossy coin icon; error tones shake once.
// Transform/opacity only (no blur, no animated shadows); Reduce Motion: a fade.
// Placement: `.gameFeedbackToast(_:)` on the game's entry line / meta row — never
// over the title art or the board.

private let toastInk = Color(hex: 0x3C1E6E)

// MARK: - Score burst

struct G5ScoreBurst: View {
    let points: Int
    let pangram: Bool
    let label: String

    @State private var popped = false
    @State private var burst = false
    @State private var leaving = false
    private let still = Theme.reduceMotion

    private var numberSize: CGFloat { pangram ? 27 : 24 }

    var body: some View {
        pill
            .background(sparkles)
            .scaleEffect(still ? 1 : (popped ? 1 : 0.6))
            .offset(y: leaving && !still ? -12 : 0)
            .opacity(leaving ? 0 : (popped ? 1 : 0))
            .onAppear(perform: run)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("\(label) plus \(points)")
            .allowsHitTesting(false)
    }

    private func run() {
        if still {
            withAnimation(.easeOut(duration: 0.18)) { popped = true }
            withAnimation(.easeIn(duration: 0.3).delay(0.85)) { leaving = true }
            return
        }
        // dampingFraction 0.45 overshoots ≈ 8 % of the 0.6 → 1 travel: the 1.08 peak.
        withAnimation(.spring(response: 0.34, dampingFraction: 0.45)) { popped = true }
        withAnimation(.easeOut(duration: 0.5).delay(0.05)) { burst = true }
        withAnimation(.easeIn(duration: 0.35).delay(0.75)) { leaving = true }
    }

    private var pill: some View {
        HStack(spacing: 6) {
            G5StarIcon(size: pangram ? 28 : 24)
            Text("+\(points)")
                .font(Brand.font(numberSize, .black))
                .foregroundStyle(.white)
                .inkEdge()
            Text(label)
                .font(Brand.font(pangram ? 15 : 13, .black))
                .foregroundStyle(.white)
                .inkEdge()
        }
        .lineLimit(1)
        .padding(.leading, 9).padding(.trailing, 16).padding(.vertical, pangram ? 6 : 4)
        .background(candy)
        .padding(.bottom, 3)  // room for the lip
        .drawingGroup()       // one flat layer: the pop / float only move it
    }

    private var fill: LinearGradient {
        pangram
            ? LinearGradient(colors: [Color(hex: 0xFF6FB5), Color(hex: 0xFFB547), Color(hex: 0xFFE45C),
                                      Color(hex: 0x5EE0A0), Color(hex: 0x6FA8FF), Color(hex: 0xA77BFF)],
                             startPoint: .leading, endPoint: .trailing)
            : LinearGradient(colors: [Color(hex: 0xFFE27A), Color(hex: 0xF5A524)], startPoint: .top, endPoint: .bottom)
    }

    private var candy: some View {
        ZStack(alignment: .top) {
            Capsule().fill(pangram ? Color(hex: 0x7C3AED) : Color(hex: 0xD97706)).offset(y: 3)
            Capsule().fill(fill)
            // The static gloss band across the top third.
            Capsule().fill(Color.white.opacity(0.38)).frame(height: 9).padding(.horizontal, 12).padding(.top, 3)
            Capsule().strokeBorder(Color.white, lineWidth: 2.5)
        }
    }

    /// Four tiny dots that burst outward once from the pill's middle.
    private var sparkles: some View {
        ZStack {
            if !still {
                ForEach(0..<4, id: \.self) { i in
                    let a = [-28.0, -152.0, 152.0, 28.0][i] * .pi / 180
                    let r: CGFloat = i % 2 == 0 ? 46 : 40
                    Circle()
                        .fill(i % 2 == 0 ? Color.white : Color(hex: 0xFFD54A))
                        .frame(width: 5, height: 5)
                        .offset(x: burst ? CGFloat(cos(a)) * (r + 26) : 0, y: burst ? CGFloat(sin(a)) * 30 : 0)
                        .opacity(burst ? 0 : 1)
                }
            }
        }
    }
}

/// A small 3D gold star (vector): a darker lip, a gradient face, a white rim.
struct G5StarIcon: View {
    var size: CGFloat = 24

    var body: some View {
        ZStack {
            G5StarShape().fill(Color(hex: 0xC2410C)).offset(y: 1.5)
            G5StarShape().fill(LinearGradient(colors: [Color(hex: 0xFFF1A8), Color(hex: 0xF59E0B)],
                                              startPoint: .top, endPoint: .bottom))
            G5StarShape().stroke(Color.white, style: StrokeStyle(lineWidth: 1.5, lineJoin: .round))
        }
        .frame(width: size, height: size)
    }
}

struct G5StarShape: Shape {
    func path(in rect: CGRect) -> Path {
        let c = CGPoint(x: rect.midX, y: rect.midY + rect.height * 0.04)
        let outer = min(rect.width, rect.height) / 2, inner = outer * 0.5
        var p = Path()
        for k in 0..<10 {
            let r = k % 2 == 0 ? outer : inner
            let a = -Double.pi / 2 + Double(k) * .pi / 5
            let pt = CGPoint(x: c.x + CGFloat(cos(a)) * r, y: c.y + CGFloat(sin(a)) * r)
            if k == 0 { p.move(to: pt) } else { p.addLine(to: pt) }
        }
        p.closeSubpath()
        return p
    }
}

private extension View {
    /// The dark-purple edge under white candy lettering (static, no blur).
    func inkEdge() -> some View {
        shadow(color: toastInk.opacity(0.9), radius: 0, x: 0, y: 2)
            .shadow(color: toastInk.opacity(0.55), radius: 0.6, x: 0, y: 0)
    }
}

// MARK: - Calm message

struct G5CandyMessage: View {
    let text: String
    let tone: G5Tone
    var pose: (MascotID, String)? = nil

    @State private var shown = false
    @State private var shook: CGFloat = 0
    private let still = Theme.reduceMotion

    var body: some View {
        let accent = tone.accent, dark = Theme.isDark
        HStack(spacing: 8) {
            if let pose {
                PoseImage(pose.0, pose.1, height: 30)
            } else {
                G5ToneCoin(tone: tone, size: 22)
            }
            Text(text)
                .font(Brand.font(13, .black))
                .foregroundStyle(FinishInk.heading)
                .lineLimit(2)
                .multilineTextAlignment(.leading)
        }
        .padding(.leading, 8).padding(.trailing, 16).padding(.vertical, pose == nil ? 8 : 4)
        .background(
            ZStack {
                Capsule().fill(dark ? accent.opacity(0.45) : accent.wash(0.38)).offset(y: 2.5)
                Capsule().fill(dark
                    ? LinearGradient(colors: [Theme.surface, Theme.surface], startPoint: .top, endPoint: .bottom)
                    : LinearGradient(colors: [accent.wash(0.05), accent.wash(0.16)], startPoint: .top, endPoint: .bottom))
                if dark { Capsule().fill(accent.opacity(0.14)) }
                Capsule().strokeBorder(accent.opacity(0.45), lineWidth: 1.5)
            }
        )
        .padding(.bottom, 2.5)
        .modifier(ToastShake(progress: shook))
        .scaleEffect(still ? 1 : (shown ? 1 : 0.9))
        .opacity(shown ? 1 : 0)
        .onAppear {
            if still { withAnimation(.easeOut(duration: 0.18)) { shown = true }; return }
            withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) { shown = true }
            if tone == .error { withAnimation(.linear(duration: 0.38).delay(0.05)) { shook = 1 } }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(text)
        .allowsHitTesting(false)
    }
}

/// One short horizontal shake (a decaying sine over the animation's progress).
private struct ToastShake: GeometryEffect {
    var progress: CGFloat
    var animatableData: CGFloat {
        get { progress }
        set { progress = newValue }
    }
    func effectValue(size: CGSize) -> ProjectionTransform {
        let x = sin(progress * .pi * 6) * 8 * (1 - progress)
        return ProjectionTransform(CGAffineTransform(translationX: x, y: 0))
    }
}

/// A small glossy 3D coin in the tone's color with a white glyph (vector).
struct G5ToneCoin: View {
    let tone: G5Tone
    var size: CGFloat = 22

    private var glyph: String {
        switch tone {
        case .error: return "xmark"
        case .success: return "checkmark"
        case .win: return "star.fill"
        case .loss: return "moon.fill"
        case .warn: return "exclamationmark"
        case .info: return "sparkle"
        }
    }

    var body: some View { G5Coin(accent: tone.accent, glyph: glyph, size: size) }
}

/// The glossy coin itself: a darker lip, a light-to-accent face, a gloss
/// highlight, a white rim and a white SF glyph. Static (no animated shadows).
struct G5Coin: View {
    let accent: Color
    let glyph: String
    var size: CGFloat = 22

    var body: some View {
        ZStack {
            Circle().fill(Color.black.mixed(over: accent, 0.22)).offset(y: 1.5)
            Circle().fill(LinearGradient(colors: [Color.white.mixed(over: accent, 0.38), accent],
                                         startPoint: .top, endPoint: .bottom))
            Ellipse().fill(Color.white.opacity(0.5))
                .frame(width: size * 0.5, height: size * 0.2).offset(y: -size * 0.27)
            Circle().strokeBorder(Color.white, lineWidth: 1.5)
            Image(systemName: glyph)
                .font(.system(size: size * 0.44, weight: .black))
                .foregroundStyle(.white)
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}

// MARK: - Placement

extension View {
    /// §BI9: anchors the game's feedback popup over this view — the entry line
    /// above the board (`.center`), or the progress / controls line just below the
    /// board (`.top`: the pill hangs down over the controls, never up over the
    /// board). So it never covers the title art or the board. Overlay only (no
    /// layout shift, no hit testing); lifted above the stack's later siblings
    /// while showing.
    /// `seq`: the game's flash counter, so a repeated message ("+1" twice) replays.
    func gameFeedbackToast(_ text: String?, seq: Int = 0, alignment: Alignment = .center,
                           pose: (MascotID, String)? = nil) -> some View {
        overlay(alignment: alignment) {
            ZStack {
                if let text {
                    G5Toast(text: text, tone: G5Toast.tone(forGameMessage: text), pose: pose)
                        .fixedSize(horizontal: false, vertical: true)
                        .id("\(seq)·\(text)")
                        .transition(.opacity)
                }
            }
            // The popup may be wider than a short anchor line: it gets the
            // screen's width (less the gutters) and stays centered on the anchor.
            .frame(width: min(UIScreen.main.bounds.width - 24, 420))
            .animation(.easeOut(duration: 0.2), value: text)
        }
        .zIndex(text == nil ? 0 : 5)
    }
}
