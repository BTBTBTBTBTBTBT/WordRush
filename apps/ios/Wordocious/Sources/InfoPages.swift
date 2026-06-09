import SwiftUI

/// Static info pages — About / Privacy / Terms / Support, ported from the
/// app/<page>/page.tsx content. NOTE: the legal prose (Privacy/Terms) is
/// summarized to the canonical sections + key points; the authoritative
/// full text lives on the web and these should be kept in sync with it.
enum InfoKind { case about, privacy, terms, support }

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

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Text(title).font(Brand.title(30)).foregroundStyle(Theme.textPrimary)
                    if let sub = subtitle { Text(sub).font(Brand.body(13)).foregroundStyle(Theme.textMuted) }
                    ForEach(0..<sections.count, id: \.self) { i in sectionView(sections[i]) }
                    if let contact { Text(contact).font(Brand.font(13, .heavy)).foregroundStyle(Theme.primary) }
                }
                .padding(16)
            }
        }
        .navigationTitle(navTitle).navigationBarTitleDisplayMode(.inline)
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
        case .about: return [
            InfoSection("What is Wordocious?", "A daily word-puzzle game with 10 modes — from the classic single-board to multi-board challenges, a 5-stage Gauntlet, and real-time VS battles."),
            InfoSection("10 Game Modes", bullets: ["Classic — 1 word, 6 tries", "VS Battle — real-time PvP", "QuadWord — 4 boards", "OctoWord — 8 boards", "Succession — 4 words in order", "Deliverance — 4 prefilled boards", "Six / Seven — 6- and 7-letter words", "Gauntlet — 5 escalating stages", "ProperNoundle — famous names"]),
            InfoSection("Daily Challenges & Streaks", "Every player gets the same daily puzzles. Play each day to build your streak — streak shields protect it if you miss a day."),
            InfoSection("Leaderboards & Competition", "Compete on daily leaderboards per mode and chase the all-time hall of records."),
            InfoSection("How Scoring Works", "A 1,000-point base for solving, plus time and completion bonuses (and a guess bonus on hint modes). Fewer guesses and faster solves rank higher."),
            InfoSection("Free to Play", "All daily puzzles are free. Pro unlocks unlimited replays, VS on every mode, and more."),
        ]
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
            InfoSection("Free Tier & Pro Subscription", bullets: ["Pro is billed through Stripe (web) / the App Store (iOS)", "Cancel anytime — Pro access continues through the billing period", "Prices may change with advance notice", "Refunds handled case-by-case"]),
            InfoSection("Intellectual Property", "Wordocious and its content are owned by us and protected by law."),
            InfoSection("Disclaimer & Limitation of Liability", "The Service is provided \"as is\" without warranties; liability is limited to the extent permitted by law."),
            InfoSection("Termination", "We may suspend or terminate accounts that violate these terms."),
            InfoSection("Contact Us", "Questions about these terms?"),
        ]
        case .support: return [
            InfoSection("How do I play Wordocious?", "Guess the hidden word in the allotted tries; tiles show green (correct spot), yellow (wrong spot), gray (not in word)."),
            InfoSection("What are the different game modes?", "10 modes from Classic to multi-board, Gauntlet, and VS — see About for the full list."),
            InfoSection("How are daily scores calculated?", "A base of 1,000 for completing, a guess bonus (hint modes), a speed bonus for finishing fast, and a completion bonus on multi-board modes."),
            InfoSection("How do XP and levels work?", "Win = 100 XP, loss = 25 XP, with streak + daily bonuses. Every 1,000 XP is a level."),
            InfoSection("How do streaks work?", "Play a daily each day to build your streak; streak shields protect it if you miss."),
            InfoSection("What is Wordocious Pro?", "Unlimited replays, VS on every mode, streak shields, a Pro badge, and extended stats."),
            InfoSection("My stats aren't showing up?", "Make sure you're signed in — stats and leaderboards require an account."),
            InfoSection("Found a bug or have a suggestion?", "We'd love to hear it — reach out below."),
        ]
        }
    }
}
