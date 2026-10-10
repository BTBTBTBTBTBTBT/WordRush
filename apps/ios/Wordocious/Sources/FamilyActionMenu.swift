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
    // Founder 10-09 ("hideous, needs to match the aesthetic"): the sheet follows the season. Off season it is the
    // picker's lavender; under a dark season (Halloween) it is the season's night glass with light ink, like the cards.
    static var night: Bool { FriendsInk.dark }
    static var sheet: Color { night ? (FriendsInk.nightCard ?? Color(hex: 0x1C0F30)) : Color(hex: 0xF4F0FF) }
    static let purple = Color(hex: 0x7C3AED)
    static let pink = Color(hex: 0xDB2777)
    static let amber = Color(hex: 0xD97706)
    static let teal = Color(hex: 0x0D9488)
    /// The family danger tint (the same pink as a confirming Remove friend).
    static let danger = pink
    static var heading: Color { night ? FriendsInk.heading : Color(hex: 0x3B1F6E) }
    static var sub: Color { night ? FriendsInk.rowSub : Color(hex: 0x7A6A95) }
    /// Founder 10-09: the actions sit two across as candy tiles (not a tall list); danger rows are one quiet line under them.
    static let tileHeight: CGFloat = 44
    static let dangerHeight: CGFloat = 40
    static let rowGap: CGFloat = 10

    /// The sheet height for a header + this menu's tiles and danger lines (grabber, header, grid, bottom air).
    /// A menu whose choices are sentences (React's quick notes) lists them one per row as speech bubbles, whole.
    static func isNotes(_ m: FamilyActionMenuModel) -> Bool { m.notes }
    static let noteHeight: CGFloat = 54

    static func height(_ m: FamilyActionMenuModel) -> CGFloat {
        if isNotes(m) {
            let n = CGFloat(m.actions.count)
            return min(13 + 14 + 48 + 14 + n * noteHeight + max(0, n - 1) * rowGap + 24, 760)
        }
        let plain = m.actions.filter { !$0.danger }.count
        let danger = m.actions.count - plain
        let rows = (plain + 1) / 2
        var h: CGFloat = 13 + 14 + 48 + 14
        h += CGFloat(rows) * tileHeight + CGFloat(max(0, rows - 1)) * rowGap
        if danger > 0 { h += 6 + CGFloat(danger) * dangerHeight }
        return h + 16
    }
}

/// The menu's content: who it's about + the rows.
struct FamilyActionMenuModel {
    let title: String
    var subtitle: String? = nil
    var avatar: AnyView? = nil
    let actions: [FamilyMenuAction]
    /// Founder 10-09: a person's menu draws their name in the bubble lettering, in their own color (their backdrop).
    var titleColor: Color? = nil
    /// The choices are sentences (React's quick notes, Report reasons): one per row as speech bubbles, whole.
    var notes: Bool = false
}

struct FamilyActionMenu: View {
    let model: FamilyActionMenuModel
    let pick: (FamilyMenuAction) -> Void
    let close: () -> Void

