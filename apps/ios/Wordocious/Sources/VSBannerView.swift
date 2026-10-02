import SwiftUI
import WordociousCore

/// The VS banner (VS overhaul, founder 2026-10-01; spec docs/VS_REDESIGN_SPEC.md
/// §1) — the home banner's one-window shape in VS teal: a frosted headline strip
/// over TODAY (the Daily Battle and the Bot of the Day) and RECORD (people, bots,
/// the ladder). Gold on a VS sweep. Every word comes from VsLobby
/// (WordociousCore), pinned to the web by vs-lobby-fixtures.json.
struct VSBannerView: View {
    let name: String
    let battle: VsDayResult
    /// "@kate" / "Lexi" for a finished Daily Battle.
    let battleOpponent: String?
    let botOfDay: VsDayResult
    /// The newest open challenge sent to the player (leads the headline).
    let incoming: VsChallenge?
    /// Bot win streak (the progression store Stats reads).
    let streak: Int
    let people: WinLoss
    let bots: WinLoss
    /// Rungs cleared; nil for free players (the ladder is Pro).
    let ladder: Int?
    let free: Bool
    let onBattle: () -> Void
    let onBotOfDay: () -> Void

    private var input: VsBannerInput {
        VsBannerInput(name: name, battle: battle, botOfDay: botOfDay, incomingFrom: incoming?.challenger.username, streak: streak)
    }
    private var sweep: Bool { VsLobby.vsSweep(battle: battle, botOfDay: botOfDay) }
    private var headInk: Color { sweep ? Color(hex: 0x78350F) : VsLobbyKit.deep }
    private var subInk: Color { sweep ? Color(hex: 0x92400E) : VsLobbyKit.ink }
    private var anyWon: Bool { battle == .won || botOfDay == .won }
    private var anyPlayed: Bool { battle != .open || botOfDay != .open }

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: 16, style: .continuous)
        VStack(spacing: 0) {
            strip
            todayRow.padding(.top, 10).padding(.horizontal, 12)
            recordRow.padding(.top, 10).padding(.horizontal, 12).padding(.bottom, 12)
        }
        .frame(maxWidth: .infinity)
        .background {
            ZStack {
                if sweep {
                    LinearGradient(colors: [Color(hex: 0xFDE68A), Color(hex: 0xFCD979)], startPoint: .top, endPoint: .bottom)
                } else {
                    LinearGradient(colors: [Color(hex: 0xD5F5EE), Color(hex: 0xE0F2FE)], startPoint: .top, endPoint: .bottom)
                }
                // The same white sheen as home.
                LinearGradient(stops: [.init(color: .white.opacity(0.35), location: 0), .init(color: .white.opacity(0), location: 0.55)],
                               startPoint: .topLeading, endPoint: .bottomTrailing)
                // One light band once either of today's battles is won (none under Reduce Motion).
                if anyWon && !Theme.reduceMotion { BannerSweep().allowsHitTesting(false) }
            }
        }
        .clipShape(shape)
        .shadow(color: sweep ? Color(hex: 0xF59E0B).opacity(0.8) : Color(hex: 0x134E4A).opacity(0.08),
                radius: sweep ? 13 : 7, x: 0, y: sweep ? 0 : 4)
        // The cast (docs/MASCOT_SPEC.md §1): S, the speedster, hosts VS — left of the share button.
        .bannerHost(Mascots.vs, trailing: anyPlayed ? 50 : 10)
    }

    // MARK: Frosted strip

    private var strip: some View {
        TimelineView(.periodic(from: .now, by: 1)) { ctx in
            let clock = VsLobby.vsBannerClockLine(input, clock: VsLobbyKit.utcCountdown(ctx.date), free: free,
                                                  challengeLeft: incoming.map { "\($0.hoursLeft)H" })
            VStack(alignment: .leading, spacing: 4) {
                HStack(alignment: .top, spacing: 6) {
                    HStack(spacing: 6) {
                        if sweep {
                            Icon3D(.trophy, size: 20)
                        }
                        Text(VsLobby.vsBannerHeadline(input))
                            .font(Brand.font(16, .black)).tracking(0.4).lineSpacing(3)
                            .foregroundStyle(headInk)
                            .fixedSize(horizontal: false, vertical: true)
                            .lineLimit(2)
                    }
                    .frame(maxWidth: .infinity, minHeight: 30, alignment: .leading)
                    .padding(.trailing, Mascots.bannerClearance)
                    // Nothing played yet: nothing to share, so no button (home parity).
                    if anyPlayed {
                        ShareLink(item: URL(string: "https://wordocious.com")!, message: Text(shareText)) {
                            Icon3D(.share, size: 24)
                                .frame(width: 36, height: 36).contentShape(Rectangle())
                        }
                        .accessibilityLabel("Share today's VS")
                    }
                }
                Text(clock)
                    .font(Brand.font(10.5, .heavy)).tracking(0.4).monospacedDigit()
                    .foregroundStyle(subInk)
                    .lineLimit(1).minimumScaleFactor(0.7)
            }
        }
        .padding(.top, 12).padding(.trailing, 8).padding(.bottom, 10).padding(.leading, 12)
        .background(Color.white.opacity(0.5))
    }

    private var shareText: String {
        "My Wordocious VS today: \(VsLobby.vsTodayStatus(battle: battle, botOfDay: botOfDay)) · \(VsLobby.vsRecordLine(people: people, bots: bots, ladder: ladder))"
    }

    // MARK: TODAY

    private var todayRow: some View {
        let bot = BotPersonas.botOfDay.name
        return VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                Text("TODAY").font(Brand.font(10, .black)).tracking(1).foregroundStyle(subInk)
                Text(VsLobby.vsTodayStatus(battle: battle, botOfDay: botOfDay))
                    .font(Brand.font(10, .black)).tracking(0.5).foregroundStyle(subInk)
            }
            HStack(spacing: 8) {
                VSDayTile(title: "DAILY BATTLE",
                          line: VsLobbyKit.tileLine(battle, opponent: battleOpponent, open: free ? "Classic · free" : "Classic · open"),
                          result: battle, icon: .swords, action: onBattle)
                VSDayTile(title: "BOT OF THE DAY",
                          line: VsLobbyKit.tileLine(botOfDay, opponent: bot, open: free ? "\(bot) · free" : "\(bot) · open"),
                          result: botOfDay, icon: .bot(BotPersonas.botOfDay.art), action: onBotOfDay)
            }
        }
    }

    // MARK: RECORD

    private var recordRow: some View {
        HStack(spacing: 6) {
            Text("RECORD").font(Brand.font(10, .black)).tracking(1).foregroundStyle(subInk)
            Text(VsLobby.vsRecordLine(people: people, bots: bots, ladder: ladder))
                .font(Brand.font(10, .black)).tracking(0.4).foregroundStyle(subInk)
                .lineLimit(1).minimumScaleFactor(0.7)
            Spacer(minLength: 4)
            if streak > 0 {
                HStack(spacing: 2) {
                    FlameMark(size: 12)
                    Text("\(streak)").font(Brand.font(12, .black)).foregroundStyle(Color(hex: 0xC2410C))
                }
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("\(streak) bot wins in a row")
            }
        }
    }
}

