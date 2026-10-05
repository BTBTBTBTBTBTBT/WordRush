import SwiftUI
import WordociousCore

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
        // §251: who redeemed it (resolved to a username for settled rows).
        var invitee_id: String?
        var converted_plan: String?
    }
    struct Leader: Decodable, Identifiable {
        var id: String { username }
        let username: String
        let count: Int
    }
    private struct LeaderboardResponse: Decodable { let leaders: [Leader] }
    private struct CreateResponse: Decodable { let code: String?; let error: String? }

    /// Last load this session — painted in the FIRST frame and replaced in ONE pass when the
    /// reads land (founder, 2026-09-29: the rows, then the names, then the leaders each popped
    /// in on their own, and the slot count read "3 left" until the rows arrived).
    private struct Snapshot { var invites: [ReferralRow]; var names: [String: String]; var leaders: [Leader] }
    private static var memoKey: String { "invitePanel:\(StatsMemo.uid)" }
    private static var memo: Snapshot? { StatsMemo.shared.get(memoKey) }
    @State private var invites: [ReferralRow] = Self.memo?.invites ?? []
    // §251: invitee_id → username for the settled rows.
    @State private var inviteeNames: [String: String] = Self.memo?.names ?? [:]
    @State private var leaders: [Leader] = Self.memo?.leaders ?? []
    @State private var creating = false
    @State private var error: String?
    @State private var shareURL: URL?
    @State private var cancelTarget: ReferralRow?
    /// Founder 10-03: credit notices the player X'd (the local list + the server flag).
    @State private var dismissed: Set<String> = []

    private static let iso: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()
    private static let isoPlain = ISO8601DateFormatter()

    private func expiry(_ row: ReferralRow) -> Date {
        Self.iso.date(from: row.expires_at) ?? Self.isoPlain.date(from: row.expires_at) ?? .distantPast
    }

    /// Dead invites (canceled / expired) disappear — web parity. Settled rows
    /// ("X joined! +3 days", "X subscribed!") also retire once the invite's own
    /// expiry has passed, so a join is news for a week, not a permanent line
    /// (founder, 2026-09-26: "Lord_Matthew joined! has been showing for a while").
    private var visibleInvites: [ReferralRow] {
        invites.filter { $0.status != "revoked" && expiry($0) > Date()
            && !(ReferralCredits.isCredit($0.status) && dismissed.contains($0.id)) }
    }

    /// X a credit notice (or Clear all): gone for good — the local list now, the server flag
    /// for the player's other devices (POST /api/referrals/dismiss; a no-op until its column ships).
    private func dismissCredits(_ ids: [String]) {
        guard let uid = auth.profile?.id, !ids.isEmpty else { return }
        withAnimation(Theme.animation(.easeOut(duration: 0.22))) {
            dismissed = ReferralCredits.write(uid, ids)
        }
        Task {
            guard let token = try? await auth.client.auth.session.accessToken,
                  let url = URL(string: "https://wordocious.com/api/referrals/dismiss") else { return }
            var req = URLRequest(url: url, timeoutInterval: 10)
            req.httpMethod = "POST"
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = try? JSONSerialization.data(withJSONObject: ["ids": ids])
            _ = try? await URLSession.shared.data(for: req)
        }
    }

    /// The local dismissed list, then the other devices' (GET /api/referrals/dismiss).
    private func loadDismissed() async {
        guard let uid = auth.profile?.id else { return }
        dismissed = ReferralCredits.read(uid)
        guard let token = try? await auth.client.auth.session.accessToken,
              let url = URL(string: "https://wordocious.com/api/referrals/dismiss") else { return }
        var req = URLRequest(url: url, timeoutInterval: 10)
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        guard let (data, _) = try? await URLSession.shared.data(for: req),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let ids = json["ids"] as? [String], !ids.isEmpty else { return }
        dismissed = ReferralCredits.write(uid, ids)
    }
    private var openCount: Int {
        invites.filter { $0.status == "pending" && expiry($0) > Date() }.count
    }
    private var slotsLeft: Int { max(0, 3 - openCount) }

    var body: some View {
        // Gifting Pro is a Pro benefit — a free account must never see this.
        // `isProActive` is false while the launch profile fetch is in flight,
        // so the panel appears for subscribers rather than flashing for all.
        // The authoritative gate is server-side in /api/referrals/create.
        if auth.isProActive {
            panel
        }
    }

    private var panel: some View {
        // BJ7: the gift card hugs its content — a smaller scene top-aligned with the
        // one-line headline, 10 between blocks, 12 padding, a medium candy.
        VStack(alignment: .leading, spacing: 10) {
            // FINISH_SPEC §T4: O3 with the crowned gift box, the headline, the
            // soft-number 7 DAYS badge and the gifts-left counter.
            HStack(alignment: .top, spacing: 10) {
                FriendsSceneArt(asset: "art-scene-gift-pro", height: 72, maxWidth: 80)
                VStack(alignment: .leading, spacing: 6) {
                    HeadingArtView(.giftpro, height: 26, maxWidth: 230, alignment: .leading)   // BJ16
                    HStack(spacing: 8) {
                        HStack(spacing: 4) {
                            Text("7").softNumber(18)
                            Text("DAYS").font(Brand.font(11, .black)).tracking(0.8).foregroundStyle(FinishInk.secondary)
                        }
                        .padding(.horizontal, 10).padding(.vertical, 4)
                        .tintedPill(G5Accent.gold)
                        .accessibilityElement(children: .ignore).accessibilityLabel("7 days of Pro")
                        HStack(spacing: 4) {
                            Text("\(slotsLeft)").softNumber(18)
                            Text(slotsLeft == 1 ? "gift left" : "gifts left").font(Brand.font(11, .heavy)).foregroundStyle(FinishInk.secondary)
                        }
                        .accessibilityElement(children: .ignore).accessibilityLabel("\(slotsLeft) \(slotsLeft == 1 ? "gift" : "gifts") left")
                    }
                }
                Spacer(minLength: 0)
            }

            (Text("Each friend gets ").foregroundColor(FinishInk.secondary)
                + Text("7 days of Pro").foregroundColor(Color(hex: 0xD97706))
                + Text(" free. You get +3 days when they join, a ").foregroundColor(FinishInk.secondary)
                + Text("free month").foregroundColor(Color(hex: 0xD97706))
                + Text(" if they subscribe — and ").foregroundColor(FinishInk.secondary)
                + Text("3 free months").foregroundColor(Color(hex: 0xD97706))
                + Text(" if they go annual. 3 friends = +4 streak shields.").foregroundColor(FinishInk.secondary))
                .font(Brand.font(12, .bold))

            // §A8 / §T4: the gold candy "Send a gift" (creates the invite link, then shares it).
            Button(action: createInvite) {
                CandyLabel(title: creating ? "Creating…"
                           : slotsLeft == 0 ? "All 3 gifts out"
                           : "Send a gift", symbol: creating || slotsLeft == 0 ? nil : "gift.fill") {
                    if creating { ProgressView().tint(.white).controlSize(.small) }
                }
            }
            .buttonStyle(CastButtonStyle(color: .gold, size: .medium))
            .disabled(creating || slotsLeft == 0)
            if slotsLeft == 0 && !creating {
                Text("Slots free up when friends join.")
                    .font(Brand.font(11, .bold)).foregroundStyle(FinishInk.secondary)
                    .frame(maxWidth: .infinity, alignment: .center)
            }

            if let error {
                G5Notice(error, tone: .error)
            }

            if ReferralCredits.showClearAll(visibleInvites.map(\.status)) {
                // Founder 10-03: a quiet Clear all once there are 2+ credit notices.
                Button {
                    dismissCredits(visibleInvites.filter { ReferralCredits.isCredit($0.status) }.map(\.id))
                } label: { CandyLabel(title: "Clear all") }
                .buttonStyle(QuietButtonStyle(size: .small))   // button family §2: the quiet pill, never bare text
                .frame(maxWidth: .infinity, alignment: .trailing)
            }
            ForEach(visibleInvites.prefix(6)) { inv in
                // §251: settled rows lead with WHO — the code is noise once spent.
                let name = inv.invitee_id.flatMap { inviteeNames[$0] } ?? "A friend"
                HStack(spacing: 8) {
                    if inv.status == "pending" {
                        // §T1: the code on small glossy letter tiles.
                        FriendsCodeTiles(code: inv.code, tile: inv.code.count > 8 ? 15 : 18)
                    }
                    Group {
                        switch inv.status {
                        case "redeemed": Text("\(name) joined! +3 days").foregroundStyle(Color(hex: 0x059669))
                        case "converted":
                            Text("\(name) subscribed! \(inv.converted_plan == "annual" ? "+3 free months" : inv.converted_plan == "monthly" ? "+1 free month" : "Reward earned")")
                                .foregroundStyle(Color(hex: 0xD97706))
                        default: Text("Waiting · \(timeLeft(inv))").foregroundStyle(FinishInk.secondary)
                        }
                    }
                    .font(Brand.font(11, .bold))
                    .lineLimit(1).minimumScaleFactor(0.8)
                    Spacer()
                    if inv.status == "pending" {
                        Button { share(code: inv.code) } label: {
                            Icon3D(.share, size: 18)
                        }
                        .buttonStyle(.squishIcon)
                        .accessibilityLabel("Share invite \(inv.code)")
                        FamilyCloseButton(size: 17, label: "Cancel invite \(inv.code)") { cancelTarget = inv }
                            .frame(width: 28, height: 28)
                    }
                    if inv.status == "converted" {
                        Icon3D(.crown, size: 15)
                    }
                    if ReferralCredits.isCredit(inv.status) {
                        // Founder 10-03: X a credit notice away (soft circle, no outline, 44 pt tap area).
                        FamilyCloseButton(size: 22, label: "Dismiss") { dismissCredits([inv.id]) }   // family 3D X
                            .padding(.vertical, -10).padding(.trailing, -8)
                    }
                }
                // §A1: each invite is a mini tinted row in its status color.
                .padding(.horizontal, 10).padding(.vertical, 6)
                .tintedPill(inv.status == "redeemed" ? G5Accent.green
                            : inv.status == "converted" ? G5Accent.gold : G5Accent.purple, radius: 12)
                // A dismissed notice fades out while the rows below close the gap.
                .transition(.opacity)
            }

            if !leaders.isEmpty {
                G5Divider(accent: G5Accent.gold)
                HStack(spacing: 5) {
                    Icon3D(.trophy, size: 14)
                    FinishLabel("Top inviters this month")
                }
                VStack(spacing: 0) {
                    ForEach(Array(leaders.enumerated()), id: \.element.id) { i, l in
                        HStack {
                            Text("\(i + 1). \(l.username)").font(Brand.font(11, .bold)).foregroundStyle(FinishInk.heading)
                            Spacer()
                            Text("\(l.count)").softNumber(13)
                            Text("joined").font(Brand.font(11, .bold)).foregroundStyle(FinishInk.secondary)
                        }
                        .padding(.horizontal, 8).padding(.vertical, 6)
                        .stripedRow(i, accent: G5Accent.gold)
                    }
                }
                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        // §T4: the gold-tinted gift card with its gold top bar.
        .tintedCard(accent: G5Accent.gold, bar: [Color(hex: 0xF5A524), Color(hex: 0xFFD166)],
                    radius: 20, barHeight: 6, tint: 0.09, line: 0.28)
        .task { await load() }
        .task(id: auth.profile?.id) { await loadDismissed() }
        .sheet(item: Binding(get: { shareURL.map { ShareURLItem(url: $0) } }, set: { _ in shareURL = nil })) { item in
            ActivityShareSheet(text: ShareCopy.invite(url: "").trimmingCharacters(in: .whitespaces), url: item.url)
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
            .select("id, code, status, created_at, expires_at, invitee_id, converted_plan")
            .eq("inviter_id", value: userId)
            .order("created_at", ascending: false)
            .limit(20)
            .execute().value
        // §251 (founder's sister: "what friends correspond to those invites"):
        // resolve redeemers — profiles is world-readable, one batched read.
        let ids = Array(Set((rows ?? []).compactMap(\.invitee_id)))
        let names: [String: String]? = ids.isEmpty ? nil : await PublicProfileService.usernames(ids: ids)

        var fetchedLeaders: [Leader]? = nil
        if let url = URL(string: "https://wordocious.com/api/referrals/leaderboard"),
           let (data, _) = try? await Net.api.data(from: url),
           let resp = try? JSONDecoder().decode(LeaderboardResponse.self, from: data) {
            fetchedLeaders = resp.leaders
        }
        // The same three reads as before, applied together so the card re-lays out once.
        instantly {
            if let rows { invites = rows }
            if let names { inviteeNames = names }
            if let fetchedLeaders { leaders = fetchedLeaders }
        }
        StatsMemo.shared.set(Self.memoKey, Snapshot(invites: invites, names: inviteeNames, leaders: leaders))
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
        let (data, _) = try await Net.api.data(for: req)
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
