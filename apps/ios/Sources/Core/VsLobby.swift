import Foundation

/// VS lobby rules (founder-approved VS overhaul, 2026-10-01; spec
/// docs/VS_REDESIGN_SPEC.md) — 1:1 port of packages/core/src/vs-lobby.ts. The
/// VS page gets the home banner's shape: a frosted headline strip over TODAY
/// (the Daily Battle and the Bot of the Day) and RECORD (people, bots, the
/// ladder). Async friend challenges ("race my run") are scored with the same
/// rule as a live match.
///
/// Pure so web, iOS and Android read the SAME words and reach the SAME
/// outcomes; pinned by vs-lobby-fixtures.json (packages/core/scripts/gen-parity-fixtures.ts).

/// One of today's two battles: not played yet, or its result.
public enum VsDayResult: String, Codable, Equatable {
    case open, won, lost, draw
}

/// Who won a VS game, from one player's side.
public enum VsOutcome: String, Codable, Equatable {
    case win, loss, draw
}

public struct VsBannerInput: Equatable {
    /// The player's username; empty for none.
    public var name: String
    /// Today's Daily Battle (a person, or the bot that stepped in).
    public var battle: VsDayResult
    /// Today's Bot of the Day.
    public var botOfDay: VsDayResult
    /// Username of the newest open challenge sent to the player, if any.
    public var incomingFrom: String?
    /// Current bot win streak (the same progression store Stats reads).
    public var streak: Int
    public init(name: String, battle: VsDayResult, botOfDay: VsDayResult, incomingFrom: String? = nil, streak: Int) {
        self.name = name; self.battle = battle; self.botOfDay = botOfDay; self.incomingFrom = incomingFrom; self.streak = streak
    }
}

public struct WinLoss: Codable, Equatable {
    public var wins: Int
    public var losses: Int
    public init(wins: Int, losses: Int) { self.wins = wins; self.losses = losses }
}

/// One side of a VS game: the same numbers a live match compares.
public struct VsRun: Codable, Equatable {
    public var solved: Bool
    public var boardsSolved: Int
    /// Guess count (the VS score unit).
    public var guesses: Int
    public var timeMs: Int
    public init(solved: Bool, boardsSolved: Int, guesses: Int, timeMs: Int) {
        self.solved = solved; self.boardsSolved = boardsSolved; self.guesses = guesses; self.timeMs = timeMs
    }
}

public struct BotLadderState: Codable, Equatable {
    /// Rungs cleared, 0–10 (the cast ladder, BotCast.ladderIds).
    public var cleared: Int
    /// Current wins in a row against the next bot (VsLobby.ladderBots[cleared]).
    public var run: Int
    public init(cleared: Int, run: Int) { self.cleared = cleared; self.run = run }
}

public enum RungState: String, Codable, Equatable {
    case cleared, next, locked
}

public struct LadderRung: Codable, Equatable {
    public var id: String
    public var state: RungState
    public var line: String
    public init(id: String, state: RungState, line: String) { self.id = id; self.state = state; self.line = line }
}

public enum VsLobby {
    /// The nine VS modes in lobby-strip order (db keys).
    public static let modeOrder = ["DUEL", "DUEL_6", "DUEL_7", "QUORDLE", "OCTORDLE", "SEQUENCE", "RESCUE", "GAUNTLET", "PROPERNOUNDLE"]

    private static func upper(_ s: String) -> String {
        s.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
    }

