import SwiftUI
import WordociousCore
#if canImport(UIKit)
import UIKit
#endif

struct KeyboardView: View {
    @ObservedObject var vm: GameViewModel
    // Keyboard layout (§213): standard | flipped | michael — three
    // arrangements of the same keys, picked in Settings. Pure rendering.
    @AppStorage("pref-keyboard-layout") private var layout = "standard"

    private let rows: [[String]] = [
        "QWERTYUIOP".map { String($0) },
        "ASDFGHJKL".map { String($0) },
        "ZXCVBNM".map { String($0) },
    ]

    /// Michael Keyboard is a row taller — shorter keys keep total height
    /// close to the 3-row layouts so tight boards (OctoWord) don't squeeze.
    private var keyHeight: CGFloat { layout == "michael" ? 44 : 52 }

    /// FINISH_SPEC §B2 + §AQ1: a key takes its new color the moment ITS tile lands
    /// (tile by tile, never after the whole row), so the reveal stays a surprise
    /// without the keyboard lagging behind fast play. Instantly on appear, a new
    /// stage, or Reduce Motion.
    @State private var shownKeys: [String: TileState] = [:]
    @State private var shownBoards: [[String: TileState]] = []
    @State private var primed = false
    /// Rows still flipping: "board:row" → when the row committed.
    @State private var flipping: [String: Date] = [:]
    /// Each board's committed row count at the last refresh.
    @State private var seenCounts: [Int] = []

    /// Committed guesses across boards — changes whenever a row commits.
    private var guessSignature: Int { vm.boards.reduce(0) { $0 + $1.guesses.count } }

    private func refreshKeys() {
        let now = Date()
        let cols = vm.wordLength
        let mini = vm.isMultiBoard   // §BI5: the board's own pacing (mini on multi-board)
        let open = flipping.filter { RevealTiming.tilesLanded(elapsed: now.timeIntervalSince($0.value), columns: cols, mini: mini) < cols }
        if open.count != flipping.count { flipping = open }
        let visible: (Int, Int) -> Int = { b, r in
            guard let at = open["\(b):\(r)"] else { return Int.max }
            return RevealTiming.tilesLanded(elapsed: now.timeIntervalSince(at), columns: cols, mini: mini)
        }
        if vm.useQuadrantKeyboard {
            shownBoards = vm.boardKeyStates(visible: visible)
        } else {
            shownKeys = vm.keyStates(visible: visible)
        }
        primed = true
    }

    /// A row committed: mark each board's new rows as flipping and refresh as each
    /// of their tiles lands.
    private func rowsCommitted() {
        let counts = vm.boards.map(\.guesses.count)
        let now = Date()
        for (b, n) in counts.enumerated() {
            let before = b < seenCounts.count ? seenCounts[b] : n
            for r in before..<max(before, n) { flipping["\(b):\(r)"] = now }
        }
        seenCounts = counts
        refreshKeys()
        for i in 0..<vm.wordLength {
            DispatchQueue.main.asyncAfter(deadline: .now() + RevealTiming.tileLands(column: i, mini: vm.isMultiBoard) + 0.005) {
                refreshKeys()
            }
        }
    }

    private func resetKeys() {
        flipping = [:]
        seenCounts = vm.boards.map(\.guesses.count)
        refreshKeys()
    }

