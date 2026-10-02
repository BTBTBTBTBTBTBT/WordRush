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

    /// FINISH_SPEC §D3: the faceoff hero (W vs S) across the top of the banner.
    private var hasHero: Bool { ArtAsset.exists("art-scene-vs-faceoff") }
    private var accent: Color { sweep ? VsLobbyKit.gold : VsLobbyKit.ink }

    var body: some View {
        VStack(spacing: 0) {
            if hasHero { hero }
            strip
            todayRow.padding(.top, 10).padding(.horizontal, 12)
            recordRow.padding(.top, 10).padding(.horizontal, 12).padding(.bottom, 12)
        }
        .frame(maxWidth: .infinity)
        // §A1: a tinted banner card with its top bar (gold on a VS sweep).
        .vsTinted(accent, bar: sweep ? VsLobbyKit.goldBar : VsLobbyKit.tealBar, tint: sweep ? 0.16 : 0.09, line: 0.3)
        .overlay {
            // One light band once either of today's battles is won (none under Reduce Motion).
            if anyWon && !Theme.reduceMotion {
                BannerSweep().allowsHitTesting(false)
                    .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
            }
        }
        .shadow(color: sweep ? Color(hex: 0xF59E0B).opacity(0.55) : .clear, radius: sweep ? 12 : 0)
        // The cast (docs/MASCOT_SPEC.md §1): S, the speedster, hosts VS — the faceoff
        // hero already shows him (§A7: never twice), so he only peeks without it.
        .modifier(VSBannerHostIfNeeded(show: !hasHero, trailing: anyPlayed ? 50 : 10))
    }

    // MARK: Hero (W vs S)

    private var hero: some View {
        Image("art-scene-vs-faceoff")
            .resizable().interpolation(.high).scaledToFit()
            .frame(maxWidth: .infinity, maxHeight: 150)
            .padding(.horizontal, 18).padding(.top, 10).padding(.bottom, 2)
            .frame(maxWidth: .infinity)
            .background(
                RadialGradient(colors: [Color.white.opacity(0.55), Color.white.opacity(0)],
                               center: .center, startRadius: 10, endRadius: 190)
            )
            .allowsHitTesting(false)
            .accessibilityHidden(true)
    }

    // MARK: Headline strip

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
                    .padding(.trailing, hasHero ? 0 : Mascots.bannerClearance)
                    // Nothing played yet: nothing to share, so no button (home parity).
                    if anyPlayed {
                        ShareLink(item: URL(string: "https://wordocious.com")!, message: Text(shareText)) {
                            Icon3D(.share, size: 24)
                                .frame(width: 44, height: 44).contentShape(Rectangle())
                        }
                        .buttonStyle(.squishIcon)
                        .accessibilityLabel("Share today's VS")
                    }
                }
                Text(clock)
                    .font(Brand.font(10.5, .heavy)).tracking(0.4).monospacedDigit()
                    .foregroundStyle(subInk)
                    .lineLimit(1).minimumScaleFactor(0.7)
            }
        }
        .padding(.top, hasHero ? 4 : 12).padding(.trailing, 8).padding(.bottom, 10).padding(.leading, 12)
    }

    private var shareText: String {
        "My Wordocious VS today: \(VsLobby.vsTodayStatus(battle: battle, botOfDay: botOfDay)) · \(VsLobby.vsRecordLine(people: people, bots: bots, ladder: ladder))"
    }

    // MARK: TODAY

    private var todayRow: some View {
        let host = BotPersonas.botOfDay
        let bot = host.name
        return VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                Text("TODAY").font(Brand.font(10, .black)).tracking(1).foregroundStyle(subInk)
                Text(VsLobby.vsTodayStatus(battle: battle, botOfDay: botOfDay))
                    .font(Brand.font(10, .black)).tracking(0.5).foregroundStyle(subInk)
            }
            HStack(spacing: 8) {
                VSDayTile(title: "DAILY BATTLE",
                          line: VsLobbyKit.tileLine(battle, opponent: battleOpponent, open: free ? "Classic · free" : "Classic · open"),
                          result: battle, icon: .swords, accent: VsLobbyKit.ink, action: onBattle)
                VSDayTile(title: "BOT OF THE DAY",
                          line: VsLobbyKit.tileLine(botOfDay, opponent: bot, open: free ? "\(bot) · free" : "\(bot) · open"),
                          result: botOfDay, icon: .bot(host.art), accent: Color(hex: UInt(host.color)), action: onBotOfDay)
            }
        }
    }

    // MARK: RECORD

    private var recordRow: some View {
        HStack(spacing: 6) {
            Text("RECORD").font(Brand.font(10, .black)).tracking(1).foregroundStyle(subInk)
            Text(VsLobby.vsRecordLine(people: people, bots: bots, ladder: ladder))
                .font(Brand.font(10.5, .black)).tracking(0.4).foregroundStyle(VsLobbyKit.numberInk)
                .lineLimit(1).minimumScaleFactor(0.7)
            Spacer(minLength: 4)
            if streak > 0 {
                HStack(spacing: 3) {
                    Icon3D(.flame, size: 16)
                    Text("\(streak)").vsNumber(15)
                }
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("\(streak) bot wins in a row")
            }
        }
        .padding(.horizontal, 10).padding(.vertical, 7)
        .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(accent.wash(0.12)))
        .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(accent.wash(0.28), lineWidth: 1))
    }
}

