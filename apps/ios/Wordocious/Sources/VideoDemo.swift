#if DEBUG
import SwiftUI
import UIKit
import WordociousCore

// JP-plan social videos (docs/design/brand/social/jp45/video). DEBUG-only HARNESS, never product behavior.
//
// Launched with `-storeDemo -videoScene <name>` (the canned signed-in WordWiz, no network), the app plays one
// scripted scene while `xcrun simctl io <udid> recordVideo` captures it. Every game opens as a fresh UNLIMITED
// board (a random seed), so no daily answer is ever on screen. Pacing is human: typed letters, taps, pauses.
//
//   -videoScene game  -videoGame OCTORDLE [-videoPace 1.0]   one game played through
//   -videoScene montage -videoGames DUEL,QUORDLE,... [-videoHold 1.5]   fast cuts, a few actions per game
//   -videoScene intro [-videoHold 6]                         cold-start intro, then Home
//   -videoScene reveal                                       season flip on Home (standard -> Halloween)
//   -videoScene cleanup                                      the flip back (Halloween -> standard)
//   -videoScene pocket -videoGames rps,ttt                   pocket games played to the finish
//   -videoScene vsbot | vslobby                              a VS match vs a bot / the bot ladder
//   -videoScene tour                                         Home -> tabs scroll
//
// The games register their view model through `VideoDemo.reg(self)` (a one-line `defer` in each VM's init).
@MainActor
enum VideoDemo {
    nonisolated static func arg(_ name: String) -> String? {
        let a = ProcessInfo.processInfo.arguments
        guard let i = a.firstIndex(of: name), i + 1 < a.count else { return nil }
        return a[i + 1]
    }
    nonisolated static var scene: String? { arg("-videoScene") }
    static weak var vm: AnyObject?
    static func reg(_ o: AnyObject) { vm = o }

    static var pace: Double = Double(arg("-videoPace") ?? "") ?? 1.0
    static func sleep(_ s: Double) async { await PerfDrive.sleep(s * pace) }
    static func raw(_ s: Double) async { await PerfDrive.sleep(s) }

    // MARK: Entry

    static func run() async {
        while !LaunchGate.isOpen { await raw(0.05) }
        DictionaryLoader.ensureInitialized()
        // First clears pop achievement cards (First Starsweep, Blitz...) that would sit over the rest of a montage: hold them all.
        AchievementUnlockCenter.shared.block("video-harness")
        let name = scene ?? ""
        // Settle on Home first (the cold-start intro's landing).
        if name == "intro" { mark() }
        if name != "intro" { await raw(2.6); mark() }
        switch name {
        case "game":
            let key = arg("-videoGame") ?? "OCTORDLE"
            await openGame(key)
            await play(key, full: true)
            mark("end")
            await raw(Double(arg("-videoTail") ?? "") ?? 5.0)
        case "montage":
            let keys = (arg("-videoGames") ?? "").split(separator: ",").map(String.init)
            let hold = Double(arg("-videoHold") ?? "") ?? 1.5
            for k in keys {
                await openGame(k, settle: 0.7)
                await play(k, full: false, budget: hold)
                PerfDrive.goHome()
                await raw(0.35)
            }
            await raw(1.0)
        case "intro":
            await raw(Double(arg("-videoHold") ?? "") ?? 7)
        case "reveal": await seasonFlip(toHalloween: true)
        case "cleanup": await seasonFlip(toHalloween: false)
        case "tour": await homeTour()
        case "pocket":
            let kinds = (arg("-videoGames") ?? "rps").split(separator: ",").map(String.init)
            for k in kinds { if let kind = FriendlyKind(rawValue: k) { await pocket(kind) } }
        case "vsbot":
            PerfTour.send(.cover(.vsBot))
            await raw(5.0)
            for w in ["CRANE", "SLOTH", "MOIST"] { await type(w, gap: 0.2); PerfDrive.enter(); await raw(1.8) }
            await raw(3)
        case "vslobby":
            PerfTour.send(.cover(.vsLobby))
            await raw(2.0)
            await PerfDrive.scroll(to: 1, speed: 500)
            await raw(1.0)
            await PerfDrive.scroll(to: 0, speed: 700)
            await raw(1.5)
        default:
            PerfTour.send(.selectTab(.home))
        }
        if name != "game" { mark("end") }
        // The recorder stops the clip; the app just idles.
    }

    // MARK: Helpers

    /// `-videoMark <host path>`: the wall-clock time (epoch seconds) the scene's first action starts, so the recording script can
    /// trim the cold-start wait off the front of the clip.
    static func mark(_ suffix: String = "") {
        guard let p = arg("-videoMark").map({ suffix.isEmpty ? $0 : $0 + "." + suffix }) else { return }
        try? String(format: "%.3f", Date().timeIntervalSince1970).write(toFile: p, atomically: true, encoding: .utf8)
    }

    static func openGame(_ key: String, settle: Double = 2.4) async {
        vm = nil
        PerfDrive.playUnlimited(key)
        await raw(settle)
    }

