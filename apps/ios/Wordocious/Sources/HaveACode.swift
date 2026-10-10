import SwiftUI
import WordociousCore

/// "Have a code?" (FRIDAY-QUEUE 9f): a button that opens a paste/type sheet. It takes a
/// bare code or any invite link (core BrandedInvite.parseTyped) and tells the host what it found; the
/// host opens the screen that accepts it. Hidden when `branded_invites` is off. Self-contained: the VS
/// lobby places the full-width `HaveACodeButton(onResolved:)`; the Friends tab places the small `quiet`
/// pill beside Add a friend (2.8 TestFlight: it must not lead the page).
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
    /// Friends tab: a small quiet pill (the family QUIET button), never a hero button.
    var quiet = false
    var onResolved: (HaveACodeResult) -> Void

    @State private var open = false

    var body: some View {
        if FlagsService.shared.isLive(BrandedInvite.switchKey) {
            Group {
                if quiet {
                    Button { open = true } label: { CandyLabel(title: "Have a code?", symbol: "link") }
                        .buttonStyle(QuietButtonStyle(size: .small, fullWidth: false))
                } else {
                    Button { open = true } label: { CandyLabel(title: "Have a code?") }
                        .buttonStyle(CastButtonStyle(color: color, size: .medium, fullWidth: fullWidth))
                }
            }
            .accessibilityLabel("Have a code?")
            .softSheet(isPresented: $open) {
                HaveACodeSheet(color: color) { result in
                    open = false
                    onResolved(result)
                }
            }
        }
    }
}

/// The paste / type sheet: sized to its content (no empty top), I waving the invite beside the bubble title,
/// the page wall behind it (the season's wall in season, the normal look otherwise), a soft rounded field,
/// PASTE (family quiet) and JOIN (primary, dimmed until there is input).
struct HaveACodeSheet: View {
    var color: CastColor = .teal
    var onResolved: (HaveACodeResult) -> Void

    @State private var typed = ""
    @State private var error: String?
    @State private var busy = false
    @State private var contentHeight: CGFloat = 330
    @FocusState private var focused: Bool

    private var canJoin: Bool { !busy && typed.trimmingCharacters(in: .whitespaces).count >= 4 }
    private var tint: PageTint { color == .pink ? .friends : .vs }

    var body: some View {
        VStack(spacing: 14) {
            HStack(alignment: .center, spacing: 6) {
                SceneArt(.invite, height: 92, fallbackSize: 84)
                VStack(alignment: .leading, spacing: 4) {
                    BubbleTextView(text: "HAVE A CODE?", palette: .friends, maxSize: 32, minSize: 20, alignment: .leading)
                    Text("Paste an invite link or type the code your friend sent.")
                        .font(Brand.font(12.5, .bold)).foregroundStyle(FriendsInk.muted)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            HStack(spacing: 8) {
                Image(systemName: "link").font(.system(size: 14, weight: .black))
                    .foregroundStyle(FriendsInk.lavender.opacity(0.8))
                TextField("Paste a link or type a code", text: $typed)
                    .textInputAutocapitalization(.characters).autocorrectionDisabled()
                    .focused($focused)
                    .submitLabel(.join)
                    .font(Brand.font(16, .heavy)).tracking(0.8)
                    .foregroundStyle(FriendsInk.heading)
                    .onChange(of: typed) { _ in error = nil }
                    .onSubmit { go() }
                if !typed.isEmpty {
                    Button { typed = "" } label: {
                        Image(systemName: "xmark.circle.fill").font(.system(size: 16)).foregroundStyle(FriendsInk.muted.opacity(0.7))
                    }
                    .buttonStyle(RoundIconButtonStyle.compact)
                    .accessibilityLabel("Clear")
                }
            }
            .padding(.horizontal, 14).frame(height: 52)
            .background(RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(FriendsInk.purple.opacity(focused ? 0.2 : 0.13)))

            if let error {
                Text(error).font(Brand.font(12.5, .heavy)).foregroundStyle(Color(hex: 0xDC2626))
                    .frame(maxWidth: .infinity, alignment: .leading)
            }

            HStack(spacing: 10) {
                Button { if let s = UIPasteboard.general.string { typed = String(s.trimmingCharacters(in: .whitespacesAndNewlines).prefix(120)) } } label: {
                    CandyLabel(title: "Paste")
                }
                .buttonStyle(QuietButtonStyle(size: .medium, fullWidth: false))
                Button { go() } label: {
                    CandyLabel(title: "Join") { if busy { ProgressView().controlSize(.small).tint(.white) } }
                }
                .buttonStyle(CastButtonStyle(color: color, size: .medium, fullWidth: true))
                .disabled(!canJoin)
            }
        }
        .padding(.horizontal, 18).padding(.top, 22).padding(.bottom, 16)
        .background(GeometryReader { g in Color.clear.preference(key: HaveACodeHeightKey.self, value: g.size.height) })
        .onPreferenceChange(HaveACodeHeightKey.self) { if $0 > 0 { contentHeight = $0 } }
        .frame(maxHeight: .infinity, alignment: .top)
        .pageBackground(tint, lightOnly: true)
        .presentationDetents([.height(contentHeight)])
        .presentationDragIndicator(.visible)
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

private struct HaveACodeHeightKey: PreferenceKey {
    static var defaultValue: CGFloat = 0
    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) { value = max(value, nextValue()) }
}
