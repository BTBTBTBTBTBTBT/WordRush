import SwiftUI

/// "GIFT PRO TO FRIENDS" — native port of the web invite panel
/// (components/referrals/invite-panel.tsx). Reads the caller's own referral
/// rows straight from PostgREST (RLS: inviter-read-only); create/cancel go
/// through the web API routes (service-role writes) with the session token.
struct InvitePanelView: View {
    @ObservedObject private var auth = AuthService.shared

    struct ReferralRow: Decodable, Identifiable {
        let id: String
        let code: String
        let status: String
        let created_at: String
        let expires_at: String
    }
    struct Leader: Decodable, Identifiable {
        var id: String { username }
        let username: String
        let count: Int
    }
    private struct LeaderboardResponse: Decodable { let leaders: [Leader] }
    private struct CreateResponse: Decodable { let code: String?; let error: String? }

    @State private var invites: [ReferralRow] = []
    @State private var leaders: [Leader] = []
    @State private var creating = false
    @State private var error: String?
    @State private var shareURL: URL?
    @State private var cancelTarget: ReferralRow?

    private static let iso: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()
    private static let isoPlain = ISO8601DateFormatter()

    private func expiry(_ row: ReferralRow) -> Date {
        Self.iso.date(from: row.expires_at) ?? Self.isoPlain.date(from: row.expires_at) ?? .distantPast
    }

