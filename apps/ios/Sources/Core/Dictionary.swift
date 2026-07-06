import Foundation

public final class GameDictionary {
    public static let shared = GameDictionary()

    private init() {}

    private var allowedWords: Set<String> = []
    private var allowedWordsArray: [String] = []
    private var solutionWords: [String] = []
    private var lengthDictionaries: [Int: (allowed: Set<String>, solutions: [String])] = [:]
    private var lengthAllowedArrays: [Int: [String]] = [:]

    public func initDictionary(allowed: [String], solutions: [String]) {
        allowedWords = Set(allowed.map { $0.uppercased() })
        allowedWordsArray = allowed.map { $0.uppercased() }
        solutionWords = solutions.map { $0.uppercased() }
    }

    public func initDictionaryForLength(_ length: Int, allowed: [String], solutions: [String]) {
        let upper = allowed.map { $0.uppercased() }
        lengthDictionaries[length] = (
            allowed: Set(upper),
            solutions: solutions.map { $0.uppercased() }
        )
        lengthAllowedArrays[length] = upper
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

    /// Allowed guess list for a specific word length — the length-specific
    /// dictionary when one is loaded (6/7-letter modes), else the flat
    /// (5-letter) list. Callers should still filter by count: the flat list
    /// carries a few stray non-5-letter entries.
    public func getAllowedWordsForLength(_ length: Int) -> [String] {
        return lengthAllowedArrays[length] ?? allowedWordsArray
    }

    /// Full 5-letter solutions list (uppercased) — used for Word of the Day.
    public func allSolutions() -> [String] {
        return solutionWords
    }
}
