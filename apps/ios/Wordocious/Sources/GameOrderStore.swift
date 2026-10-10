import SwiftUI
import UIKit
import WordociousCore

// FRIDAY-QUEUE item 35 (iOS): the player's saved game order.
// Signed in: profiles.game_order (jsonb, synced across devices) mirrored per user in UserDefaults so the
// order paints instantly; guest: UserDefaults only. Gate: the `custom_game_order` off-switch (off =
// everyone sees the default order, no editing). Pure rules: WordociousCore GameOrder (parity with core
// game-order.ts); web: lib/game-order-store.ts; Android: GameOrderStore.kt.
// `profiles.game_order` is NOT in Profile.selectColumns (the column may not exist yet) — read best-effort.

@MainActor
final class GameOrderStore: ObservableObject {
    static let shared = GameOrderStore()

    /// The saved order (nil = default). Published so every list re-sorts.
    @Published private(set) var prefs: GameOrderPrefs?
    private var userId: String?
    private var fetchedFor: String?

    private static func key(_ uid: String?) -> String { "game-order:\(uid?.lowercased() ?? "guest")" }

    /// Editing is available (the off-switch is live).
    var canEdit: Bool { FlagsService.shared.isLive("custom_game_order") }

    /// Call when the signed-in account changes (HomeView `.task(id:)`): load the local mirror, then the profile row.
    func bind(userId uid: String?) {
        guard uid != userId || fetchedFor == nil else { return }
        userId = uid
        prefs = Self.readLocal(uid)
        guard let uid, fetchedFor != uid else { fetchedFor = uid; return }
        fetchedFor = uid
        Task {
            struct Row: Decodable { let game_order: Raw? }
            struct Raw: Decodable { let dailies: [String]?; let puzzles: [String]? }
            guard let row: Row = try? await AuthService.shared.client.from("profiles")
                .select("game_order").eq("id", value: uid).limit(1).single().execute().value else { return }
            guard self.userId == uid else { return }
            let remote = GameOrder.parse(dailies: row.game_order?.dailies, puzzles: row.game_order?.puzzles)
            self.prefs = remote
            Self.writeLocal(uid, remote)
        }
    }

    private static func readLocal(_ uid: String?) -> GameOrderPrefs? {
        guard let data = UserDefaults.standard.data(forKey: key(uid)),
              let p = try? JSONDecoder().decode(GameOrderPrefs.self, from: data) else { return nil }
        return GameOrder.parse(dailies: p.dailies, puzzles: p.puzzles)
    }

    private static func writeLocal(_ uid: String?, _ p: GameOrderPrefs?) {
        if let p, let data = try? JSONEncoder().encode(p) { UserDefaults.standard.set(data, forKey: key(uid)) }
        else { UserDefaults.standard.removeObject(forKey: key(uid)) }
    }

