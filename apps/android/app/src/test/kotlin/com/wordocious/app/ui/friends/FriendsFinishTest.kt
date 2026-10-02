package com.wordocious.app.ui.friends

import com.wordocious.app.data.FriendsService
import com.wordocious.app.ui.CastPoses
import com.wordocious.app.ui.MascotId
import com.wordocious.app.ui.gameMomentParts
import com.wordocious.app.ui.gameMomentText
import com.wordocious.app.ui.momentPose
import com.wordocious.app.ui.momentPoses
import com.wordocious.core.FRIENDLY_KINDS
import com.wordocious.core.FriendlyKind
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test
import androidx.compose.ui.graphics.toArgb

/** The Friends finishing pass (FINISH_SPEC C4, K1, A7): poses, notices, the on-now line, moment parts. */
class FriendsFinishTest {
    private fun ev(type: String, me: Boolean = false, kind: String? = null, otherId: String? = null, score: String? = null) =
        FriendsService.FeedEvent(
            id = "e-$type-$kind-$me-$otherId", userId = if (me) "me" else "doug", username = if (me) "me" else "Doug",
            me = me, day = "2026-10-02", type = type, kind = kind, gameTitle = "Tic-Tac-Tile",
            otherName = if (me) "Doug" else "Kate", otherId = otherId, score = score,
        )

    @Test fun momentPosesFitTheEvent() {
        assertEquals(MascotId.O2 to "gasp", momentPose(ev("game", otherId = "me"), "me"))
        assertEquals(MascotId.W to "proud", momentPose(ev("game", me = true, otherId = "doug"), "me"))
        assertEquals(MascotId.U to "lotus", momentPose(ev("game", kind = "draw"), "me"))
        assertEquals(MascotId.O3 to "laugh", momentPose(ev("game", otherId = "kate"), "me"))
        assertEquals(MascotId.S to "slide", momentPose(ev("sweep"), "me"))
        assertEquals(MascotId.S to "flex", momentPose(ev("medal", kind = "streak_7"), "me"))
    }

    @Test fun everyPoseUsedIsDrawnAndNeverTheBannerHost() {
        val types = listOf("game", "flawless", "more_flawless", "sweep", "more_sweep", "gift", "record", "medal")
        val poses = types.flatMap { t ->
            listOf(momentPose(ev(t, otherId = "me"), "me"), momentPose(ev(t, me = true), "me"), momentPose(ev(t, kind = "draw"), "me"))
        } + listOf("Challenge sent to Doug ⚔️", "Nudged 2 friends 🔔", "Request sent 🤝", "${FRIENDS_SHIELD_NOTE}Shield sent").mapNotNull { noticeStyle(it).pose }
        poses.forEach { (id, pose) ->
            assertNotNull("missing art_pose_${id}_$pose", CastPoses.res(id, pose))
            // A7: O1 hosts the Friends banner, so no secondary spot uses O1.
            assertNotEquals(MascotId.O1, id)
        }
    }

    @Test fun eachPoseAppearsOnceDownTheList() {
        val list = listOf(ev("sweep"), ev("sweep"), ev("record"), ev("sweep"))
        val poses = momentPoses(list, "me")
        assertEquals(MascotId.S to "slide", poses[0])
        assertNull(poses[1])
        assertEquals(MascotId.D to "eureka", poses[2])
        assertNull(poses[3])
    }

    @Test fun gameMomentSplitsTheScore() {
        val e = ev("game", score = "2–1")
        assertEquals("Doug beat Kate at Tic-Tac-Tile" to "2–1", gameMomentParts(e))
        assertEquals("Doug beat Kate at Tic-Tac-Tile (2–1)", gameMomentText(e))
        assertEquals("Doug beat Kate at Tic-Tac-Tile by resignation", gameMomentText(ev("game", score = "by resignation")))
        assertEquals("Doug and Kate drew at Tic-Tac-Tile" to null, gameMomentParts(ev("game", kind = "draw", score = "1–1")))
    }

    @Test fun onNowLineNamesTheFreshestFriend() {
        val doug = FriendsService.FriendProfile(id = "d", username = "Doug", activity = "Gauntlet")
        val kate = FriendsService.FriendProfile(id = "k", username = "Kate")
        assertEquals("Doug is in Gauntlet", onNowLine(listOf(doug)))
        assertEquals("Kate is on now · +1 more", onNowLine(listOf(kate, doug)))
        assertEquals("", onNowLine(emptyList()))
    }

    @Test fun pocketGameCardsWearTheMockupColors() {
        assertEquals(6, FRIENDLY_KINDS.size)
        assertEquals(0xFFF97316.toInt(), FriendlyKind.RPS.color.toArgb())
        assertEquals(0xFF10B981.toInt(), FriendlyKind.CHAIN.color.toArgb())
    }
}
