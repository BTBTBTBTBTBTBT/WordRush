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

    /// Same modes + labels as the web MODES list (mixed-case display).
    private let modes: [(mode: GameMode, label: String)] = [
        (.duel, "Classic"), (.quordle, "QuadWord"), (.octordle, "OctoWord"),
        (.sequence, "Succession"), (.rescue, "Deliverance"), (.duel6, "Six"),
        (.duel7, "Seven"), (.gauntlet, "Gauntlet"), (.propernoundle, "ProperNoundle"),
    ]

    @State private var mode: GameMode = .duel
    @State private var tab: Tab = .link
    @State private var username = ""
    @State private var busy = false
    @State private var error: String?
    @State private var inviteURL: String?
    @State private var sentTo: String?
    @State private var copied = false

    private var modeLabel: String { modes.first { $0.mode == mode }?.label ?? "Classic" }
    private let pink = Color(hex: 0xEC4899), pinkDark = Color(hex: 0xDB2777)

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Text("Invite a friend to a head-to-head match.")
                        .font(Brand.font(13, .bold)).foregroundStyle(Theme.textSecondary)

                    // Mode picker
                    VStack(alignment: .leading, spacing: 6) {
                        Text("GAME MODE").font(Brand.font(10, .black)).tracking(0.6).foregroundStyle(Theme.textMuted)
                        Menu {
                            ForEach(modes, id: \.mode) { m in
                                Button(m.label) { mode = m.mode; reset() }
                            }
                        } label: {
                            HStack {
                                Circle().fill(ModeStyle.accent(mode)).frame(width: 12, height: 12)
                                Text(modeLabel).font(Brand.font(15, .black)).foregroundStyle(Theme.textPrimary)
                                Spacer()
                                Image(systemName: "chevron.down").font(.system(size: 12, weight: .bold)).foregroundStyle(Theme.textMuted)
                            }
                            .padding(.horizontal, 14).padding(.vertical, 12)
                            .background(RoundedRectangle(cornerRadius: 12).fill(Theme.background))
                            .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.border, lineWidth: 1.5))
                        }
                    }

                    // Tabs
                    HStack(spacing: 0) {
                        tabButton("Share Link", .link)
                        tabButton("By Username", .username)
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
            .navigationTitle("Invite to VS").navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("Done") { dismiss() } } }
        }
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
                Button("Create a different link") { reset() }
                    .font(Brand.font(11, .bold)).foregroundStyle(Theme.textMuted)
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
                Text("They'll see it in their pending invites.").font(Brand.font(12, .bold)).foregroundStyle(Theme.textMuted)
                Button("Send another") { reset() }.font(Brand.font(11, .bold)).foregroundStyle(Theme.textMuted).padding(.top, 4)
            }
            .frame(maxWidth: .infinity).padding(.vertical, 8)
        } else {
            VStack(spacing: 10) {
                TextField("@username", text: $username)
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
