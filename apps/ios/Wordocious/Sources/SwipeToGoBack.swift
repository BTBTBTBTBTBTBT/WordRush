import SwiftUI

/// Left-edge "swipe back" gesture for puzzle screens, matching how the web app
/// (and the system) lets you go back by swiping the thumb from the left edge to
/// the right.
///
/// Why this exists:
/// - `fullScreenCover` games (GameScreen / ProperNoundle / SolvedPuzzle) have NO
///   interactive dismiss at all — this adds one.
/// - Pushed screens with `.navigationBarBackButtonHidden(true)` lose the system
///   edge-swipe — this restores an equivalent.
///
/// It uses `simultaneousGesture` (not `gesture`) so it never steals taps from the
/// on-screen keyboard, tiles, or the corner Home button: a tap has ~0 translation
/// and so fails the thresholds below. Only a real left-edge rightward drag fires.
struct SwipeToGoBack: ViewModifier {
    let action: () -> Void

    func body(content: Content) -> some View {
        content.simultaneousGesture(
            DragGesture(minimumDistance: 20, coordinateSpace: .global)
                .onEnded { value in
                    // Started near the left edge, moved clearly rightward, and was
                    // mostly horizontal (so vertical scrolls / keyboard swipes don't trigger).
                    if value.startLocation.x < 24,
                       value.translation.width > 90,
                       abs(value.translation.height) < 60 {
                        action()
                    }
                }
        )
    }
}

extension View {
    /// Attach a left-edge swipe-to-go-back gesture. Pass the dismiss action
    /// (usually `dismiss()`), e.g. `.swipeToGoBack { dismiss() }`.
    func swipeToGoBack(_ action: @escaping () -> Void) -> some View {
        modifier(SwipeToGoBack(action: action))
    }
}
