import SwiftUI
#if canImport(UIKit)
import UIKit
#endif

// Physical keyboard input (founder, 2026-09-30). A tester ran the iPhone build
// on an Apple Silicon Mac ("Designed for iPhone") and typing did nothing — only
// the on-screen keys worked, while the web board takes typing. Deployment
// target is iOS 16, so SwiftUI's `.onKeyPress` (iOS 17) is out; instead a
// zero-size UIKit view becomes first responder while a board is on screen and
// reads `pressesBegan`. Same path for Mac, iPad and Bluetooth keyboards.
//
// Mirrors apps/web/lib/keyboard.ts `isTypingTarget`: it never takes first
// responder from a real text input (username edit, search…), and ignores keys
// while anything is presented over its screen (sheet, alert, share sheet) or
// while the caller says the board is inert (finished, overlay up). Keys the
// handler doesn't use — and anything with ⌘/⌃/⌥ except ⌘Z — pass up the
// responder chain untouched, so system shortcuts keep working.

/// One hardware keystroke, already normalized (letters uppercased).
enum HardwareKey: Equatable {
    case letter(String)   // "A"…"Z"
    case digit(Int)       // 0…9 (top row or keypad)
    case enter, delete, tab, backTab, space, escape
    case up, down, left, right
    case undo             // ⌘Z / ⌃Z

    /// The on-screen letter this key stands for, if any.
    var letter: String? { if case .letter(let l) = self { return l }; return nil }

    #if canImport(UIKit)
    init?(_ key: UIKey) {
        let flags = key.modifierFlags
        let mods = flags.intersection([.command, .control, .alternate])
        let chars = key.charactersIgnoringModifiers
        if !mods.isEmpty {
            // Web: (metaKey || ctrlKey) + z = undo in Letter Ladder and Sudocious.
            if (mods == .command || mods == .control), !flags.contains(.shift), chars.lowercased() == "z" { self = .undo; return }
            return nil
        }
        switch key.keyCode {
        case .keyboardReturnOrEnter, .keypadEnter: self = .enter; return
        case .keyboardDeleteOrBackspace, .keyboardDeleteForward: self = .delete; return
        case .keyboardTab: self = flags.contains(.shift) ? .backTab : .tab; return
        case .keyboardSpacebar: self = .space; return
        case .keyboardEscape: self = .escape; return
        case .keyboardUpArrow: self = .up; return
        case .keyboardDownArrow: self = .down; return
        case .keyboardLeftArrow: self = .left; return
        case .keyboardRightArrow: self = .right; return
        default: break
        }
        guard chars.count == 1, let ch = chars.uppercased().first, ch.isASCII else { return nil }
        if ch.isLetter { self = .letter(String(ch)); return }
        if let d = ch.wholeNumberValue { self = .digit(d); return }
        return nil
    }
    #endif
}

// MARK: - SwiftUI surface

private struct HardwareKeyboardEnabledKey: EnvironmentKey { static let defaultValue = true }

extension EnvironmentValues {
    /// False anywhere below a view that turned hardware keys off (overlay up,
    /// game finished). ANDed down the tree — a child can't switch it back on.
    var hardwareKeyboardEnabled: Bool {
        get { self[HardwareKeyboardEnabledKey.self] }
        set { self[HardwareKeyboardEnabledKey.self] = newValue }
    }
}

extension View {
    /// Route physical keyboard presses to `perform` while this view is on
    /// screen and `enabled`. Return true when the key was used; false passes it on.
    func hardwareKeyboard(enabled: Bool = true, perform: @escaping (HardwareKey) -> Bool) -> some View {
        modifier(HardwareKeyboardModifier(enabled: enabled, perform: perform))
    }

    /// Turn off every `hardwareKeyboard` handler below (e.g. while a victory
    /// overlay or stage transition covers the board).
    func hardwareKeyboardEnabled(_ on: Bool) -> some View {
        transformEnvironment(\.hardwareKeyboardEnabled) { $0 = $0 && on }
    }
}

private struct HardwareKeyboardModifier: ViewModifier {
    @Environment(\.hardwareKeyboardEnabled) private var envEnabled
    let enabled: Bool
    let perform: (HardwareKey) -> Bool

    func body(content: Content) -> some View {
        #if canImport(UIKit)
        content.background(
            HardwareKeyCatcher(isActive: enabled && envEnabled, onKey: perform)
                .frame(width: 0, height: 0)
                .accessibilityHidden(true)
        )
        #else
        content
        #endif
    }
}

#if canImport(UIKit)
private struct HardwareKeyCatcher: UIViewRepresentable {
    var isActive: Bool
    var onKey: (HardwareKey) -> Bool

    func makeUIView(context: Context) -> KeyCaptureView {
        let v = KeyCaptureView()
        v.onKey = onKey
        v.isActive = isActive
        return v
    }

    func updateUIView(_ v: KeyCaptureView, context: Context) {
        v.onKey = onKey
        v.isActive = isActive
        if isActive { v.claimSoon() }
    }

