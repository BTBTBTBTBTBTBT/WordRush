import SwiftUI
import WordociousCore

// Mascot item gating on iOS (docs/cloud-prompts/11; core WordociousCore AvatarAccess, a port of
// packages/core/src/avatar-access.ts). Behind AvatarAccessConfig.itemGating (OFF): with it off the maker keeps today's
// Pro pill → Go Pro and AvatarCatalog.enforcePro. With it on, every part can be tried on; Save runs the save check
// and, when parts are locked, shows the Locked card (below) instead of saving.
// The access context comes from data the app already has: the profile (level / streaks), the unlocked achievement
// keys (Edit Profile loads them), and the owned-items ledger (docs/sql/20261010-owned-items.sql — NOT applied yet,
// so owned is empty). No real purchases yet: Buy is a stub.

/// The bundled access table + the app's access context (WordociousCore AvatarAccess).
enum MascotAccess {
    /// avatar-access.json (the PROPOSED table); missing / malformed → no rules (every part free while gating is on).
    static let table: AvatarAccessTable = {
        guard let url = Bundle.main.url(forResource: "avatar-access", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let t = try? AvatarAccessTable.decode(data) else { return .empty }
        return t
    }()

    /// Gating is on (and the fit manifest — where the seasonal parts live — loaded).
    static var isOn: Bool { AvatarAccessConfig.itemGating && MascotParts.fit != nil }

    /// The earn evaluator's input from a profile row (+ the player's unlocked achievement keys; nil = not loaded).
    static func stats(_ p: Profile?, achievements: Set<String>?) -> AvatarEarnStats {
        AvatarEarnStats(level: Double(p?.level ?? 1), currentStreak: Double(p?.currentStreak ?? 0),
                        bestStreak: Double(p?.bestStreak ?? 0), bestLoginStreak: Double(p?.bestDailyLoginStreak ?? 0),
                        achievements: achievements.map { Array($0).sorted() })
    }

    /// The access context for today: the maker's season (the admin preview or the calendar's, like MascotSeasonal).
    static func context(isPro: Bool, stats: AvatarEarnStats?, saved: AvatarConfig?) -> AvatarAccessContext {
        AvatarAccessContext(isPro: isPro, owned: ownedKeys, stats: stats, date: AvatarSeason.today(),
                            previewSeason: MascotSeasonal.season ?? "none", saved: saved)
    }

    /// The owned_items ledger (my_owned_items: your own active rows; supabase/manual-migrations/20261009000009_owned_items.sql).
    /// Admin grants, earns and purchases land here; an owned part saves without Pro. Empty until loaded / signed out.
    static var ownedKeys: [String] = []

    /// Reload the ledger (no-throw; keeps the last good list on failure).
    @MainActor static func loadOwned() async {
        struct Row: Decodable { let item_key: String }
        guard AuthService.shared.profile != nil else { ownedKeys = []; return }
        if let rows: [Row] = try? await AuthService.shared.client.from("my_owned_items").select("item_key").execute().value {
            ownedKeys = rows.map(\.item_key)
        }
    }

    /// The gating-OFF save: today's Pro strip, then the OWNED parts come back (they save without Pro), then a seasonal part is
    /// free only in its season (Pro / owned / already on the saved look otherwise: seasonal parts never disappear).
    static func legacySave(_ c: AvatarConfig, _ ctx: AvatarAccessContext) -> AvatarConfig {
        let kept = AvatarAccess.keepOwned(original: c, enforced: AvatarCatalog.enforcePro(c, isPro: ctx.isPro), owned: ctx.owned)
        guard let fit = MascotParts.fit else { return kept }
        return AvatarAccess.enforceSeasonal(kept, ctx, table: table, manifest: fit)
    }

    static func access(_ part: AvatarPart, _ ctx: AvatarAccessContext) -> AvatarPartAccess? {
        guard let fit = MascotParts.fit else { return nil }
        return AvatarAccess.partAccess(part, ctx, table: table, manifest: fit)
    }

    /// A part the player can try on but not save yet (always false while gating is off).
    static func isLocked(_ field: String, _ id: String, _ ctx: AvatarAccessContext) -> Bool {
        guard isOn else { return false }
        return access(AvatarPart(field: field, id: id), ctx)?.unlocked == false
    }

    /// The worn parts that block a save (nil while gating is off).
    static func saveCheck(_ c: AvatarConfig, _ ctx: AvatarAccessContext) -> AvatarSaveCheck? {
        guard isOn, let fit = MascotParts.fit else { return nil }
        return AvatarAccess.saveCheck(c, ctx, table: table, manifest: fit)
    }

    /// The look with its locked parts taken off ("Save without it").
    static func enforce(_ c: AvatarConfig, _ ctx: AvatarAccessContext) -> AvatarConfig {
        guard isOn, let fit = MascotParts.fit else { return c }
        return AvatarAccess.enforce(c, ctx, table: table, manifest: fit)
    }

    /// A locked part's name on the card ("Cowboy", "Navy color", "Gold frame").
    static func partName(_ p: AvatarPart) -> String {
        switch p.field {
        case "color", "patternColor", "accColor":
            let n = p.id == "red" ? "Red" : MascotOptionNames.name(p.id)
            return p.field == "color" ? "\(n) color" : p.field == "patternColor" ? "\(n) pattern color" : "\(n) accessory color"
        case "frame": return "\(AvatarFrameRules.tier(p.id)?.label ?? MascotOptionNames.name(p.id)) frame"
        case "bg": return "\(MascotOptionNames.name(p.id)) backdrop"
        case "body": return "\(MascotOptionNames.name(p.id)) body"
        case "pattern": return "\(MascotOptionNames.name(p.id)) pattern"
        case "pose": return AvatarPosesData.bundled?.poses[p.id]?.label ?? MascotOptionNames.name(p.id)
        default: return MascotOptionNames.name(p.id)
        }
    }
}

/// The small lock tag on a locked tile (gating on): the dress-up lock art, else a lock glyph on a white chip.
struct MascotLockTag: View {
    var height: CGFloat = 15

