import SwiftUI
import WordociousCore

private let categoryLabels: [String: String] = [
    "music": "Music", "videogames": "Video Games", "movies": "Movies", "sports": "Sports",
    "history": "History", "science": "Science", "currentevents": "Current Events", "general": "General",
]
private let pnAccent = Color(hex: 0xDC2626)

@MainActor
final class ProperNoundleVM: ObservableObject {
    @Published private(set) var puzzle: NPuzzle?
    @Published private(set) var guesses: [(word: String, tiles: [NTile])] = []
    @Published var input = ""
    @Published private(set) var status: GameStatus = .playing
    @Published var toast: String?
    @Published private(set) var clue: String?
    @Published private(set) var revealedVowel: String?
    @Published private(set) var revealedConsonant: String?
    @Published private(set) var finalTimeSeconds: Int?

    private let startMs = Date().timeIntervalSince1970 * 1000
    private var recorded = false
    var answerLen: Int { puzzle.map { ProperNoundle.normalize($0.answer).count } ?? 0 }
    var maxGuesses: Int { ProperNoundle.maxGuesses }
    var isFinished: Bool { status != .playing }
    var hintsUsed: Int { [clue, revealedVowel, revealedConsonant].compactMap { $0 }.count }
    var elapsed: Int { finalTimeSeconds ?? max(0, Int((Date().timeIntervalSince1970 * 1000 - startMs) / 1000)) }

    init() { puzzle = ProperNoundle.dailyPuzzle() }

    func type(_ l: String) { guard !isFinished, input.count < answerLen else { return }; input += l.lowercased() }
    func delete() { if !input.isEmpty { input.removeLast() } }

    func submit() {
        guard !isFinished, let p = puzzle else { return }
        guard input.count == answerLen else { flash("Not enough letters"); return }
        let tiles = ProperNoundle.evaluate(guess: input, answer: p.answer)
        guesses.append((input, tiles)); input = ""
        if ProperNoundle.isWin(tiles) { status = .won; finish() }
        else if guesses.count >= maxGuesses { status = .lost; finish() }
    }

    func keyState(_ letter: String) -> NTile? {
        var best: NTile?
        for g in guesses {
            let chars = Array(g.word)
            for (i, t) in g.tiles.enumerated() where i < chars.count && String(chars[i]) == letter.lowercased() {
                best = merge(best, t)
            }
        }
        return best
    }
    private func merge(_ a: NTile?, _ b: NTile) -> NTile {
        let r: (NTile) -> Int = { switch $0 { case .correct: return 3; case .present: return 2; case .absent: return 1; default: return 0 } }
        guard let a else { return b }; return r(b) > r(a) ? b : a
    }

    // Hints
    func revealClue() { guard clue == nil, let p = puzzle else { return }
        clue = p.hint ?? "Category: \(categoryLabels[p.themeCategory ?? "general"] ?? "General")" }
    func revealVowel() { reveal(vowels: true) }
    func revealConsonant() { reveal(vowels: false) }
    private func reveal(vowels: Bool) {
        guard let p = puzzle else { return }
        let set = Set("aeiou")
        let chars = Array(ProperNoundle.normalize(p.answer))
        let candidates = chars.filter { vowels ? set.contains($0) : !set.contains($0) }
        guard let pick = candidates.first.map({ String($0).uppercased() }) else { return }
        if vowels, revealedVowel == nil { revealedVowel = pick }
        if !vowels, revealedConsonant == nil { revealedConsonant = pick }
    }

    private func finish() {
        finalTimeSeconds = elapsed
        if status == .won { Haptics.success() } else { Haptics.error() }
        guard !recorded else { return }; recorded = true
        let seed = generateDailySeed(date: LeaderboardService.todayLocal(), gameMode: GameMode.propernoundle.rawValue)
        let won = status == .won, secs = elapsed, gc = guesses.count, used = hintsUsed
        Task {
            await GameResultsService.record(gameMode: .propernoundle, won: won, guessCount: gc,
                                            timeSeconds: secs, boardsSolved: won ? 1 : 0, totalBoards: 1,
                                            seed: seed, hintsUsed: used)
        }
    }

    private func flash(_ m: String) {
        toast = m
        Task { try? await Task.sleep(nanoseconds: 1_400_000_000); if toast == m { toast = nil } }
    }
}

