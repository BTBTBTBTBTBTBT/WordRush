import SwiftUI
import UIKit

// Renders every widget option × family × state × theme to PNG (@3x) with ImageRenderer, plus
// today's shipping widget for reference, and writes manifest.json for the gallery builder.
// Launched headless on the simulator by build.sh (OUT_DIR comes in via SIMCTL_CHILD_OUT_DIR).

struct Job {
    let id: String
    let family: String
    let concept: String
    let state: String
    let theme: String
    let view: AnyView
}

func framed<V: View>(_ f: Fam, _ t: WTheme, _ v: V) -> AnyView {
    AnyView(WidgetFrame(fam: f, t: t) { v })
}

struct Concept {
    let id: String
    let fams: [Fam]
    let make: (Fam, WD, WTheme) -> AnyView
}

let concepts: [Concept] = [
    Concept(id: "ring", fams: [.small, .medium, .large]) { f, d, t in
        switch f {
        case .small: return AnyView(RingSmall(d: d, t: t))
        case .medium: return AnyView(RingMedium(d: d, t: t))
        default: return AnyView(RingLarge(d: d, t: t))
        }
    },
    Concept(id: "board", fams: [.small, .medium, .large]) { f, d, t in
        switch f {
        case .small: return AnyView(BoardSmall(d: d, t: t))
        case .medium: return AnyView(BoardMedium(d: d, t: t))
        default: return AnyView(BoardLarge(d: d, t: t))
        }
    },
    Concept(id: "streak", fams: [.small, .medium]) { f, d, t in
        f == .small ? AnyView(StreakSmall(d: d, t: t)) : AnyView(StreakMedium(d: d, t: t))
    },
    Concept(id: "next", fams: [.small, .medium]) { f, d, t in
        f == .small ? AnyView(UpNextSmall(d: d, t: t)) : AnyView(UpNextMedium(d: d, t: t))
    },
    Concept(id: "wotd", fams: [.small, .medium]) { f, d, t in
        f == .small ? AnyView(WotdSmall(d: d, t: t)) : AnyView(WotdMedium(d: d, t: t))
    },
    Concept(id: "rank", fams: [.small, .medium]) { f, d, t in
        f == .small ? AnyView(RankSmall(d: d, t: t)) : AnyView(RankMedium(d: d, t: t))
    },
    Concept(id: "friends", fams: [.small, .medium, .large]) { f, d, t in
        switch f {
        case .small: return AnyView(FriendsSmall(d: d, t: t))
        case .medium: return AnyView(FriendsMedium(d: d, t: t))
        default: return AnyView(FriendsLarge(d: d, t: t))
        }
    },
    Concept(id: "puzzles", fams: [.small, .medium, .large]) { f, d, t in
        switch f {
        case .small: return AnyView(PuzzlesSmall(d: d, t: t))
        case .medium: return AnyView(PuzzlesMedium(d: d, t: t))
        default: return AnyView(PuzzlesLarge(d: d, t: t))
        }
    },
]

