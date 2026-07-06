import XCTest
@testable import WordociousCore

// MARK: - Fixture Decodable Types

struct HashFixture: Decodable {
    let input: String
    let output: Int
}

struct EvalFixture: Decodable {
    let solution: String
    let guess: String
    let result: GuessResult
}

struct SeedFixtureEntry: Decodable {
    let seed: String
    let count: Int
    let solutions: [String]
}

struct SeedFixtures: Decodable {
    let standard: [SeedFixtureEntry]
    let sixLetter: [SeedFixtureEntry]
    let sevenLetter: [SeedFixtureEntry]
}

struct ScoringInput: Decodable {
    let playerGuesses: Int
    let opponentGuesses: Int
    let playerTime: Double
    let opponentTime: Double
    let playerStatus: String
    let opponentStatus: String
}

struct ScoringFixture: Decodable {
    let input: ScoringInput
    let output: ScoreBreakdown
}

struct PrefillBoardFixture: Decodable {
    let solution: String
    let prefillGuesses: [PrefilledGuess]
}

struct PrefillFixture: Decodable {
    let seed: String
    let solutions: [String]
    let prefillWords: [String]
    let boardPrefills: [PrefillBoardFixture]
}

struct DailySeedGenerateFixture: Decodable {
    let date: String
    let mode: String
    let expected: String
}

struct DailySeedIsDailyFixture: Decodable {
    let seed: String
    let expected: Bool
}

struct DailySeedFixtures: Decodable {
    let generate: [DailySeedGenerateFixture]
    let isDaily: [DailySeedIsDailyFixture]
}

// MARK: - Test Class

final class EngineParityTests: XCTestCase {

    override class func setUp() {
        super.setUp()
        loadDictionaries()
    }

    private static func loadDictionaries() {
        let dict = GameDictionary.shared

        func loadJSON<T: Decodable>(_ filename: String) -> T {
            guard let url = Bundle.module.url(forResource: filename, withExtension: "json", subdirectory: "Fixtures"),
                  let data = try? Data(contentsOf: url) else {
                fatalError("Missing fixture: \(filename).json")
            }
            return try! JSONDecoder().decode(T.self, from: data)
        }

        // Load word lists from the bundle (copied from apps/web/data/)
        let allowed: [String] = loadJSON("allowed")
        let solutions: [String] = loadJSON("solutions")
        let legacySolutions: [String] = loadJSON("solutions-legacy")
        let allowed6: [String] = loadJSON("allowed-6")
        let solutions6: [String] = loadJSON("solutions-6")
        let allowed7: [String] = loadJSON("allowed-7")
        let solutions7: [String] = loadJSON("solutions-7")

        // legacy list required so pre-cutover daily seed fixtures resolve.
        dict.initDictionary(allowed: allowed, solutions: solutions, legacySolutions: legacySolutions)
        dict.initDictionaryForLength(6, allowed: allowed6, solutions: solutions6)
        dict.initDictionaryForLength(7, allowed: allowed7, solutions: solutions7)
    }

    private func loadFixture<T: Decodable>(_ filename: String) -> T {
        guard let url = Bundle.module.url(forResource: filename, withExtension: "json", subdirectory: "Fixtures"),
              let data = try? Data(contentsOf: url) else {
            fatalError("Missing fixture: \(filename).json")
        }
        return try! JSONDecoder().decode(T.self, from: data)
    }

    // MARK: - Hash Parity (most critical test)

    func testSimpleHashParity() {
        let fixtures: [HashFixture] = loadFixture("hash-fixtures")

        for fixture in fixtures {
            let swiftResult = simpleHash(fixture.input)
            XCTAssertEqual(
                swiftResult, fixture.output,
                "simpleHash(\"\(fixture.input)\") = \(swiftResult), expected \(fixture.output)"
            )
        }
    }

    // MARK: - Evaluator Parity

    func testEvaluateGuessParity() {
        let fixtures: [EvalFixture] = loadFixture("evaluator-fixtures")

        for fixture in fixtures {
            let swiftResult = evaluateGuess(solution: fixture.solution, guess: fixture.guess)
            XCTAssertEqual(swiftResult.isCorrect, fixture.result.isCorrect,
                           "isCorrect mismatch for \(fixture.solution)/\(fixture.guess)")
            XCTAssertEqual(swiftResult.tiles.count, fixture.result.tiles.count,
                           "tile count mismatch for \(fixture.solution)/\(fixture.guess)")
            for (i, (swift, ts)) in zip(swiftResult.tiles, fixture.result.tiles).enumerated() {
                XCTAssertEqual(swift.letter, ts.letter,
                               "tile[\(i)].letter mismatch for \(fixture.solution)/\(fixture.guess)")
                XCTAssertEqual(swift.state, ts.state,
                               "tile[\(i)].state mismatch for \(fixture.solution)/\(fixture.guess): \(swift.state) vs \(ts.state)")
            }
        }
    }

