import Foundation
import WordociousCore

/// Loads the bundled word lists into the shared GameDictionary once at launch.
/// Mirrors apps/web/lib/init-dictionary.ts.
enum DictionaryLoader {
    private static var initialized = false

    static func ensureInitialized() {
        guard !initialized else { return }

        func load(_ name: String) -> [String] {
            guard let url = Bundle.main.url(forResource: name, withExtension: "json"),
                  let data = try? Data(contentsOf: url),
                  let words = try? JSONDecoder().decode([String].self, from: data) else {
                fatalError("Missing or invalid word list: \(name).json")
            }
            return words
        }

        let dict = GameDictionary.shared
        // legacy list feeds the pre-cutover answer pool (date-gated in core).
        dict.initDictionary(allowed: load("allowed"), solutions: load("solutions"),
                            legacySolutions: load("solutions-legacy"))
        dict.initDictionaryForLength(6, allowed: load("allowed-6"), solutions: load("solutions-6"))
        dict.initDictionaryForLength(7, allowed: load("allowed-7"), solutions: load("solutions-7"))
        initialized = true
    }
}
