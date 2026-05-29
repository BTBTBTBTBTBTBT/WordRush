import SwiftUI
import WordociousCore

struct GameScreen: View {
    @StateObject private var vm: GameViewModel
    let title: String

    init(seed: String, mode: GameMode, title: String) {
        _vm = StateObject(wrappedValue: GameViewModel(seed: seed, mode: mode))
        self.title = title
    }

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [Theme.background, Theme.backgroundGradientEnd],
                startPoint: .top, endPoint: .bottom
            )
            .ignoresSafeArea()

            VStack(spacing: 0) {
                header

                Spacer(minLength: 8)

                BoardView(vm: vm)
                    .padding(.bottom, 8)

                Spacer(minLength: 8)

                if vm.isFinished {
                    resultBanner
                }

                KeyboardView(vm: vm)
                    .padding(.bottom, 6)
            }
            .padding(.horizontal, 10)

            if let toast = vm.toast {
                Text(toast)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 16).padding(.vertical, 10)
                    .background(Capsule().fill(Theme.textPrimary.opacity(0.9)))
                    .padding(.top, 90)
                    .frame(maxHeight: .infinity, alignment: .top)
                    .transition(.opacity)
            }
        }
        .animation(.easeInOut(duration: 0.2), value: vm.toast)
        .onChange(of: vm.status) { newValue in
            if newValue == .won { Haptics.success() }
            else if newValue == .lost { Haptics.error() }
        }
    }

    private var header: some View {
        VStack(spacing: 2) {
            Text(title)
                .font(.system(size: 26, weight: .heavy, design: .rounded))
                .foregroundStyle(Theme.textPrimary)
            Text("Guess \(min(vm.board.guesses.count + (vm.isFinished ? 0 : 1), vm.maxGuesses)) of \(vm.maxGuesses)")
                .font(.caption).foregroundStyle(.secondary)
        }
        .padding(.top, 8)
    }

    private var resultBanner: some View {
        VStack(spacing: 4) {
            Text(vm.status == .won ? "🎉 Solved!" : "Out of guesses")
                .font(.headline)
            if vm.status == .lost {
                Text("Answer: \(vm.solution)")
                    .font(.subheadline).foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 8)
    }
}
