import XCTest
@testable import WordociousCore

/// Season readability (WCAG AA: 4.5:1 text, 3:1 large text / non-text UI) for EVERY season in
/// the registry (Wordocious/Resources/season-registry.json, the bundle copy SeasonKit reads), on
/// the surfaces the iOS app really paints each season ink on. The math mirrors the app files
/// named per test (SeasonKit.Look, ThemeManager, TintedCard / GameCardChrome, HomeBannerView,
/// RootTabView, FamilyButtons); SeasonKit lives in the app target, so the registry is decoded
/// here. The wall behind a translucent card is art, so it is checked over the darkest and the
/// lightest wall stop (wallDark; wallLight too when the tone is light).
final class SeasonContrastTests: XCTestCase {
    private static let app = URL(fileURLWithPath: #filePath)
        .deletingLastPathComponent().deletingLastPathComponent().appendingPathComponent("Wordocious")

    private struct Palette: Decodable {
        let buttonTint: String
        let quietTint: String
        let wallLight: [String]
        let wallDark: [String]
    }
    private struct Surfaces: Decodable {
        let tone: String?
        let card: String?
        let cardOpacity: Double?
        let hero: String?
        let heroOpacity: Double?
        let raised: String?
        let text: String?
        let textMuted: String?
        let textSecondary: String?
        let headline: [String]?
    }
    private struct Entry: Decodable { let id: String; let palette: Palette; let surfaces: Surfaces? }
    private struct File: Decodable { let seasons: [Entry] }

    /// One season resolved the way SeasonKit.Look + ThemeManager.current do it: a missing ink
    /// keeps the base palette's (ThemeManager "dark" / "default"), a missing card keeps the
    /// normal look (nil = nothing season-colored to check).
    private struct Look {
        let id: String
        let dark: Bool
        let walls: [UInt32]
        let card: UInt32?
        let cardOpacity: Double
        let hero: UInt32?
        let heroOpacity: Double
        let raised: UInt32?
        let text: UInt32
        let textMuted: UInt32
        let textSecondary: UInt32
        let headline: [UInt32]?
        let buttonTint: UInt32
        let quietTint: UInt32
        let hasSurfaces: Bool

        var inks: [(String, UInt32)] { [("text", text), ("textSecondary", textSecondary), ("textMuted", textMuted)] }
        /// SeasonKit.Look.cardFill composited over each wall stop.
        var cardOverWalls: [UInt32] {
            guard let card else { return [] }
            return walls.map { InkContrast.mix(card, over: $0, cardOpacity) }
        }
        /// Look.heroFill (hero ?? card) composited over each wall stop.
        var heroOverWalls: [UInt32] {
            guard let fill = hero ?? card else { return [] }
            let k = hero != nil ? heroOpacity : cardOpacity
            return walls.map { InkContrast.mix(fill, over: $0, k) }
        }
    }

    private static func hex(_ s: String) -> UInt32 { UInt32(s.dropFirst(), radix: 16) ?? 0 }
    private static func label(_ v: UInt32) -> String { String(format: "#%06X", v) }

    private static func looks() throws -> [Look] {
        let data = try Data(contentsOf: app.appendingPathComponent("Resources/season-registry.json"))
        return try JSONDecoder().decode(File.self, from: data).seasons.map { e -> Look in
            let s = e.surfaces
            let dark = s?.tone == "dark"
            // Every wall stop the season can paint; keep the darkest and the lightest.
            let stops = (e.palette.wallDark + (dark ? [] : e.palette.wallLight)).map(hex)
                .sorted { InkContrast.luminance($0) < InkContrast.luminance($1) }
            let walls = [stops.first, stops.last].compactMap { $0 }
            // ThemeManager "dark" / "default" inks (textPrimary, textMuted, textSecondary).
            let base: (UInt32, UInt32, UInt32) = dark ? (0xF0EEF6, 0x9CA3AF, 0xA0A0B8) : (0x1A1A2E, 0x9CA3AF, 0x6B7280)
            let headline = (s?.headline ?? []).map(hex)
            return Look(
                id: e.id, dark: dark, walls: walls,
                card: s?.card.map(hex), cardOpacity: s?.cardOpacity ?? 1,
                hero: s?.hero.map(hex), heroOpacity: s?.heroOpacity ?? 1,
                raised: s?.raised.map(hex),
                text: s?.text.map(hex) ?? base.0, textMuted: s?.textMuted.map(hex) ?? base.1,
                textSecondary: s?.textSecondary.map(hex) ?? base.2,
                headline: headline.count == 5 ? headline : nil,
                buttonTint: hex(e.palette.buttonTint), quietTint: hex(e.palette.quietTint),
                hasSurfaces: s != nil)
        }
    }

    /// The catalog's game accents (the app-target ModeCatalog.generated.swift, read as text):
    /// (accent, daily) — only a daily game card can show the finished wash.
    private static func gameAccents() throws -> [(UInt32, Bool)] {
        let src = try String(contentsOf: app.appendingPathComponent("Sources/ModeCatalog.generated.swift"), encoding: .utf8)
        return src.components(separatedBy: "\n").filter { $0.contains("GenMode(id:") }.compactMap { line -> (UInt32, Bool)? in
            guard let r = line.range(of: "accentHex: \"#") else { return nil }
            let accent = UInt32(line[r.upperBound...].prefix(6), radix: 16)
            return accent.map { ($0, line.contains("dailyEligible: true")) }
        }
    }

    /// The page accents a TintedCard washes with (InkContrastTests' list).
    private static let pageAccents: [UInt32] = [0x7C3AED, 0xEC4899, 0xF5A524, 0x2563EB, 0x0D9488, 0xF97316, 0x6366F1]

    private func expect(_ ink: UInt32, on bg: UInt32, _ min: Double, _ what: String,
                        file: StaticString = #filePath, line: UInt = #line) {
        let r = InkContrast.ratio(ink, bg)
        XCTAssertGreaterThanOrEqual(r, min, "\(what): \(Self.label(ink)) on \(Self.label(bg)) is \(String(format: "%.2f", r)):1, needs \(min)",
                                    file: file, line: line)
    }

    func testRegistryDecodes() throws {
        let looks = try Self.looks()
        XCTAssertFalse(looks.isEmpty)
        for l in looks { XCTAssertFalse(l.walls.isEmpty, l.id) }
        XCTAssertGreaterThan(try Self.gameAccents().count, 10)
    }

    /// Page cards (TintedCard: the season card over the wall + the page accent at 7% / 5% on a
    /// light tone) and the opaque card (ThemePalette.surface: sheets; the VS + Friends night
    /// pages, VsLobbyKit.page / FriendsInk) under the on-card inks.
    func testOnCardInksOnTheSeasonCard() throws {
        for l in try Self.looks() where l.card != nil {
            let wash = l.dark ? 0.07 : 0.05
            var bgs = l.cardOverWalls + [l.card!]
            for c in l.cardOverWalls { bgs += Self.pageAccents.map { InkContrast.mix($0, over: c, wash) } }
            for bg in bgs {
                for (n, ink) in l.inks { expect(ink, on: bg, 4.5, "\(l.id) \(n) on the card") }
            }
        }
    }

    /// Chips inside cards (ThemePalette.surfaceAlt / surfaceHover = raised, opaque).
    func testOnCardInksOnRaisedChips() throws {
        for l in try Self.looks() {
            guard let raised = l.raised else { continue }
            for (n, ink) in l.inks { expect(ink, on: raised, 4.5, "\(l.id) \(n) on raised") }
        }
    }

    /// The Home hero (HomeBannerView): the clock line (subInk = textSecondary) on the hero fill,
    /// the WORDOCIOUS / PUZZLES row labels (tierInk(.none) = textSecondary) on the rows band
    /// (raised at 45% dark / 50% light over the hero), and the greeting lettering's fills
    /// (headline top, bottom, nameTop, nameBottom; 38 pt = large text) on the hero fill.
    func testHeroInks() throws {
        for l in try Self.looks() {
            for hero in l.heroOverWalls {
                expect(l.textSecondary, on: hero, 4.5, "\(l.id) hero clock line")
                if let raised = l.raised {
                    let band = InkContrast.mix(raised, over: hero, l.dark ? 0.45 : 0.5)
                    expect(l.textSecondary, on: band, 4.5, "\(l.id) hero row label")
                }
                if let h = l.headline {
                    for i in [0, 1, 3, 4] { expect(h[i], on: hero, 3, "\(l.id) headline[\(i)] on the hero") }
                }
            }
        }
    }

    /// The Home game cards (GameCardChrome + ModeCardView): the game color at 5% (unplayed) /
    /// 38% (a finished daily; light tone 8% / 16%) over the season card; the name in
    /// `accent.onSeasonCard` (55% over white on a dark tone) and the subtitle in textMuted.
    func testGameCardInks() throws {
        let games = try Self.gameAccents()
        for l in try Self.looks() where l.card != nil {
            for (accent, daily) in games {
                let title = l.dark ? InkContrast.mix(accent, over: 0xFFFFFF, 0.55) : accent
                let washes = l.dark ? (daily ? [0.05, 0.355] : [0.05]) : (daily ? [0.08, 0.16] : [0.08])
                for c in l.cardOverWalls {
                    for w in washes {
                        let bg = InkContrast.mix(accent, over: c, w)
                        let what = "\(l.id) game \(Self.label(accent)) at \(w)"
                        expect(l.textMuted, on: bg, 4.5, "\(what) subtitle")
                        expect(title, on: bg, 4.5, "\(what) name")
                    }
                }
            }
        }
    }

    /// The tab bar (RootTabView): the season's opaque bar (raised -> card); the selected label
    /// #FDBA74 and its #F97316 underline pill (fixed while a season card is on); unselected
    /// labels in textMuted on a dark tone, the fixed #8A78AD on a light one.
    func testTabBarInks() throws {
        for l in try Self.looks() {
            guard let card = l.card else { continue }
            for bg in [l.raised ?? card, card] {
                expect(0xFDBA74, on: bg, 4.5, "\(l.id) selected tab label")
                expect(0xF97316, on: bg, 3, "\(l.id) selected tab underline")
                expect(l.dark ? l.textMuted : 0x8A78AD, on: bg, 4.5, "\(l.id) tab label")
            }
        }
    }

    /// The helper pill (buttonTint) and the quiet pill (quietTint), FamilyInk: a dark scheme
    /// takes the white-65% ink on the tint at 34% (42% pressed) over #231C40; a light one the
    /// black-32% ink on the tint at 20% (27%) over white. The scheme follows the season's tone
    /// (ThemeManager.colorScheme); without surfaces it follows the player's theme (both).
    func testHelperAndQuietPills() throws {
        for l in try Self.looks() {
            let schemes = l.hasSurfaces ? [l.dark] : [true, false]
            for dark in schemes {
                for (n, tint) in [("buttonTint", l.buttonTint), ("quietTint", l.quietTint)] {
                    let ink = dark ? InkContrast.mix(0xFFFFFF, over: tint, 0.65) : InkContrast.mix(0x000000, over: tint, 0.32)
                    for pressed in [false, true] {
                        let fill = dark ? InkContrast.mix(tint, over: 0x231C40, pressed ? 0.42 : 0.34)
                                        : InkContrast.mix(tint, over: 0xFFFFFF, pressed ? 0.27 : 0.20)
                        expect(ink, on: fill, 4.5, "\(l.id) \(n) pill label\(pressed ? " (pressed)" : "")")
                    }
                }
            }
        }
    }

    // MARK: Wave 5 — the wave-3 surfaces under a dark season (Halloween)

    /// The pocket-game / Friends accents (FriendsKit.tileAccent for rps, ttt, coin, pass, ghost, chain) + the Friends pink / amber.
    private static let pocketAccents: [UInt32] = [0xF97316, 0x7C3AED, 0xEAB308, 0x0EA5E9, 0x8B5CF6, 0x10B981, 0xEC4899, 0xF59E0B]

    /// Friends cards (FriendCardsView): the friend card is the season card, its game tiles `accent.vsWash(0.14)` (quiet
    /// 0.07 at 85% opacity) = the accent at 1.8x over the OPAQUE card (Color.vsWash under a dark season), with the
    /// heading / rowSub inks (FriendsInk -> the season's text / textMuted); the presence line in FriendsKit.green and the
    /// bannerHead / bannerLabel inks on the card. Waiting room (WaitingRoomView): numberInk / mutedInk = text / textMuted,
    /// the teal lobby ink, on the season card.
    func testFriendCardsAndWaitingRoomUnderTheDarkSeason() throws {
        for l in try Self.looks() where l.dark && l.card != nil {
            let card = l.card!
            for base in l.cardOverWalls + [card] {
                expect(0x10B981, on: base, 4.5, "\(l.id) presence green on the card")
                expect(0x2DD4BF, on: base, 4.5, "\(l.id) waiting-room teal on the card")
                expect(0xFBCFE8, on: base, 4.5, "\(l.id) bannerHead on the card")
                expect(0xF9A8D4, on: base, 4.5, "\(l.id) bannerLabel on the card")
                expect(l.text, on: base, 4.5, "\(l.id) waiting-room clock / heading")
                expect(l.textMuted, on: base, 4.5, "\(l.id) waiting-room caption / rowSub")
            }
            for accent in Self.pocketAccents {
                let tile = InkContrast.mix(accent, over: card, min(1, 0.14 * 1.8))
                expect(l.text, on: tile, 4.5, "\(l.id) friend tile word \(Self.label(accent))")
                let quiet = InkContrast.mix(accent, over: card, min(1, 0.07 * 1.8))
                // the quiet tile is drawn at 85% opacity over the card
                for wall in l.cardOverWalls {
                    let fill = InkContrast.mix(quiet, over: wall, 0.85)
                    let ink = InkContrast.mix(l.textMuted, over: wall, 0.85)
                    expect(ink, on: fill, 4.5, "\(l.id) quiet friend tile word \(Self.label(accent))")
                }
            }
        }
    }

    /// Pocket help sheet (PocketHelpSheet): the opaque season card washed with the game accent (PocketHelpLook.nightTop /
    /// nightBottom), the steps tray `accent.vsWash(0.10)` over it, the heading / joiner inks; and the game screen's score
    /// window (FriendlyGameScreen.scoreWindow: your purple / their amber halves over the card, pink header strip), the RPS
    /// pick buttons (`vsWash(0.13)`), the TTT cells and the reveal cards (label in the tint at 50% over white when it won).
    func testPocketHelpAndGameBoardsUnderTheDarkSeason() throws {
        for l in try Self.looks() where l.dark && l.card != nil {
            let card = l.card!
            for accent in Self.pocketAccents {
                for k in [0.16, 0.07] {   // PocketHelpLook.nightTop, nightBottom
                    let face = InkContrast.mix(accent, over: card, k)
                    expect(l.text, on: face, 4.5, "\(l.id) pocket help heading on \(Self.label(accent)) at \(k)")
                    // the steps tray: accent.vsWash(0.10) = 18% over the card (the gradient face is under it)
                    let tray = InkContrast.mix(accent, over: card, 0.18)
                    expect(l.text, on: tray, 4.5, "\(l.id) pocket help step text \(Self.label(accent))")
                    expect(l.textMuted, on: tray, 4.5, "\(l.id) pocket help joiner \(Self.label(accent))")
                    // the win / turns lines' icon: the accent at 60% over white under a dark season (non-text, 3:1)
                    expect(InkContrast.mix(accent, over: 0xFFFFFF, 0.6), on: face, 3, "\(l.id) pocket help icon \(Self.label(accent)) at \(k)")
                }
                let pick = InkContrast.mix(accent, over: card, min(1, 0.13 * 1.8))
                expect(l.text, on: pick, 4.5, "\(l.id) RPS pick word \(Self.label(accent))")
            }
            // Score window halves + header strip.
            let strip = InkContrast.mix(0xEC4899, over: card, min(1, 0.08 * 1.8))
            expect(0xFBCFE8, on: strip, 4.5, "\(l.id) score headline")
            expect(0xF9A8D4, on: strip, 4.5, "\(l.id) score sub line")
            for won in [true, false] {
                let you = InkContrast.mix(0x7C3AED, over: card, won ? 0.34 : 0.2)
                expect(0xC4B5FD, on: you, 4.5, "\(l.id) YOU label (won \(won))")
                expect(l.text, on: you, 4.5, "\(l.id) your score (won \(won))")
            }
            for lost in [true, false] {
                let them = InkContrast.mix(0xF59E0B, over: card, lost ? 0.3 : 0.16)
                expect(0xFCD34D, on: them, 4.5, "\(l.id) their label / score (lost \(lost))")
            }
            // Reveal cards: the tint wash (0.18 win / 0.10), label in tint at 50% over white when it won, else muted.
            for tint in [UInt32(0x7C3AED), UInt32(0xF59E0B)] {
                let win = InkContrast.mix(tint, over: card, min(1, 0.18 * 1.8))
                expect(InkContrast.mix(tint, over: 0xFFFFFF, 0.5), on: win, 4.5, "\(l.id) reveal winner label \(Self.label(tint))")
                let plain = InkContrast.mix(tint, over: card, min(1, 0.10 * 1.8))
                expect(l.textMuted, on: plain, 4.5, "\(l.id) reveal label \(Self.label(tint))")
            }
        }
    }

    /// Hubbub controls (HubView): the hint pair is an explicit amber helper (#F5A524) that does not take the season tint,
    /// so its dark-scheme label (FamilyInk.helperInk on helperFill, 34% / 42% pressed over #231C40) must still read; the
    /// found-word tiles are self-contained (fixed ink on their own fill, like GlossyTile) and the unfound pill follows
    /// PuzKit.face (the tint over the season surface) with its slate label.
    func testHubbubControlsUnderTheDarkSeason() throws {
        for l in try Self.looks() where l.dark {
            let amber: UInt32 = 0xF5A524
            let ink = InkContrast.mix(0xFFFFFF, over: amber, 0.65)
            for pressed in [false, true] {
                let fill = InkContrast.mix(amber, over: 0x231C40, pressed ? 0.42 : 0.34)
                expect(ink, on: fill, 4.5, "\(l.id) Hubbub hint helper\(pressed ? " (pressed)" : "")")
            }
            if let card = l.card {
                // an unfound word: slate #8D99B0 on PuzKit.face(#6B7891, 0.10) = the slate at 16% over the surface (card)
                let pill = InkContrast.mix(0x6B7891, over: card, 0.16)
                expect(0x8D99B0, on: pill, 4.5, "\(l.id) Hubbub unfound word")
            }
        }
        // The found-word tiles: fixed inks on fixed light fills in every season.
        expect(0x7A3D00, on: InkContrast.mix(0xF5A524, over: 0xFFFFFF, 0.42), 4.5, "Hubbub pangram tile")
        expect(0x6D28D9, on: InkContrast.mix(0x8B5CF6, over: 0xFFFFFF, 0.2), 4.5, "Hubbub revealed tile")
    }

    /// A selected helper (a toggle that is on, e.g. Sudoku's notes pad): the solid buttonTint
    /// (black 12% over it pressed) with a white 12.5-pt label.
    func testSelectedHelperOnButtonTint() throws {
        for l in try Self.looks() {
            // FamilyInk.selectedInk: white, or near-black on a bright tint (InkContrast.onSolid).
            let ink = InkContrast.onSolid(l.buttonTint)
            expect(ink, on: l.buttonTint, 4.5, "\(l.id) selected helper label")
            expect(ink, on: InkContrast.mix(0x000000, over: l.buttonTint, 0.12), 4.5, "\(l.id) selected helper label (pressed)")
        }
    }
}
