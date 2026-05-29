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
                Spacer(minLength: 6)
                BoardLayout(vm: vm)
                Spacer(minLength: 6)
                if vm.isFinished { resultBanner }
                KeyboardView(vm: vm).padding(.bottom, 6)
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
                .font(.system(size: 24, weight: .heavy, design: .rounded))
                .foregroundStyle(Theme.textPrimary)
            Text(progressLabel)
                .font(.caption).foregroundStyle(.secondary)
        }
        .padding(.top, 6)
    }

    private var progressLabel: String {
        if vm.isMultiBoard {
            let solved = vm.boards.filter { $0.status == .won }.count
            return "\(solved)/\(vm.boardCount) solved · \(vm.rowsUsed)/\(vm.maxGuesses) guesses"
        }
        let n = min(vm.rowsUsed + (vm.isFinished ? 0 : 1), vm.maxGuesses)
        return "Guess \(n) of \(vm.maxGuesses)"
    }

    private var resultBanner: some View {
        VStack(spacing: 4) {
            Text(vm.status == .won ? "🎉 Solved!" : "Out of guesses")
                .font(.headline)
            if vm.status == .lost {
                let answers = vm.boards.filter { $0.status != .won }.map(\.solution)
                Text("Answer\(answers.count > 1 ? "s" : ""): \(answers.joined(separator: ", "))")
                    .font(.subheadline).foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }
        }
        .padding(.vertical, 6)
    }
}
