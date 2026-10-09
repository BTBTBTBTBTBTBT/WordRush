package com.wordocious.core

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.longOrNull
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** Parity guard for the Friends tab cards (packages/core/src/friend-cards.ts, friend-cards-fixtures.json). */
class FriendCardsFixtureTest {
    private val root: JsonObject by lazy {
        Json.parseToJsonElement(javaClass.classLoader!!.getResource("fixtures/friend-cards-fixtures.json")!!.readText()).jsonObject
    }

    private fun JsonElement?.strOrNull(): String? = (this as? JsonPrimitive)?.takeIf { this !is JsonNull }?.contentOrNull

    private fun friend(o: JsonObject) = CardFriend(
        id = o["id"].strOrNull()!!,
        username = o["username"].strOrNull()!!,
        online = o["online"]!!.jsonPrimitive.boolean,
        activity = o["activity"].strOrNull(),
        lastSeenMs = (o["lastSeenMs"] as? JsonPrimitive)?.takeIf { it !is JsonNull }?.longOrNull,
    )

    private fun game(o: JsonObject) = CardGame(
        id = o["id"].strOrNull()!!,
        kind = FriendlyKind.from(o["kind"].strOrNull())!!,
        opponentId = o["opponentId"].strOrNull()!!,
        opponentName = o["opponentName"].strOrNull()!!,
        me = Side.from(o["me"].strOrNull())!!,
        state = decodeFriendlyState(o["state"])!!,
        yourTurn = o["yourTurn"]!!.jsonPrimitive.boolean,
        updatedAt = o["updatedAt"].strOrNull()!!,
    )

    private fun tilesOf(el: JsonElement?): List<GameTile> = el!!.jsonArray.map {
        val t = it.jsonObject
        GameTile(t["gameId"].strOrNull()!!, FriendlyKind.from(t["kind"].strOrNull())!!, t["word"].strOrNull()!!, t["yourTurn"]!!.jsonPrimitive.boolean)
    }

    @Test
    fun tile_words_match() {
        val tiles = root["tiles"]!!.jsonArray
        assertTrue(tiles.isNotEmpty())
        for (c in tiles) {
            val o = c.jsonObject
            val kind = FriendlyKind.from(o["kind"].strOrNull())!!
            val state = decodeFriendlyState(o["state"])!!
            val me = Side.from(o["me"].strOrNull())!!
            assertEquals("tile $o", o["word"].strOrNull(), FriendCards.tileWord(kind, state, me, o["yourTurn"]!!.jsonPrimitive.boolean))
        }
    }

    @Test
    fun layouts_match() {
        val layouts = root["layouts"]!!.jsonArray
        assertTrue(layouts.isNotEmpty())
        for (c in layouts) {
            val o = c.jsonObject
            val friends = o["friends"]!!.jsonArray.map { friend(it.jsonObject) }
            val games = o["games"]!!.jsonArray.map { game(it.jsonObject) }
            val got = FriendCards.friendsLayout(friends, games)
            val want = o["layout"]!!.jsonObject
            val wantCards = want["cards"]!!.jsonArray
            assertEquals("cards ${o["name"]}", wantCards.size, got.cards.size)
            wantCards.forEachIndexed { i, wc ->
                val w = wc.jsonObject
                val g = got.cards[i]
                assertEquals("friendId ${o["name"]}", w["friendId"].strOrNull(), g.friendId)
                assertEquals("name ${o["name"]}", w["name"].strOrNull(), g.name)
                assertEquals("online ${o["name"]}", w["online"]!!.jsonPrimitive.boolean, g.online)
                assertEquals("presence ${o["name"]}", w["presence"].strOrNull(), g.presence)
                assertEquals("waiting ${o["name"]}", w["waiting"]!!.jsonPrimitive.int, g.waiting)
                assertEquals("headline ${o["name"]}", w["headline"].strOrNull(), g.headline)
                assertEquals("tiles ${o["name"]}", tilesOf(w["tiles"]), g.tiles)
                assertEquals("theirTurn ${o["name"]}", tilesOf(w["theirTurn"]), g.theirTurn)
                assertEquals("line ${o["name"]}", w["theirTurnLine"].strOrNull(), g.theirTurnLine)
            }
            assertEquals("rest ${o["name"]}", want["rest"]!!.jsonArray.map { it.jsonPrimitive.content }, got.rest)
        }
    }

    @Test
    fun words_match() {
        val words = root["words"]!!.jsonObject
        for (c in words["waiting"]!!.jsonArray) {
            val o = c.jsonObject
            assertEquals(o["text"].strOrNull(), FriendCards.waitingHeadline(o["n"]!!.jsonPrimitive.int))
        }
        for (c in words["theirTurn"]!!.jsonArray) {
            val o = c.jsonObject
            assertEquals(o["text"].strOrNull(), FriendCards.theirTurnLine(o["n"]!!.jsonPrimitive.int, o["name"].strOrNull()!!))
        }
        for (c in words["presence"]!!.jsonArray) {
            val o = c.jsonObject
            assertEquals(o["text"].strOrNull(), FriendCards.cardPresence(o["online"]!!.jsonPrimitive.boolean, o["activity"].strOrNull()))
        }
        for (c in words["all"]!!.jsonArray) {
            val o = c.jsonObject
            assertEquals(o["text"].strOrNull(), FriendCards.allFriendsLabel(o["n"]!!.jsonPrimitive.int))
        }
    }
}
