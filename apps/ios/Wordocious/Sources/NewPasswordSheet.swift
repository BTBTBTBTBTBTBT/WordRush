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
                LinearGradient(colors: [Theme.background, Theme.backgroundGradientEnd],
                               startPoint: .top, endPoint: .bottom).ignoresSafeArea()
                VStack(spacing: 16) {
                    Wordmark(size: 26).padding(.top, 8)
                    Text("Set a New Password").font(Brand.font(18, .black)).foregroundStyle(Theme.textPrimary)

                    if done {
                        Text("Password updated — you're signed in!")
                            .font(Brand.font(12, .bold)).foregroundStyle(Color(hex: 0x047857))
                            .frame(maxWidth: .infinity)
                            .padding(12)
                            .background(RoundedRectangle(cornerRadius: 12).fill(Color(hex: 0xECFDF5)))
                            .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color(hex: 0xA7F3D0), lineWidth: 1))
                    } else {
                        VStack(alignment: .leading, spacing: 5) {
                            Label("New Password", systemImage: "lock").font(Brand.font(12, .heavy)).foregroundStyle(Theme.textMuted)
                            SecureField("••••••••", text: $password)
                                .padding(10).background(RoundedRectangle(cornerRadius: 10).fill(Theme.background))
                                .overlay(RoundedRectangle(cornerRadius: 10).stroke(Theme.border, lineWidth: 1.5))
                        }
                        VStack(alignment: .leading, spacing: 5) {
                            Label("Confirm Password", systemImage: "lock").font(Brand.font(12, .heavy)).foregroundStyle(Theme.textMuted)
                            SecureField("••••••••", text: $confirm)
                                .padding(10).background(RoundedRectangle(cornerRadius: 10).fill(Theme.background))
                                .overlay(RoundedRectangle(cornerRadius: 10).stroke(Theme.border, lineWidth: 1.5))
                        }

                        if let error {
                            Text(error).font(Brand.font(12, .bold)).foregroundStyle(Color(hex: 0xDC2626))
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(12)
                                .background(RoundedRectangle(cornerRadius: 12).fill(Color(hex: 0xFEE2E2)))
                                .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color(hex: 0xFECACA), lineWidth: 1))
                        }

                        Button(action: save) {
                            HStack { if saving { ProgressView().tint(.white) }
                                Text(saving ? "Saving…" : "Save New Password") }
                            .font(Brand.font(15, .black)).foregroundStyle(.white)
                            .frame(maxWidth: .infinity).padding(.vertical, 13)
                            .background(RoundedRectangle(cornerRadius: 12)
                                .fill(LinearGradient(colors: [Color(hex: 0x7C3AED), Color(hex: 0x6D28D9)], startPoint: .topLeading, endPoint: .bottomTrailing))
                                .shadow(color: Color(hex: 0x4C1D95), radius: 0, x: 0, y: 4))
                        }
                        .buttonStyle(.plain)
                        .disabled(saving)
                    }
                    Spacer()
                }
                .padding(24)
            }
            .toolbar { ToolbarItem(placement: .topBarLeading) { Button("Close") { dismiss() } } }
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