    /// Dead invites (cancelled / expired) disappear — web parity.
    private var visibleInvites: [ReferralRow] {
        invites.filter { !($0.status == "revoked" || ($0.status == "pending" && expiry($0) < Date())) }
    }
    private var openCount: Int {
        invites.filter { $0.status == "pending" && expiry($0) > Date() }.count
    }
    private var slotsLeft: Int { max(0, 3 - openCount) }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                Image(systemName: "gift.fill").foregroundStyle(Color(hex: 0x7C3AED))
                Text("GIFT PRO TO FRIENDS")
                    .font(Brand.font(15, .black))
                    .foregroundStyle(LinearGradient(colors: [Color(hex: 0x7C3AED), Color(hex: 0xEC4899)], startPoint: .leading, endPoint: .trailing))
            }

            (Text("Each friend gets ").foregroundColor(Theme.textMuted)
                + Text("7 days of Pro").foregroundColor(Color(hex: 0xD97706))
                + Text(" free. You get +3 days when they join, a ").foregroundColor(Theme.textMuted)
                + Text("free month").foregroundColor(Color(hex: 0xD97706))
                + Text(" if they subscribe — and ").foregroundColor(Theme.textMuted)
                + Text("3 free months").foregroundColor(Color(hex: 0xD97706))
                + Text(" if they go annual. 3 friends = +4 streak shields.").foregroundColor(Theme.textMuted))
                .font(Brand.font(12, .bold))

            Button(action: createInvite) {
                HStack { if creating { ProgressView().tint(.white).controlSize(.small) }
                    Text(creating ? "Creating…"
                         : slotsLeft == 0 ? "All 3 invites out — slots free when friends join"
                         : "Create invite link (\(slotsLeft) left)") }
                .font(Brand.font(14, .black)).foregroundStyle(.white)
                .frame(maxWidth: .infinity).padding(.vertical, 12)
                .background(RoundedRectangle(cornerRadius: 12)
                    .fill(LinearGradient(colors: [Color(hex: 0x7C3AED), Color(hex: 0x6D28D9)], startPoint: .topLeading, endPoint: .bottomTrailing))
                    .shadow(color: Color(hex: 0x4C1D95), radius: 0, x: 0, y: 4))
            }
            .buttonStyle(.plain)
            .disabled(creating || slotsLeft == 0)

            if let error {
                Text(error).font(Brand.font(11, .bold)).foregroundStyle(Color(hex: 0xDC2626))
            }

            ForEach(visibleInvites.prefix(6)) { inv in
                HStack(spacing: 8) {
                    Text(inv.code).font(.system(size: 12, weight: .bold, design: .monospaced)).tracking(2)
                        .foregroundStyle(Theme.textPrimary)
                    Group {
                        switch inv.status {
                        case "redeemed": Text("Friend joined! +3 days").foregroundStyle(Color(hex: 0x059669))
                        case "converted": Text("Subscribed! Reward earned").foregroundStyle(Color(hex: 0xD97706))
                        default: Text("Waiting · \(timeLeft(inv))").foregroundStyle(Theme.textMuted)
                        }
                    }
                    .font(Brand.font(11, .bold))
                    Spacer()
                    if inv.status == "pending" {
                        Button { share(code: inv.code) } label: {
                            Image(systemName: "square.and.arrow.up").font(.system(size: 13))
                                .foregroundStyle(Color(hex: 0x7C3AED))
                        }.buttonStyle(.plain)
                        Button { cancelTarget = inv } label: {
                            Image(systemName: "xmark").font(.system(size: 12))
                                .foregroundStyle(Theme.textMuted)
                        }.buttonStyle(.plain)
                    }
                    if inv.status == "converted" {
                        Image(systemName: "crown.fill").font(.system(size: 12)).foregroundStyle(Color(hex: 0xD97706))
                    }
                }
            }

            if !leaders.isEmpty {
                Divider()
                HStack(spacing: 5) {
                    Image(systemName: "trophy.fill").font(.system(size: 11)).foregroundStyle(Color(hex: 0xD97706))
                    Text("TOP INVITERS THIS MONTH").font(Brand.font(10, .black)).tracking(0.8)
                        .foregroundStyle(Theme.textMuted)
                }
                ForEach(Array(leaders.enumerated()), id: \.element.id) { i, l in
                    HStack {
                        Text("\(i + 1). \(l.username)").font(Brand.font(11, .bold)).foregroundStyle(Theme.textPrimary)
                        Spacer()
                        Text("\(l.count) joined").font(Brand.font(11, .bold)).foregroundStyle(Theme.textMuted)
                    }
                }
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 20).fill(Theme.surface))
        .overlay(RoundedRectangle(cornerRadius: 20).stroke(Color(hex: 0xC4B5FD), lineWidth: 1.5))
        .task { await load() }
        .sheet(item: Binding(get: { shareURL.map { ShareURLItem(url: $0) } }, set: { _ in shareURL = nil })) { item in
            ActivityShareSheet(text: "I'm gifting you 7 days of Wordocious Pro — daily word puzzles, battles, the works.", url: item.url)
                .presentationDetents([.medium])
        }
        .alert("Cancel invite \(cancelTarget?.code ?? "")?", isPresented: Binding(get: { cancelTarget != nil }, set: { if !$0 { cancelTarget = nil } })) {
            Button("Keep it", role: .cancel) {}
            Button("Cancel invite", role: .destructive) {
                if let t = cancelTarget { cancel(t) }
            }
        } message: {
            Text("The link stops working immediately and your invite slot frees up.")
        }
    }

    private struct ShareURLItem: Identifiable { let id = UUID(); let url: URL }

    private func timeLeft(_ inv: ReferralRow) -> String {
        let interval = expiry(inv).timeIntervalSinceNow
        if interval <= 0 { return "expired" }
        let days = Int(interval / 86_400)
        if days >= 1 { return "\(days)d left" }
        return "\(max(1, Int(interval / 3_600)))h left"
    }

    private func share(code: String) {
        shareURL = URL(string: "https://wordocious.com/join/\(code)")
        ShareEvents.log(kind: "link_invite", gameMode: "", surface: "referral")
    }

    private func load() async {
        guard let userId = auth.profile?.id else { return }
        let rows: [ReferralRow]? = try? await auth.client.from("referrals")
            .select("id, code, status, created_at, expires_at")
            .eq("inviter_id", value: userId)
            .order("created_at", ascending: false)
            .limit(20)
            .execute().value
        if let rows { invites = rows }

        if let url = URL(string: "https://wordocious.com/api/referrals/leaderboard"),
           let (data, _) = try? await URLSession.shared.data(from: url),
           let resp = try? JSONDecoder().decode(LeaderboardResponse.self, from: data) {
            leaders = resp.leaders
        }
    }

    private func apiPOST(path: String, body: [String: String]? = nil) async throws -> Data {
        guard let token = try? await auth.client.auth.session.accessToken,
              let url = URL(string: "https://wordocious.com\(path)") else {
            throw URLError(.userAuthenticationRequired)
        }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        if let body {
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = try JSONEncoder().encode(body)
        }
        let (data, _) = try await URLSession.shared.data(for: req)
        return data
    }

    private func createInvite() {
        creating = true; error = nil
        Task {
            defer { creating = false }
            do {
                let data = try await apiPOST(path: "/api/referrals/create")
                let resp = try JSONDecoder().decode(CreateResponse.self, from: data)
                if let code = resp.code {
                    await load()
                    share(code: code)
                } else {
                    error = resp.error ?? "Could not create an invite."
                }
            } catch {
                self.error = "Could not create an invite."
            }
        }
    }

    private func cancel(_ inv: ReferralRow) {
        Task {
            _ = try? await apiPOST(path: "/api/referrals/cancel", body: ["id": inv.id])
            await load()
        }
    }
}

/// UIActivityViewController wrapper sharing text + URL (URL separate so the
/// share sheet previews the site icon, matching the web fix).
struct ActivityShareSheet: UIViewControllerRepresentable {
    let text: String
    let url: URL
    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: [text, url], applicationActivities: nil)
    }
    func updateUIViewController(_ vc: UIActivityViewController, context: Context) {}
}
