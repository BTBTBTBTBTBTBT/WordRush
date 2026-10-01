import SwiftUI

/// Daily ⇄ Unlimited play mode (Pro-only). Ports the web PlayMode type. The
/// switch itself lives in the home banner's strip (HomeBannerView, home redesign
/// 2026-10-01); the old pill and the Daily Challenge / Unlimited heroes are gone.
enum PlayMode: String { case daily, unlimited }
