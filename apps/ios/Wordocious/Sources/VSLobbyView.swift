import SwiftUI
import WordociousCore

/// VS Battle lobby — entry point from the Home "VS Battle" card.
/// Free users get one daily Classic VS; Pro unlocks all modes, private-match
/// invites (create + join by code), and rematches. Mirrors the web's freemium
/// VS gating (vs-game.tsx dailyVsActive + Pro-only modes/invites).
struct VSLobbyView: View {
    @ObservedObject private var auth = AuthService.shared
    struct PendingInvite: Identifiable { let id = UUID(); let mode: GameMode; let code: String }

    @State private var joinCode = ""
    @State private var lookupError: String?
    @State private var pendingInvite: PendingInvite?
    @State private var creatingInvite: GameMode?

    /// Standard board modes supported by native VS today (Gauntlet + ProperNoundle
    /// VS have bespoke flows and are a follow-up).
    private let modes: [GameMode] = [.duel, .duel6, .duel7, .quordle, .octordle, .sequence, .rescue]

    private var isPro: Bool { auth.isProActive }

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                header
                if isPro { proContent } else { freeContent }
            }
            .padding(.horizontal, 16).padding(.bottom, 24)
        }
        .background(LinearGradient(colors: [Theme.background, Theme.backgroundGradientEnd], startPoint: .top, endPoint: .bottom).ignoresSafeArea())
        .navigationTitle("VS Battle")
        .navigationBarTitleDisplayMode(.inline)
        // Launch a private match once an invite is created or a code resolves.
        .fullScreenCover(item: $pendingInvite) { inv in
            NavigationStack { VSGameView(mode: inv.mode, inviteCode: inv.code) }
        }
    }

    private var header: some View {
        VStack(spacing: 6) {
            Image("swords").renderingMode(.template).resizable().scaledToFit()
                .frame(width: 40, height: 40).foregroundStyle(Color(hex: 0x0D9488))
            Text("VS Battle").font(Brand.title(30)).foregroundStyle(Theme.textPrimary)
            Text("Race a live opponent on the same puzzle").font(Brand.body(13)).foregroundStyle(Theme.textMuted)
        }
        .padding(.top, 8).padding(.bottom, 4)
    }

    // MARK: - Free

    private var freeContent: some View {
        VStack(spacing: 12) {
            NavigationLink {
                VSGameView(mode: .duel, isDaily: true)
            } label: {
                ctaLabel(title: "Play Daily VS", subtitle: "One free Classic match a day", gradient: [Color(hex: 0x14B8A6), Color(hex: 0x0D9488)])
            }.buttonStyle(.plain)

            proUpsell
        }
    }

    private var proUpsell: some View {
        VStack(spacing: 8) {
            Text("Unlock with Pro").font(Brand.font(12, .heavy)).tracking(0.6).foregroundStyle(Theme.textMuted)
            VStack(alignment: .leading, spacing: 6) {
                upsellRow("All modes in VS — unlimited matches")
                upsellRow("Private matches: invite friends by code")
                upsellRow("Rematches")
            }
            NavigationLink { ProView() } label: {
                Label("Go Pro", systemImage: "crown.fill").font(Brand.font(14, .black)).foregroundStyle(.white)
                    .frame(maxWidth: .infinity).padding(.vertical, 12)
                    .background(RoundedRectangle(cornerRadius: 12).fill(LinearGradient(colors: [Color(hex: 0xF59E0B), Color(hex: 0xD97706)], startPoint: .topLeading, endPoint: .bottomTrailing)))
            }.buttonStyle(.plain)
        }
        .padding(16).frame(maxWidth: .infinity)
        .background(RoundedRectangle(cornerRadius: 16).fill(Theme.surface)).overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1.5))
    }

    private func upsellRow(_ t: String) -> some View {
        HStack(spacing: 8) {
            Image(systemName: "checkmark.circle.fill").font(.system(size: 13)).foregroundStyle(Color(hex: 0xD97706))
            Text(t).font(Brand.font(12, .bold)).foregroundStyle(Theme.textSecondary)
            Spacer(minLength: 0)
        }
    }

    // MARK: - Pro

    private var proContent: some View {
        VStack(spacing: 14) {
            section("QUICK MATCH")
            ForEach(modes, id: \.self) { m in
                NavigationLink { VSGameView(mode: m) } label: { modeRow(m) }.buttonStyle(.plain)
            }

            section("PRIVATE MATCH")
            joinByCode
            createInvite
        }
    }

    private var joinByCode: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Join with a code").font(Brand.font(13, .heavy)).foregroundStyle(Theme.textSecondary)
            HStack(spacing: 8) {
                TextField("CODE", text: $joinCode)
                    .textInputAutocapitalization(.characters).autocorrectionDisabled()
                    .font(Brand.font(15, .heavy)).tracking(2)
                    .padding(10).background(RoundedRectangle(cornerRadius: 10).fill(Theme.background)).overlay(RoundedRectangle(cornerRadius: 10).stroke(Theme.border, lineWidth: 1.5))
                Button("Join") { joinWithCode() }
                    .font(Brand.font(14, .black)).foregroundStyle(.white)
                    .padding(.horizontal, 18).padding(.vertical, 11)
                    .background(RoundedRectangle(cornerRadius: 10).fill(Theme.primary))
                    .disabled(joinCode.trimmingCharacters(in: .whitespaces).count < 4)
            }
            if let e = lookupError { Text(e).font(Brand.body(12)).foregroundStyle(Color(hex: 0xDC2626)) }
        }
        .padding(16).frame(maxWidth: .infinity)
        .background(RoundedRectangle(cornerRadius: 16).fill(Theme.surface)).overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1.5))
    }

    private var createInvite: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Create a private match").font(Brand.font(13, .heavy)).foregroundStyle(Theme.textSecondary)
            Text("Pick a mode — we'll generate a code to share. Your friend joins with it.")
                .font(Brand.body(12)).foregroundStyle(Theme.textMuted)
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
                ForEach(modes, id: \.self) { m in
                    Button { createInvite(for: m) } label: {
                        HStack(spacing: 6) {
                            if creatingInvite == m { ProgressView().controlSize(.small) }
                            Text(ModeStyle.title(m)).font(Brand.font(12, .black)).foregroundStyle(Theme.textPrimary)
                        }
                        .frame(maxWidth: .infinity).padding(.vertical, 10)
                        .background(RoundedRectangle(cornerRadius: 10).fill(Theme.background)).overlay(RoundedRectangle(cornerRadius: 10).stroke(Theme.border, lineWidth: 1.5))
                    }.buttonStyle(.plain).disabled(creatingInvite != nil)
                }
            }
        }
        .padding(16).frame(maxWidth: .infinity)
        .background(RoundedRectangle(cornerRadius: 16).fill(Theme.surface)).overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1.5))
    }

    // MARK: - Actions

    private func joinWithCode() {
        let code = joinCode.trimmingCharacters(in: .whitespaces).uppercased()
        lookupError = nil
        Task {
            if let mode = await InviteService.lookupMode(code: code) {
                pendingInvite = PendingInvite(mode: mode, code: code)
            } else {
                lookupError = "No match found for that code."
            }
        }
    }

    private func createInvite(for mode: GameMode) {
        creatingInvite = mode
        Task {
            let code = await InviteService.createInvite(gameMode: mode)
            creatingInvite = nil
            if let code { pendingInvite = PendingInvite(mode: mode, code: code) }
            else { lookupError = "Couldn't create an invite. Try again." }
        }
    }

    // MARK: - Bits

    private func section(_ t: String) -> some View {
        Text(t).font(Brand.font(11, .heavy)).tracking(0.8).foregroundStyle(Theme.textMuted)
            .frame(maxWidth: .infinity, alignment: .leading).padding(.top, 4)
    }

    private func modeRow(_ m: GameMode) -> some View {
        HStack {
            Text(ModeStyle.title(m)).font(Brand.font(16, .black))
                .foregroundStyle(LinearGradient(colors: ModeStyle.gradient(m), startPoint: .leading, endPoint: .trailing))
            Spacer()
            Image(systemName: "chevron.right").font(.system(size: 13, weight: .bold)).foregroundStyle(Theme.textMuted)
        }
        .padding(16).frame(maxWidth: .infinity)
        .background(RoundedRectangle(cornerRadius: 14).fill(Theme.surface)).overlay(RoundedRectangle(cornerRadius: 14).stroke(Theme.border, lineWidth: 1.5))
    }

    private func ctaLabel(title: String, subtitle: String, gradient: [Color]) -> some View {
        VStack(spacing: 4) {
            Text(title).font(Brand.font(18, .black)).foregroundStyle(.white)
            Text(subtitle).font(Brand.font(12, .bold)).foregroundStyle(.white.opacity(0.85))
        }
        .frame(maxWidth: .infinity).padding(.vertical, 18)
        .background(RoundedRectangle(cornerRadius: 16).fill(LinearGradient(colors: gradient, startPoint: .topLeading, endPoint: .bottomTrailing)))
    }
}