    static func type(_ word: String, gap: Double = 0.16) async {
        for ch in word { PerfTour.key(.letter(String(ch))); await sleep(gap) }
    }

    /// Wait (bounded) for a registered VM of a type.
    static func waitVM<T: AnyObject>(_ t: T.Type) async -> T? {
        for _ in 0..<40 { if let v = vm as? T { return v }; await raw(0.1) }
        return nil
    }

    static var game: GameViewModel? { PerfTour.game }

    static func solveBoards(max count: Int, gap: Double, wait: Double) async {
        var n = 0
        while n < count, let b = game?.boards.first(where: { $0.status == .playing }) {
            await type(b.solution.uppercased(), gap: gap)
            PerfDrive.enter()
            await sleep(wait)
            n += 1
        }
    }

    // MARK: Per-game scripts. `full` = the whole episode (~16-22 s); else a short beat that fits `budget` seconds.

    static func play(_ key: String, full: Bool, budget: Double = 1.5) async {
        let start = CACurrentMediaTime()
        func over() -> Bool { !full && CACurrentMediaTime() - start > budget }
        switch key {
        case "DUEL", "DUEL_6", "DUEL_7", "QUORDLE", "OCTORDLE", "SEQUENCE", "RESCUE":
            let cap = key == "OCTORDLE" ? 8 : key == "QUORDLE" || key == "SEQUENCE" || key == "RESCUE" ? 4 : 1
            let g = full ? 0.2 : 0.07
            if key != "SEQUENCE" && key != "RESCUE" {
                for w in ["CRANE", "SLOTH"] {
                    await type(w, gap: g); PerfDrive.enter(); await sleep(full ? 1.9 : 0.5)
                    if over() { return }
                }
            }
            if key == "OCTORDLE" && full {
                PerfTour.send(.zoomBoard(2)); await raw(1.4)
                PerfTour.send(.zoomBoard(nil)); await raw(1.0)
            }
            await solveBoards(max: full ? cap : 1, gap: full ? 0.14 : 0.05, wait: full ? 1.1 : 0.2)
        case "PROPERNOUNDLE":
            guard let v = await waitVM(ProperNoundleVM.self) else { return }
            for _ in 0..<40 where v.puzzle == nil { await raw(0.1) }
            guard let p = v.puzzle else { return }
            let ans = Array(ProperNoundle.normalize(p.answer).uppercased())
            await raw(full ? 1.6 : 0.3)
            // A first guess from common letters (a believable miss), then the answer.
            let common = Array("STARELONICD")
            // (always a miss first: a one-guess solve pops the Perfectionist achievement, which would stall a montage)
            for i in 0..<ans.count { v.type(String(common[i % common.count])); await sleep(full ? 0.12 : 0.03) }
            await raw(full ? 0.4 : 0.15); v.submit(); await sleep(full ? 2.0 : 0.45)
            for ch in ans { v.type(String(ch)); await sleep(full ? 0.14 : 0.04) }
            await raw(0.5); v.submit(); await sleep(full ? 1.0 : 0.2)
        case "GAUNTLET":
            await type("CRANE", gap: full ? 0.2 : 0.06); PerfDrive.enter(); await sleep(full ? 1.8 : 0.4)
            let stages = full ? 3 : 1
            for s in 0..<stages {
                guard let vm = game else { return }
                for a in vm.boards.map({ $0.solution.uppercased() }) {
                    await type(a, gap: full ? 0.12 : 0.04); PerfDrive.enter(); await sleep(full ? 1.1 : 0.2)
                }
                if s < stages - 1 { await raw(1.8); game?.nextStage(); await raw(1.8) }
            }
        case "REGIONS":
            guard let v = await waitVM(RegionsVM.self) else { return }
            let n = v.n, sol = Array(v.state.solution)
            // One wrong star first: the board tells you, then it is taken back.
            let wrongCol = (Int(String(sol[0]))! + 2) % n
            // (a single tap pencils a black star; a quick second tap plays it)
            if full {   // (a montage beat goes straight to the right stars: played stars are the picture)
                v.tap(wrongCol); await raw(0.14); v.tap(wrongCol); await raw(1.8)
                v.undo(); await raw(0.7)
            }
            for r in 0..<n {
                let c = r * n + Int(String(sol[r]))!
                v.tap(c); await raw(0.14); v.tap(c)
                await sleep(full ? 0.8 : 0.12)
                if over() { return }
            }
        case "GROUPS":
            guard let v = await waitVM(KindredVM.self) else { return }
            let groups = v.state.groups
            // A near miss first (three from one group + one from another), then the four groups.
            if full, groups.count > 1 {
                for w in groups[0].words.prefix(3) + [groups[1].words[0]] { v.toggle(w); await raw(0.45) }
                v.submit(); await raw(2.2); v.deselect(); await raw(0.6)
            }
            for g in groups {
                for w in g.words { v.toggle(w); await sleep(full ? 0.42 : 0.1) }
                await raw(0.5); v.submit(); await sleep(full ? 1.5 : 0.35)
                if over() { return }
            }
        case "WORDSEARCH":
            guard let v = await waitVM(SpyglassVM.self) else { return }
            let n = v.state.n
            for p in v.state.words {
                let (dr, dc) = WORDSEARCH_DIRS[p.d] ?? (0, 1)
                let L = p.w.count
                v.select(from: p.r * n + p.c, to: (p.r + dr * (L - 1)) * n + (p.c + dc * (L - 1)))
                await sleep(full ? 1.3 : 0.3)
                if over() { return }
            }
        case "LADDER":
            guard let v = await waitVM(LadderVM.self) else { return }
            for w in v.state.path.dropFirst() {
                for ch in w { v.type(String(ch)); await sleep(full ? 0.2 : 0.05) }
                await raw(0.4); v.submit(); await sleep(full ? 1.4 : 0.3)
                if over() { return }
            }
        case "CRYPTOGRAM":
            guard let v = await waitVM(CodebreakerVM.self) else { return }
            let alpha = Array(CRYPTOGRAM_ALPHABET)
            let key = Array(v.state.key)
            var seen = Set<Character>()
            for c in v.state.cipher where CRYPTOGRAM_ALPHABET.contains(c) && !seen.contains(c) {
                seen.insert(c)
                if v.state.locked.contains(String(c)) { continue }
                guard let i = key.firstIndex(of: c) else { continue }
                v.select(String(c)); await raw(0.12)
                v.setLetter(String(alpha[i]))
                await sleep(full ? 0.38 : 0.1)
                if over() { return }
            }
        case "SUDOKU":
            guard let v = await waitVM(SudokuVM.self) else { return }
            let sol = Array(v.state.solution), giv = Array(v.state.givens)
            // Fill a row at a time: reads like a person working through it.
            var placed = 0
            for cell in 0..<81 where giv[cell] == "0" {
                v.selected = cell; await raw(0.08)
                v.place(Int(String(sol[cell]))!)
                placed += 1
                await sleep(full ? 0.34 : 0.09)
                if over() || (full && placed >= 46) { return }
            }
        case "SCRAMBLE":
            guard let v = await waitVM(MuddleVM.self) else { return }
            let words = v.state.words.map { $0.answer.uppercased() } + [v.state.final.answer.uppercased()]
            for (r, w) in words.enumerated() {
                v.select(r); await raw(0.3)
                for ch in w { v.typeLetter(String(ch)); await sleep(full ? 0.22 : 0.07) }
                await sleep(full ? 1.3 : 0.3)
                if over() { return }
            }
        case "HUB":
            guard let v = await waitVM(HubVM.self) else { return }
            var list = v.state.pangrams + v.state.words.filter { !v.state.pangrams.contains($0) && $0.count >= 4 }
            list = Array(list.prefix(full ? 9 : 3))
            for w in list {
                for ch in w.uppercased() { v.type(ch); await sleep(full ? 0.18 : 0.05) }
                await raw(0.3); v.submit(); await sleep(full ? 1.2 : 0.3)
                if over() { return }
            }
        case "CROSSWORD":
            guard let v = await waitVM(CrosswordVM.self) else { return }
            for e in v.state.entries {
                v.pickEntry(e); await raw(0.35)
                for ch in e.answer.uppercased() { v.setLetter(String(ch)); await sleep(full ? 0.11 : 0.05) }
                await sleep(full ? 0.35 : 0.12)
                if over() { return }
            }
        default: break
        }
    }

