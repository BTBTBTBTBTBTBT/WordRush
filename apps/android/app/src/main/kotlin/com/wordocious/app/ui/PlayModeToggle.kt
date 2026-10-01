package com.wordocious.app.ui

/**
 * Pro's Daily/Unlimited dimension. Unlimited flips the whole home screen: mode
 * cards route to fresh-seeded (non-daily) puzzles and never show the daily-limit
 * lock (Pro bypasses caps; the seed difference lands a new puzzle each tap).
 * Home redesign (founder, 2026-10-01): the switch lives in the banner's frosted
 * strip (HomeBanner's DAILY | UNLIMITED segments); the old pill and the
 * Unlimited hero are gone.
 */
enum class PlayMode { DAILY, UNLIMITED }
