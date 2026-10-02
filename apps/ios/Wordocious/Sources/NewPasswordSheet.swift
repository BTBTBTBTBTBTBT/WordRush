import SwiftUI
import SafariServices

/// Native completion of the password-reset flow: the emailed recovery link is
/// caught as a universal link (DeepLink), the code is exchanged for a session,
/// and this sheet sets the new password — the user ends up signed IN, in-app,
/// instead of finishing on the web and re-typing credentials. Styled to match
/// AuthView's card fields/CTA.
struct NewPasswordSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var password = ""
    @State private var confirm = ""
    @State private var error: String?
    @State private var saving = false
    @State private var done = false

    var body: some View {
        NavigationStack {
            ZStack {
                PageBackground(tint: .home)
                VStack(spacing: 16) {
                    Wordmark(size: 26).padding(.top, 8)
                    // §G5: the form sits on a tinted card (§A1) with candy CTA (§A8).
                    VStack(spacing: 16) {
                        Text("Set a New Password").font(Brand.font(18, .black)).foregroundStyle(FinishInk.heading)

                        if done {
                            G5Notice("Password updated — you're signed in!", tone: .success)
                        } else {
                            VStack(alignment: .leading, spacing: 5) {
                                Label("New Password", systemImage: "lock").font(Brand.font(12, .heavy)).foregroundStyle(FinishInk.secondary)
                                SecureField("••••••••", text: $password)
                                    .foregroundStyle(FinishInk.heading)
                                    .g5Field()
                            }
                            VStack(alignment: .leading, spacing: 5) {
                                Label("Confirm Password", systemImage: "lock").font(Brand.font(12, .heavy)).foregroundStyle(FinishInk.secondary)
                                SecureField("••••••••", text: $confirm)
                                    .foregroundStyle(FinishInk.heading)
                                    .g5Field()
                            }

                            if let error {
                                G5Notice(error, tone: .error)
                            }

                            Button(action: save) {
                                CandyLabel(title: saving ? "Saving…" : "Save New Password") {
                                    if saving { ProgressView().tint(.white) }
                                }
                            }
                            .buttonStyle(CandyButtonStyle(variant: .purple, size: .large))
                            .disabled(saving)
                        }
                    }
                    .padding(18)
                    .tintedCard(accent: G5Accent.purple, bar: [Color(hex: 0xA78BFA), Color(hex: 0xEC4899), Color(hex: 0xFBBF24)],
                                radius: 20, barHeight: 8)
                    // §A7: a cast pose where there's room (no page host here) — D with notes.
                    PoseImage(.d, done ? "cheer" : "notes", height: 96)
                    Spacer()
                }
                .padding(24)
            }
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    HeaderCircleButton(.symbol("xmark"), size: 32, label: "Close") { dismiss() }
                }
            }
        }
    }

    private func save() {
        error = nil
        guard password.count >= 6 else { error = "Password must be at least 6 characters."; return }
        guard password == confirm else { error = "Passwords don't match."; return }
        saving = true
        Task {
            do {
                try await AuthService.shared.client.auth.update(user: .init(password: password))
                done = true
                try? await Task.sleep(nanoseconds: 1_500_000_000)
                dismiss()
            } catch {
                self.error = error.localizedDescription
            }
            saving = false
        }
    }
}

/// SFSafariViewController wrapper — cross-device auth links (PKCE verifier on
/// another client) finish on the web page without leaving the app.
struct SafariSheet: UIViewControllerRepresentable {
    let url: URL
    func makeUIViewController(context: Context) -> SFSafariViewController {
        SFSafariViewController(url: url)
    }
    func updateUIViewController(_ vc: SFSafariViewController, context: Context) {}
}
