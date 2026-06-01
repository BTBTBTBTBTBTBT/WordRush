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
                    if r == 2 {
                        actionKey("ENTER") { vm.submit(); Haptics.tap() }
                    }
                    ForEach(rows[r], id: \.self) { letter in
                        letterKey(letter)
                    }
                    if r == 2 {
                        actionKey("⌫") { vm.delete(); Haptics.tap() }
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
}
