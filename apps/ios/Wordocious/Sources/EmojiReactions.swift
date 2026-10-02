import SwiftUI

/// FINISH_SPEC §AM1: moment reactions drawn in our style — never the system emoji.
/// The stored server keys stay exactly as they are (clap, fire, wow, grr, rematch;
/// "heart" is reserved for the art set). Each key renders as its glossy 3D art
/// `art-react-<key>` when that image set ships; until then fire is the 3D flame and
/// the others are small tinted word pills ("Clap!", "Wow!", "Grr!", "Rematch").
enum Reaction {
    /// Server key → the plain word (VoiceOver, accessibility actions).
    static func word(_ key: String) -> String {
        switch key {
        case "clap": return "Clap"
        case "fire": return "Fire"
        case "wow": return "Wow"
        case "grr": return "Grr"
        case "rematch": return "Rematch"
        case "heart": return "Love"
        default: return key.capitalized
        }
    }

    /// The word pill shown when the art isn't there yet.
    static func pill(_ key: String) -> String {
        key == "rematch" ? "Rematch" : "\(word(key))!"
    }

    static func asset(_ key: String) -> String { "art-react-\(key)" }
}

/// One reaction's glyph. `framed` draws the word fallback as its own tinted pill
/// (the tray); unframed is the bare word (inside an already-pill-shaped chip).
struct ReactionGlyph: View {
    let key: String
    var size: CGFloat = 28
    var framed: Bool = true

    var body: some View {
        let asset = Reaction.asset(key)
        Group {
            if ArtAsset.exists(asset) {
                Image(asset).resizable().interpolation(.high).scaledToFit()
                    .frame(width: size, height: size)
            } else if key == "fire" {
                Icon3D(.flame, size: size)
            } else if framed {
                Text(Reaction.pill(key)).font(Brand.font(max(10, size * 0.4), .black))
                    .foregroundStyle(FriendsKit.solid)
                    .lineLimit(1).fixedSize()
                    .padding(.horizontal, 9).frame(height: size * 0.82)
                    .friendsChip(FriendsInk.pink)
            } else {
                Text(Reaction.pill(key)).font(Brand.font(max(9, size * 0.6), .black))
                    .foregroundStyle(FriendsKit.solid)
                    .lineLimit(1).fixedSize()
            }
        }
        .accessibilityHidden(true)
    }
}

/// §AM1: the reaction bar's candy tray — a tinted capsule with a glossy top and a
/// darker bottom lip (the candy-button idiom), soft drop shadow. Stays light like
/// the rest of the Friends cards.
struct ReactionTray: ViewModifier {
    var accent: Color = FriendsInk.pink

    func body(content: Content) -> some View {
        content
            .padding(.horizontal, 8).padding(.vertical, 6)
            .background {
                ZStack {
                    // The lip: the tray's darker bottom edge.
                    Capsule().fill(accent.mixed(over: .white, 0.55)).offset(y: 4)
                    Capsule().fill(LinearGradient(colors: [accent.wash(0.10), accent.wash(0.20)],
                                                  startPoint: .top, endPoint: .bottom))
                    // Glossy highlight across the top half.
                    Capsule().fill(LinearGradient(colors: [Color.white.opacity(0.55), Color.white.opacity(0)],
                                                  startPoint: .top, endPoint: .center))
                        .padding(.horizontal, 10).padding(.top, 2)
                }
                .shadow(color: FriendsKit.ink.opacity(0.20), radius: 12, y: 5)
            }
            .overlay(Capsule().stroke(accent.wash(0.40), lineWidth: 1.5))
    }
}

extension View {
    /// §AM1: the candy tray behind the reaction buttons.
    func reactionTray(_ accent: Color = FriendsInk.pink) -> some View { modifier(ReactionTray(accent: accent)) }

    /// §AM1: the picked reaction pops (scale up, spring back) with a small burst.
    /// `at` is the uptime of the last pick (0 = never); a view that appears within
    /// a beat of the pick (a chip that just got its first count) pops too.
    /// Reduce Motion: none.
    func reactionPop(at: TimeInterval, color: Color = FriendsKit.solid) -> some View {
        modifier(ReactionPop(at: at, color: color))
    }
}

private struct ReactionPop: ViewModifier {
    let at: TimeInterval
    let color: Color
    @Environment(\.accessibilityReduceMotion) private var envReduce
    @State private var scale: CGFloat = 1
    @State private var burst = 0

    func body(content: Content) -> some View {
        content
            .scaleEffect(scale)
            .overlay {
                if burst > 0 { ReactionBurst(color: color).id(burst) }
            }
            .onChange(of: at) { _ in pop() }
            .onAppear {
                if at > 0, ProcessInfo.processInfo.systemUptime - at < 0.6 { pop() }
            }
    }

    private func pop() {
        guard at > 0, !(envReduce || Theme.reduceMotion) else { return }
        burst += 1
        withAnimation(.spring(response: 0.16, dampingFraction: 0.55)) { scale = 1.3 }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.14) {
            withAnimation(.spring(response: 0.32, dampingFraction: 0.45)) { scale = 1 }
        }
    }
}

/// Eight little candy dots flying out and fading (decorative).
private struct ReactionBurst: View {
    let color: Color
    @State private var go = false

    var body: some View {
        ZStack {
            ForEach(0..<8, id: \.self) { i in
                Circle()
                    .fill(i.isMultiple(of: 2) ? color : Color(hex: 0xF5C542))
                    .frame(width: 5, height: 5)
                    .offset(y: go ? -24 : -8)
                    .rotationEffect(.degrees(Double(i) * 45))
                    .opacity(go ? 0 : 1)
            }
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
        .onAppear { withAnimation(.easeOut(duration: 0.5)) { go = true } }
    }
}
