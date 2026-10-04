import SwiftUI
import AuthenticationServices
import CryptoKit
import WordociousCore

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
    /// FINISH_SPEC §AO: the first-run flow opens straight on Sign up / Sign in.
    var initialMode: Mode? = nil
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
                PageBackground(tint: .home)
                ScrollView {
                    VStack(spacing: 24) {
                        VStack(spacing: 8) {
                            // ART_SPEC §8: the whole cast around WELCOME! over the wordmark.
                            if ArtAsset.exists(ArtTitleName.welcome.assetName) {
                                ArtTitle(.welcome, maxWidth: 360)
                            }
                            Wordmark(size: 30)
                            Text("Daily Word Games").font(Brand.font(13, .bold)).foregroundStyle(FinishInk.secondary)
                        }.padding(.top, 20)

                        card
                        footer
                    }
                    .padding(.horizontal, 24).padding(.bottom, 24)
                }
            }
            .toolbar {
                if showsCloseButton {
                    ToolbarItem(placement: .topBarLeading) {
                        HeaderCircleButton(.symbol("xmark"), size: 32, label: "Close") { dismiss() }
                    }
                }
            }
        }
        .onAppear { if let initialMode { mode = initialMode } }
    }

    private var card: some View {
        VStack(spacing: 16) {   // web card space-y-4 between header / social / divider / form
            // BJ16: the mode's heading lettering, not plain text.
            HeadingArtView(mode == .signin ? .welcomeback : mode == .signup ? .jointhefun : .resetpassword, height: 44)
                .id(mode)

            if mode == .reset {
                Text("Enter your email and we'll send you a link to set a new password. Works for Google and Apple accounts too.")
                    .font(Brand.font(12, .bold)).foregroundStyle(FinishInk.secondary)
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
                        Text("Continue with Google").font(Brand.font(14, .heavy)).foregroundStyle(FinishInk.heading)
                    }
                    .frame(maxWidth: .infinity).padding(.vertical, 12)
                    // The provider's branded button keeps its logo + label; its face
                    // is a light tinted tile (§A1) instead of plain white.
                    .g5Option(active: false, accent: G5Accent.purple, radius: 12)
                }.buttonStyle(.squish).disabled(working || !SupabaseConfig.isConfigured)

                HStack(spacing: 10) {
                    G5Divider()
                    Text("or").font(Brand.font(10, .heavy)).foregroundStyle(FinishInk.secondary)
                    G5Divider()
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
                    G5Notice(signupSent
                             ? "Account created. Check your email for a confirmation link, then sign in."
                             : "Check your email — if an account exists for that address, a reset link is on its way.",
                             tone: .success)
                }

                if let error {
                    G5Notice(error, tone: .error)
                }

                // §A8: the primary action is a large purple candy button.
                Button(action: submit) {
                    CandyLabel(title: working ? "Loading..." : (mode == .signin ? "Sign In" : mode == .signup ? "Create Account" : "Send Reset Link")) {
                        if working { ProgressView().tint(.white) }
                    }
                }
                .buttonStyle(CastButtonStyle(size: .large))
                .disabled(working || !SupabaseConfig.isConfigured || (mode == .reset && resetSent)
                          || (mode == .signup && signupSent))

                // The mode switch: the question stays text, the action is a small
                // candy button (§A8 — no plain text-link actions).
                HStack(spacing: 8) {
                    if mode != .reset {
                        Text(mode == .signin ? "Don't have an account?" : "Already have an account?")
                            .font(Brand.font(12, .bold)).foregroundStyle(FinishInk.secondary)
                    }
                    Button {
                        mode = mode == .reset ? .signin : (mode == .signin ? .signup : .signin)
                        error = nil; resetSent = false; signupSent = false; confirmPassword = ""
                    } label: {
                        TextLinkLabel(title: mode == .signin ? "Sign up" : mode == .signup ? "Sign in" : "Back to sign in")
                    }
                    .buttonStyle(.squish)   // BJ15 round 2: an inline text link, not a pill
                    .accessibilityLabel(mode == .signin ? "Don't have an account? Sign up"
                                        : mode == .signup ? "Already have an account? Sign in"
                                        : "Back to sign in")
                }
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
                    TextLinkLabel(title: "Play without an account", size: 15)
                        .frame(maxWidth: .infinity, minHeight: 44)
                }
                .buttonStyle(.squish)   // BJ15 round 2: a secondary text link, not a pill
                .disabled(working)
            }
        }
        .padding(18)
        // §G5: the sign-in card is a tinted card with the purple → pink top bar.
        .tintedCard(accent: G5Accent.purple, bar: [Color(hex: 0xA78BFA), Color(hex: 0xEC4899), Color(hex: 0xFBBF24)],
                    radius: 20, barHeight: 8)
    }

    private var footer: some View {
        HStack(spacing: 6) {
            // Functional legal links (App Review expects these to work) — open the
            // in-app Privacy / Terms pages, matching the web's <Link href> footer.
            NavigationLink { InfoPage(.privacy) } label: {
                Text("Privacy Policy").font(Brand.font(11, .bold)).foregroundStyle(FinishInk.secondary)
            }
            Text("|").foregroundStyle(FinishInk.secondary.opacity(0.5))
            NavigationLink { InfoPage(.terms) } label: {
                Text("Terms of Service").font(Brand.font(11, .bold)).foregroundStyle(FinishInk.secondary)
            }
        }
    }

    private func labeledField(_ label: String, _ icon: String, _ text: Binding<String>, _ placeholder: String, keyboard: UIKeyboardType = .default) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            Label(label, systemImage: icon).font(Brand.font(12, .heavy)).foregroundStyle(FinishInk.secondary)
            TextField(placeholder, text: text)
                .textInputAutocapitalization(.never).autocorrectionDisabled().keyboardType(keyboard)
                .foregroundStyle(FinishInk.heading)
                .g5Field()
        }
    }

    private func labeledSecure(_ label: String, _ icon: String, _ text: Binding<String>,
                               trailing: (String, () -> Void)? = nil,
                               isMismatched: Bool = false) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            HStack {
                Label(label, systemImage: icon).font(Brand.font(12, .heavy)).foregroundStyle(FinishInk.secondary)
                if let (title, action) = trailing {
                    Spacer()
                    Button(action: action) { TextLinkLabel(title: title, size: 12) }
                        .buttonStyle(.squish)   // BJ15 round 2: a text link, not a pill
                        .accessibilityLabel(title)
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
                        .font(.system(size: 14)).foregroundStyle(FinishInk.secondary)
                }
                .buttonStyle(.squish)
                .accessibilityLabel(showPassword ? "Hide password" : "Show password")
            }
            .foregroundStyle(FinishInk.heading)
            .g5Field(error: isMismatched)
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
            // Shape + content (core Profanity mirrors the DB word list). The
            // profiles trigger is the authority; this is the friendly message
            // before the round trip.
            if let v = Profanity.usernameError(trimmedUsername) {
                error = v; return
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

    static func randomNonceString(length: Int = 32) -> String {
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

    static func sha256(_ input: String) -> String {
        SHA256.hash(data: Data(input.utf8)).map { String(format: "%02x", $0) }.joined()
    }
}