/// One of today's two battles. Open = white with a dashed teal border (tap to
/// play); won = solid teal with a glow; lost / draw = solid gray.
struct VSDayTile: View {
    enum Icon { case swords, bot(String) }
    let title: String
    let line: String
    let result: VsDayResult
    let icon: Icon
    let action: () -> Void

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: 12, style: .continuous)
        let solid = result != .open
        Button(action: action) {
            HStack(spacing: 8) {
                iconView(solid: solid)
                VStack(alignment: .leading, spacing: 1) {
                    Text(title).font(Brand.font(10, .black)).tracking(0.6)
                        .foregroundStyle(solid ? .white : VsLobbyKit.deep).lineLimit(1).minimumScaleFactor(0.8)
                    Text(line).font(Brand.font(11, .heavy))
                        .foregroundStyle(solid ? .white.opacity(0.92) : VsLobbyKit.ink).lineLimit(1).minimumScaleFactor(0.7)
                }
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 9).padding(.vertical, 9)
            .frame(maxWidth: .infinity)
            .background {
                switch result {
                case .open:
                    shape.fill(Color.white.opacity(0.85))
                    shape.strokeBorder(VsLobbyKit.ink.opacity(0.45), style: StrokeStyle(lineWidth: 1.5, dash: [3, 2.5]))
                case .won:
                    shape.fill(VsLobbyKit.ink).shadow(color: VsLobbyKit.ink.opacity(0.55), radius: 5)
                case .lost, .draw:
                    shape.fill(Color(hex: 0x9CA3AF))
                }
            }
            .contentShape(shape)
        }
        .buttonStyle(PressableStyle())
        .allowsHitTesting(result == .open)
        .accessibilityLabel("\(title), \(line)")
    }

    @ViewBuilder private func iconView(solid: Bool) -> some View {
        switch icon {
        case .swords:
            Image("swords").renderingMode(.template).resizable().scaledToFit()
                .frame(width: 15, height: 15).foregroundStyle(solid ? .white : VsLobbyKit.ink)
                .frame(width: 28, height: 28)
                .background(RoundedRectangle(cornerRadius: 8).fill(solid ? Color.white.opacity(0.2) : VsLobbyKit.soft))
        case .bot(let art):
            BotArtCircle(art: art, size: 28, background: solid ? Color.white.opacity(0.25) : VsLobbyKit.soft)
        }
    }
}
