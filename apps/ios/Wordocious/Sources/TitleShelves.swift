import SwiftUI
import WordociousCore

// Founder 10-05 "T1 Title Shelves" (docs/design/profile-2026-10-05): the featured-title picker. A live
// name plate on top (your mascot, name and the gold ribbon), search, "Recently earned", then one shelf per
// catalog category with its count ("13 / 94"). Earned badges try the title on; locked ones are dimmed and
// say how to earn them. Badge art = art-ach-<key> (BadgeArt fallbacks); shelf, plaque, lock + PICK YOUR
// TITLE lettering = ChatGPT art. Parity: Android TitleShelves.kt, web title-shelves.tsx.

enum TitleShelfRules {
    /// The shelves in order (catalog category → shelf label).
    static let shelves: [(id: String, label: String)] = [
        ("skill", "Skill"), ("consistency", "Streaks"), ("beginner", "Firsts"), ("puzzles", "Puzzles"),
        ("social", "VS"), ("friends", "Friends"), ("collection", "Medals"), ("mascot", "Mascot"),
        ("pocket", "Pocket"), ("bots", "Bots"), ("streaks", "Time of day"), ("seasonal", "Seasonal"),
    ]

    /// The visible titles (hidden ones never show), and the most recently earned first.
    static func recent(_ defs: [AchievementDef], dates: [String: String], limit: Int = 8) -> [AchievementDef] {
        defs.filter { dates[$0.key] != nil }
            .sorted { (dates[$0.key] ?? "") > (dates[$1.key] ?? "") }
            .prefix(limit).map { $0 }
    }
}

struct TitleShelvesView: View {
    let username: String
    let mascot: AvatarConfig
    let initial: String
    var accent: Color = Color(hex: 0x6D28D9)
    let unlockedDates: [String: String]
    let selected: String?
    let onPick: (String?) -> Void

    @ObservedObject private var catalog = AchievementCatalog.shared
    @Environment(\.dismiss) private var dismiss
    @State private var pick: String?
    @State private var query = ""
    @State private var hint = "Tap a badge to try it on."
    @State private var hop = 0
    /// BI25 pattern (Settings): the shelves build after the slide-up lands, never on the presenting
    /// frame (2.7.1 gate: ~30 badge decodes + grays there stalled the open 0.7–1.1 s cold).
    @State private var settled = false

    init(username: String, mascot: AvatarConfig, initial: String, accent: Color = Color(hex: 0x6D28D9),
         unlockedDates: [String: String], selected: String?, onPick: @escaping (String?) -> Void) {
        self.username = username; self.mascot = mascot; self.initial = initial; self.accent = accent
        self.unlockedDates = unlockedDates; self.selected = selected; self.onPick = onPick
        _pick = State(initialValue: selected)
    }