    var body: some View {
        let plain = model.actions.filter { !$0.danger }
        let danger = model.actions.filter(\.danger)
        VStack(spacing: 14) {
            Capsule().fill(FriendsInk.pink.wash(0.35)).frame(width: 40, height: 5).padding(.top, 8)
                .accessibilityHidden(true)
            HStack(spacing: 12) {
                if let avatar = model.avatar { avatar }
                VStack(alignment: .leading, spacing: 2) {
                    // Founder 10-09 ("no more plain text anywhere"): every menu title in the bubble lettering — a person's
                    // menu in their own color, the rest in the brand purple.
                    BubbleTextView(text: model.title.uppercased(), palette: .accent(model.titleColor ?? Color(hex: 0x8B5CF6)),
                                   maxSize: 26, minSize: 15, animated: false, alignment: .leading)
                    if let s = model.subtitle {
                        Text(s).font(Brand.font(12, .heavy)).foregroundStyle(FamilyMenuInk.sub).lineLimit(1)
                    }
                }
                .accessibilityElement(children: .combine)
                .accessibilityAddTraits(.isHeader)
                Spacer(minLength: 8)
                FamilyCloseButton(size: 28, label: "Close menu", action: close)
            }
            .frame(height: 48)
            VStack(spacing: 6) {
                if FamilyMenuInk.isNotes(model) {
                    ScrollView(showsIndicators: false) {
                        VStack(spacing: FamilyMenuInk.rowGap) { ForEach(plain) { a in note(a) } }
                            .padding(.bottom, 8)
                    }
                } else {
                // Two across; an odd last one takes the whole row (never a lone half-width button).
                VStack(spacing: FamilyMenuInk.rowGap) {
                    ForEach(Array(stride(from: 0, to: plain.count, by: 2)), id: \.self) { i in
                        HStack(spacing: FamilyMenuInk.rowGap) {
                            tile(plain[i])
                            if i + 1 < plain.count { tile(plain[i + 1]) }
                        }
                    }
                }
                }
                ForEach(danger) { a in dangerLine(a) }
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 16)
        .environment(\.colorScheme, FamilyMenuInk.night ? .dark : .light)
    }

    @ViewBuilder private func coin(_ a: FamilyMenuAction, tint: Color, ink: Color, size: CGFloat) -> some View {
        ZStack {
            FamilyPillSkin(fill: FamilyInk.helperFill(tint, dark: false, pressed: false), height: size)
                .frame(width: size, height: size)
            switch a.icon {
            case .clay(let name):
                if let ui = FamilyArt.shared.image("art-fam-ic-\(name)") {
                    Image(uiImage: ui).resizable().interpolation(.high).aspectRatio(contentMode: .fit)
                        .frame(width: size * 0.55, height: size * 0.55).colorMultiply(ink)
                }
            case .art(let name):
                Image(name).resizable().interpolation(.high).aspectRatio(contentMode: .fit)
                    .frame(width: size * 0.7, height: size * 0.7)
            case .symbol(let symbol):
                FamilyIcon(symbol: symbol, size: size * 0.55, ink: ink)
            }
        }
        .accessibilityHidden(true)
    }

    /// Founder 10-09 ("why do these still look so ugly"): each action is the family candy button (the ADD A FRIEND look) in
    /// its own color, two across, with its icon in white clay or full-color art. No boxes.
    private func tile(_ a: FamilyMenuAction) -> some View {
        Button { pick(a) } label: {
            CandyLabel(title: a.title) {
                switch a.icon {
                case .clay(let name):
                    if let ui = FamilyArt.shared.image("art-fam-ic-\(name)") {
                        Image(uiImage: ui).resizable().interpolation(.high).aspectRatio(contentMode: .fit)
                            .frame(width: 16, height: 16)
                    }
                case .art(let name):
                    Image(name).resizable().interpolation(.high).aspectRatio(contentMode: .fit)
                        .frame(width: 20, height: 20)
                case .symbol(let symbol):
                    Image(systemName: symbol).font(.system(size: 13, weight: .black)).foregroundStyle(.white)
                }
            }
        }
        .buttonStyle(CastButtonStyle(color: YourBoardPill.castColor(for: a.tint), size: .medium, fullWidth: true))
        .environment(\.castCapScale, 0.82)
        .disabled(a.disabled)
        .accessibilityLabel(a.accessibility ?? a.title)
    }

    /// A quick note as a speech bubble from you: the whole sentence (two lines at most), its icon in a candy coin, a little
    /// tail on the left. Tap sends it.
    private func note(_ a: FamilyMenuAction) -> some View {
        let ink = FamilyInk.helperInk(a.tint, dark: false)
        let shape = RoundedRectangle(cornerRadius: 20, style: .continuous)
        return Button { pick(a) } label: {
            HStack(spacing: 10) {
                coin(a, tint: a.tint, ink: ink, size: 32)
                Text(a.title).font(Brand.font(14.5, .black))
                    .foregroundStyle(FamilyMenuInk.night ? Color.white : FamilyMenuInk.heading)
                    .multilineTextAlignment(.leading)
                    .lineLimit(2).minimumScaleFactor(0.85)
                    .fixedSize(horizontal: false, vertical: true)
                Spacer(minLength: 0)
                Image(systemName: "paperplane.fill").font(.system(size: 13, weight: .black))
                    .foregroundStyle(a.tint.opacity(FamilyMenuInk.night ? 0.9 : 0.7))
            }
            .padding(.leading, 10).padding(.trailing, 14)
            .frame(height: FamilyMenuInk.noteHeight)
            .background(
                shape.fill(LinearGradient(colors: FamilyMenuInk.night
                                            ? [a.tint.opacity(0.42), a.tint.opacity(0.26)]
                                            : [Color.white, a.tint.opacity(0.10).mixed(over: .white, 0.9)],
                                          startPoint: .top, endPoint: .bottom))
                    .overlay(alignment: .bottomLeading) {
                        BubbleTail().fill(FamilyMenuInk.night ? a.tint.opacity(0.26) : Color.white)
                            .frame(width: 14, height: 10).offset(x: 18, y: 8)
                    }
            )
            .shadow(color: a.tint.opacity(0.25), radius: 6, y: 3)
            .padding(.bottom, 6)
            .contentShape(shape)
        }
        .buttonStyle(.squishCard)
        .disabled(a.disabled)
        .accessibilityLabel(a.accessibility ?? a.title)
    }

    /// Unfriend / Remove: one quiet centered line in the danger pink under the tiles (never a big red row).
    private func dangerLine(_ a: FamilyMenuAction) -> some View {
        let ink = FamilyInk.helperInk(FamilyMenuInk.danger, dark: false)
        return Button { pick(a) } label: {
            HStack(spacing: 7) {
                coin(a, tint: FamilyMenuInk.danger, ink: ink, size: 26)
                Text(a.title).font(Brand.font(14, .black))
                    .foregroundStyle(FamilyMenuInk.night ? Color(hex: 0xF9A8D4) : ink)
                    .lineLimit(1)
            }
            .frame(maxWidth: .infinity)
            .frame(height: FamilyMenuInk.dangerHeight)
            .contentShape(Rectangle())
        }
        .buttonStyle(.squishCard)
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
            .presentationDetents([.height(FamilyMenuInk.height(m))])
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

/// The speech bubble's little tail (a soft triangle pointing down-left).
private struct BubbleTail: Shape {
    func path(in r: CGRect) -> Path {
        var p = Path()
        p.move(to: CGPoint(x: r.minX, y: r.minY))
        p.addLine(to: CGPoint(x: r.maxX, y: r.minY))
        p.addQuadCurve(to: CGPoint(x: r.minX + 1, y: r.maxY), control: CGPoint(x: r.midX + 1, y: r.midY))
        p.closeSubpath()
        return p
    }
}

// MARK: - The family confirm (founder 10-09: "none should look like this" — no system alerts or action sheets)

/// A short yes/no (or just OK) in the family look: the soft sheet, the question in the bubble lettering, the line under it,
/// then the candy confirm beside a quiet cancel. Danger confirms (Unfriend, Delete Forever) take the pink candy.
struct FamilyConfirm: View {
    let title: String
    let message: String
    let confirm: String
    let danger: Bool
    /// nil = a notice with one button (the confirm).
    let cancel: String?
    let onConfirm: () -> Void
    let onCancel: () -> Void

    static func height(message: String) -> CGFloat { 250 + (message.count > 90 ? 40 : 0) }

    var body: some View {
        VStack(spacing: 14) {
            Capsule().fill(FriendsInk.pink.wash(0.35)).frame(width: 40, height: 5).padding(.top, 8)
                .accessibilityHidden(true)
            BubbleTextView(text: title.uppercased(), palette: .accent(danger ? Color(hex: 0xEC4899) : Color(hex: 0x8B5CF6)),
                           maxSize: 28, minSize: 16, animated: false)
                .padding(.horizontal, 8)
            Text(message).font(Brand.font(14.5, .bold)).foregroundStyle(FamilyMenuInk.sub)
                .multilineTextAlignment(.center).fixedSize(horizontal: false, vertical: true)
                .padding(.horizontal, 12)
            HStack(spacing: 10) {
                if let cancel {
                    Button(action: onCancel) { CandyLabel(title: cancel) }
                        .buttonStyle(QuietButtonStyle(size: .medium, fullWidth: true))
                }
                Button(action: onConfirm) { CandyLabel(title: confirm) }
                    .buttonStyle(CastButtonStyle(color: danger ? .pink : .purple, size: .medium, fullWidth: true))
            }
            .padding(.top, 4)
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 18)
        .environment(\.colorScheme, FamilyMenuInk.night ? .dark : .light)
    }
}

private struct FamilyConfirmModifier: ViewModifier {
    @Binding var isPresented: Bool
    let title: String
    let message: String
    let confirm: String
    let danger: Bool
    let cancel: String?
    let action: () -> Void

    func body(content: Content) -> some View {
        content.softSheet(isPresented: $isPresented) {
            // The action runs at the tap (it reads its target before the binding clears it); follow-ups are async.
            FamilyConfirm(title: title, message: message, confirm: confirm, danger: danger, cancel: cancel,
                          onConfirm: { action(); isPresented = false },
                          onCancel: { isPresented = false })
                .background(FamilyMenuInk.sheet.ignoresSafeArea())
                .presentationDetents([.height(FamilyConfirm.height(message: message))])
                .presentationDragIndicator(.hidden)
                .modifier(FamilyMenuSheetChrome())
        }
    }
}

extension View {
    /// The family yes/no sheet (replaces `.alert` / `.confirmationDialog`). `cancel` nil = a one-button notice.
    func familyConfirm(_ title: String, isPresented: Binding<Bool>, message: String, confirm: String = "OK",
                       danger: Bool = false, cancel: String? = "Cancel", action: @escaping () -> Void = {}) -> some View {
        modifier(FamilyConfirmModifier(isPresented: isPresented, title: title, message: message, confirm: confirm,
                                       danger: danger, cancel: cancel, action: action))
    }

    /// A one-button notice ("Notifications are off", "Couldn't delete account").
    func familyNotice(_ title: String, isPresented: Binding<Bool>, message: String) -> some View {
        familyConfirm(title, isPresented: isPresented, message: message, confirm: "OK", cancel: nil)
    }
}
