package com.wordocious.core

/**
 * VS match score breakdown — mirrors `apps/ios/Sources/Core/Scoring.swift`
 * (`calculateScore`) and `packages/core` scoring. Time truncation toward zero
 * matches Swift `Int(Double)` / JS `Math.trunc` via Kotlin `Double.toInt()`.
 */
fun calculateScore(result: MatchResult): ScoreBreakdown {
    var winBonus = 0
    var guessDiff = 0
    var timeDiff = 0
    var dnfPenalty = 0

    if (result.playerStatus == GameStatus.WON && result.opponentStatus != GameStatus.WON) {
        winBonus = 10
    } else if (result.playerStatus != GameStatus.WON && result.opponentStatus == GameStatus.WON) {
        winBonus = -10
    }

    if (result.playerStatus == GameStatus.WON && result.opponentStatus == GameStatus.WON) {
        guessDiff = (result.opponentGuesses - result.playerGuesses) * 2
        val timeDiffSeconds = (result.opponentTime - result.playerTime) / 1000.0
        val timeDiffPoints = (timeDiffSeconds / 5.0).toInt() // truncates toward zero
        timeDiff = maxOf(-10, minOf(10, timeDiffPoints))
    }

    if (result.playerStatus == GameStatus.LOST || result.playerStatus == GameStatus.ABANDONED) {
        dnfPenalty = -10
    } else if (result.opponentStatus == GameStatus.LOST || result.opponentStatus == GameStatus.ABANDONED) {
        dnfPenalty = 10
    }

    val total = winBonus + guessDiff + timeDiff + dnfPenalty
    return ScoreBreakdown(winBonus, guessDiff, timeDiff, dnfPenalty, total)
}
