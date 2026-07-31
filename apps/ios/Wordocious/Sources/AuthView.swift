import SwiftUI
import AuthenticationServices
import CryptoKit

/// Sign-in screen — adapts apps/web/components/auth/login-screen.tsx for iOS:
/// WORDOCIOUS wordmark, "Welcome Back!"/"Join the Fun!", Continue with Apple /
/// Google, email-password form, toggle, Privacy | Terms footer.
/// Native diverges from the web's Google+Facebook on purpose: Apple replaces
/// Facebook because App Store Guideline 4.8 requires Sign in with Apple when any
/// third-party social login is offered.
/// All three paths (Apple, Google, email) are functional; Apple+Google require
/// their providers configured in Supabase Auth (see WEB_PARITY_AUDIT checklist).
struct AuthView: View {
    /// When presented as a sheet (e.g. from Profile) we show a Close button.
    /// When used as the app-wide login gate there is nothing to dismiss to.
    var showsCloseButton: Bool = true
    @ObservedObject var auth = AuthService.shared
    @Environment(\.dismiss) private var dismiss

    @State private var mode: Mode = .signin
    @State private var email = ""
    @State private var password = ""
    @State private var confirmPassword = ""
    /// A masked field with no reveal makes a typo uncatchable, and a typo on
    /// sign-up creates an account nobody can ever sign into.
    @State private var showPassword = false
    @State private var username = ""
    @State private var error: String?
    @State private var resetSent = false
    @State private var signupSent = false
    @State private var working = false
    @State private var appleNonce: String?

    enum Mode { case signin, signup, reset }

    var body: some View {
        NavigationStack {
            ZStack {
                LinearGradient(colors: [Theme.background, Theme.backgroundGradientEnd],
                               startPoint: .top, endPoint: .bottom).ignoresSafeArea()
                ScrollView {
                    VStack(spacing: 24) {
                        VStack(spacing: 8) {
                            Wordmark(size: 30)
                            Text("Epic Word Battles").font(Brand.body(13)).foregroundStyle(Theme.textMuted)
                        }.padding(.top, 20)

                        card
                        footer
                    }
                    .padding(.horizontal, 24).padding(.bottom, 24)
                }
            }
            .toolbar {
                if showsCloseButton {
                    ToolbarItem(placement: .topBarLeading) { Button("Close") { dismiss() } }
                }
            }
        }
    }

    private var card: some View {
        VStack(spacing: 16) {   // web card space-y-4 between header / social / divider / form
            Text(mode == .signin ? "Welcome Back!" : mode == .signup ? "Join the Fun!" : "Reset Password")
                .font(Brand.font(18, .black)).foregroundStyle(Theme.textPrimary)

            if mode == .reset {
                Text("Enter your email and we'll send you a link to set a new password. Works for Google and Apple accounts too.")
                    .font(Brand.font(12, .bold)).foregroundStyle(Theme.textMuted)
                    .multilineTextAlignment(.center)
            }

            if mode != .reset {
                // Apple — required by App Store Guideline 4.8 alongside Google.
                // Official SignInWithAppleButton for HIG compliance.
                SignInWithAppleButton(.signIn, onRequest: configureAppleRequest, onCompletion: handleAppleResult)
                    .signInWithAppleButtonStyle(.black)
                    .frame(height: 48)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                    .disabled(working || !SupabaseConfig.isConfigured)

                // Google
                Button(action: signInWithGoogle) {
                    HStack(spacing: 12) {
                        Image("google").resizable().scaledToFit().frame(width: 20, height: 20)
                        Text("Continue with Google").font(Brand.font(14, .heavy)).foregroundStyle(Theme.textPrimary)
                    }
                    .frame(maxWidth: .infinity).padding(.vertical, 12)
                    .background(RoundedRectangle(cornerRadius: 12).fill(Theme.background))
                    .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.border, lineWidth: 1.5))
                }.buttonStyle(.plain).disabled(working || !SupabaseConfig.isConfigured)

                HStack(spacing: 10) {
                    Rectangle().fill(Theme.border).frame(height: 1)
                    Text("or").font(Brand.font(10, .heavy)).foregroundStyle(Theme.textMuted)
                    Rectangle().fill(Theme.border).frame(height: 1)
                }
            }

