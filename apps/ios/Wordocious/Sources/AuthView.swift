import SwiftUI

/// Sign-in screen — matches apps/web/components/auth/login-screen.tsx:
/// WORDOCIOUS wordmark, "Welcome Back!"/"Join the Fun!", Continue with
/// Google / Facebook, email-password form, toggle, Privacy | Terms footer.
/// Email/password is functional; Google/Facebook are placeholders until
/// native OAuth is wired (Supabase has Google enabled; Facebook/Apple are not
/// configured server-side yet).
struct AuthView: View {
    @ObservedObject var auth = AuthService.shared
    @Environment(\.dismiss) private var dismiss

    @State private var mode: Mode = .signin
    @State private var email = ""
    @State private var password = ""
    @State private var username = ""
    @State private var error: String?
    @State private var working = false
    @State private var oauthSoon = false

    enum Mode { case signin, signup }

    var body: some View {
        NavigationStack {
            ZStack {
                LinearGradient(colors: [Theme.background, Theme.backgroundGradientEnd],
                               startPoint: .top, endPoint: .bottom).ignoresSafeArea()
                ScrollView {
                    VStack(spacing: 16) {
                        VStack(spacing: 4) {
                            Wordmark(size: 30)
                            Text("Epic Word Battles").font(Brand.body(13)).foregroundStyle(Theme.textMuted)
                        }.padding(.top, 20)

                        card
                        footer
                    }
                    .padding(.horizontal, 24).padding(.bottom, 24)
                }
            }
            .toolbar { ToolbarItem(placement: .topBarLeading) { Button("Close") { dismiss() } } }
            .alert("Coming soon", isPresented: $oauthSoon) {
                Button("OK", role: .cancel) {}
            } message: {
                Text("Social sign-in is coming to the iOS app soon. For now, use email & password.")
            }
        }
    }

    private var card: some View {
        VStack(spacing: 12) {
            Text(mode == .signin ? "Welcome Back!" : "Join the Fun!")
                .font(Brand.headline(18)).foregroundStyle(Theme.textPrimary)

            // Google
            Button { oauthSoon = true } label: {
                HStack(spacing: 12) {
                    Image("google").resizable().scaledToFit().frame(width: 20, height: 20)
                    Text("Continue with Google").font(Brand.font(14, .heavy)).foregroundStyle(Theme.textPrimary)
                }
                .frame(maxWidth: .infinity).padding(.vertical, 12)
                .background(RoundedRectangle(cornerRadius: 12).fill(Theme.background))
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.border, lineWidth: 1.5))
            }.buttonStyle(.plain)

            // Facebook
            Button { oauthSoon = true } label: {
                HStack(spacing: 12) {
                    Image("facebook").resizable().scaledToFit().frame(width: 20, height: 20)
                    Text("Continue with Facebook").font(Brand.font(14, .heavy)).foregroundStyle(.white)
                }
                .frame(maxWidth: .infinity).padding(.vertical, 12)
                .background(RoundedRectangle(cornerRadius: 12).fill(Color(hex: 0x1877F2)))
            }.buttonStyle(.plain)

            HStack(spacing: 10) {
                Rectangle().fill(Theme.border).frame(height: 1)
                Text("or").font(Brand.font(10, .heavy)).foregroundStyle(Theme.textMuted)
                Rectangle().fill(Theme.border).frame(height: 1)
            }

            if mode == .signup { labeledField("Username", "person", $username, "Choose a username") }
            labeledField("Email", "envelope", $email, "your@email.com", keyboard: .emailAddress)
            labeledSecure("Password", "lock", $password)

            if let error { Text(error).font(Brand.body(12)).foregroundStyle(Color(hex: 0xDC2626)) }

            Button(action: submit) {
                HStack { if working { ProgressView().tint(.white) }
                    Text(working ? "Loading..." : (mode == .signin ? "Sign In" : "Create Account")) }
                .font(Brand.font(15, .black)).foregroundStyle(.white)
                .frame(maxWidth: .infinity).padding(.vertical, 13)
                .background(RoundedRectangle(cornerRadius: 12).fill(Theme.wordmarkGradient))
            }
            .buttonStyle(.plain)
            .disabled(working || !SupabaseConfig.isConfigured)

            Button(mode == .signin ? "Don't have an account? Sign up" : "Already have an account? Sign in") {
                mode = mode == .signin ? .signup : .signin; error = nil
            }
            .font(Brand.body(13)).foregroundStyle(Theme.primary)
        }
        .padding(18)
        .background(RoundedRectangle(cornerRadius: 18).fill(Theme.surface))
        .overlay(RoundedRectangle(cornerRadius: 18).stroke(Theme.border, lineWidth: 1.5))
    }

    private var footer: some View {
        HStack(spacing: 6) {
            Text("Privacy Policy").font(Brand.font(11, .bold)).foregroundStyle(Theme.textMuted)
            Text("|").foregroundStyle(Theme.textMuted)
            Text("Terms of Service").font(Brand.font(11, .bold)).foregroundStyle(Theme.textMuted)
        }
    }

    private func labeledField(_ label: String, _ icon: String, _ text: Binding<String>, _ placeholder: String, keyboard: UIKeyboardType = .default) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            Label(label, systemImage: icon).font(Brand.caption(12)).foregroundStyle(Theme.textMuted)
            TextField(placeholder, text: text)
                .textInputAutocapitalization(.never).autocorrectionDisabled().keyboardType(keyboard)
                .padding(10).background(RoundedRectangle(cornerRadius: 10).fill(Theme.background))
                .overlay(RoundedRectangle(cornerRadius: 10).stroke(Theme.border, lineWidth: 1.5))
        }
    }

    private func labeledSecure(_ label: String, _ icon: String, _ text: Binding<String>) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            Label(label, systemImage: icon).font(Brand.caption(12)).foregroundStyle(Theme.textMuted)
            SecureField("••••••••", text: text)
                .padding(10).background(RoundedRectangle(cornerRadius: 10).fill(Theme.background))
                .overlay(RoundedRectangle(cornerRadius: 10).stroke(Theme.border, lineWidth: 1.5))
        }
    }

    private func submit() {
        working = true; error = nil
        Task {
            do {
                if mode == .signup {
                    try await auth.signUp(email: email, password: password,
                                          username: username.isEmpty ? "Wordocious\(Int.random(in: 10000...99999))" : username)
                } else {
                    try await auth.signIn(email: email, password: password)
                }
                working = false; dismiss()
            } catch {
                self.error = error.localizedDescription; working = false
            }
        }
    }
}
