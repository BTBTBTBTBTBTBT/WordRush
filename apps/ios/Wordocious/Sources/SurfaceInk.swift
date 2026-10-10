import SwiftUI

/// Founder 10-10 (season readability): one place to ask "is the surface this text sits on dark?". That is the dark
/// theme OR a dark season's night cards (Halloween). `Theme.isDark` already follows a dark season's tone
/// (`ThemeManager.isDark`), and `FriendsInk.dark` is the season-only flag; either one means a dark card, so ink picked
/// for a card must key off this, never off a fixed light-theme hex. Backgrounds stay with their own helpers; this is
/// ink only.
enum SurfaceInk {
    static var surfaceDark: Bool { Theme.isDark || FriendsInk.dark }

    /// `light` on a light surface, `night` on a dark one (dark theme and the season's night cards alike).
    static func ink(light: Color, night: Color) -> Color { surfaceDark ? night : light }

    /// Hex convenience for the common fixed-ink pair.
    static func ink(light: UInt, night: UInt) -> Color { Color(hex: surfaceDark ? night : light) }

    /// For the light-only pages (Friends, VS, the pocket games): their cards stay light in the dark THEME and only go night
    /// under a dark SEASON, so their inks key off the season alone (`FriendsInk.dark`), never `Theme.isDark`.
    static func seasonInk(light: UInt, night: UInt) -> Color { Color(hex: FriendsInk.dark ? night : light) }
}
