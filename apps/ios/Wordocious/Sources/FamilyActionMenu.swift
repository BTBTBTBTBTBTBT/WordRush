import SwiftUI

// The family ACTION MENU (founder 10-05: "There shouldn't be any plain text menus looking like this").
// Replaces every system `Menu` / `.contextMenu` in user-facing screens with the approved picker look
// (Pick a Friend option 1, 10-03): a calm lavender sheet with the soft pink grabber, the subject's
// face + name on top, the family 3D X, and illustrated candy rows — a frosted family coin (white-clay
// icon tinted like a helper pill, or a full-color 3D icon) + the label in Nunito Black. Destructive
// rows take the family pink (danger) tint. No plain text lists, no chevrons.
// Opening / closing is the system sheet slide the picker uses; a picked row closes the sheet first and
// runs its action on dismiss, so any confirmation dialog it opens presents cleanly.
// Android: FamilyActionMenu.kt · web: components/ui/family-action-menu.tsx.

enum FamilyMenuIcon {
    /// A white-clay family icon (`art-fam-ic-<name>`), tinted by the row's ink.
    case clay(String)
    /// A full-color 3D art image set (icon3d-*, art-badge-*).
    case art(String)
    /// An SF Symbol with no family art yet (camera, photo library), drawn in the row's ink like FamilyIcon.
    case symbol(String)
}

struct FamilyMenuAction: Identifiable {
    let id: String
    let title: String
    let icon: FamilyMenuIcon
    var tint: Color = FamilyMenuInk.purple
    var danger = false
    var disabled = false
    /// VoiceOver label (defaults to the title).
    var accessibility: String? = nil
    let run: () -> Void
}

enum FamilyMenuInk {
    static let sheet = Color(hex: 0xF4F0FF)   // the picker's lavender (option 1)
    static let purple = Color(hex: 0x7C3AED)
    static let pink = Color(hex: 0xDB2777)
    static let amber = Color(hex: 0xD97706)
    static let teal = Color(hex: 0x0D9488)
    /// The family danger tint (the same pink as a confirming Remove friend).
    static let danger = pink
    /// Fixed light inks (web / Android parity): the menu is always the light lavender sheet,
    /// so its text never takes a dark season's light ink (FriendsInk flips under Haunted glass).
    static let heading = Color(hex: 0x3B1F6E)
    static let sub = Color(hex: 0x7A6A95)
    static let rowHeight: CGFloat = 58
    static let rowGap: CGFloat = 8

    /// The sheet height for a header + `rows` rows (grabber, header, rows, bottom air).
    static func height(rows: Int) -> CGFloat {
        13 + 14 + 42 + 14 + CGFloat(rows) * rowHeight + CGFloat(max(0, rows - 1)) * rowGap + 10
    }
}

/// The menu's content: who it's about + the rows.
struct FamilyActionMenuModel {
    let title: String
    var subtitle: String? = nil
    var avatar: AnyView? = nil
    let actions: [FamilyMenuAction]
}

struct FamilyActionMenu: View {
    let model: FamilyActionMenuModel
    let pick: (FamilyMenuAction) -> Void
    let close: () -> Void

