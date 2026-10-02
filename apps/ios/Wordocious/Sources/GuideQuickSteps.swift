import SwiftUI
import WordociousCore

// FINISH_SPEC §AF: the in-game "?" card's 3–4 short steps, distilled from each
// game's guide (guides.generated.json / lib/guide-content.ts — rules + tips),
// each with an optional tiny example row of real B-kit glossy tiles. Word games
// get a guess that flips to its colors; number / logic games a small static row
// or none. `{C}` `{P}` `{A}` in a step read as the tile color names (they follow
// the colorblind palette: orange / blue instead of purple / gold).

/// One example tile: a letter (or digit) and the face it shows.
struct GuideExTile: Hashable {
    let letter: String
    let face: GlossyFace

    static func == (a: GuideExTile, b: GuideExTile) -> Bool { a.letter == b.letter && a.face == b.face }
    func hash(into h: inout Hasher) { h.combine(letter) }
}

/// A step's example.
enum GuideExample {
    /// Typed rows that flip to their colors left → right, looping gently
    /// (several rows = one guess landing on several boards).
    case flip([[GuideExTile]])
    /// Static glossy rows.
    case tiles([[GuideExTile]])
    /// The three tile colors with a tiny caption under each.
    case legend
}

struct GuideStep {
    let text: String
    var example: GuideExample? = nil
}

enum GuideQuickSteps {
    /// A row from letters + a face code: c correct · p present · a absent ·
    /// t typed · e empty · g given · x conflict · h hint used. A space letter = blank.
    static func row(_ letters: String, _ code: String) -> [GuideExTile] {
        zip(Array(letters), Array(code)).map { l, k in
            let face: GlossyFace
            switch k {
            case "c": face = .correct
            case "p": face = .present
            case "a": face = .absent
            case "e": face = .empty
            case "g": face = .given
            case "x": face = .conflict
            case "h": face = .hintUsed
            default: face = .typed
            }
            return GuideExTile(letter: l == " " ? "" : String(l), face: face)
        }
    }

    private static func flip(_ letters: String, _ code: String) -> GuideExample { .flip([row(letters, code)]) }
    private static func still(_ letters: String, _ code: String) -> GuideExample { .tiles([row(letters, code)]) }

    /// The color names as the board shows them (colorblind: orange / blue).
    static var correctName: String { ThemeManager.shared.colorblind ? "Orange" : "Purple" }
    static var presentName: String { ThemeManager.shared.colorblind ? "Blue" : "Gold" }
    static let absentName = "Gray"

    static func render(_ s: String) -> String {
        s.replacingOccurrences(of: "{C}", with: correctName)
            .replacingOccurrences(of: "{P}", with: presentName)
            .replacingOccurrences(of: "{A}", with: absentName)
    }

    private static let legendStep = GuideStep(
        text: "{C}: right letter, right spot. {P}: in the word, wrong spot. {A}: not in the word.",
        example: .legend)

    /// The card's steps for a guide (curated per game; any other guide falls back
    /// to the first sentence of each rule).
    static func steps(for g: ModeGuide) -> [GuideStep] {
        if let s = curated[g.slug] { return s }
        return Array(g.rules.compactMap(firstSentence).prefix(4)).map { GuideStep(text: $0) }
    }

    /// The first real sentence of a paragraph (skips a lead-in question).
    static func firstSentence(_ p: String) -> String? {
        var parts: [String] = []
        var cur = ""
        for ch in p {
            cur.append(ch)
            if ch == "." || ch == "?" || ch == "!" {
                parts.append(cur.trimmingCharacters(in: .whitespaces)); cur = ""
            }
        }
        if !cur.trimmingCharacters(in: .whitespaces).isEmpty { parts.append(cur.trimmingCharacters(in: .whitespaces)) }
        return parts.first { !$0.hasSuffix("?") && $0.count >= 24 } ?? parts.first
    }

