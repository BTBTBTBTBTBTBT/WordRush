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
            // The cover's own backdrop is the Home wallpaper (never the system's
            // plain white), dimmed under the card.
            PageBackground(tint: .home)
            Color(hex: 0x1A1A2E).opacity(0.55).ignoresSafeArea()
            VStack(spacing: 0) {
                LinearGradient(colors: [Color(hex: 0xA78BFA), Color(hex: 0xEC4899), Color(hex: 0xFBBF24)],
                               startPoint: .leading, endPoint: .trailing).frame(height: 6)
                VStack(spacing: 0) {
                    VStack(spacing: 2) {
                        if ArtAsset.exists(ArtTitleName.welcome.assetName) {
                            // ART_SPEC §8: the whole cast around WELCOME! (labeled
                            // "Welcome") over the wordmark.
                            ArtTitle(.welcome, maxWidth: 312).padding(.bottom, 6)
                            Wordmark(size: 22)
                        } else {
                            Wordmark(size: 24)
                            Text("Welcome to Wordocious").font(Brand.font(11, .bold)).foregroundStyle(FinishInk.secondary)
                        }
                    }
                    .padding(.top, 20).padding(.bottom, 16)

                    VStack(alignment: .leading, spacing: 12) {
                        pillar("sparkles", Color(hex: 0x7C3AED), "Daily Puzzles", "Eight daily word games and ten Puzzles, new every day")
                        pillar("flag.checkered", Color(hex: 0xEC4899), "Play with Friends", "Today's Race, a weekly finish and VS with friends")
                        pillar("trophy.fill", Color(hex: 0xD97706), "Climb the Leaderboards", "Earn medals, build streaks, and track your stats")
                    }
                    .padding(.bottom, 18)

                    VStack(alignment: .leading, spacing: 6) {
                        FinishLabel("Choose a username")
                        TextField("username", text: $username)
                            .font(Brand.font(15, .bold)).foregroundStyle(FinishInk.heading)
                            .textInputAutocapitalization(.never).autocorrectionDisabled().focused($focused)
                            .g5Field(error: error != nil)
                        if let error { Text(error).font(Brand.font(11, .bold)).foregroundStyle(Color(hex: 0xDC2626)) }
                        else { Text("3-20 characters. Letters, numbers, and underscores.").font(Brand.font(11, .bold)).foregroundStyle(FinishInk.secondary) }
                    }
                    .padding(.bottom, 14)

                    // §A8: candy buttons — purple "Let's Play!", quiet peach "Skip".
                    Button(action: save) {
                        CandyLabel(title: saving ? "Saving…" : "Let's Play!", symbol: "play.fill")
                    }
                    .buttonStyle(CastButtonStyle(size: .large)).disabled(saving)

                    Button { skip() } label: { CandyLabel(title: "Skip for now") }
                        .buttonStyle(CandyButtonStyle(variant: .peach, size: .small, fullWidth: false))
                        .padding(.top, 6)
                        .disabled(saving)
                }
                .padding(.horizontal, 24).padding(.bottom, 20)
            }
            .frame(maxWidth: 360)
            // §G5: a tinted card (no plain white), the gradient bar on top.
            .background(ZStack {
                RoundedRectangle(cornerRadius: 20).fill(Theme.isDark ? Theme.surface : G5Accent.purple.wash(0.07))
                if Theme.isDark { RoundedRectangle(cornerRadius: 20).fill(G5Accent.purple.opacity(0.08)) }
            })
            .clipShape(RoundedRectangle(cornerRadius: 20))
            .overlay(RoundedRectangle(cornerRadius: 20).stroke(Theme.isDark ? G5Accent.purple.opacity(0.35) : G5Accent.purple.wash(0.26), lineWidth: 1.5))
            .shadow(color: .black.opacity(0.15), radius: 30, x: 0, y: 20)
            .padding(.horizontal, 24)
        }
        .onAppear { username = auth.profile?.username ?? "" }
    }

    private func pillar(_ icon: String, _ tint: Color, _ title: String, _ sub: String) -> some View {
        HStack(alignment: .top, spacing: 10) {
            // §A1: the icon sits on a mini tinted tile (wash + border + top bar).
            SymbolGlyph(icon, size: 14, color: tint)
                .frame(width: 30, height: 30).tintedPill(tint, radius: 9)
            VStack(alignment: .leading, spacing: 1) {
                Text(title).font(Brand.font(12, .black)).foregroundStyle(FinishInk.heading)
                Text(sub).font(Brand.font(10, .bold)).foregroundStyle(FinishInk.secondary).fixedSize(horizontal: false, vertical: true)
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
            _ = try? await auth.client.from("profiles").update(SkipUpdate(has_onboarded: true)).eq("id", value: uid).execute()
            await auth.refreshProfile()
        }
    }
}