    var body: some View {
        if ArtAsset.exists("art-dress-lock") {
            StageArt("art-dress-lock", height: height)
        } else {
            Image(systemName: "lock.fill").font(.system(size: height * 0.6, weight: .black)).foregroundStyle(Color(hex: 0x6D28D9))
                .frame(width: height + 3, height: height + 3)
                .background(Circle().fill(Color.white))
                .shadow(color: Color(hex: 0x3C1E78).opacity(0.25), radius: 1.5, y: 1)
                .accessibilityHidden(true)
        }
    }
}

/// The "Locked" card the maker shows when Save is tapped wearing parts the player can't save yet (gating on). The
/// mascot keeps wearing them (try-on), and each locked part lists the routes that apply (AvatarAccess.lockedCardRoutes):
/// Earn (with progress) · Included with Pro · Buy $X · the season. "Save without it" saves the look with the locked parts
/// taken off (AvatarAccess.enforce); "Keep trying on" goes back to the maker.
struct LockedItemCard: View {
    let config: AvatarConfig
    let initial: String
    let locked: [AvatarPart]
    let ctx: AvatarAccessContext
    var onSaveWithout: () -> Void
    var onClose: () -> Void

    @State private var showPro = false
    @State private var note: String?

    private var them: Bool { locked.count > 1 }

    var body: some View {
        ScrollView(showsIndicators: false) {
            VStack(alignment: .leading, spacing: 14) {
                header
                ForEach(locked, id: \.field) { part in partCard(part) }   // one part per field
                if let note { G5Notice(note, tone: .info) }
                VStack(spacing: 10) {
                    Button { onSaveWithout() } label: { CandyLabel(title: them ? "Save without them" : "Save without it") }
                        .buttonStyle(CandyButtonStyle(variant: .purple, size: .medium, fullWidth: true))
                    Button { onClose() } label: {
                        Text("Keep trying on").font(Brand.font(14, .black)).foregroundStyle(Color(hex: 0x6D28D9))
                            .frame(maxWidth: .infinity).padding(.vertical, 8)
                    }
                    .buttonStyle(.squish)
                }
                .padding(.top, 4)
            }
            .padding(.horizontal, 18).padding(.top, 22).padding(.bottom, 24)
        }
        .background((Theme.isDark ? Theme.surface : Color.white).ignoresSafeArea())
        .softSheet(isPresented: $showPro) { ProView(reason: "Pro mascot styles") }
    }