    static func dismantleUIView(_ v: KeyCaptureView, coordinator: ()) {
        v.isActive = false
    }
}

/// Zero-size, invisible to accessibility, no text input (so it never raises
/// the software keyboard). Holds first responder only while active, frontmost
/// and nothing text-editable has it.
final class KeyCaptureView: UIView {
    var onKey: ((HardwareKey) -> Bool)?
    var isActive = false {
        didSet {
            guard oldValue != isActive else { return }
            if isActive { claimSoon() } else if isFirstResponder { resignFirstResponder() }
        }
    }
    private var handled = Set<UIPress>()
    private var observers: [NSObjectProtocol] = []
    private var timer: Timer?

    override init(frame: CGRect) {
        super.init(frame: frame)
        backgroundColor = .clear
        isAccessibilityElement = false
        accessibilityElementsHidden = true
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    deinit {
        timer?.invalidate()
        observers.forEach(NotificationCenter.default.removeObserver)
    }

    override var canBecomeFirstResponder: Bool { isActive }

    override func didMoveToWindow() {
        super.didMoveToWindow()
        if window != nil { startWatching(); claimSoon() } else { stopWatching() }
    }

    func claimSoon() {
        DispatchQueue.main.async { [weak self] in self?.claim() }
    }

    /// Take first responder unless something else legitimately owns the keys.
    private func claim() {
        guard isActive, !isFirstResponder, let window, window.isKeyWindow, isFrontmost, isVisible else { return }
        if let current = UIResponder.wordoCurrentFirstResponder, current !== self,
           current is UITextInput || current is UIKeyInput { return }
        becomeFirstResponder()
    }

    /// Our screen is the top of the presentation stack (no sheet, alert,
    /// share sheet or ad over it).
    private var isFrontmost: Bool {
        guard var top = window?.rootViewController else { return false }
        while let p = top.presentedViewController, !p.isBeingDismissed { top = p }
        guard let v = top.viewIfLoaded else { return false }
        return isDescendant(of: v)
    }

    private var isVisible: Bool {
        var v: UIView? = self
        while let x = v {
            if x.isHidden || x.alpha < 0.01 { return false }
            v = x.superview
        }
        return true
    }

    private func startWatching() {
        guard observers.isEmpty else { return }
        let nc = NotificationCenter.default
        let names: [Notification.Name] = [
            UITextField.textDidEndEditingNotification,
            UITextView.textDidEndEditingNotification,
            UIResponder.keyboardDidHideNotification,
            UIWindow.didBecomeKeyNotification,
            UIApplication.didBecomeActiveNotification,
        ]
        observers = names.map { nc.addObserver(forName: $0, object: nil, queue: .main) { [weak self] _ in self?.claimSoon() } }
        // Safety net for hand-offs that post nothing (a sheet or alert
        // dismissing, a SwiftUI focus change). The guards make it a no-op
        // whenever a text field or a presented screen should keep the keys.
        let t = Timer(timeInterval: 1.0, repeats: true) { [weak self] _ in self?.claim() }
        RunLoop.main.add(t, forMode: .common)
        timer = t
    }

    private func stopWatching() {
        timer?.invalidate(); timer = nil
        observers.forEach(NotificationCenter.default.removeObserver)
        observers = []
        handled.removeAll()
    }

    // MARK: Presses — handled ones stop here; everything else goes up the chain.

    override func pressesBegan(_ presses: Set<UIPress>, with event: UIPressesEvent?) {
        var rest = Set<UIPress>()
        let live = isActive && isFrontmost && isVisible
        for press in presses {
            if live, let key = press.key, let hk = HardwareKey(key), onKey?(hk) == true {
                handled.insert(press)
            } else {
                rest.insert(press)
            }
        }
        if !rest.isEmpty { super.pressesBegan(rest, with: event) }
    }

    override func pressesChanged(_ presses: Set<UIPress>, with event: UIPressesEvent?) {
        let rest = presses.subtracting(handled)
        if !rest.isEmpty { super.pressesChanged(rest, with: event) }
    }

    override func pressesEnded(_ presses: Set<UIPress>, with event: UIPressesEvent?) {
        let rest = presses.subtracting(handled)
        handled.subtract(presses)
        if !rest.isEmpty { super.pressesEnded(rest, with: event) }
    }

    override func pressesCancelled(_ presses: Set<UIPress>, with event: UIPressesEvent?) {
        let rest = presses.subtracting(handled)
        handled.subtract(presses)
        if !rest.isEmpty { super.pressesCancelled(rest, with: event) }
    }
}

private extension UIResponder {
    private static weak var wordoFound: UIResponder?

    /// The app's current first responder (nil-targeted action trick).
    static var wordoCurrentFirstResponder: UIResponder? {
        wordoFound = nil
        UIApplication.shared.sendAction(#selector(wordoCaptureFirstResponder), to: nil, from: nil, for: nil)
        return wordoFound
    }

    @objc func wordoCaptureFirstResponder() { UIResponder.wordoFound = self }
}
#endif
