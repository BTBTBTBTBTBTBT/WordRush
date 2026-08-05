import XCTest
@testable import WordociousCore

/// Mirrors packages/core/src/username.test.ts (and the Kotlin ProfanityTest) —
/// the same accept/reject cases on all three platforms, so the ports can't
/// drift from the TS module or the SQL trigger silently.
final class ProfanityParityTests: XCTestCase {

    func testAcceptsOrdinaryNames() {
        for n in ["Brian", "Word_Master", "player.one", "A1b2", "Wordocious4821"] {
            XCTAssertNil(Profanity.usernameError(n), "\(n) should be allowed")
        }
    }

    func testRejectsShape() {
        XCTAssertNotNil(Profanity.usernameError("ab"))
        XCTAssertNotNil(Profanity.usernameError(String(repeating: "a", count: 21)))
        XCTAssertNotNil(Profanity.usernameError("..."))
    }

    func testRejectsEveryBlockedTermOnItsOwn() {
        for term in Profanity.blockedSubstrings {
            XCTAssertNotNil(Profanity.usernameError(term), "\(term) should be rejected")
        }
    }

    func testRejectsLeetAndSeparatorEvasions() {
        for n in ["n1gg3r", "f-u-c-k", "C U N T", "p0rn", "N4ZI", "BigD1ck69"] {
            XCTAssertNotNil(Profanity.usernameError(n), "\(n) should be rejected")
        }
    }

    func testRejectsTheIncidentNameAndFamily() {
        for n in ["DamnDickCockBallsAss", "damndickcockballsass", "xXPenisXx", "C-o-c-k_Lord"] {
            XCTAssertNotNil(Profanity.usernameError(n), "\(n) should be rejected")
        }
    }

    func testTier2TokensRejectedOnlyAsWholeTokens() {
        for n in ["Ass_Master", "Big Balls", "DamnGoodPlayer", "Tit.For.Tat", "PissBoy"] {
            XCTAssertNotNil(Profanity.usernameError(n), "\(n) should be rejected")
        }
        for n in ["Cassidy", "Titanic", "Sassy_Sue", "Bassett", "Assisi_Pilgrim"] {
            XCTAssertNil(Profanity.usernameError(n), "\(n) should be allowed")
        }
    }

    func testScunthorpeProblem() {
        for n in ["Cassandra", "Michelle", "Scunthorpe", "Shitake", "Analyst", "Cockburn",
                  "Penistone", "Titan", "Dickens", "Hitchcock", "Peacock42", "Swank",
                  "TitanFall", "Bass Player", "MassEffect"] {
            XCTAssertNil(Profanity.usernameError(n), "\(n) should be allowed")
        }
        // An allowlisted word must not shield a real term.
        XCTAssertNotNil(Profanity.usernameError("ScunthorpeCunt"))
        XCTAssertNil(Profanity.usernameError("Scunthorpe_Fan"))
    }

    func testPNGuessScreening() {
        XCTAssertTrue(Profanity.pnGuessBlocked(guess: "penispenisp", answer: "taylorswift"))
        XCTAssertTrue(Profanity.pnGuessBlocked(guess: "fuckfuckfuc", answer: "taylorswift"))
        for g in ["taylorswift", "harrystyles", "masseffect", "jurassicpark"] {
            XCTAssertFalse(Profanity.pnGuessBlocked(guess: g, answer: "taylorswift"), "\(g) should be allowed")
        }
        // Answers that trip the scan themselves (Ice Spice contains SPIC)
        // disable screening for that puzzle — the answer must be typeable.
        XCTAssertTrue(Profanity.containsBlockedTerm("icespice"))
        XCTAssertFalse(Profanity.pnGuessBlocked(guess: "icespice", answer: "icespice"))
        XCTAssertFalse(Profanity.pnGuessBlocked(guess: "acespace", answer: "icespice"))
    }

    func testNormalizeCollapsesAndUndoesLeet() {
        XCTAssertEqual(Profanity.normalize("n1iiggg3r"), Profanity.normalize("niger"))
        XCTAssertEqual(Profanity.normalize("f.u.c.k"), "FUCK")
    }
}
