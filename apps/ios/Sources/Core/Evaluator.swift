import Foundation

public func evaluateGuess(solution: String, guess: String) -> GuessResult {
    let solutionUpper = solution.uppercased()
    let guessUpper = guess.uppercased()

    guard solutionUpper.count == guessUpper.count else {
        fatalError("Guess length \(guessUpper.count) does not match solution length \(solutionUpper.count)")
    }

    let solutionChars = Array(solutionUpper)
    let guessChars = Array(guessUpper)
    var tiles = [TileResult]()
    var used = [Bool](repeating: false, count: solutionChars.count)

    // First pass: mark CORRECT
    for i in 0..<guessChars.count {
        if guessChars[i] == solutionChars[i] {
            tiles.append(TileResult(letter: String(guessChars[i]), state: .correct))
            used[i] = true
        } else {
            tiles.append(TileResult(letter: String(guessChars[i]), state: .absent))
        }
    }

    // Second pass: mark PRESENT
    for i in 0..<guessChars.count {
        if tiles[i].state == .correct { continue }
        for j in 0..<solutionChars.count {
            if !used[j] && guessChars[i] == solutionChars[j] {
                tiles[i].state = .present
                used[j] = true
                break
            }
        }
    }

    let isCorrect = tiles.allSatisfy { $0.state == .correct }
    return GuessResult(tiles: tiles, isCorrect: isCorrect)
}
