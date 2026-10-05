import XCTest
@testable import WordociousCore

/// 2026-10-05: a guest ("Play without an account") was dropped back on the sign-in screen
/// whenever iOS killed the backgrounded app, because guest mode lived only in memory.
/// It is now persisted and restored at launch; these pin the restore rule and the gate.
/// Same cases: Android GuestPersistenceTest.
final class GuestPersistenceTests: XCTestCase {
    func testStoredGuestChoiceComesBackOnColdLaunch() {
        XCTAssertTrue(AuthSessionPolicy.restoresGuest(storedGuestFlag: true, hadSignedInSession: false))
    }

    func testNoStoredGuestChoiceMeansSignIn() {
        XCTAssertFalse(AuthSessionPolicy.restoresGuest(storedGuestFlag: false, hadSignedInSession: false))
    }

    func testSignedInSessionOutranksStaleGuestFlag() {
        XCTAssertFalse(AuthSessionPolicy.restoresGuest(storedGuestFlag: true, hadSignedInSession: true))
    }

    func testRestoredGuestReachesShellBeforeAuthFinishesLoading() {
        // Cold launch: auth still loading, no previous session, guest restored synchronously.
        XCTAssertTrue(AuthSessionPolicy.showsApp(isAuthenticated: false, isGuest: true, isLoading: true, hadSession: false))
        // ...and after it finishes with no session.
        XCTAssertTrue(AuthSessionPolicy.showsApp(isAuthenticated: false, isGuest: true, isLoading: false, hadSession: false))
    }

    func testSignedOutNonGuestSeesSignIn() {
        XCTAssertFalse(AuthSessionPolicy.showsApp(isAuthenticated: false, isGuest: false, isLoading: false, hadSession: false))
        // While loading with no previous session the gate shows the loader, not the shell.
        XCTAssertFalse(AuthSessionPolicy.showsApp(isAuthenticated: false, isGuest: false, isLoading: true, hadSession: false))
    }

    func testReturningSignedInPlayerPaintsShellWhileSessionRestores() {
        XCTAssertTrue(AuthSessionPolicy.showsApp(isAuthenticated: false, isGuest: false, isLoading: true, hadSession: true))
        XCTAssertTrue(AuthSessionPolicy.showsApp(isAuthenticated: true, isGuest: false, isLoading: false, hadSession: true))
    }
}
