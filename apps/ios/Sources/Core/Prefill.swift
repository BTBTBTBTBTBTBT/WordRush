import Foundation

func generatePrefillWords(seed: String, solutions: [String], allowedWords: [String]) -> [String] {
    let solutionSet = Set(solutions.map { $0.uppercased() })
    let fiveLetterWords = allowedWords.filter { $0.count == 5 }
    let pool = fiveLetterWords.isEmpty ? allowedWords : fiveLetterWords
    var words: [String] = []

    for i in 0..<3 {
        var attempt = 0
        var word: String

        repeat {
            let hashKey = "\(seed)-prefill-\(i)-\(attempt)"
            let hash = simpleHash(hashKey)
            let index = hash % pool.count
            word = pool[index]
            attempt += 1
        } while solutionSet.contains(word) && attempt < 100

        words.append(word)
    }

    return words
}

func generatePrefillGuesses(words: [String], solution: String) -> [PrefilledGuess] {
    let solutionUpper = solution.uppercased()
    return words.map { word in
        PrefilledGuess(
            word: word,
            evaluation: evaluateGuess(solution: solutionUpper, guess: word)
        )
    }
}
