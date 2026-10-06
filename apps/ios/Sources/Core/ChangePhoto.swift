import Foundation

/// Change Photo on Edit Profile's Stage (cloud prompt 07, 2026-10-06): players couldn't replace or remove a
/// photo once one existed. 1:1 port of packages/core/src/change-photo.ts (Android: core/ChangePhoto.kt), so
/// all three show the same button, open the same menu and land on the same SHOW choice.
public enum ChangePhoto {
    public enum Row: String, Equatable { case camera, library, remove }
    public enum Result { case uploaded, removed }

    /// "My photo" is what SHOW reads only when the player picked it AND has a photo.
    public static func showsPhoto(display: String?, hasPhoto: Bool) -> Bool {
        display == "photo" && hasPhoto
    }

    /// The quiet "Change photo" button under SHOW, and the Stage's photo being tappable: only while the photo shows.
    public static func showsChangePhoto(display: String?, hasPhoto: Bool) -> Bool {
        showsPhoto(display: display, hasPhoto: hasPhoto)
    }

    /// Picking a SHOW option. "My photo" with no photo yet keeps the current look (display nil) and opens the
    /// Change Photo menu instead; anything else just switches.
    public static func pickShow(_ choice: String, hasPhoto: Bool) -> (display: String?, openMenu: Bool) {
        if choice == "photo" && !hasPhoto { return (nil, true) }
        return (choice, false)
    }

    /// The menu's rows, in order: Take photo (a camera exists), Choose from library, Remove photo (one is set).
    public static func rows(hasCamera: Bool, hasPhoto: Bool) -> [Row] {
        var rows: [Row] = []
        if hasCamera { rows.append(.camera) }
        rows.append(.library)
        if hasPhoto { rows.append(.remove) }
        return rows
    }

    /// SHOW after a menu result: a new photo shows; a removed photo falls back to the mascot.
    public static func displayAfter(_ result: Result) -> String {
        result == .uploaded ? "photo" : "mascot"
    }
}
