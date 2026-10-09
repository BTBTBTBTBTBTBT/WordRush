import SwiftUI
import WordociousCore

/// "Have a code?" (FRIDAY-QUEUE 9f): ONE obvious family button that opens a paste/type sheet. It takes a
/// bare code or any invite link (core BrandedInvite.parseTyped) and tells the host what it found; the
/// host opens the screen that accepts it. Hidden when `branded_invites` is off. Self-contained: the VS
/// lobby and the Friends tab each place `HaveACodeButton(onResolved:)`.
/// Mirrors web components/invites/have-a-code.tsx.
enum HaveACodeResult: Equatable {
    case race(code: String)
    case live(mode: GameMode, code: String)
    /// A friend / gift link: the web referral flow (wordocious.com/join/<CODE>).
    case friend(code: String)
}

struct HaveACodeButton: View {
    var color: CastColor = .teal
    var fullWidth = true
    var onResolved: (HaveACodeResult) -> Void

    @State private var open = false

    var body: some View {
        if FlagsService.shared.isLive(BrandedInvite.switchKey) {
            Button { open = true } label: { CandyLabel(title: "Have a code?") }
                .buttonStyle(CastButtonStyle(color: color, size: .medium, fullWidth: fullWidth))
                .softSheet(isPresented: $open) {
                    HaveACodeSheet(color: color) { result in
                        open = false
                        onResolved(result)
                    }
                }
        }
    }
}

struct HaveACodeSheet: View {
    var color: CastColor = .teal
    var onResolved: (HaveACodeResult) -> Void

    @State private var typed = ""
    @State private var error: String?
    @State private var busy = false
    @FocusState private var focused: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("HAVE A CODE?").font(Brand.font(16, .black)).foregroundStyle(VsLobbyKit.titleInk)
            Text("Paste the invite link or type the code your friend sent.")
                .font(Brand.font(12.5, .bold)).foregroundStyle(VsLobbyKit.mutedInk)
            TextField("Link or CODE", text: $typed)
                .textInputAutocapitalization(.characters).autocorrectionDisabled()
                .focused($focused)
                .font(Brand.font(15, .heavy)).tracking(1)
                .foregroundStyle(VsLobbyKit.numberInk)
                .padding(.horizontal, 12).frame(height: 46)
                .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(Color(hex: 0x8B5CF6).opacity(0.12)))
                .onChange(of: typed) { _ in error = nil }
                .onSubmit { go() }
            if let error { Text(error).font(Brand.body(12.5)).foregroundStyle(Color(hex: 0xDC2626)) }
            HStack(spacing: 8) {
                Button { if let s = UIPasteboard.general.string { typed = String(s.trimmingCharacters(in: .whitespacesAndNewlines).prefix(120)) } } label: {
                    CandyLabel(title: "Paste")
                }
                .buttonStyle(CastButtonStyle(color: .slate, size: .medium, fullWidth: false))
                Button { go() } label: {
                    CandyLabel(title: "Join") { if busy { ProgressView().controlSize(.small).tint(.white) } }
                }
                .buttonStyle(CastButtonStyle(color: color, size: .medium, fullWidth: true))
                .disabled(busy || typed.trimmingCharacters(in: .whitespaces).count < 4)
            }
        }
        .padding(.horizontal, 18).padding(.vertical, 20)
        .onAppear { focused = true }
    }

    private func go() {
        guard !busy, let parsed = BrandedInvite.parseTyped(typed) else {
            if !busy { error = "That does not look like an invite code or link." }
            return
        }
        if parsed.kind == .friend { onResolved(.friend(code: parsed.code)); return }
        busy = true
        Task {
            defer { busy = false }
            // A race-my-run challenge first, then a live private-match code (the order the lobby always used).
            if case .success = await VsChallengeService.get(code: parsed.code) {
                onResolved(.race(code: parsed.code))
            } else if let mode = await InviteService.lookupMode(code: parsed.code) {
                onResolved(.live(mode: mode, code: parsed.code))
            } else {
                error = "No match found for that code."
            }
        }
    }
}