    // MARK: - Seed Generation Parity

    func testGenerateSolutionsFromSeedParity() {
        let fixtures: SeedFixtures = loadFixture("seed-fixtures")

        for fixture in fixtures.standard {
            let swiftResult = generateSolutionsFromSeed(fixture.seed, count: fixture.count)
            XCTAssertEqual(
                swiftResult, fixture.solutions,
                "Seed \"\(fixture.seed)\" count=\(fixture.count): got \(swiftResult), expected \(fixture.solutions)"
            )
        }

        for fixture in fixtures.sixLetter {
            let swiftResult = generateSolutionsFromSeedForLength(fixture.seed, count: fixture.count, wordLength: 6)
            XCTAssertEqual(swiftResult, fixture.solutions,
                           "6-letter seed \"\(fixture.seed)\": got \(swiftResult), expected \(fixture.solutions)")
        }

        for fixture in fixtures.sevenLetter {
            let swiftResult = generateSolutionsFromSeedForLength(fixture.seed, count: fixture.count, wordLength: 7)
            XCTAssertEqual(swiftResult, fixture.solutions,
                           "7-letter seed \"\(fixture.seed)\": got \(swiftResult), expected \(fixture.solutions)")
        }
    }

    // MARK: - Scoring Parity

    func testCalculateScoreParity() {
        let fixtures: [ScoringFixture] = loadFixture("scoring-fixtures")

        for fixture in fixtures {
            let input = fixture.input
            let playerStatus = GameStatus(rawValue: input.playerStatus)!
            let opponentStatus = GameStatus(rawValue: input.opponentStatus)!

            let matchResult = MatchResult(
                playerWon: playerStatus == .won,
                playerGuesses: input.playerGuesses,
                opponentGuesses: input.opponentGuesses,
                playerTime: input.playerTime,
                opponentTime: input.opponentTime,
                playerStatus: playerStatus,
                opponentStatus: opponentStatus,
                score: ScoreBreakdown(winBonus: 0, guessDiff: 0, timeDiff: 0, dnfPenalty: 0, total: 0)
            )

            let swiftResult = calculateScore(matchResult)
            XCTAssertEqual(swiftResult, fixture.output,
                           "Score mismatch: got \(swiftResult), expected \(fixture.output)")
        }
    }

    // MARK: - Prefill Parity

    func testPrefillParity() {
        let fixtures: [PrefillFixture] = loadFixture("prefill-fixtures")
        let dict = GameDictionary.shared

        for fixture in fixtures {
            let swiftWords = generatePrefillWords(
                seed: fixture.seed,
                solutions: fixture.solutions,
                allowedWords: dict.getAllowedWords()
            )
            XCTAssertEqual(swiftWords, fixture.prefillWords,
                           "Prefill words mismatch for seed \"\(fixture.seed)\"")

            for boardFixture in fixture.boardPrefills {
                let swiftGuesses = generatePrefillGuesses(
                    words: swiftWords,
                    solution: boardFixture.solution
                )
                XCTAssertEqual(swiftGuesses.count, boardFixture.prefillGuesses.count)
                for (i, (swift, ts)) in zip(swiftGuesses, boardFixture.prefillGuesses).enumerated() {
                    XCTAssertEqual(swift.word, ts.word,
                                   "Prefill guess[\(i)].word mismatch for solution \(boardFixture.solution)")
                    XCTAssertEqual(swift.evaluation, ts.evaluation,
                                   "Prefill guess[\(i)].evaluation mismatch for solution \(boardFixture.solution)")
                }
            }
        }
    }

    // MARK: - Daily Seed Helpers

    func testDailySeedParity() {
        let fixtures: DailySeedFixtures = loadFixture("daily-seed-fixtures")

        for fixture in fixtures.generate {
            let result = generateDailySeed(date: fixture.date, gameMode: fixture.mode)
            XCTAssertEqual(result, fixture.expected)
        }

        for fixture in fixtures.isDaily {
            let result = isDailySeed(fixture.seed)
            XCTAssertEqual(result, fixture.expected, "isDailySeed(\"\(fixture.seed)\")")
        }
    }

    // MARK: - Reducer Smoke Tests

    func testDuelInitialization() {
        let state = createInitialState(seed: "test", mode: .duel)
        XCTAssertEqual(state.boards.count, 1)
        XCTAssertEqual(state.mode, .duel)
        XCTAssertEqual(state.status, .playing)
        XCTAssertEqual(state.boards[0].maxGuesses, 6)
    }

