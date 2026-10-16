package com.wordocious.core

import java.time.LocalDateTime
import java.time.LocalTime

/**
 * Time of day (founder 10-16, docs/design/brand/seasons/time-of-day/NOTES.md v2): while a season shows, its wall, Home stage
 * and window surfaces follow the device's LOCAL clock in four slots. Mirrors core `timeOfDay` / `nextTimeOfDayChange`
 * (time-of-day-fixtures.json pins it): morning 5-10, day 10-16, evening 16-19, night 19-5.
 */
enum class TimeOfDay(val id: String) {
    Morning("morning"), Day("day"), Evening("evening"), Night("night");

    companion object {
        /** The slot boundaries (local hours), in clock order from dawn. */
        val starts: List<Pair<TimeOfDay, Int>> = listOf(Morning to 5, Day to 10, Evening to 16, Night to 19)

        /** The slot cross-fade (walls, stage and window colors share this curve), ms. */
        const val FADE_MS = 600

        fun fromId(id: String?): TimeOfDay? = entries.firstOrNull { it.id == id }

        /** The slot for a local clock hour (0-23; fractional hours and out-of-range values wrap into a day). */
        fun at(hour: Double): TimeOfDay {
            var h = hour % 24.0
            if (h < 0) h += 24.0
            return when {
                h >= 19 || h < 5 -> Night
                h >= 16 -> Evening
                h >= 10 -> Day
                else -> Morning
            }
        }

        fun at(now: LocalDateTime): TimeOfDay = at(now.hour + now.minute / 60.0)

        /** The next local instant (strictly after [now]) at which the slot changes: 05:00, 10:00, 16:00 or 19:00. */
        fun nextChange(now: LocalDateTime): LocalDateTime {
            for ((_, h) in starts) {
                val t = now.toLocalDate().atTime(LocalTime.of(h, 0))
                if (t.isAfter(now)) return t
            }
            return now.toLocalDate().plusDays(1).atTime(LocalTime.of(starts[0].second, 0))
        }
    }
}
