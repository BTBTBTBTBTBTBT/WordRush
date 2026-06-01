import Foundation

public final class GameDictionary {
    public static let shared = GameDictionary()

    private init() {}

    private var allowedWords: Set<String> = []
    private var allowedWordsArray: [String] = []
    private var solutionWords: [String] = []
    private var lengthDictionaries: [Int: (allowed: Set<String>, solutions: [String])] = [:]

    public func initDictionary(allowed: [String], solutions: [String]) {
        allowedWords = Set(allowed.map { $0.uppercased() })
        allowedWordsArray = allowed.map { $0.uppercased() }
        solutionWords = solutions.map { $0.uppercased() }
    }

    public func initDictionaryForLength(_ length: Int, allowed: [String], solutions: [String]) {
        lengthDictionaries[length] = (
            allowed: Set(allowed.map { $0.uppercased() }),
            solutions: solutions.map { $0.uppercased() }
        )
    }

    public func isValidWord(_ word: String) -> Bool {
        let upper = word.uppercased()
        if let lengthDict = lengthDictionaries[upper.count] {
            return lengthDict.allowed.contains(upper)
        }
        return allowedWords.contains(upper)
    }

    public func getSolutionWord(at index: Int) -> String {
        return solutionWords[index]
    }

    public func getSolutionCount() -> Int {
        return solutionWords.count
    }

    public func getSolutionWordForLength(_ length: Int, at index: Int) -> String {
        guard let dict = lengthDictionaries[length] else {
            fatalError("No dictionary initialized for length \(length)")
        }
        return dict.solutions[index]
    }

    public func getSolutionCountForLength(_ length: Int) -> Int {
        guard let dict = lengthDictionaries[length] else {
            fatalError("No dictionary initialized for length \(length)")
        }
        return dict.solutions.count
    }

    public func getAllowedWords() -> [String] {
        return allowedWordsArray
    }

    /// Full 5-letter solutions list (uppercased) — used for Word of the Day.
    public func allSolutions() -> [String] {
        return solutionWords
    }
}