    func testDuelWinOnCorrectGuess() {
        let state = createInitialState(seed: "test", mode: .duel)
        let solution = state.boards[0].solution
        let newState = gameReducer(state: state, action: .submitGuess(guess: solution))
        XCTAssertEqual(newState.boards[0].status, .won)
        XCTAssertEqual(newState.status, .won)
    }

    func testDuelLoseAfterMaxGuesses() {
        var state = createInitialState(seed: "test", mode: .duel)
        // Use a word that's valid but won't be the solution
        let wrongWord = state.boards[0].solution == "WRONG" ? "TESTS" : "WRONG"
        for _ in 0..<6 {
            state = gameReducer(state: state, action: .submitGuess(guess: wrongWord))
        }
        XCTAssertEqual(state.boards[0].status, .lost)
        XCTAssertEqual(state.status, .lost)
    }

    func testQuordleInitialization() {
        let state = createInitialState(seed: "test", mode: .quordle)
        XCTAssertEqual(state.boards.count, 4)
        XCTAssertEqual(state.boards[0].maxGuesses, 9)
    }

    func testOctordleInitialization() {
        let state = createInitialState(seed: "test", mode: .octordle)
        XCTAssertEqual(state.boards.count, 8)
        XCTAssertEqual(state.boards[0].maxGuesses, 13)
    }

    func testGauntletInitialization() {
        let state = createInitialState(seed: "test", mode: .gauntlet)
        XCTAssertNotNil(state.gauntlet)
        XCTAssertEqual(state.gauntlet?.totalStages, 5)
        XCTAssertEqual(state.gauntlet?.currentStage, 0)
        // First stage is "The Opening" — 1 board, 6 guesses
        XCTAssertEqual(state.boards.count, 1)
        XCTAssertEqual(state.boards[0].maxGuesses, 6)
    }

    func testAbandon() {
        let state = createInitialState(seed: "test", mode: .duel)
        let newState = gameReducer(state: state, action: .abandon)
        XCTAssertEqual(newState.status, .abandoned)
    }

    func testInvalidWordRejected() {
        let state = createInitialState(seed: "test", mode: .duel)
        let newState = gameReducer(state: state, action: .submitGuess(guess: "ZZZZZ"))
        XCTAssertEqual(newState.boards[0].guesses.count, 0)
    }

    func testDuel6Initialization() {
        let state = createInitialState(seed: "test", mode: .duel6)
        XCTAssertEqual(state.boards.count, 1)
        XCTAssertEqual(state.boards[0].solution.count, 6)
        XCTAssertEqual(state.boards[0].maxGuesses, 7)
    }

    func testDuel7Initialization() {
        let state = createInitialState(seed: "test", mode: .duel7)
        XCTAssertEqual(state.boards.count, 1)
        XCTAssertEqual(state.boards[0].solution.count, 7)
        XCTAssertEqual(state.boards[0].maxGuesses, 8)
    }

    /// Plays a complete Gauntlet run: clear each stage by submitting every
    /// board's own solution, then NEXT_STAGE. Confirms the 5-stage progression
    /// reaches WON with the expected board counts (1→4→4→4→8) and that
    /// stageResults accumulates all five WON stages.
    func testGauntletFullRunReachesWon() {
        var state = createInitialState(seed: "gauntlet-run-test", mode: .gauntlet)
        let expectedBoardCounts = [1, 4, 4, 4, 8]
        var stagesPlayed = 0

        while state.status == .playing && stagesPlayed < 6 {
            let stageIdx = state.gauntlet?.currentStage ?? -1
            if stageIdx >= 0 && stageIdx < expectedBoardCounts.count {
                XCTAssertEqual(state.boards.count, expectedBoardCounts[stageIdx], "Stage \(stageIdx) board count")
            }
            // Solve every board by submitting each one's solution (applyToAll
            // solves the matching board; others just consume a row).
            let solutions = Set(state.boards.map { $0.solution })
            for sol in solutions {
                if state.boards.allSatisfy({ $0.status == .won }) { break }
                state = gameReducer(state: state, action: .submitGuess(guess: sol, boardIndex: nil, applyToAll: true))
            }
            XCTAssertTrue(state.boards.allSatisfy { $0.status == .won },
                          "All boards should be solved in stage \(stagesPlayed)")
            // Advance / finish.
            state = gameReducer(state: state, action: .nextStage(elapsedMs: nil))
            stagesPlayed += 1
        }

        XCTAssertEqual(state.status, .won)
        XCTAssertEqual(stagesPlayed, 5)
        XCTAssertEqual(state.gauntlet?.stageResults.count, 5)
        XCTAssertTrue(state.gauntlet?.stageResults.allSatisfy { $0.status == .won } ?? false)
    }
}
