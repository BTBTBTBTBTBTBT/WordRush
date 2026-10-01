import SwiftUI
import WordociousCore

/// The Bots page (VS overhaul, founder 2026-10-01; spec
/// docs/VS_REDESIGN_SPEC.md §8): the Bot of the Day (free once per UTC day,
/// Classic), THE LADDER (Rook → Lexi → Nova → Adapt, three wins in a row clear a
/// rung) and Beat your best. Ladder and Beat your best are Pro.
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
            VSNavBar(title: "BOTS", onBack: { dismiss() }) { VSModeChip(mode: mode).padding(.trailing, 6) }
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    botOfDayCard
                    ladderSection
                    beatYourBest
                }
                .padding(.horizontal, 16).padding(.top, 8).padding(.bottom, 100)
            }
        }
        .background(VsLobbyKit.page.ignoresSafeArea())
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

    // MARK: - Bot of the Day

    private var botOfDayCard: some View {
        let p = BotPersonas.botOfDay
        let result = progression.botOfDay(todayUtc: today)
        let streak = progression.liveBotOfDayStreak(todayUtc: today)
        return VStack(spacing: 0) {
            VStack(alignment: .leading, spacing: 3) {
                Text("BOT OF THE DAY · \(p.name.uppercased())").font(Brand.font(14, .black)).tracking(0.4).foregroundStyle(VsLobbyKit.deep)
                Text("SAME BOT, SAME PUZZLE FOR EVERYONE").font(Brand.font(10, .heavy)).tracking(0.5).foregroundStyle(VsLobbyKit.ink)
            }
            .padding(12).frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.white.opacity(0.5))
            HStack(spacing: 12) {
                BotArtCircle(art: p.art, size: 48, background: Color.white.opacity(0.7))
                VStack(alignment: .leading, spacing: 3) {
                    Text(BotPersonas.tierLine(p.tier)).font(Brand.font(13, .black)).foregroundStyle(VsLobbyKit.deep)
                    if streak > 0 {
                        HStack(spacing: 3) {
                            FlameMark(size: 11)
                            Text("\(streak) \(streak == 1 ? "day" : "days") in a row").font(Brand.font(11, .heavy)).foregroundStyle(Color(hex: 0xC2410C))
                        }
                    }
                }
                Spacer(minLength: 4)
                if result == .open {
                    Button { play(.daily) } label: {
                        Text("PLAY").font(Brand.font(12, .black)).tracking(0.6).foregroundStyle(.white)
                            .padding(.horizontal, 18).frame(height: 34)
                            .background(Capsule().fill(VsLobbyKit.ink))
                    }
                    .buttonStyle(PressableStyle())
                } else {
                    Text(VsLobbyKit.tileLine(result, opponent: p.name, open: ""))
                        .font(Brand.font(11, .black)).foregroundStyle(.white)
                        .padding(.horizontal, 12).frame(height: 30)
                        .background(Capsule().fill(result == .won ? VsLobbyKit.ink : Color(hex: 0x9CA3AF)))
                }
            }
            .padding(12)
        }
        .background(LinearGradient(colors: [Color(hex: 0xD5F5EE), Color(hex: 0xE0F2FE)], startPoint: .top, endPoint: .bottom))
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .shadow(color: Color(hex: 0x134E4A).opacity(0.08), radius: 7, x: 0, y: 4)
    }

    // MARK: - THE LADDER

    private var ladderSection: some View {
        let rungs = VsLobby.ladderRungs(progression.ladder)
        return VStack(alignment: .leading, spacing: 8) {
            HStack {
                VSSectionLabel(text: "THE LADDER")
                if !isPro { VSLockBadge() }
                Spacer()
                Text("STREAK \(progression.streak) · BEST \(progression.bestStreak)")
                    .font(Brand.font(10.5, .black)).tracking(0.5).foregroundStyle(Color(hex: 0xC2410C))
            }
            VStack(spacing: 0) {
                ForEach(Array(rungs.enumerated()), id: \.offset) { i, r in
                    rungRow(r, index: i, rungs: rungs)
                }
            }
        }
    }

    private func rungRow(_ r: LadderRung, index i: Int, rungs: [LadderRung]) -> some View {
        let reached: (Int) -> Bool = { $0 < rungs.count && rungs[$0].state != .locked }
        let teal = VsLobbyKit.ink, gray = Color(hex: 0xD1D5DB)
        let tagColor: Color = r.state == .cleared ? teal : r.state == .next ? Color(hex: 0xC2410C) : Color(hex: 0x9CA3AF)
        let tag = r.state == .cleared ? "CLEARED" : r.state == .next ? "NEXT" : "LOCKED"
        let ring: Color = r.state == .cleared ? teal : r.state == .next ? VsLobbyKit.purple : .clear
        let avatarBg: Color = r.state == .cleared ? VsLobbyKit.soft : r.state == .next ? Color(hex: 0xEDE9FE) : Color(hex: 0xE5E7EB)
        let row = HStack(spacing: 12) {
            // The 3 px rail: teal up to the next rung, gray after.
            VStack(spacing: 0) {
                Rectangle().fill(i == 0 ? .clear : (reached(i) ? teal : gray)).frame(width: 3, height: 15)
                BotArtCircle(art: BotPersonas.art(r.id), size: 36, background: avatarBg)
                    .overlay(Circle().strokeBorder(ring, lineWidth: 2))
                    .shadow(color: r.state == .next ? VsLobbyKit.purple.opacity(0.45) : .clear, radius: 5)
                    .saturation(r.state == .locked ? 0 : 1)
                Rectangle().fill(i == rungs.count - 1 ? .clear : (reached(i + 1) ? teal : gray)).frame(width: 3, height: 15)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text("\(VsLobby.botName(r.id)) · \(BotPersonas.tierLabel(forBotId: r.id))")
                    .font(Brand.font(13, .black)).foregroundStyle(VsLobbyKit.deep)
                Text(r.line).font(Brand.font(11, .bold)).foregroundStyle(VsLobbyKit.sub)
                    .lineLimit(1).minimumScaleFactor(0.8)
            }
            Spacer(minLength: 4)
            if !isPro && r.state != .locked { VSLockBadge() }
            Text(tag).font(Brand.font(10, .black)).tracking(0.6).foregroundStyle(tagColor)
        }
        .padding(.horizontal, 12)
        .frame(height: 66)
        .background {
            if r.state == .next {
                RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Color.white)
                    .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(teal, lineWidth: 2))
                    .shadow(color: Color(hex: 0x4C1D95).opacity(0.07), radius: 5, x: 0, y: 2)
            }
        }
        .opacity(r.state == .locked ? 0.55 : 1)
        .contentShape(Rectangle())
        return Button {
            guard r.state != .locked else { return }
            if isPro { play(BotPersonas.kind(forBotId: r.id)) } else { showPro = true }
        } label: { row }
        .buttonStyle(.plain)
        .allowsHitTesting(r.state != .locked)
        .accessibilityLabel("\(VsLobby.botName(r.id)), \(tag.lowercased()), \(r.line)")
    }

    // MARK: - BEAT YOUR BEST

    @ViewBuilder private var beatYourBest: some View {
        if !isPro || ghost != nil {
            VStack(alignment: .leading, spacing: 8) {
                VSSectionLabel(text: "BEAT YOUR BEST")
                HStack(spacing: 12) {
                    BotArtCircle(art: BotPersonas.art("ghost"), size: 40)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Beat your best").font(Brand.font(13, .black)).foregroundStyle(VsLobbyKit.deep)
                        Text(ghost.map { "Your best \(VsLobbyKit.modeName(mode)): \($0.guesses) guesses · \(VsLobby.vsClock(Int($0.timeMs)))" }
                             ?? "Race a ghost of your best \(VsLobbyKit.modeName(mode)) run.")
                            .font(Brand.font(11, .bold)).foregroundStyle(VsLobbyKit.sub).lineLimit(1).minimumScaleFactor(0.8)
                    }
                    Spacer(minLength: 4)
                    Button {
                        if isPro, let g = ghost { play(.ghost, ghost: g) } else { showPro = true }
                    } label: {
                        HStack(spacing: 4) {
                            if !isPro { VSLockBadge() }
                            VSSoftPill(title: "Race it")
                        }
                    }
                    .buttonStyle(PressableStyle())
                }
                .padding(12).vsCard()
            }
        }
    }
}
