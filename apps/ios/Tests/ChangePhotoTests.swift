import XCTest
@testable import WordociousCore

/// Cloud prompt 07: the Change Photo rules (mirrors packages/core/src/change-photo.test.ts).
final class ChangePhotoTests: XCTestCase {
    func testShowReadsPhotoOnlyWhenPickedAndPresent() {
        XCTAssertTrue(ChangePhoto.showsPhoto(display: "photo", hasPhoto: true))
        XCTAssertFalse(ChangePhoto.showsPhoto(display: "photo", hasPhoto: false))
        XCTAssertFalse(ChangePhoto.showsPhoto(display: "mascot", hasPhoto: true))
        XCTAssertFalse(ChangePhoto.showsPhoto(display: nil, hasPhoto: true))
    }

    func testButtonShowsOnlyWhilePhotoShows() {
        XCTAssertTrue(ChangePhoto.showsChangePhoto(display: "photo", hasPhoto: true))
        XCTAssertFalse(ChangePhoto.showsChangePhoto(display: "photo", hasPhoto: false))
        XCTAssertFalse(ChangePhoto.showsChangePhoto(display: "mascot", hasPhoto: true))
        XCTAssertFalse(ChangePhoto.showsChangePhoto(display: "mascot", hasPhoto: false))
    }

    func testMyPhotoWithoutPhotoOpensMenu() {
        let none = ChangePhoto.pickShow("photo", hasPhoto: false)
        XCTAssertNil(none.display); XCTAssertTrue(none.openMenu)
        let has = ChangePhoto.pickShow("photo", hasPhoto: true)
        XCTAssertEqual(has.display, "photo"); XCTAssertFalse(has.openMenu)
        let mascot = ChangePhoto.pickShow("mascot", hasPhoto: false)
        XCTAssertEqual(mascot.display, "mascot"); XCTAssertFalse(mascot.openMenu)
    }

    func testMenuRows() {
        XCTAssertEqual(ChangePhoto.rows(hasCamera: true, hasPhoto: true), [.camera, .library, .remove])
        XCTAssertEqual(ChangePhoto.rows(hasCamera: true, hasPhoto: false), [.camera, .library])
        XCTAssertEqual(ChangePhoto.rows(hasCamera: false, hasPhoto: true), [.library, .remove])
        XCTAssertEqual(ChangePhoto.rows(hasCamera: false, hasPhoto: false), [.library])
    }

    func testRemoveFallsBackToMascot() {
        XCTAssertEqual(ChangePhoto.displayAfter(.uploaded), "photo")
        XCTAssertEqual(ChangePhoto.displayAfter(.removed), "mascot")
    }
}
