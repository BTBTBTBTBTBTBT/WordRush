import SwiftUI
import WordociousCore

/// Closure-driven letter keyboard (More Games §11). `KeyboardView` is bound to
/// `GameViewModel` and `NoundleKeyboard` is a drifting copy of it; the custom
/// engines (Crosswordocious, Letter Ladder, Codebreaker) need the same keys
/// without a word-game view model. Same rows, same key sizes, same layout
/// preference (§213 standard | flipped | michael), same sounds and haptics —
/// only the wiring differs: the caller supplies the three actions and, if it
/// wants per-key colouring, a state lookup.
struct LetterKeyboard: View {
    var onLetter: (String) -> Void
    var onEnter: () -> Void
    var onDelete: () -> Void
    /// Optional per-key state for colouring (nil = plain key).
    var keyState: (String) -> TileState? = { _ in nil }
    /// Hide ENTER for games that auto-check (Crosswordocious auto-advances).
    var showEnter: Bool = true

    @AppStorage("pref-keyboard-layout") private var layout = "standard"

    private let rows: [[String]] = [
        "QWERTYUIOP".map { String($0) },
        "ASDFGHJKL".map { String($0) },
        "ZXCVBNM".map { String($0) },
    ]
    private var keyHeight: CGFloat { layout == "michael" ? 44 : 52 }

    var body: some View {
        VStack(spacing: 7) {
            ForEach(0..<rows.count, id: \.self) { r in
                HStack(spacing: 5) {
                    if r == 2 {
                        switch layout {
                        case "flipped", "michael": deleteKey()
                        default: if showEnter { enterKey() }
                        }
                    }
                    ForEach(rows[r], id: \.self) { letter in letterKey(letter) }
                    if r == 2 {
                        switch layout {
                        case "flipped": if showEnter { enterKey() }
                        default: deleteKey()
                        }
                    }
                }
            }
            if layout == "michael", showEnter {
                HStack(spacing: 5) { enterKey(); spaceKey(); enterKey() }
            }
        }
        .padding(.horizontal, 4)
    }

    private func enterKey() -> some View {
        actionKey("ENTER") { onEnter(); Haptics.tap(); SoundManager.shared.playKeyTap() }
    }

    private func deleteKey() -> some View {
        actionKey("⌫") { onDelete(); Haptics.tap(); SoundManager.shared.playKeyTap() }
    }

    private func spaceKey() -> some View {
        Button { Haptics.tap(); SoundManager.shared.playKeyTap() } label: {
            Text("space")
                .font(Brand.font(12, .semibold))
                .foregroundStyle(Color(hex: 0x8A86A0))
                .frame(maxWidth: .infinity)
                .frame(height: keyHeight)
                .background(RoundedRectangle(cornerRadius: 6).fill(Theme.keyDefault))
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Space (decorative)")
    }

    private func letterKey(_ letter: String) -> some View {
        let state = keyState(letter)
        let bg = state.map { Theme.keyColor(for: $0) } ?? Theme.keyDefault
        let fg: Color = state == nil ? Theme.keyInk : .white
        return Button {
            onLetter(letter)
            Haptics.tap()
            SoundManager.shared.playKeyTap()
        } label: {
            Text(letter)
                .font(Brand.font(18, .bold))
                .foregroundStyle(fg)
                .frame(maxWidth: .infinity)
                .frame(height: keyHeight)
                .background(RoundedRectangle(cornerRadius: 6).fill(bg))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(letter)
        .accessibilityValue(state?.a11yName ?? "")
    }

    private func actionKey(_ label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Group {
                if label == "⌫" {
                    Image(systemName: "delete.left").font(.system(size: 20, weight: .semibold))
                } else {
                    Text(label).font(Brand.font(14, .heavy))
                }
            }
            .foregroundStyle(Theme.keyInk)
            .frame(width: 54, height: keyHeight)
            .background(RoundedRectangle(cornerRadius: 6).fill(Theme.keyDefault))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label == "⌫" ? "Delete" : "Submit")
    }
}
