import SwiftUI
import AuthenticationServices
import GoogleSignIn
import Supabase

/// Settings → LINKED SIGN-INS (founder, 2026-09-30). Shows which providers
/// (Google, Apple, email) open the signed-in account, from the Supabase user's
/// identities, and attaches Google / Apple to this SAME account via manual
/// identity linking — so a Hide My Email relay can't spin up a second account.
/// An identity already owned by another account is refused, never merged.
/// Unlink is offered only while more than one identity exists.
struct LinkedSignInsSection: View {
    @State private var identities: [UserIdentity]?
    @State private var working: String?          // provider in flight
    @State private var error: String?
    @State private var notice: String?
    @State private var appleNonce: String?
    @State private var confirmUnlink: UserIdentity?
    @State private var loadFailed = false

    private struct ProviderRow { let key: String; let name: String; let icon: String?; let symbol: String? }
    private let rows: [ProviderRow] = [
        .init(key: "google", name: "Google", icon: "google", symbol: nil),
        .init(key: "apple", name: "Apple", icon: nil, symbol: "applelogo"),
        .init(key: "email", name: "Email & password", icon: nil, symbol: "envelope.fill"),
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("LINKED SIGN-INS").font(Brand.font(11, .heavy)).tracking(1.1).foregroundStyle(Theme.textMuted)
            VStack(spacing: 0) {
                ForEach(Array(rows.enumerated()), id: \.offset) { i, row in
                    if i > 0 { Divider().overlay(Theme.border) }
                    providerRow(row)
                }
            }
            .background(RoundedRectangle(cornerRadius: 14).fill(Theme.surface))
            .overlay(RoundedRectangle(cornerRadius: 14).stroke(Theme.border, lineWidth: 1.5))
            if let error {
                Text(error).font(Brand.body(12)).foregroundStyle(Color(hex: 0xDC2626))
                    .fixedSize(horizontal: false, vertical: true)
            } else if let notice {
                Text(notice).font(Brand.body(12)).foregroundStyle(Theme.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Text("Link Google or Apple so either one opens this same account. A sign-in already used by a different Wordocious account can't be linked here.")
                .font(Brand.body(11)).foregroundStyle(Theme.textMuted)
                .fixedSize(horizontal: false, vertical: true)
        }
        .task { await load() }
        .confirmationDialog(confirmUnlink.map { "Unlink \(displayName($0.provider))?" } ?? "",
                            isPresented: Binding(get: { confirmUnlink != nil }, set: { if !$0 { confirmUnlink = nil } }),
                            titleVisibility: .visible) {
            Button("Unlink", role: .destructive) { if let id = confirmUnlink { unlink(id) } }
            Button("Cancel", role: .cancel) { confirmUnlink = nil }
        } message: {
            Text("You won't be able to sign in with it anymore. Your other sign-ins keep working.")
        }
    }

    // MARK: Rows

    @ViewBuilder
    private func providerRow(_ row: ProviderRow) -> some View {
        let linked = identities?.first(where: { $0.provider == row.key })
        VStack(spacing: 10) {
            HStack(spacing: 12) {
                Group {
                    if let icon = row.icon {
                        Image(icon).resizable().scaledToFit()
                    } else if let symbol = row.symbol {
                        Image(systemName: symbol).font(.system(size: 16, weight: .semibold)).foregroundStyle(Theme.textPrimary)
                    }
                }
                .frame(width: 20, height: 20)
                .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 1) {
                    Text(row.name).font(Brand.headline(14)).foregroundStyle(Theme.textPrimary)
                    Text(subtitle(linked, loaded: identities != nil))
                        .font(Brand.body(11)).foregroundStyle(Theme.textMuted).lineLimit(1).truncationMode(.middle)
                }
                Spacer(minLength: 8)
                trailing(row, linked: linked)
            }
            // Apple's own button for the Apple link (HIG: Sign in with Apple
            // must use the system-provided button).
            if row.key == "apple", linked == nil, identities != nil {
                SignInWithAppleButton(.continue, onRequest: configureAppleRequest, onCompletion: handleAppleResult)
                    .signInWithAppleButtonStyle(.black)
                    .frame(height: 40)
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                    .disabled(working != nil)
                    .accessibilityLabel("Link Apple")
            }
        }
        .padding(12)
        .accessibilityElement(children: .contain)
    }

