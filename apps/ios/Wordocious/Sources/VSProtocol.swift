import Foundation
import WordociousCore

/// Wire models for the VS socket.io protocol. 1:1 with apps/server/src/types.ts
/// (ClientToServerEvents / ServerToClientEvents). socket.io delivers each event
/// payload as a JSON object; these encode/decode that payload.
enum VSEvent {
    // Client → server event names
    static let joinQueue = "join_queue"
    static let leaveQueue = "leave_queue"
    static let submitGuess = "submit_guess"
    static let boardSolved = "board_solved"
    static let playerCompleted = "player_completed"
    static let stageCompleted = "stage_completed"
    static let abandonMatch = "abandon_match"
    // Rematch: the server starts the rematch once BOTH players emit
    // `offer_rematch` (there is no `accept_rematch` handler) — so "accept"
    // re-emits offer_rematch rather than a distinct event.
    static let offerRematch = "offer_rematch"
    static let declineRematch = "decline_rematch"
    /// Throttled "I have letters in my row" activity ping — relayed to the opponent.
    static let typing = "typing"

    // Server → client event names
    static let queueStatus = "queue_status"
    static let matchFound = "match_found"
    static let matchStart = "match_start"
    static let guessResult = "guess_result"
    static let opponentProgress = "opponent_progress"
    static let matchEnded = "match_ended"
    static let opponentStageCompleted = "opponent_stage_completed"
    static let rematchOffered = "rematch_offered"
    static let rematchDeclined = "rematch_declined"
    static let rematchStart = "rematch_start"
    static let opponentLeft = "opponent_left"
    /// Opponent activity ping (no letters) — drives the "typing…" indicator.
    static let opponentTyping = "opponent_typing"
    static let error = "error"
}

// MARK: - Server → client payloads

struct VSQueueStatus: Codable {
    let position: Int
    let mode: String
    /// Total players waiting in this queue bucket (newer servers only).
    let queueSize: Int?
}

struct VSMatchFound: Codable {
    let matchId: String
    let mode: String
    let serverStartAt: Double      // unix ms
    let countdownSeconds: Double
    /// Opponent's Supabase user id (from presenceId `u:<id>`), or nil if anonymous.
    let opponentUserId: String?
}

struct VSPuzzleMetadata: Codable {
    let display: String?
    let category: String?
    let answerLength: Int?
    let themeCategory: String?
}

struct VSMatchStart: Codable {
    let seed: String
    let startTime: Double          // unix ms
    let puzzleMetadata: VSPuzzleMetadata?
}

struct VSGuessResult: Codable {
    let boardIndex: Int
    let isValid: Bool
    let isCorrect: Bool
    let reason: String?
}

struct VSOpponentLatestGuess: Codable {
    let boardIndex: Int
    let tiles: [String]            // "CORRECT" | "PRESENT" | "ABSENT"
}

struct VSOpponentProgress: Codable {
    let attempts: Int
    let solved: Bool
    let boardsSolved: Int
    let totalBoards: Int
    let latestGuess: VSOpponentLatestGuess?
}

struct VSMatchEnded: Codable {
    let winner: String?            // "player" | "opponent" | "draw" | null
    let playerGuesses: Int
    let opponentGuesses: Int
    let playerTime: Double         // ms
    let opponentTime: Double
    let playerScore: Double
    let opponentScore: Double
    /// Opponent's Supabase user id (nil if anonymous) — lets this client write a
    /// VS match-history row so the battle shows in Recent Matches.
    let opponentId: String?
    /// True only for the designated single writer (player1) so exactly one row
    /// is created per match. Optional for backward-compat with older servers.
    let recordMatch: Bool?
    /// True when the match ended by the opponent disconnecting/abandoning (a
    /// forfeit win for the remaining player). Powers the "FORFEIT" Recent-Matches tag.
    let forfeit: Bool?
    /// Opponent's full ordered guess words (+ board index) — letters are only
    /// revealed at match end so the result screen can render their final board.
    let opponentGuessLog: [VSGuessLogEntry]?
    /// The match solutions, so the result screen can render both final boards.
    let solutions: [String]?
}

/// One guess-word entry (mine, mirrored locally, or the opponent's from
/// match_ended) — the wire shape of OpponentGuessLogEntry on the web.
struct VSGuessLogEntry: Codable {
    let boardIndex: Int
    let guess: String
}

struct VSRematchStart: Codable {
    let matchId: String
    let seed: String
    let puzzleMetadata: VSPuzzleMetadata?
}

struct VSStageEvent: Codable { let stageIndex: Int }
struct VSServerError: Codable { let message: String }

// MARK: - Helpers

extension VSOpponentLatestGuess {
    /// Map the wire tile strings to engine TileState (ignores unknown values).
    var tileStates: [TileState] {
        tiles.map { TileState(rawValue: $0) ?? .empty }
    }
}