struct ProperNoundleView: View {
    @StateObject private var vm = ProperNoundleVM()
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ZStack {
            LinearGradient(colors: [Theme.background, Theme.backgroundGradientEnd], startPoint: .top, endPoint: .bottom).ignoresSafeArea()
            if vm.puzzle == nil {
                Text("No puzzle available").foregroundStyle(Theme.textMuted)
            } else {
                VStack(spacing: 8) {
                    header
                    Spacer(minLength: 4)
                    NoundleBoard(vm: vm)
                    Spacer(minLength: 4)
                    if vm.isFinished { result } else { hints; NoundleKeyboard(vm: vm).padding(.bottom, 6) }
                }
                .padding(.horizontal, 10)
            }
            if let toast = vm.toast {
                Text(toast).font(.subheadline.weight(.semibold)).foregroundStyle(.white)
                    .padding(.horizontal, 16).padding(.vertical, 10)
                    .background(Capsule().fill(Theme.textPrimary.opacity(0.9)))
                    .padding(.top, 100).frame(maxHeight: .infinity, alignment: .top)
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .animation(.easeInOut(duration: 0.2), value: vm.toast)
    }

    private var header: some View {
        VStack(spacing: 4) {
            Text("PROPERNOUNDLE").font(Brand.font(24, .black))
                .foregroundStyle(LinearGradient(colors: [pnAccent, Color(hex: 0xF87171)], startPoint: .leading, endPoint: .trailing))
            HStack(spacing: 8) {
                if let p = vm.puzzle {
                    Text(categoryLabels[p.themeCategory ?? "general"] ?? "General")
                        .font(Brand.caption(11)).foregroundStyle(.white)
                        .padding(.horizontal, 8).padding(.vertical, 3)
                        .background(Capsule().fill(pnAccent))
                }
                Text("\(vm.guesses.count)/\(vm.maxGuesses)").font(Brand.caption(12)).foregroundStyle(Theme.textMuted)
                if !vm.isFinished {
                    TimelineView(.periodic(from: .now, by: 1)) { _ in
                        Text("\(vm.elapsed / 60):\(String(format: "%02d", vm.elapsed % 60))")
                            .font(Brand.caption(12)).foregroundStyle(Theme.textMuted)
                    }
                }
            }
            if let clue = vm.clue {
                Text(clue).font(Brand.body(12)).foregroundStyle(Theme.textSecondary).italic()
                    .multilineTextAlignment(.center).padding(.horizontal, 20)
            }
        }
        .padding(.top, 6)
    }

    private var hints: some View {
        HStack(spacing: 8) {
            hintButton("Clue", systemImage: "lightbulb", used: vm.clue != nil) { vm.revealClue() }
            hintButton(vm.revealedVowel.map { "Vowel: \($0)" } ?? "Vowel", systemImage: "a.circle", used: vm.revealedVowel != nil) { vm.revealVowel() }
            hintButton(vm.revealedConsonant.map { "Cons: \($0)" } ?? "Consonant", systemImage: "b.circle", used: vm.revealedConsonant != nil) { vm.revealConsonant() }
        }
        .padding(.bottom, 4)
    }

    private func hintButton(_ label: String, systemImage: String, used: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Label(label, systemImage: systemImage).font(Brand.font(11, .heavy))
                .foregroundStyle(used ? Theme.textMuted : pnAccent)
                .padding(.horizontal, 10).padding(.vertical, 7)
                .background(Capsule().fill(Theme.surface))
                .overlay(Capsule().stroke(used ? Theme.border : pnAccent.opacity(0.5), lineWidth: 1.5))
        }
        .buttonStyle(.plain).disabled(used)
    }

    private var result: some View {
        VStack(spacing: 8) {
            Text(vm.status == .won ? "🎉 Solved!" : "Out of guesses").font(Brand.headline(18)).foregroundStyle(Theme.textPrimary)
            if let p = vm.puzzle { Text(p.display).font(Brand.title(20)).foregroundStyle(pnAccent) }
            Button("Home") { dismiss() }.font(Brand.font(13, .black)).foregroundStyle(Theme.textMuted).padding(.top, 2)
        }
        .padding(.vertical, 12)
    }
}

/// Word-group tile board for ProperNoundle.
struct NoundleBoard: View {
    @ObservedObject var vm: ProperNoundleVM

