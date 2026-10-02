import SwiftUI
import WordociousCore
#if canImport(UIKit)
import UIKit
#endif

/// Pro-only "Invite to a VS match" sheet — ports the web InviteModal
/// (components/invites/invite-modal.tsx): pick a mode, then either generate a
/// shareable join link or send a targeted invite to a username.
struct InviteSheet: View {
    @Environment(\.dismiss) private var dismiss

    enum Tab { case link, username }

    /// The 9 VS-capable modes, single-sourced from the home catalog so each row
    /// carries its real brand icon + accent (excludes the VS card, which has no
    /// dbKey). Order matches the home grid.
    private var inviteModes: [HomeMode] { homeModes.filter { $0.dbKey != nil } }
    private var selectedHome: HomeMode { inviteModes.first { $0.dbKey == mode.rawValue } ?? inviteModes[0] }

    @State private var mode: GameMode = .duel
    @State private var modeOpen = false

    init(mode: GameMode = .duel) {
        _mode = State(initialValue: mode)
    }
    @State private var tab: Tab = .link
    @State private var username = ""
    @State private var busy = false
    @State private var error: String?
    @State private var inviteURL: String?
    @State private var sentTo: String?
    @State private var copied = false

    private var modeLabel: String { selectedHome.title }
    private let pink = Color(hex: 0xEC4899)

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                // Header — I's invite scene (ART_SPEC §7) over the gradient title +
                // subtitle, X close (matches web modal)
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 4) {
                        if ArtScene.invite.isAvailable { SceneArt(.invite, height: 110).padding(.bottom, 4) }
                        Text("INVITE A FRIEND")
                            .font(Brand.font(24, .black))
                            .foregroundStyle(LinearGradient(colors: [Color(hex: 0xA78BFA), Color(hex: 0xEC4899)], startPoint: .leading, endPoint: .trailing))
                        Text("Pick a mode, then send a link or a username invite.")
                            .font(Brand.font(12, .bold)).foregroundStyle(FinishInk.secondary)
                    }
                    Spacer()
                    HeaderCircleButton(.symbol("xmark"), size: 32, label: "Close") { dismiss() }
                }

                    // Mode picker — a custom inline dropdown (styled with each
                    // mode's brand icon + accent). Expands in place and pushes the
                    // content down, instead of a floating menu that overlapped and
                    // hid the buttons underneath.
                    VStack(alignment: .leading, spacing: 6) {
                        FinishLabel("Game mode")
                        VStack(spacing: 0) {
                            // Trigger row (shows the selected mode).
                            Button {
                                withAnimation(Theme.animation(.easeInOut(duration: 0.22))) { modeOpen.toggle() }
                            } label: {
                                HStack(spacing: 10) {
                                    ModeIconView(icon: selectedHome.icon, accent: selectedHome.accent, box: 30)
                                    Text(modeLabel).font(Brand.font(16, .black)).foregroundStyle(FinishInk.heading)
                                    Spacer()
                                    Image(systemName: "chevron.down")
                                        .font(.system(size: 12, weight: .bold)).foregroundStyle(selectedHome.accent)
                                        .rotationEffect(.degrees(modeOpen ? 180 : 0))
                                }
                                .padding(.horizontal, 12).padding(.vertical, 10)
                                .contentShape(Rectangle())
                            }.buttonStyle(.squish)

                            // Expanded list — one styled row per mode.
                            if modeOpen {
                                G5Divider(accent: selectedHome.accent).padding(.horizontal, 8)
                                VStack(spacing: 2) {
                                    ForEach(inviteModes) { hm in modeRow(hm) }
                                }
                                .padding(.horizontal, 6).padding(.top, 4).padding(.bottom, 6)
                            }
                        }
                        // §A1: the picker is a tinted tile in the mode's accent.
                        .g5Option(active: modeOpen, accent: selectedHome.accent, radius: 14)
                    }

                    // Tabs — the shared soft segmented toggle (§A9 squish).
                    SoftSegmented(options: [(key: Tab.link, label: "Share link"), (key: Tab.username, label: "Username")],
                                  selection: Binding(get: { tab }, set: { tab = $0; error = nil }),
                                  accent: pink, accessibilityLabel: "Invite by")

                    if tab == .link { linkTab } else { usernameTab }

                    if let error {
                        G5Notice(error, tone: .error)
                    }
                }
                .padding(18)
            }
            // §A1: the sheet sits on a soft pink wash, never plain white.
            .background(G5SheetBackground(accent: pink))
    }

    // MARK: Mode picker row

    private func modeRow(_ hm: HomeMode) -> some View {
        let selected = hm.dbKey == mode.rawValue
        return Button {
            if let m = hm.dbKey.flatMap({ GameMode(rawValue: $0) }) { mode = m; reset() }
            withAnimation(Theme.animation(.easeInOut(duration: 0.2))) { modeOpen = false }
        } label: {
            HStack(spacing: 10) {
                ModeIconView(icon: hm.icon, accent: hm.accent, box: 28)
                Text(hm.title).font(Brand.font(14, .heavy)).foregroundStyle(FinishInk.heading)
                Spacer()
                if selected {
                    Image(systemName: "checkmark").font(.system(size: 12, weight: .black)).foregroundStyle(hm.accent)
                }
            }
            .padding(.horizontal, 8).padding(.vertical, 8)
            .frame(maxWidth: .infinity)
            .background(RoundedRectangle(cornerRadius: 10).fill(selected ? hm.accent.opacity(0.14) : Color.clear))
            .contentShape(Rectangle())
        }.buttonStyle(.squish)
    }

    // MARK: Tabs

    @ViewBuilder private var linkTab: some View {
        if let url = inviteURL {
            VStack(alignment: .leading, spacing: 10) {
                // §T1: the invite code on the game kit's glossy letter tiles.
                if let code = url.split(separator: "/").last.map(String.init), !code.isEmpty {
                    VStack(spacing: 6) {
                        FinishLabel("Invite code")
                        FriendsCodeTiles(code: code, tile: code.count > 8 ? 26 : 32)
                    }
                    .frame(maxWidth: .infinity)
                }
                Text(url).font(Brand.font(13, .semibold)).foregroundStyle(FinishInk.heading)
                    .lineLimit(2).truncationMode(.middle)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .g5Field(pink)
                // §A8: candy buttons — quiet peach Copy, pink Share.
                HStack(spacing: 10) {
                    Button { copy(url) } label: {
                        CandyLabel(title: copied ? "Copied!" : "Copy", symbol: copied ? "checkmark" : "doc.on.doc")
                    }
                    .buttonStyle(CandyButtonStyle(variant: copied ? .teal : .peach, size: .medium))
                    Button { share(url) } label: {
                        CandyLabel(title: "Share") { Icon3D(.share, size: 18) }
                    }
                    .buttonStyle(CandyButtonStyle(variant: .pink, size: .medium))
                }
                Text("Link expires in 24 hours.")
                    .font(Brand.font(10, .bold)).foregroundStyle(FinishInk.secondary)
                    .frame(maxWidth: .infinity, alignment: .center)
            }
        } else {
            Button { createLink() } label: {
                CandyLabel(title: busy ? "Creating…" : "Create Invite Link", symbol: "link")
            }
            .buttonStyle(CandyButtonStyle(variant: .pink, size: .large))
            .disabled(busy)
        }
    }

    @ViewBuilder private var usernameTab: some View {
        if let sent = sentTo {
            // §T1: INVITE SENT! — I tossing the star envelope, the name on a glossy pill,
            // candy Send another / Done.
            FriendsInviteSentCard(name: sent, line: "They'll see it the next time they open Wordocious.",
                                  onSendAnother: { reset() }, onDone: { dismiss() })
        } else {
            VStack(alignment: .leading, spacing: 10) {
                FinishLabel("Username")
                TextField("e.g. wordmaster", text: $username)
                    .textInputAutocapitalization(.never).autocorrectionDisabled()
                    .foregroundStyle(FinishInk.heading)
                    .g5Field(pink)
                Button { sendToUsername() } label: {
                    CandyLabel(title: busy ? "Sending…" : "Send Invite", symbol: "paperplane.fill")
                }
                .buttonStyle(CandyButtonStyle(variant: .pink, size: .large))
                .disabled(busy)
            }
        }
    }

    // MARK: Actions

    private func reset() { inviteURL = nil; sentTo = nil; copied = false; error = nil }

    private func createLink() {
        busy = true; error = nil
        Task {
            let r = await InviteService.createInvite(gameMode: mode, inviteeUsername: nil)
            busy = false
            if let code = r.code { inviteURL = "https://wordocious.com/vs/join/\(code)" }
            else { error = r.error ?? "Failed to create invite" }
        }
    }

    private func sendToUsername() {
        let clean = username.trimmingCharacters(in: .whitespaces).replacingOccurrences(of: "@", with: "")
        if clean.isEmpty { error = "Enter a username"; return }
        busy = true; error = nil
        Task {
            let r = await InviteService.createInvite(gameMode: mode, inviteeUsername: clean)
            busy = false
            if r.code != nil { sentTo = clean } else { error = r.error ?? "Failed to send invite" }
        }
    }

    private func copy(_ url: String) {
        #if canImport(UIKit)
        UIPasteboard.general.string = url
        #endif
        copied = true
    }

    private func share(_ url: String) {
        ShareEvents.log(kind: "link_invite", gameMode: mode.rawValue, surface: "invite_sheet")
        #if canImport(UIKit)
        // FINISH_SPEC §S4: the shared invite copy; the link rides as its own item.
        let text = ShareCopy.vsInvite(game: modeLabel, url: "").trimmingCharacters(in: .whitespaces)
        let items: [Any] = [text, URL(string: url) ?? url]
        let av = UIActivityViewController(activityItems: items, applicationActivities: nil)
        guard let scene = UIApplication.shared.connectedScenes.first(where: { $0.activationState == .foregroundActive }) as? UIWindowScene,
              let root = scene.windows.first(where: { $0.isKeyWindow })?.rootViewController else { return }
        var top = root
        while let p = top.presentedViewController { top = p }
        av.popoverPresentationController?.sourceView = top.view
        av.popoverPresentationController?.sourceRect = CGRect(x: top.view.bounds.midX, y: top.view.bounds.midY, width: 0, height: 0)
        top.present(av, animated: true)
        #endif
    }
}
