import SwiftUI
import WordociousCore
#if canImport(UIKit)
import UIKit
#endif

struct KeyboardView: View {
    @ObservedObject var vm: GameViewModel

    private let rows: [[String]] = [
        "QWERTYUIOP".map { String($0) },
        "ASDFGHJKL".map { String($0) },
        "ZXCVBNM".map { String($0) },
    ]

    var body: some View {
        VStack(spacing: 7) {
            ForEach(0..<rows.count, id: \.self) { r in
                HStack(spacing: 5) {
                    // Match web's bottom row ['BACK', Z…M, 'ENTER']: Delete on the
                    // LEFT, Enter on the RIGHT.
                    if r == 2 {
                        actionKey("⌫") { vm.delete(); Haptics.tap(); SoundManager.shared.playKeyTap() }
                    }
                    ForEach(rows[r], id: \.self) { letter in
                        if vm.useQuadrantKeyboard { quadrantKey(letter) } else { letterKey(letter) }
                    }
                    if r == 2 {
                        actionKey("ENTER") { vm.submit(); Haptics.tap(); SoundManager.shared.playKeyTap() }
                    }
                }
            }
        }
        .padding(.horizontal, 4)
    }

    private func letterKey(_ letter: String) -> some View {
        let state = vm.keyState(for: letter)
        let bg = state.map { Theme.keyColor(for: $0) } ?? Theme.keyDefault
        let fg: Color = state == nil ? Theme.textPrimary : .white
        return Button {
            vm.type(letter)
            Haptics.tap()
            SoundManager.shared.playKeyTap()
        } label: {
            Text(letter)
                .font(Brand.font(18, .bold))
                .foregroundStyle(fg)
                .frame(maxWidth: .infinity)
                .frame(height: 52)
                .background(RoundedRectangle(cornerRadius: 6).fill(bg))
        }
        .buttonStyle(.plain)
    }

    /// Per-board quadrant key (QuadWord/OctoWord/Deliverance) — mirrors web
    /// QuadrantKey: a grid of sub-cells, one per board, each colored by that
    /// board's state for this letter; all-absent collapses to solid gray.
    private func quadrantKey(_ letter: String) -> some View {
        let boards = vm.boardKeyStates()
        let count = max(1, boards.count)
        let cols = count <= 4 ? 2 : 4
        let rowCount = Int(ceil(Double(count) / Double(cols)))
        let states: [TileState?] = boards.map { $0[letter] }
        let present = states.compactMap { $0 }
        let hasAny = !present.isEmpty
        let allAbsent = hasAny && present.allSatisfy { $0 == .absent }
        let fg: Color = hasAny ? .white : Color(hex: 0x374151)
        return Button {
            vm.type(letter); Haptics.tap(); SoundManager.shared.playKeyTap()
        } label: {
            ZStack {
                if allAbsent {
                    Color(hex: 0x9CA3AF)
                } else {
                    VStack(spacing: 0) {
                        ForEach(0..<rowCount, id: \.self) { r in
                            HStack(spacing: 0) {
                                ForEach(0..<cols, id: \.self) { c in
                                    let idx = r * cols + c
                                    quadColor(idx < states.count ? states[idx] : nil)
                                }
                            }
                        }
                    }
                }
                Text(letter).font(Brand.font(18, .bold)).foregroundStyle(fg)
                    .shadow(color: hasAny ? .black.opacity(0.35) : .clear, radius: 1, x: 0, y: 1)
            }
            .frame(maxWidth: .infinity).frame(height: 52)
            .clipShape(RoundedRectangle(cornerRadius: 6))
            .overlay(RoundedRectangle(cornerRadius: 6).stroke(Theme.border, lineWidth: 1.5))
        }
        .buttonStyle(.plain)
    }

    private func quadColor(_ st: TileState?) -> some View {
        // Theme.correct/present are colorblind-aware — web's [data-colorblind]
        // overrides recolor the quadrant mini-cells too (they use the same
        // bg-green-500/yellow-500 classes the board tiles use).
        let c: Color
        switch st {
        case .correct: c = Theme.correct
        case .present: c = Theme.present
        case .absent: c = Theme.keyAbsent
        default: c = Theme.keyDefault
        }
        return c.frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func actionKey(_ label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(label)
                .font(Brand.font(14, .bold))
                .foregroundStyle(Theme.textPrimary)
                .frame(width: 54, height: 52)
                .background(RoundedRectangle(cornerRadius: 6).fill(Theme.keyDefault))
        }
        .buttonStyle(.plain)
    }
}

/// Native haptics — no-ops cleanly off-device.
enum Haptics {
    static func tap() {
        #if canImport(UIKit)
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
        #endif
    }

    static func success() {
        #if canImport(UIKit)
        UINotificationFeedbackGenerator().notificationOccurred(.success)
        #endif
    }

    static func error() {
        #if canImport(UIKit)
        UINotificationFeedbackGenerator().notificationOccurred(.error)
        #endif
    }

    static func warning() {
        #if canImport(UIKit)
        UINotificationFeedbackGenerator().notificationOccurred(.warning)
        #endif
    }
}