    private static let curated: [String: [GuideStep]] = [
        "classic": [
            GuideStep(text: "Type any 5-letter word and press enter. You get six tries.", example: flip("CRANE", "apcac")),
            legendStep,
            GuideStep(text: "A doubled letter only colors as many times as it's in the answer.", example: still("SPEED", "capaa")),
            GuideStep(text: "Turn the whole row {C} to win. Fewer guesses and a faster time score more.", example: flip("STARE", "ccccc")),
        ],
        "six": [
            GuideStep(text: "Guess the hidden 6-letter word in seven tries.", example: flip("STRIPE", "cccaap")),
            legendStep,
            GuideStep(text: "Stuck? Reveal a vowel or a consonant. Each hint costs 75 points.", example: still("  E   ", "eeceee")),
            GuideStep(text: "Turn the whole row {C} to win.", example: flip("STREAM", "cccccc")),
        ],
        "seven": [
            GuideStep(text: "Guess the hidden 7-letter word in eight tries.", example: flip("PARENTS", "cpappcc")),
            legendStep,
            GuideStep(text: "Stuck? Reveal a vowel or a consonant. Each hint costs 75 points.", example: still("  A    ", "eeceeee")),
            GuideStep(text: "Turn the whole row {C} to win.", example: flip("PLANETS", "ccccccc")),
        ],
        "quadword": [
            GuideStep(text: "Solve four hidden 5-letter words at once with nine guesses."),
            GuideStep(text: "Every guess lands on all four boards, and each board colors its own tiles.",
                      example: .flip([row("CRANE", "apcac"), row("CRANE", "caapa")])),
            legendStep,
            GuideStep(text: "A solved board locks with a check. Clear all four before you run out."),
        ],
        "octoword": [
            GuideStep(text: "Solve eight hidden 5-letter words at once with thirteen guesses."),
            GuideStep(text: "Every guess lands on all eight boards, and each board colors its own tiles.",
                      example: .flip([row("SLATE", "capaa"), row("SLATE", "aacpa")])),
            legendStep,
            GuideStep(text: "Spend your first guesses testing lots of common letters."),
        ],
        "succession": [
            GuideStep(text: "Solve four hidden 5-letter words one at a time, in order.", example: flip("CRANE", "apcac")),
            legendStep,
            GuideStep(text: "Ten guesses are shared across all four boards."),
            GuideStep(text: "Your earlier guesses carry forward onto each new board."),
        ],
        "deliverance": [
            GuideStep(text: "Each of the four boards opens with three guesses already played.",
                      example: .tiles([row("SLATE", "apaac"), row("DOING", "aaaca")])),
            legendStep,
            GuideStep(text: "Read those clues, then finish all four boards with six guesses of your own.",
                      example: flip("PRICE", "cpaac")),
            GuideStep(text: "Each guess you type lands on all four boards."),
        ],
        "gauntlet": [
            GuideStep(text: "Five stages and 21 words in one run. Each stage gets harder."),
            legendStep,
            GuideStep(text: "Solve every word in a stage to move on.", example: flip("BRAVE", "ccccc")),
            GuideStep(text: "Run out of guesses on any stage and the run ends."),
        ],
        "propernoundle": [
            GuideStep(text: "The answer is a famous name: a person, place, brand, character or title."),
            GuideStep(text: "Guesses don't have to be real words. A gap means the name has two words.",
                      example: flip("PARIS", "cpaac")),
            legendStep,
            GuideStep(text: "Stuck? A clue, a vowel or a consonant. Each hint costs 60 points."),
        ],
        "sudocious": [
            GuideStep(text: "Fill the grid so every row, column and 3 × 3 box has 1 to 9 exactly once.",
                      example: still("53 7", "ggeg")),
            GuideStep(text: "Tap an empty cell, then a number. Right turns {C}; wrong turns red.",
                      example: still("48", "cx")),
            GuideStep(text: "Turn on Notes to pencil in candidates. Notes are never judged."),
            GuideStep(text: "Three mistakes end the puzzle."),
        ],
        "starsweep": [
            GuideStep(text: "Place one star in every row, every column and every color region."),
            GuideStep(text: "Stars can never touch, not even at a corner."),
            GuideStep(text: "Tap a cell to set a black star (a free pencil mark). Double-tap to play it."),
            GuideStep(text: "A wrong star turns red. Three mistakes end the game."),
        ],
        "letter-ladder": [
            GuideStep(text: "Climb from the start word to the end word, changing one letter at a time.",
                      example: .tiles([row("STONE", "ttttt"), row("STORE", "tttct"), row("STARE", "ttctt")])),
            GuideStep(text: "Every rung must be a real word. Turned-away words are free."),
            GuideStep(text: "Every accepted word is a move. Reach the end in par; you get par plus five."),
            GuideStep(text: "Undo is free, but the move stays spent. A hint counts as a move."),
        ],
        "spyglass": [
            GuideStep(text: "Find ten hidden words that fit the grid's theme."),
            GuideStep(text: "Each chip shows only a word's length. Words read forwards: across, down or diagonal."),
            GuideStep(text: "Tap the first and last letter, or drag across a word.", example: flip("WHISK", "ccccc")),
            GuideStep(text: "A straight line of 4+ letters that isn't on the list is a miss. Misses lower your score."),
        ],
        "hubbub": [
            GuideStep(text: "Make words of 4+ letters from the seven. Every word uses the center letter.",
                      example: still("LAPNTRE", "tttpttt")),
            GuideStep(text: "Letters can repeat. Four-letter words score 1; longer words score their length."),
            GuideStep(text: "Use all seven letters for a pangram and 7 bonus points.", example: flip("PLANTER", "ccccccc")),
            GuideStep(text: "Reach Hubbub (half the top score) to solve the puzzle. Keep going to climb higher."),
        ],
        "codebreaker": [
            GuideStep(text: "Every letter of a saying is swapped for another, the same way throughout."),
            GuideStep(text: "Type into any box and the letter fills every matching code letter at once."),
            GuideStep(text: "Pencil freely. Only Check counts against you."),
            GuideStep(text: "The puzzle finishes itself the moment every letter is right."),
        ],
        "kindred": [
            GuideStep(text: "Sixteen words hide four groups of four."),
            GuideStep(text: "Tap four words that share something and press Submit."),
            GuideStep(text: "A wrong set costs a mistake. \"One away…\" means three of them fit."),
            GuideStep(text: "Hints never cost a mistake. Four mistakes end the puzzle."),
        ],
        "crosswordocious": [
            GuideStep(text: "Every clue is a familiar saying with one word missing."),
            GuideStep(text: "Tap a cell or a clue and type. Tap a cell twice to switch Across and Down.",
                      example: still("STORM", "ttttt")),
            GuideStep(text: "Change letters freely. Only Check counts against you."),
            GuideStep(text: "The grid finishes itself the moment every cell is right.", example: flip("STORM", "ccccc")),
        ],
        "muddle": [
            GuideStep(text: "Unscramble four words. Each one checks itself when its boxes are full.",
                      example: flip("WHALE", "ccccc")),
            GuideStep(text: "The ringed letters spell the punchline that finishes the joke."),
            GuideStep(text: "Every check counts. Five is a perfect run; the thirteenth loses."),
            GuideStep(text: "Hints never count as checks."),
        ],
    ]
}