    var body: some View {
        VStack(spacing: 14) {
            Capsule().fill(FriendsInk.pink.wash(0.35)).frame(width: 40, height: 5).padding(.top, 8)
                .accessibilityHidden(true)
            HStack(spacing: 12) {
                if let avatar = model.avatar { avatar }
                VStack(alignment: .leading, spacing: 2) {
                    Text(model.title).font(Brand.font(19, .black)).foregroundStyle(FamilyMenuInk.heading)
                        .lineLimit(1).minimumScaleFactor(0.7)
                    if let s = model.subtitle {
                        Text(s).font(Brand.font(12, .heavy)).foregroundStyle(FamilyMenuInk.sub).lineLimit(1)
                    }
                }
                .accessibilityElement(children: .combine)
                .accessibilityAddTraits(.isHeader)
                Spacer(minLength: 8)
                FamilyCloseButton(size: 28, label: "Close menu", action: close)
            }
            .frame(height: 56 - 14)
            VStack(spacing: FamilyMenuInk.rowGap) {
                ForEach(model.actions) { a in row(a) }
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 16)
        .environment(\.colorScheme, .light)
    }

    private func row(_ a: FamilyMenuAction) -> some View {
        let tint = a.danger ? FamilyMenuInk.danger : a.tint
        let ink = FamilyInk.helperInk(tint, dark: false)
        return Button { pick(a) } label: {
            HStack(spacing: 12) {
                ZStack {
                    FamilyPillSkin(fill: FamilyInk.helperFill(tint, dark: false, pressed: false), height: 40)
                        .frame(width: 40, height: 40)
                    switch a.icon {
                    case .clay(let name):
                        if let ui = FamilyArt.shared.image("art-fam-ic-\(name)") {
                            Image(uiImage: ui).resizable().interpolation(.high).aspectRatio(contentMode: .fit)
                                .frame(width: 22, height: 22).colorMultiply(ink)
                        }
                    case .art(let name):
                        Image(name).resizable().interpolation(.high).aspectRatio(contentMode: .fit)
                            .frame(width: 28, height: 28)
                    case .symbol(let symbol):
                        FamilyIcon(symbol: symbol, size: 22, ink: ink)
                    }
                }
                .accessibilityHidden(true)
                Text(a.title).font(Brand.font(17, .black))
                    .foregroundStyle(a.danger ? ink : FamilyMenuInk.heading)
                    .lineLimit(1).minimumScaleFactor(0.8)
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 10)
            .frame(height: FamilyMenuInk.rowHeight)
            .background(RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(a.danger ? tint.mixed(over: .white, 0.10) : Color.white.opacity(0.78)))
            .shadow(color: tint.opacity(0.10), radius: 6, y: 2)
            .contentShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        }
        .buttonStyle(.squish)
        .disabled(a.disabled)
        .opacity(a.disabled ? 0.5 : 1)
        .accessibilityLabel(a.accessibility ?? a.title)
    }
}

private struct FamilyActionMenuModifier<Item: Identifiable>: ViewModifier {
    @Binding var item: Item?
    let model: (Item) -> FamilyActionMenuModel
    /// The picked row's action, run once the sheet is gone (so a confirmation can present).
    @State private var pending: (() -> Void)?

    func body(content: Content) -> some View {
        // BJ10: an app-owned sheet soft-pops like the Pick a Friend picker it matches.
        content.softSheet(item: $item, onDismiss: {
            let run = pending
            pending = nil
            run?()
        }) { it in
            let m = model(it)
            FamilyActionMenu(model: m, pick: { a in
                pending = a.run
                item = nil
            }, close: { item = nil })
            .background(FamilyMenuInk.sheet.ignoresSafeArea())
            .presentationDetents([.height(FamilyMenuInk.height(rows: m.actions.count))])
            .presentationDragIndicator(.hidden)
            .modifier(FamilyMenuSheetChrome())
        }
    }
}

private struct FamilyMenuSheetChrome: ViewModifier {
    func body(content: Content) -> some View {
        if #available(iOS 16.4, *) {
            content.presentationBackground(FamilyMenuInk.sheet).presentationCornerRadius(28)
        } else {
            content
        }
    }
}

extension View {
    /// Presents the family action menu for `item` (nil = closed).
    func familyActionMenu<Item: Identifiable>(item: Binding<Item?>,
                                              model: @escaping (Item) -> FamilyActionMenuModel) -> some View {
        modifier(FamilyActionMenuModifier(item: item, model: model))
    }
}

/// A one-off Identifiable for menus that aren't about a list item (e.g. a profile's More menu).
struct FamilyMenuToken: Identifiable { let id: String }

#if DEBUG
/// `-storeShot friendmenu|profilemenu`: StoreDemoDriver opens a menu through this (object = "friend" / "profile").
enum FamilyActionMenuDemo { static let open = Notification.Name("FamilyActionMenuDemo.open") }
#endif