    @ViewBuilder
    private func trailing(_ row: ProviderRow, linked: UserIdentity?) -> some View {
        if identities == nil {
            if !loadFailed { ProgressView().controlSize(.small) }
        } else if working == row.key {
            ProgressView().controlSize(.small)
        } else if let linked {
            HStack(spacing: 10) {
                if (identities?.count ?? 0) > 1 {
                    Button("Unlink") { error = nil; notice = nil; confirmUnlink = linked }
                        .font(Brand.font(12, .heavy)).foregroundStyle(Theme.textMuted)
                        .disabled(working != nil)
                        .accessibilityLabel("Unlink \(row.name)")
                }
                Image(systemName: "checkmark.circle.fill").foregroundStyle(Theme.primary)
                    .accessibilityLabel("Linked")
            }
        } else if row.key == "google" {
            Button { linkGoogle() } label: {
                Text("Link Google").font(Brand.font(12, .heavy)).foregroundStyle(Theme.primary)
                    .padding(.horizontal, 12).padding(.vertical, 7)
                    .overlay(Capsule().stroke(Theme.primary, lineWidth: 1.5))
            }
            .buttonStyle(.plain)
            .disabled(working != nil)
        }
    }

    private func subtitle(_ identity: UserIdentity?, loaded: Bool) -> String {
        guard loaded else { return loadFailed ? "Couldn't check" : "Checking…" }
        guard let identity else { return "Not linked" }
        if let email = identity.identityData?["email"]?.stringValue, !email.isEmpty {
            return email.hasSuffix("privaterelay.appleid.com") ? "Linked · Hide My Email" : "Linked · \(email)"
        }
        return "Linked"
    }

    private func displayName(_ provider: String) -> String {
        switch provider {
        case "google": return "Google"
        case "apple": return "Apple"
        case "email": return "email & password"
        default: return provider.capitalized
        }
    }

    // MARK: Actions

    private func load() async {
        do { identities = try await AuthService.shared.linkedIdentities(); loadFailed = false }
        catch {
            // Keep the last good list; with none, show "Couldn't check" and no
            // Link buttons (an empty list would wrongly read as "not linked").
            loadFailed = identities == nil
            if self.error == nil { self.error = "Couldn't load your sign-ins. Check your connection and reopen Settings." }
        }
    }

    private func linkGoogle() {
        error = nil; notice = nil; working = "google"
        Task {
            do {
                try await AuthService.shared.linkGoogle()
                notice = "Google is now linked. Either sign-in opens this account."
            } catch {
                if (error as? GIDSignInError)?.code != .canceled {
                    self.error = AuthService.linkErrorMessage(error, provider: "Google account")
                }
            }
            await load()
            working = nil
        }
    }

    private func configureAppleRequest(_ request: ASAuthorizationAppleIDRequest) {
        let nonce = AuthView.randomNonceString()
        appleNonce = nonce
        request.requestedScopes = [.email]
        request.nonce = AuthView.sha256(nonce)
    }

    private func handleAppleResult(_ result: Result<ASAuthorization, Error>) {
        switch result {
        case .failure(let err):
            if (err as? ASAuthorizationError)?.code != .canceled { error = err.localizedDescription }
        case .success(let authorization):
            guard let cred = authorization.credential as? ASAuthorizationAppleIDCredential,
                  let tokenData = cred.identityToken,
                  let idToken = String(data: tokenData, encoding: .utf8),
                  let rawNonce = appleNonce else {
                error = "Apple didn't return a sign-in. Please try again."
                return
            }
            error = nil; notice = nil; working = "apple"
            Task {
                do {
                    try await AuthService.shared.linkApple(idToken: idToken, rawNonce: rawNonce)
                    notice = "Apple is now linked. Either sign-in opens this account."
                } catch {
                    self.error = AuthService.linkErrorMessage(error, provider: "Apple ID")
                }
                await load()
                working = nil
            }
        }
    }

    private func unlink(_ identity: UserIdentity) {
        confirmUnlink = nil
        guard (identities?.count ?? 0) > 1 else { return }   // never the last one
        error = nil; notice = nil; working = identity.provider
        Task {
            do {
                try await AuthService.shared.unlink(identity)
                let name = displayName(identity.provider)
                notice = "\(name.prefix(1).uppercased() + name.dropFirst()) is no longer linked."
            } catch {
                self.error = AuthService.linkErrorMessage(error, provider: displayName(identity.provider))
            }
            await load()
            working = nil
        }
    }
}