    var body: some View {
        // BJ3: the per-board key states once per render (not once per key).
        let quadBoards = vm.useQuadrantKeyboard ? (primed ? shownBoards : vm.boardKeyStates()) : []
        return VStack(spacing: 7) {
            ForEach(0..<rows.count, id: \.self) { r in
                HStack(spacing: 5) {
                    // standard: ENTER left / ⌫ right (every phone puts backspace
                    // bottom-right — founder call, 2026-08-10). flipped: the
                    // original mirror. michael: ⌫ at BOTH ends of the Z row,
                    // with ENTER ×2 + a decorative space bar on a 4th row.
                    if r == 2 {
                        switch layout {
                        case "flipped": deleteKey()
                        case "michael": deleteKey()
                        default: enterKey()
                        }
                    }
                    ForEach(rows[r], id: \.self) { letter in
                        if vm.useQuadrantKeyboard { quadrantKey(letter, quadBoards) } else { letterKey(letter) }
                    }
                    if r == 2 {
                        switch layout {
                        case "flipped": enterKey()
                        default: deleteKey()
                        }
                    }
                }
            }
            if layout == "michael" {
                HStack(spacing: 5) {
                    enterKey()
                    spaceKey()
                    enterKey()
                }
            }
        }
        .padding(.horizontal, 4)
        .onAppear { resetKeys() }
        .onChange(of: guessSignature) { [old = guessSignature] new in
            // A new stage / board reset (fewer guesses) or Reduce Motion: instant colors.
            if new < old || Theme.reduceMotion || vm.boardCount > 4 { resetKeys(); return }   // perf audit: 5+ boards reveal at once
            rowsCommitted()
        }
        // Physical keyboard (founder, 2026-09-30) — web parity with every word
        // board's keydown: Enter / Backspace / A–Z, same actions as the keys
        // above (the view model's guards apply). Live while this keyboard is.
        .hardwareKeyboard(enabled: !vm.isFinished) { key in
            switch key {
            case .enter: vm.submit()
            case .delete: vm.delete(); SoundManager.shared.playDelete(); return true
            case .letter(let l): vm.type(l)
            default: return false
            }
            SoundManager.shared.playKeyTap()
            return true
        }
    }

    private func enterKey() -> some View {
        actionKey("ENTER") { vm.submit(); Haptics.tap(); SoundManager.shared.playKeyTap() }
    }

    private func deleteKey() -> some View {
        actionKey("⌫") { vm.delete(); Haptics.tap(); SoundManager.shared.playDelete() }
    }

    /// Decorative space bar (§213): reacts like a key, does nothing.
    private func spaceKey() -> some View {
        Button { Haptics.tap(); SoundManager.shared.playKeyTap() } label: {
            KeyCap(state: nil, height: keyHeight) {
                Text("space").font(Brand.font(12, .heavy))
            }
        }
        .buttonStyle(KeyPressStyle())
        .accessibilityLabel("Space (decorative)")
    }

    /// §B2: the key is a tile — a lilac lip under a light face with dark purple
    /// letters, taking purple / gold / slate after a reveal.
    /// FINISH_SPEC BJ3: an Equatable key — a keystroke (which only changes the typing
    /// row) re-diffs each key with one comparison instead of rebuilding its cap.
    private func letterKey(_ letter: String) -> some View {
        let state = primed ? shownKeys[letter] : vm.keyState(for: letter)
        let vm = vm
        return LetterKeyView(letter: letter, state: state, height: keyHeight,
                             colorblind: ThemeManager.shared.colorblind) {
            vm.type(letter)
            Haptics.tap()
            SoundManager.shared.playKeyTap()
        }
        .equatable()
    }

    /// Per-board quadrant key (QuadWord/OctoWord/Deliverance) — mirrors web
    /// QuadrantKey: a grid of sub-cells, one per board, each colored by that
    /// board's state for this letter; all-absent collapses to solid gray.
    private func quadrantKey(_ letter: String, _ boards: [[String: TileState]]) -> some View {
        let vm = vm
        return QuadrantKeyView(letter: letter, states: boards.map { $0[letter] }, height: keyHeight,
                               colorblind: ThemeManager.shared.colorblind) {
            vm.type(letter); Haptics.tap(); SoundManager.shared.playKeyTap()
        }
        .equatable()
    }

    /// §B2: ENTER (12 pt label) and the chunky purple backspace, as key tiles.
    private func actionKey(_ label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            KeyCap(state: nil, height: keyHeight, width: 54) {
                if label == "⌫" {
                    DeleteKeyIcon(width: 30)
                } else {
                    Text(label).font(Brand.font(12, .black)).tracking(0.5)
                }
            }
        }
        .buttonStyle(KeyPressStyle())
        .accessibilityLabel(label == "⌫" ? "Delete" : "Submit guess")
    }
}

// `Haptics` lives in SoundManager.swift (FINISH_SPEC §U: gated by the Haptics toggle).

