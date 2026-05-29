import Foundation

class GameDictionary {
    static let shared = GameDictionary()

    private var allowedWords: Set<String> = []
    private var allowedWordsArray: [String] = []
    private var solutionWords: [String] = []
    private var lengthDictionaries: [Int: (allowed: Set<String>, solutions: [String])] = [:]

    func initDictionary(allowed: [String], solutions: [String]) {
        allowedWords = Set(allowed.map { $0.uppercased() })
        allowedWordsArray = allowed.map { $0.uppercased() }
        solutionWords = solutions.map { $0.uppercased() }
    }

    func initDictionaryForLength(_ length: Int, allowed: [String], solutions: [String]) {
        lengthDictionaries[length] = (
            allowed: Set(allowed.map { $0.uppercased() }),
            solutions: solutions.map { $0.uppercased() }
        )
    }

    func isValidWord(_ word: String) -> Bool {
        let upper = word.uppercased()
        if let lengthDict = lengthDictionaries[upper.count] {
            return lengthDict.allowed.contains(upper)
        }
        return allowedWords.contains(upper)
    }

    func getSolutionWord(at index: Int) -> String {
        return solutionWords[index]
    }

    func getSolutionCount() -> Int {
        return solutionWords.count
    }

    func getSolutionWordForLength(_ length: Int, at index: Int) -> String {
        guard let dict = lengthDictionaries[length] else {
            fatalError("No dictionary initialized for length \(length)")
        }
        return dict.solutions[index]
    }

    func getSolutionCountForLength(_ length: Int) -> Int {
        guard let dict = lengthDictionaries[length] else {
            fatalError("No dictionary initialized for length \(length)")
        }
        return dict.solutions.count
    }

    func getAllowedWords() -> [String] {
        return allowedWordsArray
    }
}
