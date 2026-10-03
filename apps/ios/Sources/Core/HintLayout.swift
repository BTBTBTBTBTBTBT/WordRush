import Foundation

/// FINISH_SPEC §BI22: hints and feedback never resize or move the board. A hint's
/// result (a named category, a clue, a "Starts with…" chip) or a feedback toast
/// lives in an overlay or in a slot that is ALWAYS reserved — so the board's size
/// is a function of the screen and the game's progress, never of the hints shown.
/// (Founder 10-02: "hitting the hint button caused one of the puzzle games to
/// shrink a bit" — Kindred's grid shrank when "Name a category" added its chip row.)
public enum HintLayout {
    /// Kindred's tile height for the band between the header and the pinned controls.
    /// The named-category chip row's slot is always reserved, so `revealedCategories`
    /// (kept in the signature on purpose) never changes the result.
    public static func kindredTileHeight(band: Double, tiles: Int, solvedBars: Int,
                                         revealedCategories: Int, trayLip: Double) -> Double {
        _ = revealedCategories
        let rows = Double(max(1, (tiles + 3) / 4))
        // The rail, the solved bars, the stack's gaps, the tray's padding + lip and the
        // always-present category slot.
        let reserved = kindredRailHeight + Double(solvedBars) * (kindredBarHeight + 6) + 8 * 3 + 8 * 2 + trayLip
            + kindredChipSlotHeight + 8
        let cell = ((band - reserved) / rows).rounded(.down) - 6
        return min(kindredTileMax, max(kindredTileMin, cell))
    }

    public static let kindredRailHeight: Double = 20      // progress rail row
    public static let kindredBarHeight: Double = 58       // one solved-group bar (label + words)
    /// The Name-a-category chips row: one line of chips, always reserved.
    public static let kindredChipSlotHeight: Double = 26
    public static let kindredTileMin: Double = 56, kindredTileMax: Double = 92

    /// The used-count on a hint / check button's gold corner badge (web
    /// lib/hint-layout.ts `hintCountText` parity): empty at 0 (no badge), the count,
    /// or "99+". The label itself never carries the count, so it never widens.
    public static func countText(_ count: Int) -> String {
        guard count > 0 else { return "" }
        return count > 99 ? "99+" : String(count)
    }

    /// ProperNoundle's clue slot: always two lines tall (empty until the Clue hint
    /// lands); a longer clue is clamped and opens in full on tap.
    public static let noundleClueLines = 2
}