    var body: some View {
        let groups = vm.puzzle.map { ProperNoundle.wordGroups($0.display) } ?? [vm.answerLen]
        let total = groups.reduce(0, +)
        let gap: CGFloat = 4, groupGap: CGFloat = 14
        let avail: CGFloat = 350
        let tile = min(40, floor((avail - gap * CGFloat(max(0, total - 1)) - groupGap * CGFloat(max(0, groups.count - 1))) / CGFloat(max(1, total))))
        return VStack(spacing: gap) {
            ForEach(0..<vm.maxGuesses, id: \.self) { row in
                rowView(row, groups: groups, tile: tile, gap: gap, groupGap: groupGap)
            }
        }
    }

    @ViewBuilder
    private func rowView(_ row: Int, groups: [Int], tile: CGFloat, gap: CGFloat, groupGap: CGFloat) -> some View {
        let committed = row < vm.guesses.count
        let isCurrent = row == vm.guesses.count && !vm.isFinished
        let letters: [Character] = committed ? Array(vm.guesses[row].word) : (isCurrent ? Array(vm.input) : [])
        let states: [NTile]? = committed ? vm.guesses[row].tiles : nil
        HStack(spacing: groupGap) {
            ForEach(0..<groups.count, id: \.self) { gi in
                let start = groups.prefix(gi).reduce(0, +)
                HStack(spacing: gap) {
                    ForEach(0..<groups[gi], id: \.self) { ci in
                        let idx = start + ci
                        let ch = idx < letters.count ? String(letters[idx]).uppercased() : ""
                        let st = states != nil && idx < states!.count ? states![idx] : .empty
                        nTile(ch, st, size: tile)
                    }
                }
            }
        }
    }

    private func nTile(_ letter: String, _ state: NTile, size: CGFloat) -> some View {
        let filled = state != .empty
        let color: Color = {
            switch state {
            case .correct: return Theme.correct
            case .present: return Theme.present
            case .absent: return Theme.absent
            case .hintUsed: return Theme.present
            case .empty: return .white
            }
        }()
        return Text(letter).font(Brand.font(size * 0.5, .heavy))
            .foregroundStyle(filled ? .white : Theme.textPrimary)
            .frame(width: size, height: size)
            .background(RoundedRectangle(cornerRadius: size * 0.14).fill(color))
            .overlay(RoundedRectangle(cornerRadius: size * 0.14).stroke(letter.isEmpty ? Theme.emptyBorder : Theme.textPrimary.opacity(0.25), lineWidth: 2))
    }
}

/// QWERTY keyboard for ProperNoundle (per-key colour from guesses).
struct NoundleKeyboard: View {
    @ObservedObject var vm: ProperNoundleVM
    private let rows: [[String]] = ["QWERTYUIOP".map { String($0) }, "ASDFGHJKL".map { String($0) }, "ZXCVBNM".map { String($0) }]

    var body: some View {
        VStack(spacing: 7) {
            ForEach(0..<rows.count, id: \.self) { r in
                HStack(spacing: 5) {
                    if r == 2 { action("ENTER") { vm.submit(); Haptics.tap() } }
                    ForEach(rows[r], id: \.self) { key in letterKey(key) }
                    if r == 2 { action("⌫") { vm.delete(); Haptics.tap() } }
                }
            }
        }.padding(.horizontal, 4)
    }

    private func letterKey(_ l: String) -> some View {
        let st = vm.keyState(l)
        let bg: Color = st.map { s in
            switch s { case .correct: return Theme.correct; case .present: return Theme.present; case .absent: return Theme.absent; default: return Theme.keyDefault }
        } ?? Theme.keyDefault
        return Button { vm.type(l); Haptics.tap() } label: {
            Text(l).font(Brand.font(18, .bold)).foregroundStyle(st == nil ? Theme.textPrimary : .white)
                .frame(maxWidth: .infinity).frame(height: 52)
                .background(RoundedRectangle(cornerRadius: 6).fill(bg))
        }.buttonStyle(.plain)
    }

    private func action(_ label: String, _ act: @escaping () -> Void) -> some View {
        Button(action: act) {
            Text(label).font(Brand.font(14, .bold)).foregroundStyle(Theme.textPrimary)
                .frame(width: 54, height: 52).background(RoundedRectangle(cornerRadius: 6).fill(Theme.keyDefault))
        }.buttonStyle(.plain)
    }
}
