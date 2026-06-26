import SwiftUI

/// Static info pages — About / Privacy / Terms / Support, ported from the
/// app/<page>/page.tsx content. NOTE: the legal prose (Privacy/Terms) is
/// summarized to the canonical sections + key points; the authoritative
/// full text lives on the web and these should be kept in sync with it.
enum InfoKind: Identifiable { case about, privacy, terms, support; var id: Self { self } }

struct InfoSection {
    let heading: String
    let body: String?
    let bullets: [String]
    init(_ heading: String, _ body: String? = nil, bullets: [String] = []) {
        self.heading = heading; self.body = body; self.bullets = bullets
    }
}

struct InfoPage: View {
    let kind: InfoKind
    init(_ kind: InfoKind) { self.kind = kind }
    @StateObject private var content = ContentService.shared

    var body: some View {
        // Same chrome as How to Play / the other menu screens: accent bar +
        // wordmark-gradient title + Close. Works both presented as a sheet (from
        // the "?" menu) and pushed from Settings — MenuScaffold's Close uses the
        // environment dismiss, and we hide the system nav bar so there's no
        // duplicate header in the pushed case.
        MenuScaffold(title) {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    if let sub = subtitle { Text(sub).font(Brand.body(13)).foregroundStyle(Theme.textMuted) }
                    // About + Support are single-sourced via /api/content (ContentService);
                    // Privacy + Terms stay hardcoded for offline / pre-sign-in compliance.
                    if kind == .about || kind == .support {
                        let cs = kind == .about ? content.about : content.support
                        if cs.isEmpty {
                            Text("Loading…").font(Brand.font(12, .regular)).foregroundStyle(Theme.textMuted)
                        } else {
                            ForEach(cs) { contentSectionView($0) }
                        }
                    } else {
                        ForEach(0..<sections.count, id: \.self) { i in sectionView(sections[i]) }
                    }
                    if let contact { Text(contact).font(Brand.font(13, .heavy)).foregroundStyle(Theme.primary) }
                }
                .padding(16)
            }
        }
        .toolbar(.hidden, for: .navigationBar)
        .task { if kind == .about || kind == .support { await content.load() } }
    }

    private func contentSectionView(_ s: ContentService.ContentSection) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(s.heading).font(Brand.font(14, .black)).foregroundStyle(Theme.textPrimary)
            ForEach(Array((s.paragraphs ?? []).enumerated()), id: \.offset) { _, p in
                Text(p).font(Brand.font(12, .regular)).foregroundStyle(Theme.textSecondary)
                    .lineSpacing(6).fixedSize(horizontal: false, vertical: true)
            }
            ForEach(s.items ?? []) { item in
                VStack(alignment: .leading, spacing: 2) {
                    Text(item.heading).font(Brand.font(12, .black))
                        .foregroundStyle(item.accent.flatMap { Color(hexString: $0) } ?? Theme.primary)
                    Text(item.body).font(Brand.font(12, .regular)).foregroundStyle(Theme.textSecondary)
                        .lineSpacing(6).fixedSize(horizontal: false, vertical: true)
                }
            }
        }
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 16).fill(Theme.surface))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1.5))
    }

    private func sectionView(_ s: InfoSection) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(s.heading).font(Brand.font(14, .black)).foregroundStyle(Theme.textPrimary)
            if let b = s.body {
                Text(b).font(Brand.font(12, .regular)).foregroundStyle(Theme.textSecondary)
                    .lineSpacing(6).fixedSize(horizontal: false, vertical: true)
            }
            ForEach(s.bullets, id: \.self) { b in
                HStack(alignment: .top, spacing: 8) {
                    Text("•").foregroundStyle(Theme.primary)
                    Text(b).font(Brand.font(12, .regular)).foregroundStyle(Theme.textSecondary)
                        .lineSpacing(6).fixedSize(horizontal: false, vertical: true)
                }
            }
        }
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 16).fill(Theme.surface))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1.5))
    }

    private var navTitle: String {
        switch kind { case .about: return "About"; case .privacy: return "Privacy"; case .terms: return "Terms"; case .support: return "Support" }
    }
    private var title: String {
        switch kind { case .about: return "About Wordocious"; case .privacy: return "Privacy Policy"; case .terms: return "Terms of Service"; case .support: return "Help & Support" }
    }
    private var subtitle: String? {
        switch kind {
        case .about: return "Epic Word Battles — Daily Puzzles & Multiplayer Showdowns"
        case .privacy: return "Effective April 14, 2026"
        case .terms: return "Effective April 10, 2026"
        case .support: return "Got a question? We've got answers."
        }
    }
    private var contact: String? {
        switch kind { case .terms: return "legal@wordocious.com"; case .support: return "support@wordocious.com"; default: return nil }
    }

    private var sections: [InfoSection] {
        switch kind {
        // About + Support render from ContentService (/api/content), not here.
        case .about, .support: return []
        case .privacy: return [
            InfoSection("Introduction", "This policy explains what Wordocious collects, how we use it, and your choices."),
            InfoSection("Information We Collect", bullets: ["Email address — provided during sign-up or via Google OAuth", "Username / display name — chosen when creating your profile", "Game statistics — scores, win/loss, completion times across all modes", "Streak data — daily streak counts and history", "Device and usage information — device type, usage patterns, anonymous analytics, and (with your permission) advertising identifiers"]),
            InfoSection("How We Use Your Information", bullets: ["To create and manage your account", "To track game progress, streaks, and statistics", "To display leaderboards and records", "To improve and maintain the app", "To communicate important service updates"]),
            InfoSection("Third-Party Services", bullets: ["Supabase — authentication and secure data storage", "Vercel — web hosting", "Google OAuth — optional sign-in; we receive only email + display name", "Google AdMob — displays advertisements to free-tier users; ad-related data collection is governed by Google's privacy policies. Pro subscribers are not shown ads."]),
            InfoSection("Advertising & Data Sharing", "Wordocious shows advertisements to free-tier users. On iOS these are served by Google AdMob and are subject to Google's Privacy Policy. With your permission — requested through Apple's App Tracking Transparency prompt — ads may be personalized; if you decline, you'll see non-personalized ads. Pro subscribers enjoy a completely ad-free experience. We do not sell or rent your personal data for marketing beyond what is necessary for ad delivery."),
            InfoSection("Data Security", "We use industry-standard measures to protect your data. No method of transmission or storage is 100% secure, but we work to safeguard your information."),
            InfoSection("Your Rights", "You may request access to, correction of, or deletion of your personal data at any time. You can delete your account from Settings or by contacting us; upon deletion your personal data is removed from our systems."),
            InfoSection("Children's Privacy", "Wordocious is not intended for children under 13. We do not knowingly collect personal information from children under 13. If you believe a child under 13 has provided us data, contact us so we can remove it."),
            InfoSection("Changes to This Policy", "We may update this policy from time to time. Continued use of the app after changes constitutes acceptance of the updated policy."),
            InfoSection("Contact Us", "Questions about this policy or your personal data? Contact us at privacy@wordocious.com."),
        ]
        case .terms: return [
            InfoSection("Agreement to Terms", "By using Wordocious you agree to these terms."),
            InfoSection("Eligibility", "You must be at least 13 years of age to use the Service."),
            InfoSection("Your Account", "You're responsible for your account and for activity under it."),
            InfoSection("Acceptable Use", bullets: ["No automated tools, bots, scripts, or cheating", "Don't exploit bugs — report them", "No harassment, threats, or abuse", "No offensive/hateful/inappropriate usernames", "Don't access others' accounts or private data", "Don't interfere with or disrupt the Service"]),
            InfoSection("Free Tier & Pro Subscription", bullets: ["Pro is purchased through the App Store (or Google Play on Android) via in-app purchase, subject to that store's terms", "Cancel anytime in your App Store account settings — Pro access continues through the billing period", "Prices may change with advance notice", "Refunds are handled by Apple (or Google) under their policies"]),
            InfoSection("Intellectual Property", "Wordocious and its content are owned by us and protected by law."),
            InfoSection("Disclaimer & Limitation of Liability", "The Service is provided \"as is\" without warranties; liability is limited to the extent permitted by law."),
            InfoSection("Termination", "We may suspend or terminate accounts that violate these terms."),
            InfoSection("Contact Us", "Questions about these terms?"),
        ]
        }
    }
}