    private static func hasIncoming(_ i: VsBannerInput) -> Bool {
        guard let from = i.incomingFrom else { return false }
        return !from.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private static func doneCount(_ battle: VsDayResult, _ botOfDay: VsDayResult) -> Int {
        (battle != .open ? 1 : 0) + (botOfDay != .open ? 1 : 0)
    }

    /// Both of today's battles won: the banner turns gold.
    public static func vsSweep(battle: VsDayResult, botOfDay: VsDayResult) -> Bool {
        battle == .won && botOfDay == .won
    }

    /// The VS banner headline, always upper case. An open challenge leads; then a
    /// VS sweep; then a hot streak; then today's own news; then a greeting.
    public static func vsBannerHeadline(_ i: VsBannerInput) -> String {
        if hasIncoming(i) { return "\(upper(i.incomingFrom ?? "")) CHALLENGED YOU!" }
        if vsSweep(battle: i.battle, botOfDay: i.botOfDay) { return "VS SWEEP!" }
        if i.streak >= 3 { return "ON A ROLL · \(i.streak) WINS IN A ROW" }
        if i.battle == .won { return "DAILY BATTLE WON!" }
        if i.botOfDay == .won { return "BOT OF THE DAY BEATEN!" }
        if i.battle != .open || i.botOfDay != .open { return "BACK FOR MORE?" }
        let name = upper(i.name)
        return name.isEmpty ? "READY TO RACE?" : "READY TO RACE, \(name)?"
    }

    /// The line under the headline. `clock` is the HH:MM:SS countdown to the next
    /// UTC midnight (the Daily Battle and Bot of the Day are UTC-seeded);
    /// `challengeLeft` is the open challenge's time left, e.g. "17H".
    public static func vsBannerClockLine(_ i: VsBannerInput, clock: String, free: Bool = false, challengeLeft: String? = nil) -> String {
        if hasIncoming(i) {
            return "RACE \(upper(i.incomingFrom ?? ""))’S RUN · \(challengeLeft ?? "24H") LEFT"
        }
        let done = doneCount(i.battle, i.botOfDay)
        if done == 2 { return "NEW BATTLES IN \(clock)" }
        if done == 0 {
            return free ? "TWO FREE BATTLES A DAY · RESET IN \(clock)" : "DAILY BATTLE + BOT OF THE DAY · RESET IN \(clock)"
        }
        return "RESETS IN \(clock)"
    }

    /// The TODAY row's status: "0/2", "1/2", "2/2", or "SWEEP · 2/2 WON".
    public static func vsTodayStatus(battle: VsDayResult, botOfDay: VsDayResult) -> String {
        if vsSweep(battle: battle, botOfDay: botOfDay) { return "SWEEP · 2/2 WON" }
        return "\(doneCount(battle, botOfDay))/2"
    }

    /// The RECORD row: "PEOPLE 12–7 · BOTS 31–9 · LADDER 2/4". People and bots are
    /// summed exactly like the Stats page's VS section (user_stats play_type 'vs'
    /// and 'vs_cpu'), so the two can never disagree. The ladder is left out when
    /// `ladder` is nil (free players).
    public static func vsRecordLine(people: WinLoss, bots: WinLoss, ladder: Int?) -> String {
        var parts = ["PEOPLE \(people.wins)–\(people.losses)", "BOTS \(bots.wins)–\(bots.losses)"]
        if let ladder {
            parts.append(ladder >= ladderBots.count ? "LADDER CLEARED" : "LADDER \(ladder)/\(ladderBots.count)")
        }
        return parts.joined(separator: " · ")
    }

    // MARK: - Async challenges ("race my run")

    /// 45 seconds of speed is worth one guess (apps/server endMatch).
    public static let timeWeightS: Double = 45

    private static func composite(_ r: VsRun) -> Double {
        Double(r.guesses) + Double(r.timeMs) / 1000 / timeWeightS
    }

    /// Who won, from `me`'s side. Mirrors the live server: a solve beats no solve;
    /// two solves compare boards, then guesses + time/45s (within 0.01 is a draw).
    /// Two failed runs (the live server scores both as losses) compare boards
    /// solved, and are otherwise a draw.
    public static func vsOutcome(_ me: VsRun, _ them: VsRun) -> VsOutcome {
        if me.solved != them.solved { return me.solved ? .win : .loss }
        if me.boardsSolved != them.boardsSolved { return me.boardsSolved > them.boardsSolved ? .win : .loss }
        if !me.solved { return .draw }
        let a = composite(me), b = composite(them)
        if abs(a - b) < 0.01 { return .draw }
        return a < b ? .win : .loss
    }

    /// "1:05" from milliseconds (whole seconds, rounded).
    public static func vsClock(_ ms: Int) -> String {
        // JS Math.round: halves round up (toward +∞).
        let s = max(0, Int((Double(ms) / 1000 + 0.5).rounded(.down)))
        return "\(s / 60):\(String(format: "%02d", s % 60))"
    }

    /// What decided it, from the winner's side: "ONLY ONE SOLVE", "2 MORE BOARDS",
    /// "1 FEWER GUESS", "FASTER BY 0:12"; a draw reads "DEAD EVEN".
    public static func vsMargin(_ me: VsRun, _ them: VsRun) -> String {
        let out = vsOutcome(me, them)
        if out == .draw { return "DEAD EVEN" }
        let (w, l) = out == .win ? (me, them) : (them, me)
        if w.solved != l.solved { return "ONLY ONE SOLVE" }
        if w.boardsSolved != l.boardsSolved {
            let d = w.boardsSolved - l.boardsSolved
            return "\(d) MORE \(d == 1 ? "BOARD" : "BOARDS")"
        }
        if w.guesses < l.guesses {
            let d = l.guesses - w.guesses
            return "\(d) FEWER \(d == 1 ? "GUESS" : "GUESSES")"
        }
        return "FASTER BY \(vsClock(l.timeMs - w.timeMs))"
    }

    /// The challenge result headline: "YOU BEAT DOUG’S RUN!" / "DOUG’S RUN HELD!" / "DEAD HEAT WITH DOUG!".
    public static func challengeHeadline(_ outcome: VsOutcome, from: String) -> String {
        let u = upper(from)
        let n = u.isEmpty ? "THEIR" : u
        switch outcome {
        case .win: return "YOU BEAT \(n)’S RUN!"
        case .loss: return "\(n)’S RUN HELD!"
        case .draw: return "DEAD HEAT WITH \(n)!"
        }
    }

    // MARK: - The bot ladder

    /// Ladder order (FINISH_SPEC §D1): the ten cast bots, Rip (easy) → … → Webster (the boss).
    public static let ladderBots = BotCast.ladderIds
    /// Wins in a row against the next bot that clear its rung.
    public static let ladderClearRun = 3

    /// Fold one finished bot game into the ladder. Only games against the NEXT
    /// bot count: a win adds to the run (three clear the rung), a loss resets the
    /// run. Games against other bots (or the Bot of the Day / Beat your best)
    /// leave the ladder alone.
    public static func ladderAfterGame(_ s: BotLadderState, botId: String, won: Bool) -> BotLadderState {
        if s.cleared >= ladderBots.count { return BotLadderState(cleared: ladderBots.count, run: 0) }
        // Old ids (rook / lexi / nova / adapt) count as their cast rung (core canonicalBotId).
        if s.cleared < 0 || BotCast.canonicalId(botId) != ladderBots[s.cleared] { return s }
        if !won { return BotLadderState(cleared: s.cleared, run: 0) }
        let run = s.run + 1
        return run >= ladderClearRun ? BotLadderState(cleared: s.cleared + 1, run: 0) : BotLadderState(cleared: s.cleared, run: run)
    }

    /// "rip" → "Rip" (the cast name; any other id is capitalized).
    public static func botName(_ id: String) -> String {
        if let m = BotCast.members.first(where: { $0.id == id }) { return m.name }
        return id.prefix(1).uppercased() + id.dropFirst()
    }

    /// Each rung's state and its line ("Cleared", "Win 3 in a row to clear · 1 so far", "Clear Rip to unlock").
    public static func ladderRungs(_ s: BotLadderState) -> [LadderRung] {
        ladderBots.enumerated().map { i, id in
            if i < s.cleared { return LadderRung(id: id, state: .cleared, line: "Cleared") }
            if i == s.cleared { return LadderRung(id: id, state: .next, line: "Win \(ladderClearRun) in a row to clear · \(s.run) so far") }
            return LadderRung(id: id, state: .locked, line: "Clear \(botName(ladderBots[i - 1])) to unlock")
        }
    }
}
