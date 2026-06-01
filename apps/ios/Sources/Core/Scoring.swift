import Foundation

public func calculateScore(_ result: MatchResult) -> ScoreBreakdown {
    var winBonus = 0
    var guessDiff = 0
    var timeDiff = 0
    var dnfPenalty = 0

    if result.playerStatus == .won && result.opponentStatus != .won {
        winBonus = 10
    } else if result.playerStatus != .won && result.opponentStatus == .won {
        winBonus = -10
    }

    if result.playerStatus == .won && result.opponentStatus == .won {
        guessDiff = (result.opponentGuesses - result.playerGuesses) * 2
    }

    if result.playerStatus == .won && result.opponentStatus == .won {
        let timeDiffSeconds = (result.opponentTime - result.playerTime) / 1000.0
        let timeDiffPoints = Int(timeDiffSeconds / 5.0)
        timeDiff = max(-10, min(10, timeDiffPoints))
    }

    if result.playerStatus == .lost || result.playerStatus == .abandoned {
        dnfPenalty = -10
    } else if result.opponentStatus == .lost || result.opponentStatus == .abandoned {
        dnfPenalty = 10
    }

    let total = winBonus + guessDiff + timeDiff + dnfPenalty

    return ScoreBreakdown(
        winBonus: winBonus,
        guessDiff: guessDiff,
        timeDiff: timeDiff,
        dnfPenalty: dnfPenalty,
        total: total
    )
}