    private var visible: [AchievementDef] { catalog.all.filter { !($0.hidden ?? false) } }
    private func earned(_ d: AchievementDef) -> Bool { unlockedDates[d.key] != nil }
    private func matches(_ d: AchievementDef) -> Bool {
        let q = query.trimmingCharacters(in: .whitespaces).lowercased()
        return q.isEmpty || d.name.lowercased().contains(q)
    }
    private var ink: Color { Theme.isDark ? Theme.textPrimary : FinishInk.title }
    private var labelInk: Color { Theme.isDark ? Theme.textSecondary : Color(hex: 0x6D28D9) }

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                StageCloseButton(onStage: false) { dismiss() }
                    .padding(.leading, -8)
                    .frame(width: StageMetrics.sideSlot, alignment: .leading)
                Group {
                    if ArtAsset.exists("art-dress-title") {
                        // Fits between the side slots (scales down on a narrow phone instead of running under DONE).
                        ArtThumbs.image("art-dress-title", points: 240).resizable().interpolation(.high).scaledToFit()
                            .frame(maxHeight: 30).padding(.horizontal, 2)
                            .accessibilityLabel("Pick your title")
                    } else {
                        Text("PICK YOUR TITLE").font(Brand.font(20, .black)).foregroundStyle(Color(hex: 0xF5B82E))
                    }
                }
                .frame(maxWidth: .infinity)
                Button { onPick(pick); dismiss() } label: { CandyLabel(title: "Done") }
                    .buttonStyle(CastButtonStyle(color: .purple, size: .small, fullWidth: false))
                    .frame(width: StageMetrics.sideSlot, alignment: .trailing)
            }
            .padding(.horizontal, 10).padding(.top, 10)
            plate.padding(.horizontal, 14).padding(.top, 10)
            search.padding(.horizontal, 14).padding(.top, 8)
            ScrollView(showsIndicators: false) {
                if settled { shelves.transition(.opacity) }
            }
        }
        .background((Theme.isDark ? Theme.surface : Color(hex: 0xF6F0FF)).ignoresSafeArea())
        .task {
            try? await Task.sleep(nanoseconds: 380_000_000)
            withAnimation(.easeOut(duration: 0.2)) { settled = true }
        }
        .task { await catalog.load() }
    }

    private var shelves: some View {
        LazyVStack(alignment: .leading, spacing: 4) {
            let recent = TitleShelfRules.recent(visible, dates: unlockedDates).filter(matches)
            if !recent.isEmpty { shelf("Recently earned", count: nil, recent) }
            ForEach(TitleShelfRules.shelves, id: \.id) { s in
                let all = visible.filter { $0.category == s.id }
                let list = (all.filter(earned) + all.filter { !earned($0) }).filter(matches)
                if !list.isEmpty { shelf(s.label, count: "\(all.filter(earned).count) / \(all.count)", list) }
            }
            if visible.isEmpty {
                // Never a bare screen: the bundled catalog makes this rare (a broken install / cache).
                VStack(spacing: 8) {
                    PoseImage(.d, "skeptic", height: 70)
                    Text("Your titles are on their way").font(Brand.font(14, .black)).foregroundStyle(ink)
                    Button { Task { await catalog.load(force: true) } } label: { CandyLabel(title: "Try again") }
                        .buttonStyle(CastButtonStyle(color: .purple, size: .small, fullWidth: false))
                }
                .frame(maxWidth: .infinity).padding(.top, 30)
            } else if visible.filter(matches).isEmpty {
                VStack(spacing: 6) {
                    PoseImage(.d, "skeptic", height: 70)
                    Text("No title matches \"\(query)\"").font(Brand.font(13, .black)).foregroundStyle(ink)
                }
                .frame(maxWidth: .infinity).padding(.top, 24)
            }
        }
        .padding(.bottom, 30)
    }

    private var plate: some View {
        HStack(spacing: 8) {
            LiveMascot(config: mascot, initial: initial, size: 78, hopToken: hop)
            VStack(alignment: .leading, spacing: 4) {
                Text(username).font(Brand.font(20, .black)).foregroundStyle(accent).lineLimit(1).minimumScaleFactor(0.6)
                let name = pick.flatMap { k in catalog.all.first { $0.key == k }?.name }
                TitleRibbon(text: name ?? "No title", height: 26, maxWidth: 230, placeholder: name == nil)
                Text(hint).font(Brand.font(11, .bold)).foregroundStyle(Theme.isDark ? Theme.textSecondary : Color(hex: 0x7A6AA6))
                    .lineLimit(2).fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
            if pick != nil {
                Button { Haptics.tap(); pick = nil; hint = "No title for now." } label: {
                    Text("None").font(Brand.font(11, .black)).foregroundStyle(Color(hex: 0x7C3AED))
                        .padding(.horizontal, 10).padding(.vertical, 5)
                        .background(Capsule().fill(Color(hex: 0x7C3AED).opacity(0.1)))
                }
                .buttonStyle(.squish)
                .accessibilityLabel("Wear no title")
            }
        }
        .padding(.vertical, 6).padding(.horizontal, 8)
        .background(RoundedRectangle(cornerRadius: 20, style: .continuous)
            .fill(LinearGradient(colors: [Color.white.opacity(Theme.isDark ? 0.08 : 0.8), Color(hex: 0xEDE9FE).opacity(Theme.isDark ? 0.06 : 0.6)],
                                 startPoint: .topLeading, endPoint: .bottomTrailing)))
    }

    private var search: some View {
        HStack(spacing: 6) {
            Image(systemName: "magnifyingglass").font(.system(size: 13, weight: .black)).foregroundStyle(Color(hex: 0x8B7FB3))
            TextField("Search your titles", text: $query)
                .font(Brand.font(13, .heavy)).foregroundStyle(ink)
                .textInputAutocapitalization(.never).autocorrectionDisabled()
        }
        .padding(.horizontal, 12).padding(.vertical, 8)
        .background(Capsule().fill(Color.white.opacity(Theme.isDark ? 0.08 : 0.8)))
    }

    private func shelf(_ label: String, count: String?, _ list: [AchievementDef]) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text(label.uppercased()).font(Brand.font(10, .black)).tracking(1.2).foregroundStyle(labelInk)
                Spacer()
                if let count {
                    // The plaque art is the count's frame (it used to hang 7 pt past the padding, near the edge).
                    Text(count).font(Brand.font(10, .black)).foregroundStyle(Color(hex: 0x7C2D12))
                        .lineLimit(1).minimumScaleFactor(0.8)
                        .frame(width: 64, height: 22)
                        .background { if ArtAsset.exists("art-dress-plaque") { StageArt("art-dress-plaque", width: 64, height: 22) } }
                        .accessibilityLabel("\(count) earned")
                }
            }
            .padding(.horizontal, 16).padding(.top, 10)
            ScrollView(.horizontal, showsIndicators: false) {
                // Lazy: a shelf holds up to ~94 badges; only the on-screen ones build (2.7.1 gate: the eager
                // row decoded every badge on the opening frame, a ~1 s stall on the Title Shelves open).
                LazyHStack(alignment: .top, spacing: 4) {
                    ForEach(list) { d in badge(d) }
                }
                .padding(.horizontal, 10).padding(.top, 4)
            }
            // The ledge sits under the two-line names (it used to overlap and cut "Warrior", "Victory"…).
            shelfLedge.padding(.horizontal, 8).padding(.top, -1)
        }
    }

    private var shelfLedge: some View {
        HStack(spacing: 0) {
            StageArt("art-dress-shelf-l", height: 16)
            Group {
                if ArtAsset.exists("art-dress-shelf-m") {
                    ArtThumbs.image("art-dress-shelf-m", points: 24).resizable()
                } else { Color(hex: 0xC4B5FD) }
            }
            .frame(height: 16)
            StageArt("art-dress-shelf-r", height: 16)
        }
        .accessibilityHidden(true)
    }

    private func badge(_ d: AchievementDef) -> some View {
        let isEarned = earned(d)
        let on = pick == d.key
        return Button {
            Haptics.tap()
            if !isEarned { hint = "Locked · \(d.description.isEmpty ? "Keep playing" : d.description)"; return }
            pick = d.key
            hint = d.description
            hop += 1
        } label: {
            VStack(spacing: 2) {
                ZStack(alignment: .topTrailing) {
                    AchievementBadgeArt(icon: d.icon, key: d.key, category: d.category, unlocked: isEarned, size: 50,
                                        glow: on ? Color(hex: 0xF59E0B) : Color(hex: 0x7C3AED))
                        .scaleEffect(on ? 1.08 : 1)
                }
                Text(d.name).font(Brand.font(9.5, .heavy))
                    .foregroundStyle(on ? Color(hex: 0xB45309) : (isEarned ? ink : Color(hex: 0xA99CCF)))
                    .multilineTextAlignment(.center).lineLimit(2).minimumScaleFactor(0.8)
                    .frame(width: 64, height: 26, alignment: .top)
            }
            .frame(width: 66)
        }
        .buttonStyle(.squish)
        .accessibilityLabel("\(d.name)\(isEarned ? "" : ", locked. \(d.description)")")
        .accessibilityAddTraits(on ? [.isButton, .isSelected] : .isButton)
    }
}
