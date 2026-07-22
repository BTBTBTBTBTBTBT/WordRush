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
    @State private var tab: Tab = .link
    @State private var username = ""
    @State private var busy = false
    @State private var error: String?
    @State private var inviteURL: String?
    @State private var sentTo: String?
    @State private var copied = false

    private var modeLabel: String { selectedHome.title }
    private let pink = Color(hex: 0xEC4899), pinkDark = Color(hex: 0xDB2777)

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                // Header — gradient title + subtitle + X close (matches web modal)
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("INVITE A FRIEND")
                            .font(Brand.font(24, .black))
                            .foregroundStyle(LinearGradient(colors: [Color(hex: 0xA78BFA), Color(hex: 0xEC4899)], startPoint: .leading, endPoint: .trailing))
                        Text("Pick a mode, then send a link or a username invite.")
                            .font(Brand.font(12, .bold)).foregroundStyle(Theme.textMuted)
                    }
                    Spacer()
                    Button { dismiss() } label: {
                        Image(systemName: "xmark")
                            .font(.system(size: 13, weight: .bold)).foregroundStyle(Theme.textMuted)
                            .frame(width: 32, height: 32)
                            .background(Circle().fill(Theme.surfaceHover))
                    }.buttonStyle(.plain)
                }

                    // Mode picker — a custom inline dropdown (styled with each
                    // mode's brand icon + accent). Expands in place and pushes the
                    // content down, instead of a floating menu that overlapped and
                    // hid the buttons underneath.
                    VStack(alignment: .leading, spacing: 6) {
                        Text("GAME MODE").font(Brand.font(10, .black)).tracking(0.6).foregroundStyle(Theme.textMuted)
                        VStack(spacing: 0) {
                            // Trigger row (shows the selected mode).
                            Button {
                                withAnimation(Theme.animation(.easeInOut(duration: 0.22))) { modeOpen.toggle() }
                            } label: {
                                HStack(spacing: 10) {
                                    ModeIconView(icon: selectedHome.icon, accent: selectedHome.accent, box: 30)
                                    Text(modeLabel).font(Brand.font(16, .black)).foregroundStyle(Theme.textPrimary)
                                    Spacer()
                                    Image(systemName: "chevron.down")
                                        .font(.system(size: 12, weight: .bold)).foregroundStyle(selectedHome.accent)
                                        .rotationEffect(.degrees(modeOpen ? 180 : 0))
                                }
                                .padding(.horizontal, 12).padding(.vertical, 10)
                                .contentShape(Rectangle())
                            }.buttonStyle(.plain)

                            // Expanded list — one styled row per mode.
                            if modeOpen {
                                Divider().overlay(Theme.border).padding(.horizontal, 8)
                                VStack(spacing: 2) {
                                    ForEach(inviteModes) { hm in modeRow(hm) }
                                }
                                .padding(.horizontal, 6).padding(.top, 4).padding(.bottom, 6)
                            }
                        }
                        .background(RoundedRectangle(cornerRadius: 14).fill(Theme.background))
                        .overlay(RoundedRectangle(cornerRadius: 14).stroke(modeOpen ? selectedHome.accent : Theme.border, lineWidth: 1.5))
                    }

                    // Tabs
                    HStack(spacing: 0) {
                        tabButton("Share link", .link)
                        tabButton("Username", .username)
                    }
                    .background(RoundedRectangle(cornerRadius: 10).fill(Theme.background))
                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(Theme.border, lineWidth: 1))

                    if tab == .link { linkTab } else { usernameTab }

                    if let error {
                        Text(error).font(Brand.font(12, .bold)).foregroundStyle(Color(hex: 0xDC2626))
                    }
                }
                .padding(18)
            }
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
                Text(hm.title).font(Brand.font(14, .heavy)).foregroundStyle(Theme.textPrimary)
                Spacer()
                if selected {
                    Image(systemName: "checkmark").font(.system(size: 12, weight: .black)).foregroundStyle(hm.accent)
                }
            }
            .padding(.horizontal, 8).padding(.vertical, 8)
            .frame(maxWidth: .infinity)
            .background(RoundedRectangle(cornerRadius: 10).fill(selected ? hm.accent.opacity(0.10) : Color.clear))
            .contentShape(Rectangle())
        }.buttonStyle(.plain)
    }

    // MARK: Tabs

    private func tabButton(_ title: String, _ t: Tab) -> some View {
        let active = tab == t
        return Button { tab = t; error = nil } label: {
            Text(title).font(Brand.font(13, .black))
                .foregroundStyle(active ? .white : Theme.textMuted)
                .frame(maxWidth: .infinity).padding(.vertical, 9)
                .background(RoundedRectangle(cornerRadius: 8).fill(active ? Theme.primary : .clear))
        }
        .buttonStyle(.plain).padding(2)
    }

    @ViewBuilder private var linkTab: some View {
        if let url = inviteURL {
            VStack(alignment: .leading, spacing: 10) {
                Text(url).font(Brand.font(13, .semibold)).foregroundStyle(Theme.textSecondary)
                    .lineLimit(2).truncationMode(.middle)
                    .padding(12).frame(maxWidth: .infinity, alignment: .leading)
                    .background(RoundedRectangle(cornerRadius: 10).fill(Theme.background))
                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(Theme.border, lineWidth: 1))
                HStack(spacing: 10) {
                    Button { copy(url) } label: {
                        Label(copied ? "Copied!" : "Copy", systemImage: copied ? "checkmark" : "doc.on.doc")
                            .font(Brand.font(13, .black)).frame(maxWidth: .infinity).padding(.vertical, 11)
                            .background(RoundedRectangle(cornerRadius: 10).fill(Theme.surfaceHover)).foregroundStyle(Theme.textPrimary)
                    }.buttonStyle(.plain)
                    Button { share(url) } label: {
                        Label("Share", systemImage: "square.and.arrow.up")
                            .font(Brand.font(13, .black)).frame(maxWidth: .infinity).padding(.vertical, 11)
                            .foregroundStyle(.white)
                            .background(RoundedRectangle(cornerRadius: 10).fill(LinearGradient(colors: [pink, pinkDark], startPoint: .topLeading, endPoint: .bottomTrailing)))
                    }.buttonStyle(.plain)
                }
                Text("Link expires in 24 hours.")
                    .font(Brand.font(10, .bold)).foregroundStyle(Theme.textMuted)
                    .frame(maxWidth: .infinity, alignment: .center)
            }
        } else {
            Button { createLink() } label: {
                Text(busy ? "Creating…" : "Create Invite Link")
                    .font(Brand.font(14, .black)).foregroundStyle(.white)
                    .frame(maxWidth: .infinity).padding(.vertical, 13)
                    .background(RoundedRectangle(cornerRadius: 12).fill(LinearGradient(colors: [pink, pinkDark], startPoint: .topLeading, endPoint: .bottomTrailing)))
            }.buttonStyle(.plain).disabled(busy)
        }
    }

    @ViewBuilder private var usernameTab: some View {
        if let sent = sentTo {
            VStack(spacing: 8) {
                Image(systemName: "checkmark.circle.fill").font(.system(size: 32)).foregroundStyle(Color(hex: 0x22C55E))
                Text("Invite sent to @\(sent)").font(Brand.font(14, .black)).foregroundStyle(Theme.textPrimary)
                Text("They'll see it the next time they open Wordocious.").font(Brand.font(12, .bold)).foregroundStyle(Theme.textMuted).multilineTextAlignment(.center)
                Button("Send another") { reset() }.font(Brand.font(11, .bold)).foregroundStyle(Theme.textMuted).padding(.top, 4)
            }
            .frame(maxWidth: .infinity).padding(.vertical, 8)
        } else {
            VStack(alignment: .leading, spacing: 10) {
                Text("USERNAME").font(Brand.font(10, .black)).tracking(0.6).foregroundStyle(Theme.textMuted)
                TextField("e.g. wordmaster", text: $username)
                    .textInputAutocapitalization(.never).autocorrectionDisabled()
                    .padding(12).background(RoundedRectangle(cornerRadius: 10).fill(Theme.background))
                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(Theme.border, lineWidth: 1))
                Button { sendToUsername() } label: {
                    Text(busy ? "Sending…" : "Send Invite")
                        .font(Brand.font(14, .black)).foregroundStyle(.white)
                        .frame(maxWidth: .infinity).padding(.vertical, 13)
                        .background(RoundedRectangle(cornerRadius: 12).fill(LinearGradient(colors: [pink, pinkDark], startPoint: .topLeading, endPoint: .bottomTrailing)))
                }.buttonStyle(.plain).disabled(busy)
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
        let text = "Come play me on Wordocious — \(modeLabel)."
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
