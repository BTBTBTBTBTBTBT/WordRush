import SwiftUI
import WordociousCore

/// The Bots page (VS overhaul, founder 2026-10-01; spec
/// docs/VS_REDESIGN_SPEC.md §8; FINISH_SPEC §D1–§D3): the Bot of the Day (today's
/// day host, free once per UTC day, Classic), THE LADDER (the ten cast bots, Rip →
/// Webster the boss; three wins in a row clear a rung) and Your Ghost (beat your
/// best). Ladder and Your Ghost are Pro. Every rung is a tinted card in its bot's
/// own color with the character itself.
struct VSBotsView: View {
    let mode: GameMode
    @Environment(\.dismiss) private var dismiss
    @ObservedObject private var auth = AuthService.shared

    @State private var progression = CpuProgressionStore.load()
    @State private var ghost: VSIntent.GhostRun?
    @State private var launch: Launch?
    @State private var showPro = false

    struct Launch: Identifiable { let id = UUID(); let mode: GameMode; let kind: CpuKind; let ghost: VSIntent.GhostRun? }

    private var isPro: Bool { auth.isProActive }
    private var today: String { LeaderboardService.todayUTC() }

    var body: some View {
        VStack(spacing: 0) {
            // No host beside the title: every cast member appears on the ladder
            // below (§A7 — never the same character image twice on one screen).
            VSNavBar(title: "BOTS", host: nil, onBack: { dismiss() }) { VSModeChip(mode: mode).padding(.trailing, 6) }
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    botOfDayCard
                    ladderSection
                    beatYourBest
                }
                .padding(.horizontal, 16).padding(.top, 8).padding(.bottom, 100)
            }
        }
        .pageBackground(.vs, lightOnly: true)
        .toolbar(.hidden, for: .navigationBar)
        .swipeToGoBack { dismiss() }
        .sheet(isPresented: $showPro) { ProView() }
        .navigationDestination(isPresented: Binding(get: { launch != nil }, set: { if !$0 { launch = nil } })) {
            if let l = launch { VSGameView(mode: l.mode, intent: .bot(l.kind, ghost: l.ghost)) }
        }
        .onAppear { progression = CpuProgressionStore.load() }
        .task {
            // Best recorded run for this mode → Beat your best.
            if isPro, let uid = auth.profile?.id, let g = await MatchStatsService.ghostBestRun(uid: uid, mode: mode) {
                ghost = VSIntent.GhostRun(guesses: g.guesses, timeMs: g.timeMs)
            }
        }
    }

    private func play(_ kind: CpuKind, ghost: VSIntent.GhostRun? = nil) {
        Haptics.tap()
        launch = Launch(mode: mode, kind: kind, ghost: ghost)
    }

    // MARK: - Bot of the Day (§D2: today's day-host character)

    private var botOfDayCard: some View {
        let p = BotPersonas.botOfDay
        let color = Color(hex: UInt(p.color))
        let result = progression.botOfDay(todayUtc: today)
        let streak = progression.liveBotOfDayStreak(todayUtc: today)
        return VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .center, spacing: 12) {
                // The host in character, ready to play (§A7: the ladder rungs below
                // draw the hero image, never this pose).
                PoseImage(p.mascot, "ready", height: 108)
                    .frame(width: 96)
                VStack(alignment: .leading, spacing: 4) {
                    Text("BOT OF THE DAY").font(Brand.font(10.5, .black)).tracking(1.1).foregroundStyle(color)
                    Text(p.name).font(Brand.font(24, .black)).foregroundStyle(VsLobbyKit.titleInk)
                        .lineLimit(1).minimumScaleFactor(0.7)
                    Text(p.tierLine).font(Brand.font(12, .heavy)).foregroundStyle(VsLobbyKit.mutedInk)
                        .lineLimit(1).minimumScaleFactor(0.8)
                    Text("Same bot, same puzzle for everyone").font(Brand.font(10.5, .bold)).foregroundStyle(VsLobbyKit.mutedInk)
                        .lineLimit(1).minimumScaleFactor(0.8)
                }
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 12).padding(.top, 10)
            HStack(spacing: 10) {
                // The day streak in soft numbers.
                HStack(spacing: 5) {
                    Icon3D(.flame, size: 22)
                    Text("\(streak)").vsNumber(20)
                    Text(streak == 1 ? "day" : "days").font(Brand.font(11, .heavy)).foregroundStyle(VsLobbyKit.mutedInk)
                }
                .padding(.horizontal, 10).padding(.vertical, 5)
                .background(Capsule().fill(Color(hex: 0xF97316).wash(0.12)))
                .overlay(Capsule().stroke(Color(hex: 0xF97316).wash(0.32), lineWidth: 1.5))
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("\(streak) \(streak == 1 ? "day" : "days") in a row")
                Spacer(minLength: 4)
                if result == .open {
                    Button { play(.daily) } label: { CandyLabel(title: "Play", symbol: "play.fill") }
                        .buttonStyle(CandyButtonStyle(variant: .purple, size: .medium, fullWidth: false))
                } else {
                    // Today's result: the W / L badge + the line.
                    HStack(spacing: 6) {
                        if result == .won || result == .lost { RowResultBadge(won: result == .won, size: 22) }
                        Text(VsLobbyKit.tileLine(result, opponent: p.name, open: ""))
                            .font(Brand.font(12, .black)).foregroundStyle(result == .won ? VsLobbyKit.purpleSub : VsLobbyKit.slate)
                            .lineLimit(1).minimumScaleFactor(0.7)
                    }
                    .padding(.horizontal, 12).frame(minHeight: 34)
                    .background(Capsule().fill((result == .won ? VsLobbyKit.purple : VsLobbyKit.slate).wash(0.14)))
                    .overlay(Capsule().stroke((result == .won ? VsLobbyKit.purple : VsLobbyKit.slate).wash(0.34), lineWidth: 1.5))
                }
            }
            .padding(.horizontal, 12).padding(.top, 6).padding(.bottom, 12)
        }
        .vsTinted(color, bar: [color.wash(0.7), color], tint: 0.10, line: 0.32)
    }

    // MARK: - THE LADDER (ten cast rungs)

    private var ladderSection: some View {
        let rungs = VsLobby.ladderRungs(progression.ladder)
        let allClear = rungs.allSatisfy { $0.state == .cleared }
        return VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                VSSectionLabel(text: "THE LADDER")
                if !isPro { VSLockBadge() }
                Spacer()
                HStack(spacing: 4) {
                    Icon3D(.flame, size: 16)
                    Text("STREAK").font(Brand.font(9.5, .black)).tracking(0.6).foregroundStyle(VsLobbyKit.mutedInk)
                    Text("\(progression.streak)").vsNumber(14)
                    Text("· BEST").font(Brand.font(9.5, .black)).tracking(0.6).foregroundStyle(VsLobbyKit.mutedInk)
                    Text("\(progression.bestStreak)").vsNumber(14)
                }
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("Streak \(progression.streak), best \(progression.bestStreak)")
            }
            if allClear { ladderClearedCard }
            VStack(spacing: 8) {
                ForEach(Array(rungs.enumerated()), id: \.offset) { i, r in
                    rungRow(r, index: i, rungs: rungs)
                }
            }
        }
    }

    /// All ten rungs cleared: the celebration art (W with the trophy).
    @ViewBuilder private var ladderClearedCard: some View {
        VStack(spacing: 8) {
            if ArtAsset.exists("art-scene-ladder-cleared") {
                Image("art-scene-ladder-cleared").resizable().interpolation(.high).scaledToFit()
                    .frame(maxHeight: 190)
                    .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                    .accessibilityHidden(true)
            } else {
                Icon3D(.trophy, size: 56)
            }
            Text("LADDER CLEARED!").font(Brand.font(18, .black)).tracking(0.5).foregroundStyle(VsLobbyKit.titleInk)
            Text("All ten beaten — even the boss. Keep any rung for practice.")
                .font(Brand.font(12, .bold)).foregroundStyle(VsLobbyKit.mutedInk).multilineTextAlignment(.center)
        }
        .padding(14).frame(maxWidth: .infinity)
        .vsTinted(VsLobbyKit.gold, bar: VsLobbyKit.goldBar, tint: 0.14, line: 0.36)
        .accessibilityElement(children: .combine)
    }

    private func rungRow(_ r: LadderRung, index i: Int, rungs: [LadderRung]) -> some View {
        let p = BotPersonas.persona(r.id)
        let boss = p.rung == VsLobby.ladderBots.count
        let color = boss ? VsLobbyKit.gold : Color(hex: UInt(p.color))
        let locked = r.state == .locked
        let tag = r.state == .cleared ? "CLEARED" : r.state == .next ? "NEXT" : "LOCKED"
        let row = HStack(spacing: 12) {
            // The bot's own character (its hero image), on a wash of its color.
            ZStack(alignment: .bottomTrailing) {
                Image(p.art).resizable().interpolation(.high).scaledToFit()
                    .frame(width: 54, height: 54)
                    .saturation(locked ? 0 : 1)
                    .accessibilityHidden(true)
                Text("\(p.rung)")
                    .font(Brand.font(11, .black)).foregroundStyle(.white)
                    .frame(width: 20, height: 20)
                    .background(Circle().fill(color))
                    .overlay(Circle().stroke(Color.white, lineWidth: 1.5))
                    .offset(x: 4, y: 2)
            }
            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 5) {
                    Text(p.name).font(Brand.font(15, .black)).foregroundStyle(VsLobbyKit.titleInk)
                    if boss { Text("BOSS").font(Brand.font(9, .black)).tracking(0.6).foregroundStyle(Color(hex: 0x92400E))
                        .padding(.horizontal, 6).padding(.vertical, 2)
                        .background(Capsule().fill(VsLobbyKit.gold.wash(0.3))) }
                }
                // "Easy going · Solves in 6" ("Matches your form" for Umi).
                Text(p.tierLine).font(Brand.font(11.5, .heavy)).foregroundStyle(color == VsLobbyKit.gold ? Color(hex: 0xB45309) : color)
                    .lineLimit(1).minimumScaleFactor(0.75)
                Text(r.line).font(Brand.font(11, .bold)).foregroundStyle(VsLobbyKit.mutedInk)
                    .lineLimit(1).minimumScaleFactor(0.75)
            }
            Spacer(minLength: 4)
            rungTrailing(r, boss: boss)
        }
        .padding(.horizontal, 12).padding(.vertical, 10)
        .vsTinted(color, bar: r.state == .next || boss ? [color.wash(0.7), color] : [color],
                  radius: 18, barHeight: r.state == .next ? 6 : 4,
                  tint: r.state == .next ? 0.16 : 0.09, line: r.state == .next ? 0.5 : 0.28)
        .overlay {
            if r.state == .next {
                RoundedRectangle(cornerRadius: 21, style: .continuous).inset(by: -3)
                    .stroke(color.opacity(0.28), lineWidth: 3).allowsHitTesting(false)
            }
        }
        .opacity(locked ? 0.55 : 1)
        .contentShape(Rectangle())
        return Button {
            guard r.state != .locked else { return }
            if isPro { play(BotPersonas.kind(forBotId: r.id)) } else { showPro = true }
        } label: { row }
        .buttonStyle(.squish)
        .allowsHitTesting(r.state != .locked)
        .accessibilityLabel("\(VsLobby.botName(r.id)), \(p.tierLine), \(tag.lowercased()), \(r.line)")
    }

    /// Cleared ✓ · next = the Play candy (a lock on it for free players) · locked = the 3D lock.
    @ViewBuilder private func rungTrailing(_ r: LadderRung, boss: Bool) -> some View {
        HStack(spacing: 6) {
            if boss && ArtAsset.exists("art-medal-trophy") {
                VSArt("art-medal-trophy", height: 34).frame(width: 30)
            }
            switch r.state {
            case .cleared:
                Icon3D(.badgeCheck, size: 26)
            case .next:
                VSCandyTag(title: "Play", symbol: isPro ? "play.fill" : nil, variant: .purple, showLock: !isPro)
            case .locked:
                Icon3D(.lock, size: 22)
            }
        }
    }

    // MARK: - YOUR GHOST (Beat your best — the player's own best run, never a bot)

    @ViewBuilder private var beatYourBest: some View {
        if !isPro || ghost != nil {
            VStack(alignment: .leading, spacing: 8) {
                VSSectionLabel(text: "BEAT YOUR BEST")
                Button {
                    if isPro, let g = ghost { play(.ghost, ghost: g) } else { showPro = true }
                } label: {
                    HStack(spacing: 12) {
                        VSGhostTile(size: 44)
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Your Ghost").font(Brand.font(14, .black)).foregroundStyle(VsLobbyKit.titleInk)
                            Text(ghost.map { "Your best \(VsLobbyKit.modeName(mode)): \($0.guesses) guesses · \(VsLobby.vsClock(Int($0.timeMs)))" }
                                 ?? "Race a ghost of your best \(VsLobbyKit.modeName(mode)) run.")
                                .font(Brand.font(11, .bold)).foregroundStyle(VsLobbyKit.mutedInk).lineLimit(1).minimumScaleFactor(0.8)
                        }
                        Spacer(minLength: 4)
                        VSCandyTag(title: "Race it", variant: .teal, showLock: !isPro)
                    }
                    .padding(12)
                    .vsTinted(VsLobbyKit.purple, bar: [VsLobbyKit.purple.wash(0.5)], radius: 18, barHeight: 4, tint: 0.07)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.squish)
                .accessibilityLabel("Your Ghost, beat your best" + (isPro ? "" : ", Pro"))
            }
        }
    }
}