    /// `modes` (already flag-filtered, catalog order) sorted by the player's order for `section`.
    func ordered(_ modes: [HomeMode], section: GameOrderSection) -> [HomeMode] {
        let saved = canEdit ? prefs.map { section == .dailies ? $0.dailies : $0.puzzles } : nil
        let ids = GameOrder.apply(defaultIds: modes.map(\.id), saved: saved, pinnedFirst: GameOrder.pinned(for: section))
        let byId = Dictionary(modes.map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
        return ids.compactMap { byId[$0] }
    }

    /// The whole Dailies (or Puzzles) id order as the player sees it, for NEXT and other id-only walkers.
    func orderedIds(_ defaultIds: [String], section: GameOrderSection) -> [String] {
        let saved = canEdit ? prefs.map { section == .dailies ? $0.dailies : $0.puzzles } : nil
        return GameOrder.apply(defaultIds: defaultIds, saved: saved, pinnedFirst: GameOrder.pinned(for: section))
    }

    /// Live reorder while dragging: updates the published order only (persist: false), saved on drop.
    func set(section: GameOrderSection, ids: [String], persist: Bool) {
        var p = prefs ?? GameOrderPrefs()
        if section == .dailies { p.dailies = ids } else { p.puzzles = ids }
        let allDefault = GameOrder.isDefault(defaultIds: GameOrder.defaultDailies, saved: p.dailies, pinnedFirst: GameOrder.pinnedFirstDaily)
            && GameOrder.isDefault(defaultIds: GameOrder.defaultPuzzles, saved: p.puzzles, pinnedFirst: nil)
        prefs = allDefault ? nil : p
        if persist { save() }
    }

    func reset(section: GameOrderSection) {
        var p = prefs ?? GameOrderPrefs()
        if section == .dailies { p.dailies = [] } else { p.puzzles = [] }
        prefs = (p.dailies.isEmpty && p.puzzles.isEmpty) ? nil : p
        save()
    }

    func commit() { save() }

    private func save() {
        Self.writeLocal(userId, prefs)
        WidgetBridge.refresh()   // the widget lists games in the same order
        guard let uid = userId else { return }
        let snapshot = prefs
        Task {
            struct Update: Encodable {
                let game_order: GameOrderPrefs?
                func encode(to encoder: Encoder) throws {
                    var c = encoder.container(keyedBy: CodingKeys.self)
                    try c.encode(game_order, forKey: .game_order)   // null clears
                }
                enum CodingKeys: String, CodingKey { case game_order }
            }
            _ = try? await AuthService.shared.client.from("profiles").update(Update(game_order: snapshot)).eq("id", value: uid).execute()
        }
    }
}

// MARK: - Edit mode (Home)

/// The designed edit mode for one Home grid: long-press a tile (or tap the pencil built into the section
/// title) to enter it; tiles wiggle, the dragged tile lifts, the drop target glows. Pinned Classic neither
/// wiggles nor moves. `ids` is the visible order; moves persist when the drop lands.
struct ReorderableTile: ViewModifier {
    let id: String
    let section: GameOrderSection
    @Binding var editing: GameOrderSection?
    @Binding var dragging: String?
    @Binding var targeted: String?
    let ids: [String]
    @ObservedObject var store: GameOrderStore
    @Environment(\.accessibilityReduceMotion) private var reduce

    private var isEditing: Bool { editing == section }
    private var pinned: Bool { id == GameOrder.pinned(for: section) }

    @ViewBuilder
    func body(content: Content) -> some View {
        let wiggle = isEditing && !pinned && !reduce && !Theme.reduceMotion
        let base = content
            .rotationEffect(.degrees(wiggle ? ((ids.firstIndex(of: id) ?? 0) % 2 == 0 ? 1.4 : -1.4) : 0))
            .animation(wiggle ? .easeInOut(duration: 0.14).repeatForever(autoreverses: true) : .default, value: wiggle)
            .scaleEffect(dragging == id ? 1.06 : 1)
            .opacity(dragging == id ? 0.55 : 1)
            // The drop target's glow: the family purple, soft, no outline box.
            .shadow(color: targeted == id && dragging != id ? Color(hex: 0xA78BFA).opacity(0.85) : .clear, radius: 14)
            .simultaneousGesture(
                LongPressGesture(minimumDuration: 0.5).onEnded { _ in
                    guard store.canEdit, !isEditing else { return }
                    Haptics.medium()
                    withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) { editing = section }
                }
            )
            .onDrop(of: [.text], delegate: ReorderDropDelegate(id: id, section: section, ids: ids, dragging: $dragging, targeted: $targeted, store: store, active: isEditing))
        // The system drag only exists in edit mode (otherwise a long press would lift an empty drag).
        if isEditing && !pinned {
            base.onDrag {
                dragging = id
                Haptics.light()
                return NSItemProvider(object: id as NSString)
            }
        } else {
            base
        }
    }
}

private struct ReorderDropDelegate: DropDelegate {
    let id: String
    let section: GameOrderSection
    let ids: [String]
    @Binding var dragging: String?
    @Binding var targeted: String?
    let store: GameOrderStore
    let active: Bool