/// S peeks over the banner only when the faceoff hero is missing.
private struct VSBannerHostIfNeeded: ViewModifier {
    let show: Bool
    let trailing: CGFloat
    @ViewBuilder func body(content: Content) -> some View {
        if show { content.bannerHost(Mascots.vs, trailing: trailing) } else { content }
    }
}

/// One of today's two battles as a §A1 mini card in its accent (VS teal for the
/// Daily Battle, the host bot's own color for the Bot of the Day): open = soft
/// wash + top bar (tap to play); won = purple wash + the W badge; lost / draw =
/// slate wash (+ the L badge on a loss).
struct VSDayTile: View {
    enum Icon { case swords, bot(String) }
    let title: String
    let line: String
    let result: VsDayResult
    let icon: Icon
    var accent: Color = VsLobbyKit.ink
    let action: () -> Void

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: 14, style: .continuous)
        let tone: Color = result == .won ? VsLobbyKit.purple : (result == .open ? accent : VsLobbyKit.slate)
        Button(action: action) {
            HStack(spacing: 8) {
                iconView
                VStack(alignment: .leading, spacing: 1) {
                    Text(title).font(Brand.font(10, .black)).tracking(0.6)
                        .foregroundStyle(VsLobbyKit.titleInk).lineLimit(1).minimumScaleFactor(0.8)
                    Text(line).font(Brand.font(11, .heavy))
                        .foregroundStyle(result == .open ? tone : VsLobbyKit.mutedInk).lineLimit(1).minimumScaleFactor(0.7)
                }
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 9).padding(.top, 12).padding(.bottom, 9)
            .frame(maxWidth: .infinity)
            .background {
                ZStack(alignment: .top) {
                    shape.fill(tone.wash(result == .open ? 0.13 : 0.18))
                    tone.frame(height: 4)
                }
                .clipShape(shape)
            }
            .overlay(shape.stroke(tone.wash(0.36), lineWidth: 1.5))
            .overlay(alignment: .topTrailing) {
                if result == .won || result == .lost {
                    RowResultBadge(won: result == .won, size: 20).offset(x: 5, y: -6)
                }
            }
            .shadow(color: tone.opacity(0.14), radius: 5, x: 0, y: 3)
            .contentShape(shape)
        }
        .buttonStyle(.squish)
        .allowsHitTesting(result == .open)
        .accessibilityLabel("\(title), \(line)")
    }

    @ViewBuilder private var iconView: some View {
        switch icon {
        case .swords:
            Image("swords").renderingMode(.template).resizable().scaledToFit()
                .frame(width: 15, height: 15).foregroundStyle(accent)
                .frame(width: 30, height: 30)
                .background(RoundedRectangle(cornerRadius: 9).fill(accent.wash(0.2)))
        case .bot(let art):
            // The host bot in character (its hero image).
            if ArtAsset.exists(art) {
                Image(art).resizable().interpolation(.high).scaledToFit()
                    .frame(width: 34, height: 34)
                    .accessibilityHidden(true)
            } else {
                BotArtCircle(art: art, size: 30)
            }
        }
    }
}
