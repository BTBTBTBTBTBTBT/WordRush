import SwiftUI
import WordociousCore

/// The neutral, on-brand 13+ age check (FRIDAY-QUEUE item 29): D (glasses + pencil) asks ONE question —
/// "When's your birthday year?" — on a year wheel with NO default and no hint that 13 matters. Layered
/// art from docs/design/brand/2.8/agecheck (ChatGPT props; the canonical cast art placed as is).
/// State, storage, the server mirror and the service gating live in AgeCheckStore.

/// Root overlay: sits above the whole app until this device has answered (and forever for "under").
struct AgeGateOverlay: View {
    @ObservedObject private var store = AgeCheckStore.shared
    @ObservedObject private var auth = AuthService.shared
    @ObservedObject private var flags = FlagsService.shared
    /// A returning signed-in player on a fresh device may already be confirmed server-side: give that
    /// lookup a moment before asking (never longer than this).
    @State private var waitedOut = false

    var body: some View {
        ZStack {
            // Mirrors the account's server flag / answer once a profile exists (idempotent).
            Color.clear.frame(width: 0, height: 0)
                .task(id: auth.profile?.id) { await store.syncWithServer() }
                .task {
                    try? await Task.sleep(nanoseconds: 6_000_000_000)
                    waitedOut = true
                }

            if store.isUnder {
                AgeCheckUnderView().transition(.opacity)
            } else if store.stored == nil, flags.isLive("age_check") {
                if AuthService.hadPersistedSession, !store.serverCheckDone, !waitedOut {
                    Color("LaunchBackground").ignoresSafeArea()
                } else {
                    AgeCheckQuestionView { store.answer(year: $0) }.transition(.opacity)
                }
            }
        }
        .animation(.easeOut(duration: 0.2), value: store.stored)
    }
}

struct AgeCheckQuestionView: View {
    let onAnswer: (Int) -> Void
    private let years = AgeCheck.years()
    /// 0 = the neutral placeholder row (no default); 1... = years[index - 1].
    @State private var row = 0

    var body: some View {
        ZStack {
            LinearGradient(colors: [Color(red: 0.933, green: 0.894, blue: 1.0), Color(red: 1.0, green: 0.925, blue: 0.965)],
                           startPoint: .top, endPoint: .bottom)
                .ignoresSafeArea()
            ScrollView {
                VStack(spacing: 12) {
                    Image("age-bunting")
                        .resizable().scaledToFit().frame(width: 209)
                        .accessibilityHidden(true)

                    // D's speech bubble: the one question.
                    Text("When's your birthday year?")
                        .font(.system(size: 28, weight: .black, design: .rounded))
                        .foregroundColor(Color(red: 0.357, green: 0.129, blue: 0.714))
                        .multilineTextAlignment(.center)
                        .frame(maxWidth: .infinity)
                        .padding(.horizontal, 20).padding(.top, 30).padding(.bottom, 24)
                        .background(
                            RoundedRectangle(cornerRadius: 34, style: .continuous)
                                .fill(LinearGradient(colors: [Color(red: 0.965, green: 0.937, blue: 1.0), Color(red: 0.902, green: 0.839, blue: 1.0)],
                                                     startPoint: .top, endPoint: .bottom))
                                .shadow(color: Color(red: 0.486, green: 0.227, blue: 0.929).opacity(0.2), radius: 14, y: 8)
                        )
                        .padding(.top, -34)
                        .accessibilityAddTraits(.isHeader)

                    wheel

                    HStack(alignment: .bottom) {
                        Image("age-cake").resizable().scaledToFit().frame(width: 90).accessibilityHidden(true)
                        Spacer()
                        Image(MascotID.d.assetName).resizable().scaledToFit().frame(width: 150).accessibilityHidden(true)
                    }

                    Button {
                        guard row > 0 else { return }
                        onAnswer(years[row - 1])
                    } label: { CandyLabel(title: "Continue") }
                        .buttonStyle(CastButtonStyle(color: .purple, size: .large))
                        .disabled(row == 0)
                }
                .padding(.horizontal, 20).padding(.vertical, 20)
                .frame(maxWidth: 420)
                .frame(maxWidth: .infinity)
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityAddTraits(.isModal)
    }

    private var wheel: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 34, style: .continuous)
                .fill(LinearGradient(colors: [Color(red: 0.77, green: 0.71, blue: 0.99).opacity(0.6),
                                              Color(red: 0.914, green: 0.835, blue: 1.0),
                                              Color(red: 0.77, green: 0.71, blue: 0.99).opacity(0.6)],
                                     startPoint: .top, endPoint: .bottom))
                .shadow(color: Color(red: 0.486, green: 0.227, blue: 0.929).opacity(0.22), radius: 14, y: 8)
            // The gold answer band.
            RoundedRectangle(cornerRadius: 22, style: .continuous)
                .fill(LinearGradient(colors: [Color.yellow.opacity(0.55), Color.orange.opacity(0.32)],
                                     startPoint: .top, endPoint: .bottom))
                .frame(height: 46).padding(.horizontal, -6)
                .shadow(color: Color.orange.opacity(0.45), radius: 10)
                .allowsHitTesting(false)
            Picker("Birthday year", selection: $row) {
                // Neutral placeholder: no year is ever pre-selected.
                Text("\u{2022}  \u{2022}  \u{2022}")
                    .font(.system(size: 22, weight: .black, design: .rounded)).tag(0)
                ForEach(Array(years.enumerated()), id: \.offset) { i, y in
                    Text(String(y))
                        .font(.system(size: 26, weight: .black, design: .rounded))
                        .tag(i + 1)
                }
            }
            .pickerStyle(.wheel)
            .labelsHidden()
        }
        .frame(width: 168, height: 190)
    }
}

/// The kind screen for an under-13 answer: nothing is created, the answer sticks on this device.
struct AgeCheckUnderView: View {
    var body: some View {
        ZStack {
            LinearGradient(colors: [Color(red: 0.894, green: 0.925, blue: 1.0), Color(red: 0.992, green: 0.945, blue: 0.894)],
                           startPoint: .top, endPoint: .bottom)
                .ignoresSafeArea()
            VStack(spacing: 12) {
                Image("age-under13")
                    .resizable().scaledToFit()
                    .accessibilityLabel("13 and up. See you soon! The Wordocious cast waves from under a rainbow.")
                Text("Wordocious is for players 13 and up. We would love to play with you when you are older!")
                    .font(.system(size: 15, weight: .bold, design: .rounded))
                    .foregroundColor(Color(red: 0.357, green: 0.129, blue: 0.714))
                    .multilineTextAlignment(.center)
                if let mail = URL(string: "mailto:\(AgeCheck.supportEmail)") {
                    Link("Parents: questions or corrections? \(AgeCheck.supportEmail)", destination: mail)
                        .font(.system(size: 12, weight: .semibold, design: .rounded))
                        .multilineTextAlignment(.center)
                }
            }
            .padding(20)
            .frame(maxWidth: 420)
        }
        .accessibilityElement(children: .contain)
        .accessibilityAddTraits(.isModal)
    }
}