/// FINISH_SPEC BJ3: one letter key, compared by what it shows (the action is the
/// same `vm.type(letter)` for the key's whole life, so it's left out of `==`).
private struct LetterKeyView: View, Equatable {
    let letter: String
    let state: TileState?
    let height: CGFloat
    let colorblind: Bool
    let action: () -> Void

    static func == (a: Self, b: Self) -> Bool {
        a.letter == b.letter && a.state == b.state && a.height == b.height && a.colorblind == b.colorblind
    }

    var body: some View {
        Button(action: action) {
            KeyCap(state: state, height: height) {
                Text(letter).font(Brand.font(18, .black))
            }
        }
        .buttonStyle(KeyPressStyle())
        .accessibilityLabel(letter)
        .accessibilityValue(state?.a11yName ?? "")
    }
}

/// FINISH_SPEC BJ3: one quadrant key (a sub-cell per board), compared by its states.
private struct QuadrantKeyView: View, Equatable {
    let letter: String
    let states: [TileState?]
    let height: CGFloat
    let colorblind: Bool
    let action: () -> Void

    static func == (a: Self, b: Self) -> Bool {
        a.letter == b.letter && a.states == b.states && a.height == b.height && a.colorblind == b.colorblind
    }

    var body: some View {
        let count = max(1, states.count)
        let cols = count <= 4 ? 2 : 4
        let rowCount = Int(ceil(Double(count) / Double(cols)))
        let present = states.compactMap { $0 }
        let hasAny = !present.isEmpty
        let allAbsent = hasAny && present.allSatisfy { $0 == .absent }
        let fg: Color = hasAny ? .white : (Theme.isDark ? Color(hex: 0xEFE9FF) : FinishInk.softNumber)
        return Button(action: action) {
            ZStack {
                if allAbsent {
                    LinearGradient(colors: [TilePalette.slate.light, TilePalette.slate.base], startPoint: .top, endPoint: .bottom)
                } else {
                    VStack(spacing: 0) {
                        ForEach(0..<rowCount, id: \.self) { r in
                            HStack(spacing: 0) {
                                ForEach(0..<cols, id: \.self) { c in
                                    let idx = r * cols + c
                                    Self.quadColor(idx < states.count ? states[idx] : nil)
                                }
                            }
                        }
                    }
                }
                Text(letter).font(Brand.font(18, .black)).foregroundStyle(fg)
                    .lineLimit(1).minimumScaleFactor(0.5)   // §AB: fits its key at 200% text
                    .shadow(color: hasAny ? .black.opacity(0.35) : .clear, radius: 1, x: 0, y: 1)
            }
            .frame(maxWidth: .infinity).frame(height: height)
            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            // Button family §5: the key light map (gloss + lip) over the quadrant cells.
            .overlay(FamilyKeyGloss())
        }
        .buttonStyle(KeyPressStyle())
        .accessibilityLabel(letter)
        .accessibilityValue(Self.a11yValue(states))
    }

    /// Spoken per-board summary for a quadrant key, e.g. "board 1 correct, board 3 not in word".
    static func a11yValue(_ states: [TileState?]) -> String {
        let parts = states.enumerated().compactMap { i, st -> String? in
            guard let st, !st.a11yName.isEmpty else { return nil }
            return "board \(i + 1) \(st.a11yName)"
        }
        return parts.joined(separator: ", ")
    }

    static func quadColor(_ st: TileState?) -> some View {
        // Theme.correct/present are colorblind-aware — web's [data-colorblind]
        // overrides recolor the quadrant mini-cells too (they use the same
        // bg-green-500/yellow-500 classes the board tiles use).
        let c: AnyShapeStyle
        switch st {
        case .correct: c = AnyShapeStyle(LinearGradient(colors: [TilePalette.correct.light, TilePalette.correct.base], startPoint: .top, endPoint: .bottom))
        case .present, .hintUsed: c = AnyShapeStyle(LinearGradient(colors: [TilePalette.present.light, TilePalette.present.base], startPoint: .top, endPoint: .bottom))
        case .absent: c = AnyShapeStyle(TilePalette.slate.base)
        default: c = AnyShapeStyle(Theme.isDark ? Color(hex: 0x3D355F) : Color(hex: 0xFBFAFF))
        }
        return Rectangle().fill(c).frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}
