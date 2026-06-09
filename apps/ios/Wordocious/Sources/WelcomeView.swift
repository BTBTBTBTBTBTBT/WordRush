import SwiftUI

/// First-run onboarding — ports the web WelcomeModal. Shown once when a new
/// account has `has_onboarded == false`: a welcome card with the three pillars
/// and a username picker (Save / Skip). Both paths set `has_onboarded = true`.
struct WelcomeView: View {
    @ObservedObject private var auth = AuthService.shared
    @State private var username = ""
    @State private var error: String?
    @State private var saving = false
    @FocusState private var focused: Bool

    private struct SaveUpdate: Encodable { let username: String; let has_onboarded: Bool }
    private struct SkipUpdate: Encodable { let has_onboarded: Bool }

    var body: some View {
        ZStack {
            Color(hex: 0x1A1A2E).opacity(0.55).ignoresSafeArea()
            VStack(spacing: 0) {
                LinearGradient(colors: [Color(hex: 0xA78BFA), Color(hex: 0xEC4899), Color(hex: 0xFBBF24)],
                               startPoint: .leading, endPoint: .trailing).frame(height: 6)
                VStack(spacing: 0) {
                    VStack(spacing: 2) {
                        Wordmark(size: 24)
                        Text("Welcome to Epic Word Battles").font(Brand.font(11, .bold)).foregroundStyle(Theme.textMuted)
                    }
                    .padding(.top, 20).padding(.bottom, 16)

                    VStack(alignment: .leading, spacing: 12) {
                        pillar("sparkles", Color(hex: 0x7C3AED), Color(hex: 0xF3F0FF), "Daily Puzzles", "New challenges every day across 9 unique game modes")
                        pillar("flag.checkered", Color(hex: 0xEC4899), Color(hex: 0xFDF2F8), "Compete Head-to-Head", "Challenge friends or get matched with random opponents")
                        pillar("trophy.fill", Color(hex: 0xD97706), Color(hex: 0xFFFBEB), "Climb the Leaderboards", "Earn medals, build streaks, and track your stats")
                    }
                    .padding(.bottom, 18)

                    VStack(alignment: .leading, spacing: 6) {
                        Text("CHOOSE A USERNAME").font(Brand.font(10, .black)).tracking(0.8).foregroundStyle(Theme.textMuted)
                        TextField("username", text: $username)
                            .font(Brand.font(15, .bold)).foregroundStyle(Theme.textPrimary)
                            .textInputAutocapitalization(.never).autocorrectionDisabled().focused($focused)
                            .padding(.horizontal, 12).padding(.vertical, 11)
                            .background(RoundedRectangle(cornerRadius: 12).fill(Theme.background))
                            .overlay(RoundedRectangle(cornerRadius: 12).stroke(error == nil ? Theme.border : Color(hex: 0xDC2626), lineWidth: 1.5))
                        if let error { Text(error).font(Brand.font(11, .bold)).foregroundStyle(Color(hex: 0xDC2626)) }
                        else { Text("3-20 characters. Letters, numbers, and underscores.").font(Brand.font(11, .bold)).foregroundStyle(Theme.textMuted) }
                    }
                    .padding(.bottom, 14)

                    Button(action: save) {
                        Text(saving ? "Saving…" : "Let's Play!").font(Brand.font(15, .black)).foregroundStyle(.white)
                            .frame(maxWidth: .infinity).frame(height: 48)
                            .background(RoundedRectangle(cornerRadius: 12).fill(
                                LinearGradient(colors: [Color(hex: 0x7C3AED), Color(hex: 0x6D28D9)], startPoint: .topLeading, endPoint: .bottomTrailing)))
                            .shadow(color: Color(hex: 0x4C1D95), radius: 0, x: 0, y: 4)
                    }
                    .buttonStyle(.plain).disabled(saving)

                    Button("Skip for now") { skip() }
                        .font(Brand.font(12, .bold)).foregroundStyle(Theme.textMuted).padding(.top, 10)
                        .disabled(saving)
                }
                .padding(.horizontal, 24).padding(.bottom, 20)
            }
            .frame(maxWidth: 360)
            .background(RoundedRectangle(cornerRadius: 20).fill(Theme.surface))
            .clipShape(RoundedRectangle(cornerRadius: 20))
            .overlay(RoundedRectangle(cornerRadius: 20).stroke(Theme.border, lineWidth: 1.5))
            .shadow(color: .black.opacity(0.15), radius: 30, x: 0, y: 20)
            .padding(.horizontal, 24)
        }
        .onAppear { username = auth.profile?.username ?? "" }
    }

    private func pillar(_ icon: String, _ tint: Color, _ bg: Color, _ title: String, _ sub: String) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: icon).font(.system(size: 14)).foregroundStyle(tint)
                .frame(width: 28, height: 28).background(RoundedRectangle(cornerRadius: 8).fill(bg))
            VStack(alignment: .leading, spacing: 1) {
                Text(title).font(Brand.font(12, .heavy)).foregroundStyle(Theme.textPrimary)
                Text(sub).font(Brand.font(10, .bold)).foregroundStyle(Theme.textMuted).fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
        }
    }

    private func validate(_ name: String) -> String? {
        let t = name.trimmingCharacters(in: .whitespaces)
        if t.count < 3 { return "At least 3 characters" }
        if t.count > 20 { return "20 characters max" }
        if t.range(of: "^[a-zA-Z0-9_]+$", options: .regularExpression) == nil { return "Letters, numbers, and underscores only" }
        return nil
    }

    private func save() {
        let t = username.trimmingCharacters(in: .whitespaces)
        if let v = validate(t) { error = v; return }
        guard let uid = auth.profile?.id else { return }
        saving = true; error = nil
        Task {
            do {
                try await auth.client.from("profiles").update(SaveUpdate(username: t, has_onboarded: true)).eq("id", value: uid).execute()
                await auth.refreshProfile()   // flips hasOnboarded → dismisses this cover
            } catch {
                let msg = "\(error)"
                self.error = msg.contains("23505") || msg.lowercased().contains("duplicate") ? "Username already taken" : "Something went wrong"
                saving = false
            }
        }
    }

    private func skip() {
        guard let uid = auth.profile?.id else { return }
        saving = true
        Task {
            try? await auth.client.from("profiles").update(SkipUpdate(has_onboarded: true)).eq("id", value: uid).execute()
            await auth.refreshProfile()
        }
    }
}