    // MARK: Season flip

    static let optOut = ThemeChoiceRules.optOutKey(season: "halloween", date: CastSkin.localDay())

    static func setHalloween(_ on: Bool) {
        // The skin views observe ThemeManager (a plain defaults write would not redraw them).
        UserDefaults.standard.removeObject(forKey: CastSkin.debugKey)
        ThemeManager.shared.seasonOptOut = on ? nil : optOut
        CastSkin.invalidate()
    }

    static func seasonFlip(toHalloween: Bool) async {
        PerfTour.send(.selectTab(.home))
        setHalloween(!toHalloween)
        await raw(3.4)
        setHalloween(toHalloween)
        await raw(3.8)
        await PerfDrive.scroll(to: 1, speed: 420)
        await raw(1.0)
        await PerfDrive.scroll(to: 0, speed: 600)
        await raw(0.8)
        PerfTour.send(.selectTab(.leaderboard))
        await raw(2.4)
        PerfTour.send(.selectTab(.home))
        await raw(2.0)
    }

    static func homeTour() async {
        PerfTour.send(.selectTab(.home))
        await raw(1.5)
        await PerfDrive.scroll(to: 1, speed: 420)
        await raw(0.8)
        await PerfDrive.scroll(to: 0, speed: 600)
        for t in [AppTab.leaderboard, .stats, .friends, .home] { PerfTour.send(.selectTab(t)); await raw(1.8) }
    }

    static func pocket(_ kind: FriendlyKind) async {
        PocketDemo.begin(kind)
        PerfTour.send(.cover(.pocket))
        await raw(1.8)
        await PocketDemo.autoplay()
        await raw(2.6)
        PerfTour.send(.cover(nil))
        await raw(0.8)
    }
}
#endif