    private var header: some View {
        HStack(alignment: .center, spacing: 12) {
            // TODO(art): the ChatGPT lock art `art-lock-card` (a cast member peeking at the item behind a velvet rope)
            // replaces this placeholder slot once it ships.
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(Color(hex: 0xEDE9FE))
                .frame(width: 64, height: 64)
                .overlay(Image(systemName: "lock.fill").font(.system(size: 26, weight: .black)).foregroundStyle(Color(hex: 0x7C3AED)))
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 3) {
                BubbleLabel("Locked", color: Color(hex: 0x7C3AED).bubbleInk, size: 23)
                    .accessibilityAddTraits(.isHeader)
                Text("You can try \(them ? "these" : "it") on. Unlock to save.")
                    .font(Brand.font(12, .bold)).foregroundStyle(FinishInk.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
            MascotAvatar(config: wearing, initial: initial, size: 72, cached: false)
                .accessibilityLabel("Your mascot wearing it")
        }
    }

    /// The draft (wearing the locked parts), always as the mascot.
    private var wearing: AvatarConfig {
        var c = config
        c.display = "mascot"
        return c
    }

    private func partCard(_ part: AvatarPart) -> some View {
        let routes = MascotAccess.access(part, ctx).map(AvatarAccess.lockedCardRoutes) ?? []
        return VStack(alignment: .leading, spacing: 8) {
            BubbleLabel(MascotAccess.partName(part), color: Color(hex: 0x7C3AED).bubbleInk, size: 16)
            if routes.isEmpty {
                HStack(spacing: 8) {
                    Image("art-badge-calendar").resizable().interpolation(.high).scaledToFit()
                        .frame(width: 22, height: 22).accessibilityHidden(true)
                    Text("Not up for grabs right now. Check back soon.").font(Brand.font(12, .heavy)).foregroundStyle(FinishInk.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            ForEach(Array(routes.enumerated()), id: \.offset) { _, route in routeRow(route) }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(Theme.isDark ? Color.white.opacity(0.06) : Color(hex: 0xF6F0FF)))
    }

    @ViewBuilder private func routeRow(_ route: AvatarAccessRoute) -> some View {
        let line = AvatarAccess.routeLine(route)
        switch route {
        case .earn(let p):
            VStack(alignment: .leading, spacing: 4) {
                Text(line).font(Brand.font(12, .heavy)).foregroundStyle(Theme.isDark ? Theme.textPrimary : Color(hex: 0x5B21B6))
                    .fixedSize(horizontal: false, vertical: true)
                if p.target > 1 {
                    BadgeProgressBar(current: p.current, target: p.target, accent: FinishInk.purple, numberSize: 11)
                }
            }
        case .pro:
            // the Go Pro flow the maker opens for Pro items today
            Button { showPro = true } label: { CandyLabel(title: line) }
                .buttonStyle(CastButtonStyle(color: .purple, size: .small, fullWidth: true))
        case .buy(_, let price):
            // TODO(IAP): a direct non-consumable item purchase (StoreKit) writing the owned_items ledger. Stubbed: no
            // purchase happens yet.
            Button { note = "Purchases are coming soon." } label: { CandyLabel(title: line) }
                .buttonStyle(CastButtonStyle(color: .gold, size: .small, fullWidth: true))
                .accessibilityLabel("Buy for \(AvatarAccess.priceLabel(price))")
        case .season:
            // Not earnable right now: a small calendar badge and the season line, never a bare orange sentence.
            HStack(spacing: 8) {
                Image("art-badge-calendar").resizable().interpolation(.high).scaledToFit()
                    .frame(width: 22, height: 22).accessibilityHidden(true)
                Text(line).font(Brand.font(12, .heavy)).foregroundStyle(Theme.isDark ? Color(hex: 0xFDBA74) : Color(hex: 0xC2410C))
                    .fixedSize(horizontal: false, vertical: true)
                Spacer(minLength: 0)
            }
        }
    }
}