// MARK: - Example rows

/// A step's example, sized for the card (decorative: the step text says it).
struct GuideExampleView: View {
    let example: GuideExample
    let still: Bool

    var body: some View {
        Group {
            switch example {
            case .flip(let rows): GuideFlipRows(rows: rows, still: still)
            case .tiles(let rows):
                VStack(alignment: .leading, spacing: 4) {
                    ForEach(rows.indices, id: \.self) { r in
                        HStack(spacing: 4) {
                            ForEach(rows[r].indices, id: \.self) { i in
                                GlossyTile(face: rows[r][i].face, letter: rows[r][i].letter, width: Self.size(rows))
                            }
                        }
                    }
                }
            case .legend:
                HStack(alignment: .top, spacing: 10) {
                    legendTile("W", .correct, "RIGHT SPOT")
                    legendTile("O", .present, "WRONG SPOT")
                    legendTile("R", .absent, "NOT IN IT")
                }
            }
        }
        .accessibilityHidden(true)
    }

    private func legendTile(_ l: String, _ face: GlossyFace, _ caption: String) -> some View {
        VStack(spacing: 4) {
            GlossyTile(face: face, letter: l, width: 30)
            Text(caption).font(Brand.fixedFont(8.5, .black)).tracking(0.6).foregroundStyle(FinishInk.secondary)
                .lineLimit(1).fixedSize()
        }
    }

    /// Tiles shrink a touch for long words and stacked rows.
    static func size(_ rows: [[GuideExTile]]) -> CGFloat {
        let n = rows.map(\.count).max() ?? 5
        let base: CGFloat = n >= 7 ? 26 : (n == 6 ? 28 : 30)
        return rows.count > 2 ? base - 4 : (rows.count == 2 ? base - 2 : base)
    }
}

/// Typed rows that flip to their colors left → right (300 ms apart), hold, then
/// reset and play again every few seconds. Still (Reduce Motion / Low Power) = the
/// final colors, no loop.
private struct GuideFlipRows: View {
    let rows: [[GuideExTile]]
    let still: Bool
    @State private var revealed = 0

    private var cols: Int { rows.map(\.count).max() ?? 0 }

    var body: some View {
        let size = GuideExampleView.size(rows)
        VStack(alignment: .leading, spacing: 4) {
            ForEach(rows.indices, id: \.self) { r in
                HStack(spacing: 4) {
                    ForEach(rows[r].indices, id: \.self) { i in
                        GuideFlipTile(tile: rows[r][i], revealed: still || i < revealed, size: size, still: still)
                    }
                }
            }
        }
        .task(id: still) {
            guard !still else { return }
            while !Task.isCancelled {
                revealed = 0
                try? await Task.sleep(nanoseconds: 900_000_000)
                for i in 1...max(1, cols) {
                    if Task.isCancelled { return }
                    revealed = i
                    try? await Task.sleep(nanoseconds: 300_000_000)
                }
                try? await Task.sleep(nanoseconds: 2_600_000_000)
            }
        }
    }
}

/// One example tile: typed, then turns over (edge-on at the half, the color swaps)
/// to its face.
private struct GuideFlipTile: View {
    let tile: GuideExTile
    let revealed: Bool
    let size: CGFloat
    let still: Bool
    @State private var shown = false
    @State private var angle: Double = 0

    var body: some View {
        GlossyTile(face: shown ? tile.face : .typed, letter: tile.letter, width: size,
                   glow: GlossyTile.bloom(tile.face), glowAmount: shown && !still ? 0.5 : 0)
            .rotation3DEffect(.degrees(angle), axis: (x: 1, y: 0, z: 0), perspective: 0.5)
            .onAppear { shown = revealed }
            .onChange(of: revealed) { now in
                if still { shown = now; angle = 0; return }
                if now {
                    withAnimation(.easeIn(duration: 0.18)) { angle = 90 }
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.18) {
                        shown = true
                        withAnimation(.spring(response: 0.32, dampingFraction: 0.7)) { angle = 0 }
                    }
                } else {
                    withAnimation(.easeInOut(duration: 0.25)) { shown = false; angle = 0 }
                }
            }
    }
}
