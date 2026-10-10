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
    private static let accent = Color(hex: 0x06B6D4)
    private let rows: [ProviderRow] = [
        .init(key: "google", name: "Google", icon: "google", symbol: nil),
        .init(key: "apple", name: "Apple", icon: nil, symbol: "applelogo"),
        .init(key: "email", name: "Email & password", icon: nil, symbol: "envelope.fill"),
    ]

    var body: some View {
        // FINISH_SPEC §G5: a tinted section card with its top bar (§A1), like the
        // rest of Settings; notices as tinted cards; Link / Unlink as candy (§A8).
        G5Card("LINKED SIGN-INS", accent: Self.accent) {
            VStack(spacing: 0) {
                ForEach(Array(rows.enumerated()), id: \.offset) { i, row in
                    if i > 0 { G5Divider(accent: Self.accent) }
                    providerRow(row)
                }
            }
            if let error {
                G5Notice(error, tone: .error)
            } else if let notice {
                G5Notice(notice, tone: .success)
            }
            Text("Link Google or Apple so either one opens this same account. A sign-in already used by a different Wordocious account can't be linked here.")
                .font(Brand.font(11, .bold)).foregroundStyle(FinishInk.secondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .task { await load() }
        .familyConfirm(confirmUnlink.map { "Unlink \(displayName($0.provider))?" } ?? "",
                       isPresented: Binding(get: { confirmUnlink != nil }, set: { if !$0 { confirmUnlink = nil } }),
                       message: "You won't be able to sign in with it anymore. Your other sign-ins keep working.",
                       confirm: "Unlink", danger: true) {
            if let id = confirmUnlink { unlink(id) }
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
                        Image(systemName: symbol).font(.system(size: 16, weight: .semibold)).foregroundStyle(FinishInk.heading)
                    }
                }
                .frame(width: 20, height: 20)
                .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 1) {
                    Text(row.name).font(Brand.font(14, .black)).foregroundStyle(FinishInk.heading)
                    Text(subtitle(linked, loaded: identities != nil))
                        .font(Brand.font(11, .bold)).foregroundStyle(FinishInk.secondary).lineLimit(1).truncationMode(.middle)
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
        .padding(.vertical, 10)
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
                    Button { error = nil; notice = nil; confirmUnlink = linked } label: {
                        CandyLabel(title: "Unlink")
                    }
                    .buttonStyle(CandyButtonStyle(variant: .peach, size: .small, fullWidth: false))
                    .disabled(working != nil)
                        .accessibilityLabel("Unlink \(row.name)")
                }
                Image(systemName: "checkmark.circle.fill").foregroundStyle(Self.accent)
                    .accessibilityLabel("Linked")
            }
        } else if row.key == "google" {
            Button { linkGoogle() } label: {
                CandyLabel(title: "Link Google")
            }
            .buttonStyle(CandyButtonStyle(variant: .purple, size: .small, fullWidth: false))
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