    func dropEntered(info: DropInfo) {
        guard active, let from = dragging, from != id, id != GameOrder.pinned(for: section),
              let a = ids.firstIndex(of: from), let b = ids.firstIndex(of: id) else { return }
        targeted = id
        withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
            store.set(section: section, ids: GameOrder.move(ids, from: a, to: b, pinnedFirst: GameOrder.pinned(for: section)), persist: false)
        }
        Haptics.selection()
    }
    func dropUpdated(info: DropInfo) -> DropProposal? { DropProposal(operation: active ? .move : .cancel) }
    func performDrop(info: DropInfo) -> Bool {
        guard active else { return false }
        store.commit()
        dragging = nil; targeted = nil
        return true
    }
    func dropExited(info: DropInfo) { if targeted == id { targeted = nil } }
}

extension View {
    func reorderableTile(id: String, section: GameOrderSection, editing: Binding<GameOrderSection?>, dragging: Binding<String?>,
                         targeted: Binding<String?>, ids: [String], store: GameOrderStore) -> some View {
        modifier(ReorderableTile(id: id, section: section, editing: editing, dragging: dragging, targeted: targeted, ids: ids, store: store))
    }
}

/// The pencil glyph built into a Home section title (trailing edge) + the Done / Reset bar shown while editing.
struct GameOrderTitleAccessory: View {
    let section: GameOrderSection
    @Binding var editing: GameOrderSection?
    @ObservedObject var store: GameOrderStore

    var body: some View {
        if store.canEdit, editing != section {
            // Founder 10-09 ("brown … an eyesore"): a quiet frosted coin with the soft clay shuffle mark, not the season helper
            // pill — present, but it never competes with the section art.
            Button { Haptics.light(); withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) { editing = section } } label: {
                let dark = Theme.isDark
                ZStack {
                    Circle().fill(dark ? Color.white.opacity(0.10) : Color(hex: 0x7C3AED).opacity(0.08))
                    Circle().strokeBorder(dark ? Color.white.opacity(0.16) : Color(hex: 0x7C3AED).opacity(0.14), lineWidth: 1)
                    FamClayIcon(name: "shuffle", size: 15, ink: dark ? Color(hex: 0xC4B5FD) : Color(hex: 0x7C3AED))
                }
                .frame(width: 30, height: 30)
                .frame(width: 44, height: 44)
                .contentShape(Rectangle())
                .opacity(0.8)
            }
            .buttonStyle(.squishCard)
            .accessibilityLabel(section == .dailies ? "Reorder Dailies" : "Reorder Puzzles")
        }
    }
}

struct GameOrderEditBar: View {
    let section: GameOrderSection
    @Binding var editing: GameOrderSection?
    @ObservedObject var store: GameOrderStore

    private var atDefault: Bool {
        let saved = store.prefs.map { section == .dailies ? $0.dailies : $0.puzzles }
        return GameOrder.isDefault(defaultIds: section == .dailies ? GameOrder.defaultDailies : GameOrder.defaultPuzzles,
                                   saved: saved, pinnedFirst: GameOrder.pinned(for: section))
    }

    var body: some View {
        HStack(spacing: 8) {
            Text("DRAG TO REORDER")
                .font(Brand.font(11.5, .black)).tracking(0.5)
                .foregroundStyle(Color(hex: 0x7C3AED).opacity(0.85))
            Button { Haptics.light(); store.reset(section: section) } label: { CandyLabel(title: "Reset", symbol: "arrow.counterclockwise") }
                .buttonStyle(QuietButtonStyle(size: .small))
                .disabled(atDefault)
            Button { Haptics.medium(); store.commit(); withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) { editing = nil } } label: { CandyLabel(title: "Done", symbol: "checkmark") }
                .buttonStyle(HelperButtonStyle(fallback: Color(hex: 0x7C3AED), selected: true))
        }
        .frame(maxWidth: .infinity)
        .transition(.opacity.combined(with: .scale(scale: 0.96)))
    }
}