            // Form fields group — web <form className="space-y-3"> (12pt).
            VStack(spacing: 12) {
                if mode == .signup { labeledField("Username", "person", $username, "Choose a username") }
                labeledField("Email", "envelope", $email, "your@email.com", keyboard: .emailAddress)
                if mode != .reset {
                    labeledSecure("Password", "lock", $password,
                                  trailing: mode == .signin ? ("Forgot password?", { mode = .reset; error = nil; resetSent = false; signupSent = false }) : nil)
                }
                if mode == .signup {
                    labeledSecure("Confirm password", "lock", $confirmPassword,
                                  isMismatched: !confirmPassword.isEmpty && confirmPassword != password)
                }

                if resetSent || signupSent {
                    Text(signupSent
                         ? "Account created. Check your email for a confirmation link, then sign in."
                         : "Check your email — if an account exists for that address, a reset link is on its way.")
                        .font(Brand.font(12, .bold)).foregroundStyle(Color(hex: 0x047857))
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(12)
                        .background(RoundedRectangle(cornerRadius: 12).fill(Color(hex: 0xECFDF5)))
                        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color(hex: 0xA7F3D0), lineWidth: 1))
                }

                if let error {
                    Text(error).font(Brand.font(12, .bold)).foregroundStyle(Color(hex: 0xDC2626))
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(12)
                        .background(RoundedRectangle(cornerRadius: 12).fill(Color(hex: 0xFEE2E2)))
                        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color(hex: 0xFECACA), lineWidth: 1))
                }

                Button(action: submit) {
                    HStack { if working { ProgressView().tint(.white) }
                        Text(working ? "Loading..." : (mode == .signin ? "Sign In" : mode == .signup ? "Create Account" : "Send Reset Link")) }
                    .font(Brand.font(15, .black)).foregroundStyle(.white)
                    .frame(maxWidth: .infinity).padding(.vertical, 13)
                    .background(RoundedRectangle(cornerRadius: 12)
                        .fill(LinearGradient(colors: [Color(hex: 0x7C3AED), Color(hex: 0x6D28D9)], startPoint: .topLeading, endPoint: .bottomTrailing))
                        .shadow(color: Color(hex: 0x4C1D95), radius: 0, x: 0, y: 4))   // btn-3d
                }
                .buttonStyle(.plain)
                .disabled(working || !SupabaseConfig.isConfigured || (mode == .reset && resetSent)
                          || (mode == .signup && signupSent))

                Button(mode == .signin ? "Don't have an account? Sign up"
                       : mode == .signup ? "Already have an account? Sign in"
                       : "Back to sign in") {
                    mode = mode == .reset ? .signin : (mode == .signin ? .signup : .signin)
                    error = nil; resetSent = false; signupSent = false; confirmPassword = ""
                }
                .font(Brand.body(13)).foregroundStyle(Theme.primary)
            }

            // Apple 5.1.1(v): a signed-out visitor must be able to reach the
            // single-player daily without registering. Shown only on the root
            // gate (not the in-app "Sign in" sheet, which already has a close X).
            if !showsCloseButton {
                Button(action: {
                    // Guest is its own save owner — never inherit the boards of
                    // whoever was signed in on this device before.
                    AuthService.claimSavesFor("guest")
                    auth.isGuest = true
                }) {
                    Text("Play without an account")
                        .font(Brand.font(13, .heavy)).foregroundStyle(Theme.textSecondary).underline()
                }
                .buttonStyle(.plain)
                .disabled(working)
            }
        }
        .padding(18)
        .background(RoundedRectangle(cornerRadius: 20).fill(Theme.surface))
        .overlay(RoundedRectangle(cornerRadius: 20).stroke(Color(hex: 0xC4B5FD), lineWidth: 1.5))
        .shadow(color: Color(hex: 0x7C3AED).opacity(0.08), radius: 12, x: 0, y: 4)
    }

    private var footer: some View {
        HStack(spacing: 6) {
            // Functional legal links (App Review expects these to work) — open the
            // in-app Privacy / Terms pages, matching the web's <Link href> footer.
            NavigationLink { InfoPage(.privacy) } label: {
                Text("Privacy Policy").font(Brand.font(11, .bold)).foregroundStyle(Theme.textMuted)
            }
            Text("|").foregroundStyle(Theme.borderLight)
            NavigationLink { InfoPage(.terms) } label: {
                Text("Terms of Service").font(Brand.font(11, .bold)).foregroundStyle(Theme.textMuted)
            }
        }
    }

    private func labeledField(_ label: String, _ icon: String, _ text: Binding<String>, _ placeholder: String, keyboard: UIKeyboardType = .default) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            Label(label, systemImage: icon).font(Brand.font(12, .heavy)).foregroundStyle(Theme.textMuted)
            TextField(placeholder, text: text)
                .textInputAutocapitalization(.never).autocorrectionDisabled().keyboardType(keyboard)
                .padding(10).background(RoundedRectangle(cornerRadius: 10).fill(Theme.background))
                .overlay(RoundedRectangle(cornerRadius: 10).stroke(Theme.border, lineWidth: 1.5))
        }
    }

    private func labeledSecure(_ label: String, _ icon: String, _ text: Binding<String>,
                               trailing: (String, () -> Void)? = nil,
                               isMismatched: Bool = false) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            HStack {
                Label(label, systemImage: icon).font(Brand.font(12, .heavy)).foregroundStyle(Theme.textMuted)
                if let (title, action) = trailing {
                    Spacer()
                    Button(title, action: action)
                        .font(Brand.font(12, .bold)).foregroundStyle(Theme.primary)
                        .buttonStyle(.plain)
                }
            }
            HStack(spacing: 8) {
                // One reveal toggle drives BOTH password fields, so confirming
                // means comparing what you can actually read.
                if showPassword {
                    TextField("••••••••", text: text)
                        .textInputAutocapitalization(.never).autocorrectionDisabled()
                } else {
                    SecureField("••••••••", text: text)
                }
                Button { showPassword.toggle() } label: {
                    Image(systemName: showPassword ? "eye.slash" : "eye")
                        .font(.system(size: 14)).foregroundStyle(Theme.textMuted)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(showPassword ? "Hide password" : "Show password")
            }
            .padding(10).background(RoundedRectangle(cornerRadius: 10).fill(Theme.background))
            .overlay(RoundedRectangle(cornerRadius: 10)
                .stroke(isMismatched ? Color(hex: 0xFCA5A5) : Theme.border, lineWidth: 1.5))
        }
    }

    private func submit() {
        error = nil
        // Reset mode only needs an email — the link finishes on the web page.
        if mode == .reset {
            guard email.contains("@") else { error = "Enter your email address."; return }
            working = true
            Task {
                // Report success either way: confirming which addresses exist
                // would let anyone probe the user list (web parity).
                do { try await auth.resetPassword(email: email) } catch {}
                resetSent = true; working = false
            }
            return
        }
        // Client-side validation — web parity (login-screen.tsx: password
        // minLength=6; signup username required, 3–20 chars).
        guard password.count >= 6 else {
            error = "Password must be at least 6 characters."; return
        }
        let trimmedUsername = username.trimmingCharacters(in: .whitespacesAndNewlines)
        if mode == .signup {
            guard (3...20).contains(trimmedUsername.count) else {
                error = "Username must be 3-20 characters."; return
            }
            guard password == confirmPassword else {
                error = "Passwords do not match"; return
            }
        }
        working = true
        Task {
            do {
                if mode == .signup {
                    let signedIn = try await auth.signUp(email: email, password: password, username: trimmedUsername)
                    working = false
                    // No session means confirmation is pending — say so and stay
                    // put. Dismissing here dropped the user back to a signed-out
                    // app with no indication the account had been created.
                    if signedIn { dismiss() } else { signupSent = true }
                } else {
                    try await auth.signIn(email: email, password: password)
                    working = false; dismiss()
                }
            } catch {
                self.error = error.localizedDescription; working = false
            }
        }
    }

    // MARK: - OAuth

    private func signInWithGoogle() {
        working = true; error = nil
        Task {
            do { try await auth.signInWithGoogle(); working = false; dismiss() }
            catch {
                if !isUserCancellation(error) { self.error = error.localizedDescription }
                working = false
            }
        }
    }

    private func configureAppleRequest(_ request: ASAuthorizationAppleIDRequest) {
        let nonce = Self.randomNonceString()
        appleNonce = nonce
        request.requestedScopes = [.fullName, .email]
        request.nonce = Self.sha256(nonce)   // Apple hashes the nonce; we send raw to Supabase.
    }

    private func handleAppleResult(_ result: Result<ASAuthorization, Error>) {
        switch result {
        case .failure(let err):
            if !isUserCancellation(err) { error = err.localizedDescription }
        case .success(let authorization):
            guard let cred = authorization.credential as? ASAuthorizationAppleIDCredential,
                  let tokenData = cred.identityToken,
                  let idToken = String(data: tokenData, encoding: .utf8),
                  let rawNonce = appleNonce else {
                error = "Apple sign-in failed. Please try again."
                return
            }
            working = true; error = nil
            Task {
                do { try await auth.signInWithApple(idToken: idToken, rawNonce: rawNonce); working = false; dismiss() }
                catch { self.error = error.localizedDescription; working = false }
            }
        }
    }

    /// Apple/ASWebAuthenticationSession surface a "canceled" error when the user
    /// dismisses the sheet — not worth showing as an error.
    private func isUserCancellation(_ error: Error) -> Bool {
        if let e = error as? ASAuthorizationError, e.code == .canceled { return true }
        let ns = error as NSError
        return ns.domain == ASWebAuthenticationSessionError.errorDomain
            && ns.code == ASWebAuthenticationSessionError.canceledLogin.rawValue
    }

    // MARK: - Nonce (Sign in with Apple)

    private static func randomNonceString(length: Int = 32) -> String {
        let charset = Array("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-._")
        var result = ""
        var remaining = length
        while remaining > 0 {
            var random: UInt8 = 0
            let status = SecRandomCopyBytes(kSecRandomDefault, 1, &random)
            if status != errSecSuccess { continue }
            if random < UInt8(charset.count) { result.append(charset[Int(random)]); remaining -= 1 }
        }
        return result
    }

    private static func sha256(_ input: String) -> String {
        SHA256.hash(data: Data(input.utf8)).map { String(format: "%02x", $0) }.joined()
    }
}
