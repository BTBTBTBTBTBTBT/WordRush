import SwiftUI
import AuthenticationServices

struct AuthView: View {
    @ObservedObject var auth = AuthService.shared
    @Environment(\.dismiss) private var dismiss

    @State private var isSignUp = false
    @State private var email = ""
    @State private var password = ""
    @State private var username = ""
    @State private var error: String?
    @State private var working = false

    var body: some View {
        NavigationStack {
            ZStack {
                LinearGradient(colors: [Theme.background, Theme.backgroundGradientEnd],
                               startPoint: .top, endPoint: .bottom)
                    .ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 16) {
                        Text(isSignUp ? "Create account" : "Sign in")
                            .font(.system(size: 28, weight: .heavy, design: .rounded))
                            .padding(.top, 24)

                        if !SupabaseConfig.isConfigured {
                            Text("⚠️ Supabase anon key not set — paste it into SupabaseConfig.swift to enable sign-in.")
                                .font(.footnote).foregroundStyle(.orange)
                                .multilineTextAlignment(.center)
                                .padding(.horizontal)
                        }

                        if isSignUp {
                            field("Username", text: $username)
                        }
                        field("Email", text: $email, keyboard: .emailAddress)
                        secureField("Password", text: $password)

                        if let error {
                            Text(error).font(.footnote).foregroundStyle(.red)
                        }

                        Button(action: submit) {
                            HStack {
                                if working { ProgressView().tint(.white) }
                                Text(isSignUp ? "Sign up" : "Sign in")
                            }
                            .frame(maxWidth: .infinity).frame(height: 50)
                        }
                        .buttonStyle(.borderedProminent)
                        .disabled(working || !SupabaseConfig.isConfigured)

                        // Sign in with Apple — wired to Supabase signInWithIdToken
                        // in Phase 2 once the signing team + capability are set.
                        SignInWithAppleButton(.signIn) { _ in } onCompletion: { _ in }
                            .signInWithAppleButtonStyle(.black)
                            .frame(height: 50)
                            .allowsHitTesting(false)
                            .opacity(0.5)
                            .overlay(Text("Apple sign-in: Phase 2").font(.caption2).foregroundStyle(.white))

                        Button(isSignUp ? "Have an account? Sign in" : "New here? Create an account") {
                            isSignUp.toggle(); error = nil
                        }
                        .font(.footnote)
                        .padding(.top, 4)
                    }
                    .padding(.horizontal, 28)
                }
            }
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Close") { dismiss() }
                }
            }
        }
    }

    private func field(_ label: String, text: Binding<String>, keyboard: UIKeyboardType = .default) -> some View {
        TextField(label, text: text)
            .textFieldStyle(.roundedBorder)
            .textInputAutocapitalization(.never)
            .autocorrectionDisabled()
            .keyboardType(keyboard)
    }

    private func secureField(_ label: String, text: Binding<String>) -> some View {
        SecureField(label, text: text)
            .textFieldStyle(.roundedBorder)
    }

    private func submit() {
        working = true; error = nil
        Task {
            do {
                if isSignUp {
                    try await auth.signUp(email: email, password: password, username: username.isEmpty ? "Wordocious\(Int.random(in: 10000...99999))" : username)
                } else {
                    try await auth.signIn(email: email, password: password)
                }
                working = false
                dismiss()
            } catch {
                self.error = error.localizedDescription
                working = false
            }
        }
    }
}