func allJobs(only: String?) -> [Job] {
    var jobs: [Job] = []
    let data = Dictionary(uniqueKeysWithValues: DayState.allCases.map { ($0, WD.make($0)) })
    // Today's shipping widget (reference).
    for (f, name) in [(Fam.small, "small"), (.medium, "medium"), (.large, "large")] {
        for t in [WTheme.light, .darkT] {
            let d = data[.mid]!
            let v: AnyView = f == .small ? AnyView(SmallView(snap: d.snap, date: d.date))
                : f == .medium ? AnyView(MediumView(snap: d.snap, date: d.date)) : AnyView(LargeView(snap: d.snap, date: d.date))
            jobs.append(Job(id: "today-\(name)-\(t.id)", family: name, concept: "today", state: "mid", theme: t.id,
                            view: AnyView(ZStack { WidgetBackdrop(); v.padding(16) }
                                .frame(width: f.size.width, height: f.size.height)
                                .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
                                .environment(\.colorScheme, t.dark ? .dark : .light))))
        }
    }
    for c in concepts where only == nil || only == c.id {
        for f in c.fams {
            for s in DayState.allCases {
                jobs.append(Job(id: "\(c.id)-\(f.rawValue)-\(s.rawValue)-light", family: f.rawValue, concept: c.id,
                                state: s.rawValue, theme: "light", view: framed(f, .light, c.make(f, data[s]!, .light))))
            }
            for t in [WTheme.darkT, .ocean, .forest, .halloween, .thanksgiving] {
                jobs.append(Job(id: "\(c.id)-\(f.rawValue)-mid-\(t.id)", family: f.rawValue, concept: c.id,
                                state: "mid", theme: t.id, view: framed(f, t, c.make(f, data[.mid]!, t))))
            }
            // A big day in Dark too (the own-mascot moment at night).
            jobs.append(Job(id: "\(c.id)-\(f.rawValue)-swept-dark", family: f.rawValue, concept: c.id,
                            state: "swept", theme: "dark", view: framed(f, .darkT, c.make(f, data[.swept]!, .darkT))))
        }
    }
    if only == nil || only == "persona" {
        // Rotating cast cameo: the day host sits on the ring (Mon D … Sun O3), plain and in costume.
        let days = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
        for (i, h) in dayHosts.enumerated() {
            for t in [WTheme.light, .halloween, .thanksgiving] {
                jobs.append(Job(id: "persona-cameo-\(days[i])-\(t.id)", family: "small", concept: "cameo", state: days[i],
                                theme: t.id, view: framed(.small, t, RingSmall(d: data[.mid]!, t: t, sitter: t.cast(h, "sit")))))
            }
        }
        // Placement comparison on one moment (mid-day, Default).
        jobs.append(Job(id: "persona-place-none", family: "small", concept: "place", state: "none", theme: "light",
                        view: framed(.small, .light, RingSmall(d: data[.mid]!, t: .light, showSitter: false))))
        jobs.append(Job(id: "persona-place-sit", family: "small", concept: "place", state: "sit", theme: "light",
                        view: framed(.small, .light, RingSmall(d: data[.mid]!, t: .light))))
        jobs.append(Job(id: "persona-place-own", family: "small", concept: "place", state: "own", theme: "light",
                        view: framed(.small, .light, RingSmall(d: data[.mid]!, t: .light, sitter: "art-player-mascot"))))
        jobs.append(Job(id: "persona-place-hold", family: "small", concept: "place", state: "hold", theme: "light",
                        view: framed(.small, .light, StreakSmall(d: data[.mid]!, t: .light))))
        jobs.append(Job(id: "persona-place-point", family: "small", concept: "place", state: "point", theme: "light",
                        view: framed(.small, .light, UpNextSmall(d: data[.mid]!, t: .light))))
        jobs.append(Job(id: "persona-place-peek", family: "medium", concept: "place", state: "peek", theme: "light",
                        view: framed(.medium, .light, BoardMedium(d: data[.mid]!, t: .light))))
    }
    if only == nil || only == "lock" {
        for s in [DayState.fresh, .mid, .swept] {
            let d = data[s]!
            jobs.append(Job(id: "lock-circular-ring-\(s.rawValue)", family: "circular", concept: "lock-ring", state: s.rawValue,
                            theme: "lock", view: AnyView(LockBackdrop(fam: .circular) { LockRing(d: d) })))
            jobs.append(Job(id: "lock-rect-progress-\(s.rawValue)", family: "rectangular", concept: "lock-progress",
                            state: s.rawValue, theme: "lock", view: AnyView(LockBackdrop(fam: .rectangular) { LockRectProgress(d: d) })))
        }
        for s in [DayState.mid, .milestone] {
            jobs.append(Job(id: "lock-circular-flame-\(s.rawValue)", family: "circular", concept: "lock-flame", state: s.rawValue,
                            theme: "lock", view: AnyView(LockBackdrop(fam: .circular) { LockFlame(d: data[s]!) })))
        }
        jobs.append(Job(id: "lock-rect-word-mid", family: "rectangular", concept: "lock-word", state: "mid", theme: "lock",
                        view: AnyView(LockBackdrop(fam: .rectangular) { LockRectWord() })))
        jobs.append(Job(id: "lock-rect-race-mid", family: "rectangular", concept: "lock-race", state: "mid", theme: "lock",
                        view: AnyView(LockBackdrop(fam: .rectangular) { LockRectRace(d: data[.mid]!) })))
        jobs.append(Job(id: "lock-inline-mid", family: "inline", concept: "lock-inline", state: "mid", theme: "lock",
                        view: AnyView(LockBackdrop(fam: .inline) { LockInline(d: data[.mid]!) })))
    }
    return jobs
}

@MainActor
enum Runner {
    static func run() {
        let env = ProcessInfo.processInfo.environment
        let out = URL(fileURLWithPath: env["OUT_DIR"] ?? NSTemporaryDirectory())
        try? FileManager.default.createDirectory(at: out, withIntermediateDirectories: true)
        let jobs = allJobs(only: env["ONLY"].flatMap { $0.isEmpty ? nil : $0 })
        var manifest: [[String: String]] = []
        for j in jobs {
            let r = ImageRenderer(content: j.view)
            r.scale = 3
            guard let png = r.uiImage?.pngData() else { print("FAILED \(j.id)"); continue }
            try? png.write(to: out.appendingPathComponent(j.id + ".png"))
            manifest.append(["id": j.id, "family": j.family, "concept": j.concept, "state": j.state, "theme": j.theme])
        }
        if let data = try? JSONSerialization.data(withJSONObject: manifest, options: [.prettyPrinted, .sortedKeys]) {
            try? data.write(to: out.appendingPathComponent("manifest.json"))
        }
        print("rendered \(manifest.count) of \(jobs.count)")
        exit(0)
    }
}

@main
struct HarnessApp: App {
    var body: some Scene {
        WindowGroup {
            Color.white.onAppear { DispatchQueue.main.async { Runner.run() } }
        }
    }
}
